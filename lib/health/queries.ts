import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/supabase/database.types";
import { deriveBmi, normalizeHealthObservation } from "./normalize";
import type { HealthMetric, HealthProvider, HealthSummary, IncomingHealthObservation } from "./types";

type Supabase = SupabaseClient<Database>;
type HealthSourceRow = Database["public"]["Tables"]["health_sources"]["Row"];
type HealthObservationRow = Database["public"]["Tables"]["health_observations"]["Row"];

export async function listHealthSources(supabase: Supabase, userId: string): Promise<HealthSourceRow[]> {
  const { data, error } = await supabase
    .from("health_sources")
    .select("*")
    .eq("user_id", userId)
    .order("created_at");
  if (error) throw new Error(`health-sources-load-failed:${error.message}`);
  return data ?? [];
}

export async function upsertHealthSource(
  supabase: Supabase,
  userId: string,
  input: {
    sourceKey: string;
    provider: HealthProvider;
    label: string;
    deviceName?: string | null;
    authorizedMetrics: HealthMetric[];
  }
): Promise<HealthSourceRow> {
  const { data, error } = await supabase
    .from("health_sources")
    .upsert(
      {
        user_id: userId,
        source_key: input.sourceKey,
        provider: input.provider,
        label: input.label,
        device_name: input.deviceName ?? null,
        authorized_metrics: input.authorizedMetrics,
        status: "active",
        last_error_code: null,
      },
      { onConflict: "user_id,source_key" }
    )
    .select("*")
    .single();
  if (error) throw new Error(`health-source-save-failed:${error.message}`);
  return data;
}

export async function setHealthSourceCoaching(
  supabase: Supabase,
  userId: string,
  sourceId: string,
  enabled: boolean
): Promise<void> {
  const { error } = await supabase
    .from("health_sources")
    .update({ use_for_coaching: enabled })
    .eq("id", sourceId)
    .eq("user_id", userId);
  if (error) throw new Error(`health-source-update-failed:${error.message}`);
}

export async function deleteHealthSource(
  supabase: Supabase,
  userId: string,
  sourceId: string
): Promise<void> {
  const { error } = await supabase.from("health_sources").delete().eq("id", sourceId).eq("user_id", userId);
  if (error) throw new Error(`health-source-delete-failed:${error.message}`);
}

export async function importHealthObservations(
  supabase: Supabase,
  userId: string,
  sourceId: string,
  incoming: IncomingHealthObservation[]
): Promise<{ read: number; imported: number }> {
  const { data: source, error: sourceError } = await supabase
    .from("health_sources")
    .select("id,authorized_metrics,status")
    .eq("id", sourceId)
    .eq("user_id", userId)
    .maybeSingle();
  if (sourceError || !source) throw new Error("health-source-not-found");
  // A previous transient sync error must be retryable. `disconnected` is
  // the only non-readable state; successful import returns an errored
  // source to active below.
  if (source.status === "disconnected") throw new Error("health-source-not-active");

  const normalized = incoming.map(normalizeHealthObservation);
  const allowed = new Set(source.authorized_metrics);
  if (allowed.size > 0 && normalized.some((item) => !allowed.has(item.metric))) {
    throw new Error("health-metric-not-authorized");
  }

  const startedAt = new Date().toISOString();
  const { data: run, error: runError } = await supabase
    .from("health_sync_runs")
    .insert({
      user_id: userId,
      health_source_id: sourceId,
      status: "running",
      records_read: incoming.length,
      started_at: startedAt,
    })
    .select("id")
    .single();
  if (runError) throw new Error(`health-sync-start-failed:${runError.message}`);

  try {
    const rows: Database["public"]["Tables"]["health_observations"]["Insert"][] = normalized.map((item) => ({
      user_id: userId,
      health_source_id: sourceId,
      metric: item.metric,
      value: item.value,
      unit: item.unit,
      recorded_at: item.recordedAt,
      external_record_id: item.externalRecordId,
      origin_name: item.originName ?? null,
      device_name: item.deviceName ?? null,
      metadata: (item.metadata ?? {}) as Json,
    }));

    const { data, error } = await supabase
      .from("health_observations")
      .upsert(rows, { onConflict: "health_source_id,external_record_id", ignoreDuplicates: true })
      .select("id");
    if (error) throw error;

    const finishedAt = new Date().toISOString();
    const imported = data?.length ?? 0;
    await Promise.all([
      supabase.from("health_sync_runs").update({ status: "completed", records_imported: imported, finished_at: finishedAt }).eq("id", run.id),
      supabase.from("health_sources").update({ last_sync_at: finishedAt, last_error_code: null, status: "active" }).eq("id", sourceId).eq("user_id", userId),
    ]);
    return { read: incoming.length, imported };
  } catch (error) {
    // Never persist raw database/provider errors: they can contain schema,
    // query or upstream payload details. The caller gets a stable code while
    // the original exception remains in-process only.
    const errorCode = "observation-write-failed";
    await Promise.all([
      supabase.from("health_sync_runs").update({ status: "failed", error_code: errorCode, finished_at: new Date().toISOString() }).eq("id", run.id).eq("user_id", userId),
      supabase.from("health_sources").update({ status: "error", last_error_code: errorCode }).eq("id", sourceId).eq("user_id", userId),
    ]);
    throw error;
  }
}

