import { describe, expect, it } from "vitest";
import { generationPlanSchema, generationRequestSchema, parseModelPlan, planToDocument } from "./plan";
import { parseDocument } from "../document";
import { useEditorStore } from "../store";

export const validPlan = {
  title: "对照实验研究设计",
  nodes: [
    { id: "screen", title: "对象筛选", description: "确认纳入标准", kind: "process" as const },
    { id: "control", title: "对照组", description: "按方案处理", kind: "process" as const },
    { id: "treatment", title: "干预组", description: "按方案干预", kind: "process" as const },
    { id: "compare", title: "组间比较", description: "分析组间差异", kind: "process" as const },
  ],
  edges: [{ source: "screen", target: "control", label: "随机分配" }, { source: "screen", target: "treatment", label: "随机分配" }, { source: "control", target: "compare", label: "" }, { source: "treatment", target: "compare", label: "" }],
  notes: ["样本量与处理参数待确认。"],
};

describe("AI plan validation and editability", () => {
  it("lays out a branching study without losing content or connections", () => {
    const doc = planToDocument(validPlan, "TB");
    expect(parseDocument(doc)).toEqual(doc);
    expect(doc.nodes.map(node => node.data.title)).toEqual(validPlan.nodes.map(node => node.title));
    expect(doc.edges).toHaveLength(4);
    expect(doc.edges[0].sourceAnchor).toBe("bottom");
    expect(new Set(doc.nodes.map(node => `${node.position.x},${node.position.y}`)).size).toBe(4);
    expect(doc.nodes.every(node => Number.isFinite(node.position.x) && Number.isFinite(node.position.y))).toBe(true);
  });
  it("supports horizontal layout with appropriate anchors", () => {
    const doc = planToDocument(validPlan, "LR");
    expect(doc.edges.every(edge => edge.sourceAnchor === "right" && edge.targetAnchor === "left")).toBe(true);
  });
  it("accepts a fenced JSON response but rejects explanatory prose", () => {
    expect(parseModelPlan(`\u0060\u0060\u0060json\n${JSON.stringify(validPlan)}\n\u0060\u0060\u0060`)).toEqual(validPlan);
    expect(() => parseModelPlan(`这里是图形：${JSON.stringify(validPlan)}`)).toThrow();
  });
  it.each(["duplicate", "dangling", "self", "duplicate-edge", "extra-code", "too-many"])("rejects invalid model structure: %s", mode => {
    const plan = structuredClone(validPlan);
    if (mode === "duplicate") plan.nodes[1].id = plan.nodes[0].id;
    if (mode === "dangling") plan.edges[0].target = "missing";
    if (mode === "self") plan.edges[0].target = plan.edges[0].source;
    if (mode === "duplicate-edge") plan.edges.push(plan.edges[0]);
    if (mode === "extra-code") Object.assign(plan, { script: "alert(1)" });
    if (mode === "too-many") plan.nodes = Array.from({ length: 21 }, (_, i) => ({ ...plan.nodes[0], id: `n-${i}` }));
    expect(generationPlanSchema.safeParse(plan).success).toBe(false);
  });
  it("rejects short and oversized research descriptions", () => {
    const base = { diagramType: "workflow", direction: "TB" };
    expect(generationRequestSchema.safeParse({ ...base, description: "太短" }).success).toBe(false);
    expect(generationRequestSchema.safeParse({ ...base, description: "字".repeat(6001) }).success).toBe(false);
  });
  it("can apply an AI result and restore the previous project with one undo", () => {
    const original = structuredClone(useEditorStore.getState().doc);
    const generated = planToDocument(validPlan, "TB");
    useEditorStore.getState().replace(generated);
    useEditorStore.getState().patchNode(generated.nodes[0].id, { data: { title: "生成后继续编辑" } });
    expect(useEditorStore.getState().doc.nodes[0].data.title).toBe("生成后继续编辑");
    useEditorStore.getState().undo();
    expect(useEditorStore.getState().doc.nodes).toEqual(original.nodes);
    expect(useEditorStore.getState().doc.edges).toEqual(original.edges);
  });
});
