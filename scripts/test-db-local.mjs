import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
// Deliberately no hosted URL, credentials, reset or provider operations.
const container = process.argv[2];
if (!/^local775-claims-test(?:-[a-z0-9]+)?$/.test(container ?? ""))
  throw Error("explicit disposable container required");
const run = (sql) =>
  execFileSync(
    "docker",
    [
      "exec",
      "-i",
      container,
      "psql",
      "-U",
      "postgres",
      "-d",
      "local775_claims",
      "-v",
      "ON_ERROR_STOP=1",
      "-At",
    ],
    { input: sql, encoding: "utf8", maxBuffer: 16 * 1024 * 1024 },
  );
if (process.argv.includes("--migrate")) {
  run(
    "create schema if not exists extensions; create schema if not exists auth; create or replace function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$; grant usage on schema auth to anon,authenticated,service_role; grant execute on function auth.jwt() to anon,authenticated,service_role;",
  );
  for (const file of readdirSync("supabase/migrations")
    .filter((x) => x.endsWith(".sql"))
    .sort()) {
    run(readFileSync(`supabase/migrations/${file}`, "utf8"));
    console.log(`Applied ${file}`);
  }
}
run("grant usage on schema extensions to anon,authenticated,service_role");
let assertions = 0;
for (const file of readdirSync("supabase/tests")
  .filter((x) => x.endsWith(".sql"))
  .sort()) {
  const out = run(readFileSync(`supabase/tests/${file}`, "utf8"));
  const failed = out.split("\n").filter((x) => /^not ok|^# (?:Looks like|Failed)/.test(x));
  assertions += out.split("\n").filter((x) => /^ok \d+/.test(x)).length;
  console.log(`${file}: ${failed.length ? "FAIL" : "PASS"}`);
  if (failed.length) {
    console.log(out);
    process.exitCode = 1;
  }
}
console.log(`${assertions} pgTAP assertions passed`);