function aggregateDailyMax(rows: HealthObservationRow[], metric: HealthMetric, sinceMs: number): number | null {
  const perSourceDay = new Map<string, number>();
  for (const row of rows) {
    if (row.metric !== metric || Date.parse(row.recorded_at) < sinceMs) continue;
    const day = row.recorded_at.slice(0, 10);
    const key = `${row.health_source_id}:${day}`;
    perSourceDay.set(key, (perSourceDay.get(key) ?? 0) + Number(row.value));
  }
  const perDay = new Map<string, number>();
  for (const [sourceDay, value] of perSourceDay) {
    const day = sourceDay.slice(sourceDay.lastIndexOf(":") + 1);
    perDay.set(day, Math.max(perDay.get(day) ?? 0, value));
  }
  if (perDay.size === 0) return null;
  const total = [...perDay.values()].reduce((sum, value) => sum + value, 0);
  return metric === "workout_minutes" ? Math.round(total) : Math.round(total / perDay.size);
}

export async function getHealthSummary(
  supabase: Supabase,
  userId: string,
  options: { coachingOnly?: boolean } = {}
): Promise<HealthSummary> {
  let sourceQuery = supabase.from("health_sources").select("*").eq("user_id", userId).eq("status", "active");
  if (options.coachingOnly) sourceQuery = sourceQuery.eq("use_for_coaching", true);
  const { data: sources, error: sourcesError } = await sourceQuery;
  if (sourcesError) throw new Error(`health-sources-load-failed:${sourcesError.message}`);
  if (!sources?.length) {
    return { latest: {}, bmi: null, sevenDay: { averageSteps: null, averageSleepMinutes: null, totalWorkoutMinutes: null }, sourceCount: 0, lastSyncedAt: null };
  }

  const sourceIds = sources.map((source) => source.id);
  const { data: rows, error } = await supabase
    .from("health_observations")
    .select("*")
    .eq("user_id", userId)
    .in("health_source_id", sourceIds)
    .order("recorded_at", { ascending: false })
    .limit(5000);
  if (error) throw new Error(`health-observations-load-failed:${error.message}`);

  const sourceLabels = new Map(sources.map((source) => [source.id, source.label]));
  const latest: HealthSummary["latest"] = {};
  for (const row of rows ?? []) {
    if (latest[row.metric]) continue;
    latest[row.metric] = {
      value: Number(row.value),
      unit: row.unit,
      recordedAt: row.recorded_at,
      sourceLabel: sourceLabels.get(row.health_source_id) ?? "Fonte ligada",
    };
  }

  const weight = latest.weight_kg;
  const height = latest.height_cm;
  const now = Date.now();
  return {
    latest,
    bmi: weight && height
      ? { value: deriveBmi(weight.value, height.value)!, weightRecordedAt: weight.recordedAt, heightRecordedAt: height.recordedAt }
      : null,
    sevenDay: {
      averageSteps: aggregateDailyMax(rows ?? [], "steps_count", now - 7 * 86_400_000),
      averageSleepMinutes: aggregateDailyMax(rows ?? [], "sleep_minutes", now - 7 * 86_400_000),
      totalWorkoutMinutes: aggregateDailyMax(rows ?? [], "workout_minutes", now - 7 * 86_400_000),
    },
    sourceCount: sources.length,
    lastSyncedAt: sources.map((source) => source.last_sync_at).filter((value): value is string => !!value).sort().at(-1) ?? null,
  };
}
