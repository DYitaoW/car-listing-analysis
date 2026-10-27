#!/usr/bin/env node
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const isWin = process.platform === "win32";
const children = [];

function spawnInherit(command, args) {
  const child = spawn(command, args, {
    cwd: root,
    stdio: "inherit",
    shell: isWin,
    env: process.env,
  });
  children.push(child);
  return child;
}

function shutdown() {
  for (const child of children) {
    if (!child.killed) child.kill("SIGTERM");
  }
}

process.on("SIGINT", () => {
  shutdown();
  process.exit(0);
});
process.on("SIGTERM", () => {
  shutdown();
  process.exit(0);
});

if (!fs.existsSync(path.join(root, "node_modules"))) {
  console.log("Dependencies missing — running install first...");
  const setup = spawn(process.execPath, [path.join(root, "scripts", "install-app.mjs")], {
    cwd: root,
    stdio: "inherit",
    shell: isWin,
    env: process.env,
  });
  setup.on("exit", (code) => {
    if (code !== 0) process.exit(code ?? 1);
    begin();
  });
} else {
  begin();
}

function begin() {
  console.log("\nStarting SignalCheck...");
  console.log("  API  -> http://127.0.0.1:43124");
  console.log("  Web  -> http://127.0.0.1:43123");
  console.log("\nPress Ctrl+C to stop.\n");

  spawnInherit(process.execPath, [path.join(root, "scripts", "run-api.mjs")]);
  spawnInherit(isWin ? "pnpm.cmd" : "pnpm", ["dev:web"]);
}
