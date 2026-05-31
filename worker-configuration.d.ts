/// <reference types="@cloudflare/workers-types" />

interface Env {
  DB: D1Database;
  BUCKET: R2Bucket;
  ASSET: Fetcher;
  // ── AI bindings (optional) ──────────────────────────────────────────────────
  AI?: Ai; // Cloudflare Workers AI binding
  OPENAI_API_KEY?: string; // OpenAI-compatible API key
  OPENAI_BASE_URL?: string; // Override base URL (e.g. Together, Groq, Ollama)
  AI_MODEL?: string; // Model name for the active provider
}
