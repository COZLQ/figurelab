import { z } from "zod";

export const COLORS = ["#EA7752", "#4D9688", "#6486BB", "#9677B5", "#BB9655", "#65717B"] as const;
export const anchors = ["top", "right", "bottom", "left"] as const;
const identifier = z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/);
const color = z.string().regex(/^#[0-9a-fA-F]{6}$/);

export const figureDataSchema = z.object({
  kind: z.enum(["process", "capsule", "note"]),
  title: z.string().max(120),
  subtitle: z.string().max(200),
  kicker: z.string().max(48),
  color,
});

export const figureNodeSchema = z.object({
  id: identifier,
  position: z.object({ x: z.number().finite().min(-100000).max(100000), y: z.number().finite().min(-100000).max(100000) }),
  width: z.number().min(140).max(500),
  height: z.number().min(132).max(320),
  data: figureDataSchema,
});

export const figureEdgeSchema = z.object({
  id: identifier,
  source: identifier,
  target: identifier,
  sourceAnchor: z.enum(anchors),
  targetAnchor: z.enum(anchors),
  label: z.string().max(80),
  color,
});

export const documentSchema = z.object({
  version: z.literal(1),
  id: identifier,
  title: z.string().min(1).max(120),
  updatedAt: z.string().datetime(),
  nodes: z.array(figureNodeSchema).max(300),
  edges: z.array(figureEdgeSchema).max(1000),
}).superRefine((doc, ctx) => {
  const ids = new Set<string>();
  for (const node of doc.nodes) {
    if (ids.has(node.id)) ctx.addIssue({ code: "custom", message: "模块编号重复" });
    ids.add(node.id);
  }
  const edgeIds = new Set<string>();
  for (const edge of doc.edges) {
    if (edgeIds.has(edge.id)) ctx.addIssue({ code: "custom", message: "连线编号重复" });
    edgeIds.add(edge.id);
    if (!ids.has(edge.source) || !ids.has(edge.target)) ctx.addIssue({ code: "custom", message: "连线引用了不存在的模块" });
  }
});

export type FigureData = z.infer<typeof figureDataSchema>;
export type FigureNode = z.infer<typeof figureNodeSchema>;
export type FigureEdge = z.infer<typeof figureEdgeSchema>;
export type FigureDocument = z.infer<typeof documentSchema>;
export type Anchor = typeof anchors[number];

export function parseDocument(input: unknown): FigureDocument {
  return documentSchema.parse(input);
}

export function serializeDocument(doc: FigureDocument): string {
  return JSON.stringify(parseDocument(doc), null, 2);
}

export function fileName(title: string): string {
  return title.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-").replace(/[. ]+$/g, "").trim().slice(0, 80) || "figurelab";
}
