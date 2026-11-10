import { z } from "zod";
import dagre from "@dagrejs/dagre";
import { COLORS, parseDocument, type FigureDocument } from "../document";

export const diagramTypes = ["workflow", "experiment", "architecture"] as const;
export const diagramTypeLabels = { workflow: "研究流程", experiment: "实验设计", architecture: "模型架构" };
export const defaultConnection = { baseUrl: "https://api.deepseek.com", model: "deepseek-flash", apiKey: "", jsonMode: true };
export const connectionSchema = z.object({
  baseUrl: z.string().trim().min(1).max(500),
  model: z.string().trim().min(1).max(160),
  apiKey: z.string().trim().min(1).max(1000),
  jsonMode: z.boolean().default(true),
}).strict();
export type AiConnection = z.infer<typeof connectionSchema>;
export const generationRequestSchema = z.object({
  description: z.string().trim().min(10, "请至少输入 10 个字，描述研究内容与主要步骤。").max(6000),
  diagramType: z.enum(diagramTypes),
  direction: z.enum(["LR", "TB"]),
  connection: connectionSchema.optional(),
}).strict();
export type GenerationRequest = z.infer<typeof generationRequestSchema>;

const planId = z.string().regex(/^[a-zA-Z0-9_-]{1,60}$/);
export const generationPlanSchema = z.object({
  title: z.string().trim().min(1).max(80),
  nodes: z.array(z.object({
    id: planId,
    title: z.string().trim().min(1).max(60),
    description: z.string().trim().max(140).default(""),
    kind: z.enum(["process", "capsule", "note"]).default("process"),
  }).strict()).min(1).max(20),
  edges: z.array(z.object({ source: planId, target: planId, label: z.string().trim().max(50).default("") }).strict()).max(45),
  notes: z.array(z.string().trim().min(1).max(240)).max(4).default([]),
}).strict().superRefine((plan, ctx) => {
  const ids = new Set<string>();
  for (const node of plan.nodes) {
    if (ids.has(node.id)) ctx.addIssue({ code: "custom", message: "生成结果包含重复模块编号" });
    ids.add(node.id);
  }
  const connections = new Set<string>();
  for (const edge of plan.edges) {
    if (!ids.has(edge.source) || !ids.has(edge.target)) ctx.addIssue({ code: "custom", message: "生成结果包含无效连接" });
    if (edge.source === edge.target) ctx.addIssue({ code: "custom", message: "生成结果包含自连接" });
    const key = `${edge.source}:${edge.target}`;
    if (connections.has(key)) ctx.addIssue({ code: "custom", message: "生成结果包含重复连线" });
    connections.add(key);
  }
});
export type GenerationPlan = z.infer<typeof generationPlanSchema>;

export function parseModelPlan(content: string): GenerationPlan {
  let json = content.trim();
  if (json.startsWith("```")) json = json.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  return generationPlanSchema.parse(JSON.parse(json));
}

export function planToDocument(input: GenerationPlan, direction: "LR" | "TB"): FigureDocument {
  const plan = generationPlanSchema.parse(input);
  const graph = new dagre.graphlib.Graph();
  graph.setDefaultEdgeLabel(() => ({}));
  graph.setGraph({ rankdir: direction, nodesep: 60, ranksep: 80 });
  plan.nodes.forEach(node => graph.setNode(node.id, { width: 240, height: 156 }));
  plan.edges.forEach(edge => graph.setEdge(edge.source, edge.target));
  dagre.layout(graph);
  return parseDocument({
    version: 1, id: crypto.randomUUID(), title: plan.title, updatedAt: new Date().toISOString(),
    nodes: plan.nodes.map((node, index) => ({
      id: node.id, width: 240, height: 156,
      position: { x: Math.round(graph.node(node.id).x - 120), y: Math.round(graph.node(node.id).y - 78) },
      data: { kind: node.kind, title: node.title, subtitle: node.description, kicker: `${String(index + 1).padStart(2, "0")} / ${node.kind === "note" ? "NOTE" : "STEP"}`, color: COLORS[index % COLORS.length] },
    })),
    edges: plan.edges.map((edge, index) => ({
      id: `edge-${index + 1}`, source: edge.source, target: edge.target, label: edge.label,
      sourceAnchor: direction === "LR" ? "right" : "bottom", targetAnchor: direction === "LR" ? "left" : "top", color: "#A2ABA8",
    })),
  });
}
