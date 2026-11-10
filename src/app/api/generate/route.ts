import { generationRequestSchema } from "@/lib/ai/plan";
import { assertSameOrigin, generateDiagram, GenerationError, readBoundedText } from "@/lib/ai/server";

export const runtime = "nodejs";
export const maxDuration = 65;

export async function POST(request: Request) {
  const headers = { "Cache-Control": "no-store" };
  try {
    assertSameOrigin(request);
    let input: unknown;
    try { input = JSON.parse(await readBoundedText(request.body, 32 * 1024)); }
    catch (error) { if (error instanceof GenerationError) throw error; throw new GenerationError("INVALID_REQUEST", "请求内容无法读取，请重新输入研究描述。"); }
    const parsed = generationRequestSchema.safeParse(input);
    if (!parsed.success) throw new GenerationError("INVALID_REQUEST", "请填写 10–6000 字的研究描述，并检查模型连接信息。");
    const result = await generateDiagram(parsed.data, request.signal);
    return Response.json(result, { headers });
  } catch (error) {
    const safe = error instanceof GenerationError ? error : new GenerationError("GENERATION_FAILED", "生成未完成，当前画布未修改。请稍后重试。", 500);
    return Response.json({ error: { code: safe.code, message: safe.message } }, { status: safe.status, headers });
  }
}
