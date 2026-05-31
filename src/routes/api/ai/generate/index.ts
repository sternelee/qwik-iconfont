import type { RequestHandler } from "@builder.io/qwik-city";
import { generateIconSVG } from "~/lib/ai";

export const onPost: RequestHandler = async ({ request, json, platform }) => {
  try {
    const body = (await request.json()) as {
      prompt?: string;
      style?: string;
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

    const style = body.style === "filled" ? "filled" : "outline";
    const svg = await generateIconSVG(platform, prompt, style);

    json(200, { svg });
  } catch (e: any) {
    json(500, { error: e.message ?? "AI 生成失败" });
  }
};
