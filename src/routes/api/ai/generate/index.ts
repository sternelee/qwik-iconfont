import type { RequestHandler } from "@builder.io/qwik-city";
import { generateIconSVG, type AICredentials } from "~/lib/ai";

export const onPost: RequestHandler = async ({ request, json, platform }) => {
  try {
    const body = (await request.json()) as {
      prompt?: string;
      style?: string;
      apiKey?: string;
      baseUrl?: string;
      model?: string;
    };

    const prompt = body.prompt?.trim();
    if (!prompt) {
      json(400, { error: "prompt 不能为空" });
      return;
    }
    if (prompt.length > 500) {
      json(400, { error: "prompt 最多 500 个字符" });
      return;
    }

    // Reject partial BYOA: baseUrl/model without apiKey would risk server key leak
    if ((body.baseUrl || body.model) && !body.apiKey) {
      json(400, { error: "提供 baseUrl 或 model 时必须同时提供 apiKey" });
      return;
    }

    const credentials: AICredentials | undefined = body.apiKey
      ? {
          apiKey: body.apiKey,
          baseUrl: body.baseUrl || undefined,
          model: body.model || undefined,
        }
      : undefined;

    const style = body.style === "filled" ? "filled" : "outline";
    const svg = await generateIconSVG(platform, prompt, style, credentials);

    json(200, { svg });
  } catch (e: any) {
    json(500, { error: e.message ?? "AI 生成失败" });
  }
};
