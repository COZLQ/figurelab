import { FigureDocument, FigureNode } from "./document";

export type TemplateKey = "research" | "experiment" | "model";
export const templateInfo = [
  { key: "research" as const, title: "研究流程", description: "从科学问题，到研究结论", badge: "FLOW" },
  { key: "experiment" as const, title: "实验设计", description: "分组、干预与结果验证", badge: "STUDY" },
  { key: "model" as const, title: "模型架构", description: "输入、特征与模型输出", badge: "MODEL" },
];

const specs = {
  research: [
    ["研究问题", "明确假设与研究目标", "01 / QUESTION", "#EA7752"],
    ["实验设计", "选择方法，制定研究方案", "02 / DESIGN", "#4D9688"],
    ["数据采集", "记录样本与实验观察", "03 / COLLECT", "#6486BB"],
    ["分析与验证", "统计分析与假设检验", "04 / ANALYZE", "#9677B5"],
    ["结果与讨论", "解释发现，界定结论", "05 / INTERPRET", "#BB9655"],
    ["图表与发表", "清晰呈现研究成果", "06 / SHARE", "#4D9688"],
  ],
  experiment: [
    ["研究对象", "确定纳入与排除标准", "01 / SUBJECTS", "#EA7752"],
    ["随机分组", "记录分配方法与样本量", "02 / ALLOCATION", "#4D9688"],
    ["实验干预", "按预先制定的方案实施", "03 / TREATMENT", "#6486BB"],
    ["结果测量", "按统一标准采集终点", "04 / MEASURE", "#9677B5"],
    ["组间比较", "估计效应与不确定性", "05 / COMPARE", "#BB9655"],
    ["报告结果", "披露方法与研究局限", "06 / REPORT", "#4D9688"],
  ],
  model: [
    ["输入数据", "图像 · 文本 · 时序", "01 / INPUT", "#EA7752"],
    ["数据预处理", "归一化与数据增强", "02 / PREPROCESS", "#4D9688"],
    ["特征编码", "提取多尺度特征表示", "03 / ENCODER", "#6486BB"],
    ["特征融合", "聚合信息与上下文", "04 / FUSION", "#9677B5"],
    ["预测输出", "生成任务相关的预测", "05 / PREDICT", "#BB9655"],
    ["模型评估", "独立测试与误差分析", "06 / EVALUATE", "#4D9688"],
  ],
};

export function createTemplate(key: TemplateKey): FigureDocument {
  const positions = [{ x: 0, y: 0 }, { x: 290, y: 0 }, { x: 580, y: 0 }, { x: 580, y: 230 }, { x: 290, y: 230 }, { x: 0, y: 230 }];
  const nodes: FigureNode[] = specs[key].map(([title, subtitle, kicker, color], i) => ({
    id: `node-${i + 1}`, position: positions[i], width: 220, height: 132,
    data: { kind: "process", title, subtitle, kicker, color },
  }));
  return {
    version: 1, id: crypto.randomUUID(), title: `${templateInfo.find(t => t.key === key)!.title}图`, updatedAt: new Date().toISOString(), nodes,
    edges: nodes.slice(0, -1).map((node, i) => ({
      id: `edge-${i + 1}`, source: node.id, target: nodes[i + 1].id,
      sourceAnchor: i < 2 ? "right" : i === 2 ? "bottom" : "left",
      targetAnchor: i < 2 ? "left" : i === 2 ? "top" : "right", label: "", color: "#A2ABA8",
    })),
  };
}
