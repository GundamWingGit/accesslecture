/** Side-effect import: load .env.local before any server module reads config. */
import { existsSync, readFileSync } from "fs";
import { join } from "path";

const p = join(process.cwd(), ".env.local");
if (!existsSync(p)) {
  console.error("Missing .env.local — run from frontend/ (cwd must be frontend).");
  process.exit(1);
}
const content = readFileSync(p, "utf8");
for (const line of content.split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eq = trimmed.indexOf("=");
  if (eq <= 0) continue;
  const key = trimmed.slice(0, eq).trim();
  let val = trimmed.slice(eq + 1).trim();
  if (
    (val.startsWith('"') && val.endsWith('"')) ||
    (val.startsWith("'") && val.endsWith("'"))
  ) {
    val = val.slice(1, -1);
  }
  if (!(key in process.env) || process.env[key] === "") {
    process.env[key] = val;
  }
}
