import assert from "node:assert/strict";
import { execFileSync, execFile } from "node:child_process";
import { promisify } from "node:util";
const container = process.argv[2];
if (!/^local775-claims-test(?:-[a-z0-9]+)?$/.test(container ?? ""))
  throw Error("explicit disposable container required");
const config = JSON.parse(execFileSync("docker", ["inspect", container], { encoding: "utf8" }))[0];
assert.equal(config.HostConfig.NetworkMode, "none");
assert.equal(config.Mounts.length, 0);
const args = [
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
  "-Atq",
];
const run = (sql) => execFileSync("docker", args, { input: sql, encoding: "utf8" }).trim();
const execute = promisify(execFile);
const parallel = (sql) => execute("docker", [...args, "-c", sql]);
const actor = "e1000000-0000-4000-8000-000000000001";
run(`insert into app.actors(id,workos_user_id) values('${actor}','profile_concurrent');`);
const identity =
  "select set_config('request.jwt.claims','{\"sub\":\"profile_concurrent\"}',false);set role authenticated;";
const same =
  identity +
  'select public.save_my_profile(\'{"displayName":"Synthetic Neighbor","city":"reno","bio":""}\',0,\'profile-concurrent-same\');';
const replay = await Promise.allSettled([parallel(same), parallel(same)]);
assert.equal(replay.filter((x) => x.status === "fulfilled").length, 2);
assert.equal(run(`select version from app.person_profiles where actor_id='${actor}';`), "1");
assert.equal(
  run(
    `select count(*) from app.audit_events where actor_id='${actor}' and action='person_profile.saved';`,
  ),
  "1",
);
const rival = (name, key) =>
  identity +
  `select public.save_my_profile('{"displayName":"${name}","city":"reno","bio":""}',1,'${key}');`;
const competing = await Promise.allSettled([
  parallel(rival("Synthetic First", "profile-rival-first")),
  parallel(rival("Synthetic Second", "profile-rival-second")),
]);
assert.equal(competing.filter((x) => x.status === "fulfilled").length, 1);
assert.match(competing.find((x) => x.status === "rejected").reason.stderr, /profile_changed/);
assert.equal(run(`select version from app.person_profiles where actor_id='${actor}';`), "2");
console.log(
  "PASS: concurrent identical saves create one revision/audit; competing writers preserve one update and reject the stale writer.",
);
// All synthetic rows remain only inside this disposable container until cleanup.
