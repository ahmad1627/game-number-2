import { spawn } from "node:child_process";

console.log("\x1b[36m%s\x1b[0m", "Starting Fantasy XI Full-Stack (Backend + Vite Frontend)...");

const backend = spawn("node", ["backend/server.js"], {
  stdio: "inherit",
  shell: true,
});

const frontend = spawn("npx", ["vite", "--host", "0.0.0.0"], {
  stdio: "inherit",
  shell: true,
});

function cleanup() {
  try { backend.kill(); } catch {}
  try { frontend.kill(); } catch {}
  process.exit();
}

process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);
