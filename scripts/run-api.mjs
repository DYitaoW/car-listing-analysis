#!/usr/bin/env node
/**
 * Cross-platform API setup/start.
 * Prefers `uv` when installed; otherwise uses a local .venv + pip + requirements.txt.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const apiDir = path.join(root, "apps", "api");
const mode = process.argv[2] === "setup" ? "setup" : "dev";
const isWin = process.platform === "win32";

function run(command, args, opts = {}) {
  const result = spawnSync(command, args, {
    cwd: apiDir,
    stdio: "inherit",
    shell: isWin,
    env: process.env,
    ...opts,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function which(bin) {
  const probe = isWin ? "where" : "which";
  const result = spawnSync(probe, [bin], { encoding: "utf8", shell: isWin });
  return result.status === 0;
}

function pythonCandidates() {
  if (isWin) return ["py -3.12", "py -3", "python"];
  return ["python3.12", "python3", "python"];
}

function resolvePython() {
  for (const candidate of pythonCandidates()) {
    const parts = candidate.split(" ");
    const result = spawnSync(parts[0], [...parts.slice(1), "--version"], {
      encoding: "utf8",
      shell: isWin,
    });
    if (result.status === 0) return parts;
  }
  console.error(
    "Python 3.12+ was not found. Install it from https://www.python.org/downloads/ then re-run.",
  );
  process.exit(1);
}

function venvPython() {
  return isWin
    ? path.join(apiDir, ".venv", "Scripts", "python.exe")
    : path.join(apiDir, ".venv", "bin", "python");
}

function ensurePipEnv() {
  const py = venvPython();
  if (!fs.existsSync(py)) {
    const base = resolvePython();
    console.log("Creating apps/api/.venv …");
    run(base[0], [...base.slice(1), "-m", "venv", ".venv"]);
  }
  const pipPython = venvPython();
  console.log("Installing apps/api/requirements.txt …");
  run(pipPython, ["-m", "pip", "install", "-U", "pip"]);
  run(pipPython, ["-m", "pip", "install", "-r", "requirements.txt"]);
  run(pipPython, ["-m", "pip", "install", "-e", "."]);
  return pipPython;
}

function startWith(pythonBin, extraArgs = []) {
  const args = [
    "-m",
    "uvicorn",
    "listing_validator_api.main:app",
    "--reload",
    "--host",
    "0.0.0.0",
    "--port",
    "43124",
    ...extraArgs,
  ];
  if (typeof pythonBin === "string") {
    run(pythonBin, args);
  } else {
    run(pythonBin[0], [...pythonBin.slice(1), ...args]);
  }
}

process.chdir(apiDir);

if (which("uv")) {
  if (mode === "setup" || !fs.existsSync(path.join(apiDir, ".venv"))) {
    console.log("Using uv to sync apps/api …");
    run("uv", ["sync"]);
  }
  if (mode === "setup") {
    console.log("API dependencies are ready (uv).");
    process.exit(0);
  }
  run("uv", [
    "run",
    "uvicorn",
    "listing_validator_api.main:app",
    "--reload",
    "--host",
    "0.0.0.0",
    "--port",
    "43124",
  ]);
} else {
  console.log("uv not found — falling back to pip + apps/api/requirements.txt");
  const py = ensurePipEnv();
  if (mode === "setup") {
    console.log("API dependencies are ready (pip).");
    process.exit(0);
  }
  startWith(py);
}
