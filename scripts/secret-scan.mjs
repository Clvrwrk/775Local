#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { secretKinds } from "./secret-scan-lib.mjs";

const output = execFileSync(
  "git",
  ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
  { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 },
);
const findings = [];
for (const path of output.split("\0").filter(Boolean)) {
  let content;
  try {
    content = readFileSync(path, "utf8");
  } catch {
    continue;
  }
  for (const kind of secretKinds(content)) findings.push({ path, kind });
}

if (findings.length > 0) {
  for (const finding of findings) console.error(`${finding.path}: possible ${finding.kind}`);
  process.exitCode = 1;
} else {
  console.log("Secret scan passed.");
}
