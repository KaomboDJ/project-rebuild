import { z } from "zod";
import { HEALTH_METRICS, HEALTH_PROVIDERS } from "./types";

const metadataValue = z.union([z.string().max(300), z.number().finite(), z.boolean(), z.null()]);

export const healthObservationSchema = z
  .object({
    metric: z.enum(HEALTH_METRICS),
    value: z.number().finite(),
    unit: z.string().trim().min(1).max(30),
    recordedAt: z.iso.datetime({ offset: true }),
    externalRecordId: z.string().trim().min(1).max(300),
    originName: z.string().trim().min(1).max(120).optional(),
    deviceName: z.string().trim().min(1).max(120).optional(),
    metadata: z.record(z.string().max(60), metadataValue).optional(),
  })
  .superRefine((value, context) => {
    const recorded = Date.parse(value.recordedAt);
    const now = Date.now();
    if (recorded > now + 5 * 60_000) {
      context.addIssue({ code: "custom", path: ["recordedAt"], message: "future-observation" });
    }
    if (recorded < now - 5 * 365.25 * 86_400_000) {
      context.addIssue({ code: "custom", path: ["recordedAt"], message: "observation-too-old" });
    }
    if (value.metadata && Object.keys(value.metadata).length > 20) {
      context.addIssue({ code: "custom", path: ["metadata"], message: "metadata-too-large" });
    }
  });

export const healthImportSchema = z.object({
  sourceId: z.uuid(),
  observations: z.array(healthObservationSchema).min(1).max(500),
});

export const healthSourceSchema = z.object({
  sourceKey: z.string().trim().min(1).max(200),
  provider: z.enum(HEALTH_PROVIDERS),
  label: z.string().trim().min(1).max(120),
  deviceName: z.string().trim().min(1).max(120).nullable().optional(),
  authorizedMetrics: z.array(z.enum(HEALTH_METRICS)).min(1).max(HEALTH_METRICS.length),
});

