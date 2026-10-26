#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const isWin = process.platform === "win32";

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: "inherit",
    shell: isWin,
    env: process.env,
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

console.log("\n=== SignalCheck install ===\n");

if (!fs.existsSync(path.join(root, ".env")) && fs.existsSync(path.join(root, ".env.example"))) {
  fs.copyFileSync(path.join(root, ".env.example"), path.join(root, ".env"));
  console.log("Created .env from .env.example");
}

console.log("[1/2] Installing web packages...");
run(isWin ? "pnpm.cmd" : "pnpm", ["install"]);

console.log("\n[2/2] Installing API packages...");
run(process.execPath, [path.join(root, "scripts", "run-api.mjs"), "setup"]);

console.log("\n=== Install complete ===");
console.log(isWin ? "Next: start.cmd" : "Next: ./start.sh  (or pnpm start)");
console.log("Then open http://127.0.0.1:43123\n");
