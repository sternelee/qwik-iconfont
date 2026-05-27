#!/usr/bin/env node
/**
 * Post-build fix for Cloudflare Workers adapter.
 * Qwik's cloudflarePagesAdapter generates dist/_worker.js with:
 *   import { fetch } from "server/entry.cloudflare-pages";
 * which wrangler interprets as a package path instead of a relative path.
 * This script prefixes it with "./" to make it a proper relative import.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const workerPath = join(process.cwd(), "dist", "_worker.js");
try {
  const content = readFileSync(workerPath, "utf-8");
  const fixed = content.replace(
    'from "server/entry.cloudflare-pages"',
    'from "./server/entry.cloudflare-pages"'
  );
  if (content !== fixed) {
    writeFileSync(workerPath, fixed);
    console.log("[fix-worker-import] Fixed dist/_worker.js import path");
  }
} catch (e) {
  console.error("[fix-worker-import] Failed:", e.message);
  process.exit(1);
}
