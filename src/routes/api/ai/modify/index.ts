import type { RequestHandler } from "@builder.io/qwik-city";
import { modifyIconSVG } from "~/lib/ai";

export const onPost: RequestHandler = async ({ request, json, platform }) => {
  try {
    const body = (await request.json()) as {
      svg?: string;
      instruction?: string;
    };

    const svg = body.svg?.trim();
    const instruction = body.instruction?.trim();

    if (!svg || !instruction) {
      json(400, { error: "svg 和 instruction 均不能为空" });
      return;
    }
    if (svg.length > 50_000) {
      json(400, { error: "SVG 内容过大（最大 50KB）" });
      return;
    }
    if (instruction.length > 500) {
      json(400, { error: "instruction 最多 500 个字符" });
      return;
    }

    const modified = await modifyIconSVG(platform, svg, instruction);

    json(200, { svg: modified });
  } catch (e: any) {
    json(500, { error: e.message ?? "AI 修改失败" });
  }
};
