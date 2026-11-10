import { afterEach, describe, expect, it, vi } from "vitest";
import { generateDiagram, getConnectionStatus, normalizeBaseUrl, resolveConnection } from "./server";
import { POST } from "../../app/api/generate/route";
import type { GenerationRequest } from "./plan";

const plan = { title: "研究流程", nodes: [{ id: "a", title: "采集数据", description: "观察与记录", kind: "process" }, { id: "b", title: "分析数据", description: "分析与验证", kind: "process" }], edges: [{ source: "a", target: "b", label: "" }], notes: [] };
const connection = { baseUrl: "https://example.org/v1", model: "test-model", apiKey: "test-key-not-a-real-secret", jsonMode: true };
const request: GenerationRequest = { description: "先采集实验数据，再开展数据分析与验证。", diagramType: "workflow", direction: "TB", connection };
const completion = (content: unknown = JSON.stringify(plan), finish = "stop") => Response.json({ choices: [{ message: { content }, finish_reason: finish }] });
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("AI provider boundary", () => {
  it("uses the configured compatible endpoint and returns only an editable document", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(completion());
    const output = await generateDiagram(request, undefined, { fetcher, env: {} });
    const [url, options] = fetcher.mock.calls[0]; const body = JSON.parse(options!.body as string);
    expect(String(url)).toBe("https://example.org/v1/chat/completions");
    expect(options!.redirect).toBe("error");
    expect(body.response_format).toEqual({ type: "json_object" });
    expect(body.thinking).toBeUndefined();
    expect(body.messages[1].content).toBe(request.description);
    expect(JSON.stringify(body.messages)).not.toContain(connection.apiKey);
    expect(output.document.nodes).toHaveLength(2);
    expect(JSON.stringify(output)).not.toContain(connection.apiKey);
  });
  it("disables thinking for official DeepSeek while keeping other providers generic", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(completion());
    await generateDiagram({ ...request, connection: { ...connection, baseUrl: "https://api.deepseek.com", model: "deepseek-flash" } }, undefined, { fetcher, env: {} });
    expect(JSON.parse(fetcher.mock.calls[0][1]!.body as string).thinking).toEqual({ type: "disabled" });
  });
  it("can omit JSON mode for providers that do not implement response_format", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(completion());
    await generateDiagram({ ...request, connection: { ...connection, jsonMode: false } }, undefined, { fetcher, env: {} });
    expect(JSON.parse(fetcher.mock.calls[0][1]!.body as string).response_format).toBeUndefined();
  });
  it("never lends a server key to a per-request endpoint", () => {
    const env = { FIGURELAB_AI_API_KEY: "server-key", FIGURELAB_AI_BASE_URL: "https://api.deepseek.com" };
    expect(() => resolveConnection({ ...connection, apiKey: "" }, env)).toThrow();
    expect(getConnectionStatus(env)).not.toHaveProperty("apiKey");
    expect(JSON.stringify(getConnectionStatus(env))).not.toContain("server-key");
  });
  it("normalizes a full completion URL and requires explicit opt-in for local model endpoints", () => {
    expect(normalizeBaseUrl("https://example.org/v1/chat/completions").pathname).toBe("/v1");
    expect(() => normalizeBaseUrl("http://127.0.0.1:4000/v1")).toThrow();
    expect(normalizeBaseUrl("http://127.0.0.1:4000/v1", true).hostname).toBe("127.0.0.1");
    expect(() => normalizeBaseUrl("https://user:password@example.org")).toThrow();
  });
  it.each([[401, "AUTH_FAILED"], [402, "QUOTA_EXCEEDED"], [429, "RATE_LIMITED"], [500, "PROVIDER_UNAVAILABLE"], [400, "MODEL_REQUEST_REJECTED"]])("handles provider HTTP %s without echoing raw provider errors", async (status, code) => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response("private upstream contents", { status: Number(status) }));
    await expect(generateDiagram(request, undefined, { fetcher, env: {} })).rejects.toMatchObject({ code });
  });
  it.each([["", "stop", "EMPTY_OUTPUT"], ["   ", "stop", "EMPTY_OUTPUT"], ["{", "length", "OUTPUT_TRUNCATED"], ["not-json", "stop", "INVALID_GRAPH"], [JSON.stringify({ ...plan, edges: [{ source: "a", target: "missing" }] }), "stop", "INVALID_GRAPH"]])("rejects incomplete model output (%s, %s)", async (content, finish, code) => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(completion(content, finish));
    await expect(generateDiagram(request, undefined, { fetcher, env: {} })).rejects.toMatchObject({ code });
  });
  it("reports refusal, timeout, and cancellation separately", async () => {
    const refused = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ choices: [{ message: { refusal: "refused" }, finish_reason: "stop" }] }));
    await expect(generateDiagram(request, undefined, { fetcher: refused, env: {} })).rejects.toMatchObject({ code: "MODEL_REFUSAL" });
    const failed = vi.fn<typeof fetch>().mockRejectedValue(new Error("aborted"));
    const controller = new AbortController(); controller.abort();
    await expect(generateDiagram(request, controller.signal, { fetcher: failed, env: {} })).rejects.toMatchObject({ code: "CANCELLED" });
    vi.spyOn(AbortSignal, "timeout").mockReturnValue(AbortSignal.abort());
    await expect(generateDiagram(request, undefined, { fetcher: failed, env: {} })).rejects.toMatchObject({ code: "TIMEOUT" });
  });
});

describe("generation API", () => {
  it("returns a validated graph through the actual route handler", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(completion()));
    const response = await POST(new Request("http://localhost/api/generate", { method: "POST", body: JSON.stringify(request), headers: { Origin: "http://localhost" } }));
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect((await response.json()).document.edges).toHaveLength(1);
  });
  it("rejects a cross-origin generation request", async () => {
    const response = await POST(new Request("http://localhost/api/generate", { method: "POST", body: JSON.stringify(request), headers: { Origin: "https://other.example" } }));
    expect(response.status).toBe(403);
  });
  it("accepts a loopback browser origin when Next.js uses localhost internally", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(completion()));
    const response = await POST(new Request("http://localhost:3002/api/generate", { method: "POST", body: JSON.stringify(request), headers: { Origin: "http://127.0.0.1:3002", Host: "127.0.0.1:3002" } }));
    expect(response.status).toBe(200);
  });
  it("rejects a request exceeding the byte limit before calling the provider", async () => {
    const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
    const response = await POST(new Request("http://localhost/api/generate", { method: "POST", body: JSON.stringify({ ...request, description: "字".repeat(15000) }) }));
    expect(response.status).toBe(413); expect(fetcher).not.toHaveBeenCalled();
  });
  it("reports missing credentials without inventing a generated diagram", async () => {
    vi.stubEnv("FIGURELAB_AI_API_KEY", ""); vi.stubEnv("DEEPSEEK_API_KEY", "");
    const { connection: _connection, ...withoutKey } = request;
    const response = await POST(new Request("http://localhost/api/generate", { method: "POST", body: JSON.stringify(withoutKey) }));
    expect(response.status).toBe(503);
    const payload = await response.json(); expect(payload.error.code).toBe("NOT_CONFIGURED"); expect(payload.document).toBeUndefined();
  });
});
