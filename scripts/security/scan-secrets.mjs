import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const files = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard"], { encoding: "utf8" })
  .split(/\r?\n/)
  .filter(Boolean)
  .filter((file) => !file.endsWith("package-lock.json"));

const patterns = [
  ["private-key", /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ["anthropic-key", /sk-ant-[A-Za-z0-9_-]{20,}/],
  ["openai-key", /sk-(?:proj-)?[A-Za-z0-9_-]{30,}/],
  ["github-token", /gh[opusr]_[A-Za-z0-9]{30,}/],
  ["supabase-service-role", /SUPABASE_SERVICE_ROLE_KEY\s*=\s*(?!["']?test-)[^\s#][^\r\n]{40,}/],
  ["companion-hmac", /COMPANION_HMAC_KEY\s*=\s*(?!["']?test-)[^\s#][^\r\n]{40,}/],
];

const findings = [];
for (const file of files) {
  let content;
  try {
    content = readFileSync(file, "utf8");
  } catch {
    continue;
  }
  for (const [name, pattern] of patterns) {
    if (pattern.test(content)) findings.push(`${file}: possible ${name}`);
  }
}

if (findings.length) {
  process.stderr.write(`Potential committed secrets detected:\n${findings.join("\n")}\n`);
  process.exit(1);
}
process.stdout.write(`Secret scan clean across ${files.length} tracked files.\n`);
