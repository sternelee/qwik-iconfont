const GENERATE_SYSTEM = `You are an expert SVG icon designer. Create clean, minimal, professional SVG icons suitable for UI use.

Rules:
- Always use viewBox="0 0 24 24"
- Output ONLY the raw <svg> element — no markdown code blocks, no explanation, no extra text
- The SVG must start with <svg and end with </svg>
- Use standard SVG shapes: path, circle, rect, line, polyline, polygon

Outline style: stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
Filled style: fill="currentColor" stroke="none"`;

const MODIFY_SYSTEM = `You are an expert SVG icon editor. Modify the provided SVG icon according to the user's instruction.

Rules:
- Preserve the existing viewBox attribute
- Output ONLY the modified <svg> element — no markdown code blocks, no explanation
- Make only the requested changes, preserve everything else`;

interface AIChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface AIOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

/** User-provided credentials for BYOA (Bring Your Own API Key). */
export interface AICredentials {
  apiKey: string;
  baseUrl?: string;
  model?: string;
}

/** Validate a user-supplied base URL: must be HTTPS, no auth info, no private hosts. */
function validateBaseUrl(raw: string): string {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("Base URL 格式无效");
  }
  if (url.protocol !== "https:") throw new Error("Base URL 必须使用 HTTPS");
  if (url.username || url.password)
    throw new Error("Base URL 不允许包含认证信息");
  if (
    /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|::1)/i.test(
      url.hostname,
    )
  ) {
    throw new Error("Base URL 不允许使用内网地址");
  }
  return raw.replace(/\/+$/, "");
}

async function callOpenAICompatible(
  apiKey: string,
  baseUrl: string,
  model: string,
  messages: AIChatMessage[],
  options: AIOptions,
): Promise<string> {
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 2048,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`AI API error (${res.status}): ${errText.slice(0, 200)}`);
  }

  const data = (await res.json()) as {
    choices: Array<{ message: { content: string } }>;
  };
  return data.choices[0]?.message?.content ?? "";
}

export async function callAI(
  platform: any,
  messages: AIChatMessage[],
  options: AIOptions = {},
  /** BYOA: if provided, these credentials are used exclusively — never mixed with server keys. */
  userCredentials?: AICredentials,
): Promise<string> {
  // BYOA path — only user credentials, never mixed with server keys
  if (userCredentials?.apiKey) {
    const baseUrl = userCredentials.baseUrl?.trim()
      ? validateBaseUrl(userCredentials.baseUrl.trim())
      : "https://api.openai.com/v1";
    const model =
      userCredentials.model?.trim() || options.model || "gpt-4o-mini";
    return callOpenAICompatible(
      userCredentials.apiKey,
      baseUrl,
      model,
      messages,
      options,
    );
  }

  // Server-configured path
  const env = (platform?.env ?? {}) as Partial<Env>;

  if (env.OPENAI_API_KEY) {
    const baseUrl = env.OPENAI_BASE_URL ?? "https://api.openai.com/v1";
    const model = options.model ?? env.AI_MODEL ?? "gpt-4o-mini";
    return callOpenAICompatible(
      env.OPENAI_API_KEY,
      baseUrl,
      model,
      messages,
      options,
    );
  }

  if (env.AI) {
    const model =
      options.model ?? env.AI_MODEL ?? "@cf/meta/llama-3.1-8b-instruct";
    const result = await (env.AI as any).run(model, { messages });
    return (result as { response?: string }).response ?? "";
  }

  throw new Error(
    "未配置 AI 服务。请设置 API Key，或联系管理员配置服务端 AI。",
  );
}

/** Strip dangerous SVG content (scripts, styles with JS, event handlers, javascript: URIs). */
export function sanitizeSVG(svg: string): string {
  return svg
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/\s+on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s/>]*)/gi, "")
    .replace(/(href|xlink:href)\s*=\s*['"]javascript:[^'"]*['"]/gi, "");
}

function extractSVG(text: string): string {
  // Remove markdown code fences if the model wrapped the response
  const cleaned = text.replace(/```[a-z]*\n?/gi, "").trim();
  // Non-greedy: matches from first <svg to first </svg>.
  // AI-generated icons are simple shapes without nested <svg> elements,
  // so non-greedy is safer against trailing text that contains "</svg>".
  const match = cleaned.match(/<svg[\s\S]*?<\/svg>/i);
  if (!match) {
    throw new Error("AI 未返回有效的 SVG 元素，请重试");
  }
  return sanitizeSVG(match[0].trim());
}

export async function generateIconSVG(
  platform: any,
  prompt: string,
  style: "outline" | "filled" = "outline",
  credentials?: AICredentials,
): Promise<string> {
  const text = await callAI(
    platform,
    [
      { role: "system", content: GENERATE_SYSTEM },
      {
        role: "user",
        content: `Generate a ${style} style SVG icon representing: ${prompt}`,
      },
    ],
    {},
    credentials,
  );
  return extractSVG(text);
}

export async function modifyIconSVG(
  platform: any,
  svg: string,
  instruction: string,
  credentials?: AICredentials,
): Promise<string> {
  const text = await callAI(
    platform,
    [
      { role: "system", content: MODIFY_SYSTEM },
      {
        role: "user",
        content: `Current SVG:\n${svg}\n\nModification instruction: ${instruction}`,
      },
    ],
    {},
    credentials,
  );
  return extractSVG(text);
}
