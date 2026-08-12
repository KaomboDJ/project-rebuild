import { readFileSync } from "node:fs";

const sarifPath = process.argv[2];
if (!sarifPath) throw new Error("SARIF path is required");

const sarif = JSON.parse(readFileSync(sarifPath, "utf8"));
const blocked = [];

for (const run of sarif.runs ?? []) {
  const severities = new Map(
    (run.tool?.driver?.rules ?? []).map((rule) => [
      rule.id,
      Number(rule.properties?.["security-severity"] ?? 0),
    ]),
  );
  for (const result of run.results ?? []) {
    const severity = severities.get(result.ruleId) ?? 0;
    if (severity < 7) continue;
    const location = result.locations?.[0]?.physicalLocation;
    blocked.push({
      ruleId: result.ruleId,
      severity,
      message: result.message?.text ?? "CodeQL security finding",
      file: location?.artifactLocation?.uri ?? "unknown",
      line: location?.region?.startLine ?? null,
    });
  }
}

if (blocked.length) {
  process.stderr.write(`High/critical CodeQL findings:\n${JSON.stringify(blocked, null, 2)}\n`);
  process.exit(1);
}

process.stdout.write("CodeQL SARIF contains no high/critical security findings.\n");
