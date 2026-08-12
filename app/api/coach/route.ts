import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createToolRuntime, getCoachProvider, type ChatTurn, type CoachContext } from "@/lib/ai/provider";
import { executeReadOnlyTool } from "@/lib/coach/tools";
import { buildPantrySummary } from "@/lib/coach/pantry-context";
import { inferDayType } from "@/lib/coach/day-type";
import { appendMessage, createConversation, getConversationMessages } from "@/lib/coach/conversations";
import { getFounderNow } from "@/lib/date/founder-now";
import { listGeneralFounderNotes } from "@/lib/decision-engine/queries";
import { instantToLocalWallClockIso } from "@/lib/date/timezone";
import { DEFAULT_PROFILE } from "@/lib/decision-engine/context-builder";
import { getSleepPhase, resolveSleepSchedule } from "@/lib/sleep/schedule";
import { getHealthSummary } from "@/lib/health/queries";

const MAX_MESSAGE_LENGTH = 1000;
const HISTORY_TURNS = 16;

const bodySchema = z.object({
  message: z.string().trim().min(1).max(MAX_MESSAGE_LENGTH),
  conversationId: z.string().uuid().optional(),
});

/**
 * Rebuilt for the Coach UX + Pantry Intelligence milestone: this route used
 * to trust a `context` object the client assembled from its own Supabase
 * reads (see the old CoachDrawer). Context is now built server-side from
 * the authenticated session instead - the client only sends the message
 * text and, optionally, which conversation it belongs to. This is what
 * makes persistence (coach_conversations/coach_messages) and pantry/day-type
 * context (which the client has no reason to fetch itself) possible without
 * duplicating reads on both sides.
 */
export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "supabase-not-configured" }, { status: 503 });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid-body" }, { status: 400 });
  }
  const { message, conversationId: requestedConversationId } = parsed.data;

  const [{ data: profile }, { date, timezone, now }] = await Promise.all([
    supabase.from("profiles").select("desired_identity, current_constraints, timezone, target_sleep_time, target_wake_time, weekend_sleep_time, weekend_wake_time, wind_down_minutes, sleep_schedule_type").eq("user_id", user.id).maybeSingle(),
    getFounderNow(supabase, user.id),
  ]);
  const effectiveTimezone = profile?.timezone || timezone || DEFAULT_PROFILE.timezone;
  const sleepSchedule = resolveSleepSchedule(date, {
    targetSleepTime: profile?.target_sleep_time || DEFAULT_PROFILE.targetSleepTime,
    targetWakeTime: profile?.target_wake_time || DEFAULT_PROFILE.targetWakeTime,
    weekendSleepTime: profile?.weekend_sleep_time ?? DEFAULT_PROFILE.weekendSleepTime,
    weekendWakeTime: profile?.weekend_wake_time ?? DEFAULT_PROFILE.weekendWakeTime,
    windDownMinutes: profile?.wind_down_minutes || DEFAULT_PROFILE.windDownMinutes,
    sleepScheduleType: profile?.sleep_schedule_type || DEFAULT_PROFILE.sleepScheduleType,
  });
  const localTime = now.slice(11, 16);

  const [{ data: checkIn }, { data: decisions }, pantry, dayType, founderNotes, healthSummary] = await Promise.all([
    supabase.from("daily_check_ins").select("sleep_quality, energy_level, stress_level").eq("user_id", user.id).eq("date", date).maybeSingle(),
    supabase.from("decisions").select("title, status, recommended_start, recommended_end, timing_type, trigger_label").eq("user_id", user.id).eq("date", date),
    buildPantrySummary(supabase, user.id),
    inferDayType(supabase, user.id, date),
    listGeneralFounderNotes(supabase, user.id).catch(() => []),
    getHealthSummary(supabase, user.id, { coachingOnly: true }).catch(() => null),
  ]);

  const context: CoachContext = {
    identity: profile?.desired_identity ?? "",
    constraints: profile?.current_constraints ?? "",
    checkIn: checkIn
      ? { sleepQuality: checkIn.sleep_quality ?? 3, energyLevel: checkIn.energy_level ?? 3, stressLevel: checkIn.stress_level ?? 3 }
      : null,
    decisions: (decisions ?? []).map((decision) => ({
      title: decision.title,
      status: decision.status,
      timingType: decision.timing_type,
      timeLabel: decision.recommended_start
        ? `${instantToLocalWallClockIso(new Date(decision.recommended_start), effectiveTimezone).slice(11, 16)}${
            decision.recommended_end
              ? `–${instantToLocalWallClockIso(new Date(decision.recommended_end), effectiveTimezone).slice(11, 16)}`
              : ""
          }`
        : decision.trigger_label ?? null,
    })),
    pantry,
    dayType,
    founderNotes,
    healthSummary: healthSummary ?? undefined,
    sleepSchedule: {
      currentTime: localTime,
      ...sleepSchedule,
      phase: getSleepPhase(localTime, sleepSchedule),
    },
  };

  let conversationId = requestedConversationId;
  let history: ChatTurn[] = [];

  if (conversationId) {
    try {
      const priorMessages = await getConversationMessages(supabase, user.id, conversationId);
      if (priorMessages.length === 0) {
        // Either a stale/foreign id or a brand-new conversation the client
        // pre-generated - either way, RLS already prevents reading another
        // user's rows, so this just means "start fresh under this id" is
        // not possible; create a real one instead.
        conversationId = undefined;
      } else {
        history = priorMessages.slice(-HISTORY_TURNS).map((m) => ({ role: m.role, content: m.content }));
      }
    } catch {
      conversationId = undefined;
    }
  }

  if (!conversationId) {
    try {
      conversationId = await createConversation(supabase, user.id, message);
    } catch {
      return NextResponse.json({ error: "conversation-create-failed" }, { status: 500 });
    }
  }

  await appendMessage(supabase, user.id, conversationId, { role: "user", content: message });

  try {
    const provider = getCoachProvider();
    const toolRuntime = createToolRuntime((name, args) => executeReadOnlyTool(supabase, user.id, name, args));
    const { text, toolCalls } = await provider.respond(context, message, history, toolRuntime);

    const assistantMessage = await appendMessage(supabase, user.id, conversationId, {
      role: "assistant",
      content: text,
      toolCalls,
    });

    return NextResponse.json({
      conversationId,
      messageId: assistantMessage.id,
      reply: text,
      toolCalls,
    });
  } catch (error) {
    console.error("coach_provider_error", error);
    return NextResponse.json({ error: "coach_unavailable", conversationId }, { status: 502 });
  }
}
