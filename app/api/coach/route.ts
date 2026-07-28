import { NextRequest, NextResponse } from "next/server";
import { getCoachProvider, type CoachContext } from "@/lib/ai/provider";

const MAX_MESSAGE_LENGTH = 1000;

function isValidContext(context: unknown): context is CoachContext {
  if (!context || typeof context !== "object") return false;
  const candidate = context as Partial<CoachContext>;
  return (
    !!candidate.profile &&
    typeof candidate.profile === "object" &&
    !!candidate.checkIn &&
    typeof candidate.checkIn === "object" &&
    typeof candidate.state === "string" &&
    Array.isArray(candidate.instances)
  );
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const { message, context } = (body ?? {}) as { message?: unknown; context?: unknown };

  if (typeof message !== "string" || message.trim().length === 0) {
    return NextResponse.json({ error: "message_required" }, { status: 400 });
  }
  if (message.length > MAX_MESSAGE_LENGTH) {
    return NextResponse.json({ error: "message_too_long" }, { status: 400 });
  }
  if (!isValidContext(context)) {
    return NextResponse.json({ error: "context_invalid" }, { status: 400 });
  }

  try {
    const provider = getCoachProvider();
    const reply = await provider.respond(context, message.trim());
    return NextResponse.json({ reply });
  } catch (error) {
    console.error("coach_provider_error", error);
    return NextResponse.json({ error: "coach_unavailable" }, { status: 502 });
  }
}
