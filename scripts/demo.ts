#!/usr/bin/env tsx
import { spawn } from "node:child_process";
import { platform } from "node:os";

const baseUrl = process.env.APP_BASE_URL?.replace(/\/$/, "") || "http://localhost:3000";
const manualEndpoint = `${baseUrl}/api/manual/check-weather`;

function run(command: string, args: string[]) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit", env: process.env });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${command} ${args.join(" ")} exited with code ${code}`));
      }
    });
  });
}

async function triggerWeatherScan() {
  try {
    const response = await fetch(manualEndpoint, { method: "POST" });
    if (!response.ok) {
      const text = await response.text();
      console.warn(`Weather scan request returned ${response.status}: ${text}`);
      return;
    }
    const payload = await response.json().catch(() => ({}));
    console.log("Weather monitor stats:", payload.stats ?? payload);
  } catch (error) {
    console.warn(
      `Unable to trigger weather monitor at ${manualEndpoint}. Is the dev server running?`,
      error instanceof Error ? error.message : error,
    );
  }
}

function openDashboard() {
  const target = `${baseUrl}/`;
  const currentPlatform = platform();
  let command: string;
  let args: string[];

  if (currentPlatform === "darwin") {
    command = "open";
    args = [target];
  } else if (currentPlatform === "win32") {
    command = "cmd";
    args = ["/c", "start", target];
  } else {
    command = "xdg-open";
    args = [target];
  }

  const child = spawn(command, args, { stdio: "ignore" });
  child.unref();
}

async function main() {
  const shouldOpen = process.argv.includes("--open");

  console.log("\n🧹 Resetting mock data (npm run seed)...\n");
  await run("npm", ["run", "seed"]);

  console.log("\n🌦️  Triggering weather monitor...");
  await triggerWeatherScan();

  if (shouldOpen) {
    console.log("\n🌐 Opening dashboard...\n");
    openDashboard();
  }

  console.log("✅ Demo setup complete.");
  console.log(`Dashboard: ${baseUrl}/`);
  console.log(`Proposals: ${baseUrl}/proposals`);
  console.log(`Outbox:    ${baseUrl}/notifications/outbox`);
  console.log("Run with --open to automatically launch the dashboard.");
}

main().catch((error) => {
  console.error("Demo script failed:", error);
  process.exit(1);
});
