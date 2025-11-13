import path from "path";
import fs from "fs";
import { config } from "dotenv";

// If env already has EMAIL_MODE, assume Next loaded it and skip.
if (!process.env.EMAIL_MODE || !process.env.DEMO_EMAIL) {
  // Try to resolve project root relative to this file
  const root = path.resolve(__dirname, "..");
  const isDev = process.env.NODE_ENV !== "production";
  const primary = path.join(root, ".env.local");
  const candidates = [
    primary,
    path.join(root, ".env"),
    path.join(process.cwd(), ".env.local"),
    path.join(process.cwd(), ".env"),
  ].filter((p) => {
    try {
      return fs.existsSync(p);
    } catch {
      return false;
    }
  });

  // Load the project .env.local with override in dev to fix mis-rooted servers.
  if (fs.existsSync(primary)) {
    config({ path: primary, override: isDev });
  }

  // Load the rest without overriding.
  for (const candidate of candidates) {
    if (candidate === primary) continue;
    config({ path: candidate, override: false });
  }
}

export {}; // module side effects only
