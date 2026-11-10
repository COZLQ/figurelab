"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Background, BackgroundVariant, ConnectionMode, Handle, MarkerType, NodeResizer,
  ReactFlow, ReactFlowProvider, useReactFlow, type Connection, type Edge, type EdgeChange,
  type Node, type NodeChange, type NodeProps,
} from "@xyflow/react";
import {
  ArrowDown, ArrowDownToLine, ArrowRight, ArrowUpRight, Check, ChevronDown, CircleHelp,
  Copy, Download, Expand, FilePlus2, FlaskConical, FolderOpen, GitBranch, Grip,
  LayoutTemplate, LoaderCircle, Maximize2, Minus, MousePointer2, Plus, Redo2,
  ScanLine, Shapes, SlidersHorizontal, Sparkles, StickyNote, Trash2, Undo2, Upload, X,
} from "lucide-react";
import dagre from "@dagrejs/dagre";
import { COLORS, fileName, parseDocument, serializeDocument, type Anchor, type FigureData, type FigureDocument } from "@/lib/document";
import { createTemplate, templateInfo, type TemplateKey } from "@/lib/templates";
import { FONT_STACK, downloadFile, downloadPng, exportSvg, nodeSvgContent } from "@/lib/svg";
import { useEditorStore } from "@/lib/store";
import { anchorPosition } from "@/lib/svg";
import { Modal } from "./modal";
import { AiGenerator } from "./ai-generator";
import { defaultConnection, type AiConnection } from "@/lib/ai/plan";

const STORAGE_KEY = "figurelab.document.v1";
type CanvasNode = Node<{ model: FigureDocument["nodes"][number] }, "figure">;

function FigureCanvasNode({ data, selected }: NodeProps<CanvasNode>) {
  const model = data.model;
  return <div className={`figure-node ${selected ? "is-selected" : ""}`} style={{ width: model.width, height: model.height, "--node-color": model.data.color } as React.CSSProperties}>
    <NodeResizer isVisible={selected} minWidth={140} minHeight={132} maxWidth={500} maxHeight={320} onResizeStart={() => useEditorStore.getState().checkpoint()} lineStyle={{ borderColor: model.data.color }} handleStyle={{ background: "white", borderColor: model.data.color, width: 7, height: 7, borderRadius: 2 }} />
    <svg width={model.width} height={model.height} viewBox={`0 0 ${model.width} ${model.height}`} fontFamily={FONT_STACK} role="img" aria-label={model.data.title}>
      <title>{model.data.title} — {model.data.subtitle}</title>
      <g dangerouslySetInnerHTML={{ __html: nodeSvgContent(model) }} />
    </svg>
    {(["top", "right", "bottom", "left"] as const).map(side => <Handle key={side} type="source" id={side} position={anchorPosition[side]} className="node-handle" />)}
  </div>;
}
const nodeTypes = { figure: FigureCanvasNode };

function TemplateThumbnail({ index }: { index: number }) {
  return <div className={`template-thumbnail thumbnail-${index}`} aria-hidden="true">
    <svg viewBox="0 0 180 65"><path d={index === 1 ? "M45 20V43H135V20M90 10V43M45 43V56M135 43V56" : index === 2 ? "M25 32H155M65 32V15H110V32M65 32V50H110V32" : "M25 20H150V47H25"} fill="none" stroke="#A6BDB2" strokeWidth="1.4" />
      {(index === 0 ? [[18, 12], [74, 12], [130, 12], [130, 39], [74, 39], [18, 39]] : index === 1 ? [[73, 2], [28, 30], [118, 30], [28, 50], [118, 50]] : [[8, 24], [56, 7], [56, 42], [101, 24], [146, 24]]).map(([x, y], i) => <rect key={i} x={x} y={y} width={index === 0 ? 32 : 28} height={index === 0 ? 15 : 14} rx="3" fill={i === 1 ? "#F5E4D7" : "#F7FAF7"} stroke={i === 1 ? "#D5A284" : "#BACAC0"} />)}
    </svg>
  </div>;
}

function EditorWorkspace() {
  const state = useEditorStore();
  const { doc, selectedNode, selectedEdge, checkpoint, patchNode, patchDocument, patchEdge, select, undo, redo, removeSelection, duplicateNode } = state;
  const flow = useReactFlow<CanvasNode>();
  const [ready, setReady] = useState(false);
  const [saveStatus, setSaveStatus] = useState("正在恢复画布");
  const [persistence, setPersistence] = useState(true);
  const [toast, setToast] = useState("");
  const [showHelp, setShowHelp] = useState(false);
  const [showAi, setShowAi] = useState(false);
  const [aiConnection, setAiConnection] = useState<AiConnection>({ ...defaultConnection });
  const [inspectorOpen, setInspectorOpen] = useState(true);
  const [exportOpen, setExportOpen] = useState(false);
  const [layoutOpen, setLayoutOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [titleDraft, setTitleDraft] = useState(doc.title);
  const [zoom, setZoom] = useState(1);
  const [pending, setPending] = useState<{ doc: FigureDocument; label: string } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const titleInput = useRef<HTMLTextAreaElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const notify = useCallback((message: string) => {
    setToast(message); if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 4000);
  }, []);

  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current); }, []);
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) useEditorStore.setState({ doc: parseDocument(JSON.parse(saved)), selectedNode: null, selectedEdge: null });
    } catch {
      setPersistence(false); setSaveStatus("请下载项目保存");
      notify("本地记录暂时无法读取，已保留原记录。请下载项目保存当前内容。");
    }
    setReady(true);
  }, [notify]);
  useEffect(() => { setTitleDraft(doc.title); }, [doc.title]);
  useEffect(() => {
    if (!ready || !persistence) return;
    setSaveStatus("正在保存…");
    const timeout = setTimeout(() => {
      try { localStorage.setItem(STORAGE_KEY, serializeDocument(doc)); setSaveStatus("已保存在此浏览器"); }
      catch { setSaveStatus("请下载项目保存"); setPersistence(false); notify("浏览器无法自动保存，请点击「保存项目」下载文件。"); }
    }, 450);
    return () => clearTimeout(timeout);
  }, [doc, ready, persistence, notify]);
  useEffect(() => {
    if (!ready) return;
    const timer = setTimeout(() => flow.fitView({ padding: .22, duration: 300, maxZoom: 1.15 }), 70);
    return () => clearTimeout(timer);
  }, [state.fitRevision, ready, flow]);

  const saveProject = useCallback(() => {
    const current = useEditorStore.getState().doc;
    downloadFile(serializeDocument(current), `${fileName(current.title)}.figurelab.json`, "application/json;charset=utf-8");
    notify("项目已下载，可通过「导入项目」继续编辑。");
  }, [notify]);

  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLElement && (event.target.closest("input, textarea, select, [contenteditable=true]") || event.target.closest("dialog"))) return;
      if (document.querySelector("dialog[open]")) return;
      const command = event.ctrlKey || event.metaKey;
      if (command && event.key.toLowerCase() === "s") { event.preventDefault(); saveProject(); }
      else if (command && event.key.toLowerCase() === "z") { event.preventDefault(); if (event.shiftKey) redo(); else undo(); }
      else if (command && event.key.toLowerCase() === "y") { event.preventDefault(); redo(); }
      else if (command && event.key.toLowerCase() === "d") { event.preventDefault(); duplicateNode(); }
      else if (["Delete", "Backspace"].includes(event.key)) { event.preventDefault(); removeSelection(); }
      else if (event.key === "Escape") { select(null); setExportOpen(false); setLayoutOpen(false); }
    };
    window.addEventListener("keydown", keydown); return () => window.removeEventListener("keydown", keydown);
  }, [duplicateNode, redo, removeSelection, saveProject, select, undo]);

  const nodes: CanvasNode[] = doc.nodes.map(model => ({ id: model.id, type: "figure", position: model.position, width: model.width, height: model.height, measured: { width: model.width, height: model.height }, style: { width: model.width, height: model.height }, selected: model.id === selectedNode, data: { model } }));
  const edges: Edge[] = doc.edges.map(edge => ({
    id: edge.id, source: edge.source, target: edge.target, sourceHandle: edge.sourceAnchor, targetHandle: edge.targetAnchor,
    type: "smoothstep", pathOptions: { borderRadius: 16, offset: 24 }, selected: edge.id === selectedEdge,
    style: { stroke: edge.id === selectedEdge ? "#EA7752" : edge.color, strokeWidth: 1.6 },
    markerEnd: { type: MarkerType.Arrow, color: edge.color, width: 8, height: 8, markerUnits: "userSpaceOnUse" },
    label: edge.label, labelStyle: { fontSize: 11, fill: "#69766F", fontFamily: FONT_STACK }, labelBgPadding: [8, 4], labelBgBorderRadius: 5,
  }));

  const onNodesChange = useCallback((changes: NodeChange<CanvasNode>[]) => {
    const current = useEditorStore.getState();
    const selected = changes.find(change => change.type === "select" && change.selected);
    if (selected?.type === "select") current.select(selected.id);
    const mutations = changes.filter(change => (change.type === "position" && change.position) || (change.type === "dimensions" && change.resizing));
    if (!mutations.length) return;
    current.patchDocument({ nodes: current.doc.nodes.map(node => {
      let next = node;
      for (const change of mutations) {
        if (change.type !== "position" && change.type !== "dimensions") continue;
        if (change.id !== node.id) continue;
        if (change.type === "position" && change.position) next = { ...next, position: { x: Math.max(-100000, Math.min(100000, change.position.x)), y: Math.max(-100000, Math.min(100000, change.position.y)) } };
        if (change.type === "dimensions" && change.dimensions && change.resizing) next = { ...next, width: Math.max(140, Math.min(500, change.dimensions.width)), height: Math.max(132, Math.min(320, change.dimensions.height)) };
      }
      return next;
    }) });
  }, []);
  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    const selected = changes.find(change => change.type === "select" && change.selected);
    if (selected?.type === "select") useEditorStore.getState().select(null, selected.id);
  }, []);
  const onConnect = useCallback((connection: Connection) => {
    if (!connection.source || !connection.target) return;
    useEditorStore.getState().connect({ id: crypto.randomUUID(), source: connection.source, target: connection.target, sourceAnchor: (connection.sourceHandle || "right") as Anchor, targetAnchor: (connection.targetHandle || "left") as Anchor, label: "", color: "#A2ABA8" });
  }, []);

  const addNode = (kind: FigureData["kind"], position?: { x: number; y: number }) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    const center = position || flow.screenToFlowPosition({ x: (rect?.left || 0) + (rect?.width || 600) / 2, y: (rect?.top || 0) + (rect?.height || 400) / 2 });
    const id = state.addNode(kind, { x: Math.round(center.x - 110), y: Math.round(center.y - 66) });
    if (!id) notify("当前画布最多支持 300 个模块。");
  };
  const autoLayout = (direction: "LR" | "TB") => {
    checkpoint(); const graph = new dagre.graphlib.Graph();
    graph.setDefaultEdgeLabel(() => ({})); graph.setGraph({ rankdir: direction, nodesep: 65, ranksep: 85, marginx: 0, marginy: 0 });
    doc.nodes.forEach(node => graph.setNode(node.id, { width: node.width, height: node.height }));
    doc.edges.forEach(edge => graph.setEdge(edge.source, edge.target)); dagre.layout(graph);
    patchDocument({ nodes: doc.nodes.map(node => ({ ...node, position: { x: graph.node(node.id).x - node.width / 2, y: graph.node(node.id).y - node.height / 2 } })), edges: doc.edges.map(edge => ({ ...edge, sourceAnchor: direction === "LR" ? "right" : "bottom", targetAnchor: direction === "LR" ? "left" : "top" })) });
    setLayoutOpen(false); setTimeout(() => flow.fitView({ padding: .2, duration: 350 }), 30); notify(direction === "LR" ? "已按横向重新排列，可撤销。" : "已按纵向重新排列，可撤销。");
  };
  const exportFile = async (format: "svg" | "png") => {
    setExportOpen(false);
    try {
      if (format === "svg") downloadFile(exportSvg(doc), `${fileName(doc.title)}.svg`, "image/svg+xml;charset=utf-8");
      else { setExporting(true); await downloadPng(doc); }
      notify(format === "svg" ? "SVG 已导出，文字、形状和连线均为矢量对象。" : "PNG 已导出，白色背景，最高 2 倍分辨率。");
    } catch { notify("导出未完成，请稍后重试。"); } finally { setExporting(false); }
  };
  const importProject = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { notify("请选择小于 2 MB 的 FigureLab 项目文件。"); return; }
    try { const imported = parseDocument(JSON.parse(await file.text())); setPending({ doc: imported, label: `导入「${imported.title}」` }); }
    catch { notify("无法导入：请选择有效的 FigureLab 项目 JSON 文件。当前画布未修改。"); }
  };
  const node = doc.nodes.find(n => n.id === selectedNode);
  const edge = doc.edges.find(e => e.id === selectedEdge);

  if (!ready) return <div className="loading-screen"><FlaskConical size={32} /><span>正在打开 FigureLab…</span></div>;

  return <div className={`app ${inspectorOpen ? "" : "inspector-hidden"}`}>
    <header className="app-header">
      <a className="brand" href="/" aria-label="FigureLab 首页"><span className="brand-icon"><FlaskConical size={23} strokeWidth={1.65} /></span><span>Figure<span className="brand-light">Lab</span><span className="brand-tag">BETA</span></span></a>
      <div className="project-heading"><span className="breadcrumb">我的工作空间 <span>/</span></span><input aria-label="图表名称" className="project-title" value={titleDraft} maxLength={120} onChange={event => setTitleDraft(event.target.value)} onBlur={() => { const value = titleDraft.trim() || "未命名图表"; if (value !== doc.title) { checkpoint(); patchDocument({ title: value }); } else setTitleDraft(doc.title); }} onKeyDown={event => { if (event.key === "Enter") event.currentTarget.blur(); }} /><span className="local-badge">本地项目</span></div>
      <div className="header-actions"><button className="icon-button help-button" title="使用帮助" aria-label="使用帮助" onClick={() => setShowHelp(true)}><CircleHelp size={18} /></button><button className="button ai-launch" aria-label="AI 生成" onClick={() => setShowAi(true)}><Sparkles size={15} /><span>AI 生成</span></button><button className="button save-button" onClick={saveProject}><Download size={15} /><span>保存项目</span></button><div className="export-group"><button className="button primary" disabled={exporting} onClick={() => exportFile("svg")}>{exporting ? <LoaderCircle size={15} className="spin" /> : <ArrowUpRight size={16} />}<span>导出 SVG</span></button><button className="export-toggle" aria-label="更多导出格式" aria-expanded={exportOpen} onClick={() => { setExportOpen(!exportOpen); setLayoutOpen(false); }}><ChevronDown size={15} /></button>{exportOpen && <div className="dropdown export-menu"><button onClick={() => exportFile("svg")}><ScanLine size={16} /><span>SVG 矢量图<small>可继续编辑 · 透明背景</small></span></button><button onClick={() => exportFile("png")}><ArrowDownToLine size={16} /><span>PNG 高清图<small>白色背景 · 最高 2×</small></span></button></div>}</div></div>
    </header>

    <aside className="sidebar">
      <div className="sidebar-section"><div className="eyebrow">YOUR NEXT DISCOVERY</div><h1>让研究，<br /><span>清晰可见。</span></h1><p className="sidebar-intro">从一个想法，到一张好图。</p></div>
      <div className="sidebar-section template-section"><div className="section-heading"><span><LayoutTemplate size={15} />从模板开始</span><span className="count">03</span></div>
        <div className="template-list">{templateInfo.map((template, i) => <button key={template.key} className="template-card" onClick={() => setPending({ doc: createTemplate(template.key as TemplateKey), label: `使用「${template.title}」模板` })}><TemplateThumbnail index={i} /><span className="template-caption"><strong>{template.title}</strong><span>{template.badge}</span></span><span className="template-description">{template.description}</span></button>)}</div>
      </div>
      <div className="sidebar-section palette-section"><div className="section-heading"><span><Shapes size={15} />基础组件</span><small>点击或拖入</small></div><div className="palette">
        {([{ kind: "process", label: "流程模块", icon: <div className="shape-preview rectangle" /> }, { kind: "capsule", label: "起止模块", icon: <div className="shape-preview capsule" /> }, { kind: "note", label: "注释说明", icon: <StickyNote size={24} strokeWidth={1.25} /> }] as const).map(item => <button key={item.kind} draggable onDragStart={event => { event.dataTransfer.setData("application/figurelab-kind", item.kind); event.dataTransfer.effectAllowed = "copy"; }} onClick={() => addNode(item.kind)} className="palette-item">{item.icon}<span>{item.label}</span></button>)}
      </div></div>
      <div className="sidebar-bottom"><button className="import-button" onClick={() => fileInput.current?.click()}><FolderOpen size={16} /><span>导入项目</span><Upload size={13} /></button><button className="new-button" onClick={() => setPending({ doc: { ...createTemplate("research"), title: "未命名图表", nodes: [], edges: [] }, label: "新建空白图表" })}><FilePlus2 size={15} />新建空白图表</button><div className="sidebar-footnote"><span className="privacy-dot" />图表保存在你的浏览器中</div></div>
    </aside>

    <main className="workspace">
      <div className="workspace-header"><div><div className="workspace-kicker"><span className="live-dot" />FIGURE WORKSPACE</div><div className="workspace-title"><h2>{doc.title}</h2><span className="figure-index">FIG. 01</span></div><p>组织你的研究思路，自由编辑每一个细节。</p></div><button className={`icon-button inspector-toggle ${inspectorOpen ? "active" : ""}`} title="显示或隐藏属性面板" aria-label="显示或隐藏属性面板" aria-pressed={inspectorOpen} onClick={() => setInspectorOpen(!inspectorOpen)}><SlidersHorizontal size={18} /></button></div>
      <div className="canvas-shell" ref={canvasRef}>
        <div className="canvas-toolbar"><div className="tool-group"><span className="tool-indicator"><MousePointer2 size={16} /></span><span className="tool-divider" /><button className="icon-button" disabled={!state.past.length} title="撤销 · Ctrl+Z" aria-label="撤销" onClick={undo}><Undo2 size={16} /></button><button className="icon-button" disabled={!state.future.length} title="重做 · Ctrl+Shift+Z" aria-label="重做" onClick={redo}><Redo2 size={16} /></button></div><div className="toolbar-right"><div className="layout-dropdown"><button className="toolbar-button" aria-expanded={layoutOpen} onClick={() => { setLayoutOpen(!layoutOpen); setExportOpen(false); }}><GitBranch size={15} />自动排版<ChevronDown size={13} /></button>{layoutOpen && <div className="dropdown layout-menu"><button onClick={() => autoLayout("LR")}><ArrowRight size={15} />横向排列</button><button onClick={() => autoLayout("TB")}><ArrowDown size={15} />纵向排列</button></div>}</div><button className="toolbar-button add-button" onClick={() => addNode("process")}><Plus size={15} />添加模块</button></div></div>
        <ReactFlow<CanvasNode> nodes={nodes} edges={edges} nodeTypes={nodeTypes} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect} onNodeDragStart={checkpoint} onPaneClick={() => { select(null); setExportOpen(false); setLayoutOpen(false); }} onNodeDoubleClick={(_, node) => { select(node.id); setInspectorOpen(true); setTimeout(() => titleInput.current?.focus(), 50); }} onMove={(_, viewport) => setZoom(viewport.zoom)} connectionMode={ConnectionMode.Loose} deleteKeyCode={null} multiSelectionKeyCode={null} minZoom={.15} maxZoom={2} nodesDraggable nodesConnectable elementsSelectable fitView fitViewOptions={{ padding: .22, maxZoom: 1.15 }} attributionPosition="bottom-right" onDragOver={event => { event.preventDefault(); event.dataTransfer.dropEffect = "copy"; }} onDrop={event => { event.preventDefault(); const kind = event.dataTransfer.getData("application/figurelab-kind"); if (["process", "capsule", "note"].includes(kind)) addNode(kind as FigureData["kind"], flow.screenToFlowPosition({ x: event.clientX, y: event.clientY })); }}>
          <Background variant={BackgroundVariant.Dots} gap={22} size={1} color="#CDD7D0" />
        </ReactFlow>
        {doc.nodes.length === 0 && <div className="empty-state"><span><Shapes size={30} strokeWidth={1.2} /></span><h3>从第一个模块开始</h3><p>点击「添加模块」，或从左侧拖入一个组件。</p><button className="button primary" onClick={() => addNode("process")}><Plus size={16} />添加模块</button></div>}
        <div className="canvas-meta"><span className="canvas-label">CANVAS 01</span><span>{doc.nodes.length} 个模块<span className="meta-dot">·</span>{doc.edges.length} 条连线</span></div>
        <div className="zoom-controls"><button aria-label="缩小画布" title="缩小" onClick={() => flow.zoomOut({ duration: 200 })}><Minus size={15} /></button><span>{Math.round(zoom * 100)}%</span><button aria-label="放大画布" title="放大" onClick={() => flow.zoomIn({ duration: 200 })}><Plus size={15} /></button><span className="tool-divider" /><button aria-label="适应画布" title="显示完整图表" onClick={() => flow.fitView({ padding: .22, duration: 300, maxZoom: 1.15 })}><Maximize2 size={15} /></button></div>
      </div>
      <footer className="workspace-footer"><span><span className={`status-dot ${!persistence ? "warning" : ""}`} />{saveStatus}</span><span className="canvas-hint">拖动空白处平移<span>·</span>滚轮缩放<span>·</span>双击模块编辑</span></footer>
    </main>

    <aside className="inspector"><div className="inspector-heading"><span>样式与属性</span><SlidersHorizontal size={15} /></div>
      {node ? <div className="inspector-content"><div className="selection-caption"><span className="selection-icon"><Shapes size={16} /></span><div><strong>模块属性</strong><small>每一个细节，都由你定义</small></div></div>
        <label className="field"><span>模块标题 <small>{node.data.title.length}/120</small></span><textarea ref={titleInput} aria-label="模块标题" rows={2} maxLength={120} value={node.data.title} onFocus={checkpoint} onChange={event => patchNode(node.id, { data: { title: event.target.value } })} /></label>
        <label className="field"><span>辅助说明</span><textarea aria-label="辅助说明" rows={2} maxLength={200} value={node.data.subtitle} onFocus={checkpoint} onChange={event => patchNode(node.id, { data: { subtitle: event.target.value } })} /></label>
        <label className="field"><span>步骤标签</span><input aria-label="步骤标签" maxLength={48} value={node.data.kicker} onFocus={checkpoint} onChange={event => patchNode(node.id, { data: { kicker: event.target.value } })} /></label>
        <div className="inspector-rule" /><div className="field"><span>强调颜色</span><div className="color-palette">{COLORS.map(color => <button key={color} aria-label={`使用颜色 ${color}`} aria-pressed={node.data.color === color} style={{ background: color }} className={node.data.color === color ? "selected" : ""} onClick={() => { checkpoint(); patchNode(node.id, { data: { color } }); }}>{node.data.color === color && <Check size={13} strokeWidth={2.5} />}</button>)}</div></div>
        <div className="field"><span>图形样式</span><div className="shape-options">{([{ kind: "process", label: "圆角" }, { kind: "capsule", label: "胶囊" }, { kind: "note", label: "注释" }] as const).map(shape => <button key={shape.kind} className={node.data.kind === shape.kind ? "selected" : ""} aria-pressed={node.data.kind === shape.kind} onClick={() => { checkpoint(); patchNode(node.id, { data: { kind: shape.kind } }); }}>{shape.label}</button>)}</div></div>
        <div className="size-grid"><label className="field"><span>宽度</span><div className="number-field"><input aria-label="模块宽度" type="number" min={140} max={500} value={Math.round(node.width)} onFocus={checkpoint} onChange={event => { const n = Number(event.target.value); if (Number.isFinite(n) && n >= 140 && n <= 500) patchNode(node.id, { width: n }); }} /><small>px</small></div></label><label className="field"><span>高度</span><div className="number-field"><input aria-label="模块高度" type="number" min={132} max={320} value={Math.round(node.height)} onFocus={checkpoint} onChange={event => { const n = Number(event.target.value); if (Number.isFinite(n) && n >= 132 && n <= 320) patchNode(node.id, { height: n }); }} /><small>px</small></div></label></div>
        <div className="inspector-rule" /><div className="object-actions"><button className="button" onClick={duplicateNode}><Copy size={14} />复制模块</button><button className="icon-button delete-button" title="删除模块" aria-label="删除模块" onClick={removeSelection}><Trash2 size={16} /></button></div>
        <p className="inspector-tip"><Grip size={13} />拖动边缘控制点，可调整模块尺寸。</p>
      </div> : edge ? <div className="inspector-content"><div className="selection-caption"><span className="selection-icon"><GitBranch size={17} /></span><div><strong>连线属性</strong><small>表达模块之间的关系</small></div></div><label className="field"><span>连线说明</span><input aria-label="连线说明" maxLength={80} value={edge.label} onFocus={checkpoint} onChange={event => patchEdge(edge.id, { label: event.target.value })} /></label><div className="field"><span>连线颜色</span><div className="color-palette">{[...COLORS, "#A2ABA8"].map(color => <button key={color} aria-label={`连线颜色 ${color}`} aria-pressed={edge.color === color} style={{ background: color }} onClick={() => { checkpoint(); patchEdge(edge.id, { color }); }}>{edge.color === color && <Check size={13} />}</button>)}</div></div><button className="button danger-outline" onClick={removeSelection}><Trash2 size={15} />删除连线</button></div> : <div className="inspector-empty"><div><MousePointer2 size={27} strokeWidth={1.4} /></div><h3>选中，开始编辑</h3><p>点击画布中的模块或连线，<br />在这里调整它的内容与样式。</p><span>连接模块</span><p>从模块边缘的圆点拖向另一个模块，<br />即可建立一条新的连线。</p></div>}
      <div className="inspector-bottom"><span className="editable-icon"><Expand size={16} /></span><div><strong>为每一次发现，留出空间</strong><p>导出矢量图，继续你的研究表达。</p></div></div>
    </aside>
    <input ref={fileInput} type="file" accept=".json,application/json" aria-label="选择项目文件" className="visually-hidden" onChange={event => { importProject(event.target.files?.[0]); event.target.value = ""; }} />
    {toast && <div className="toast" role="status"><Check size={16} /><span>{toast}</span><button aria-label="关闭提示" onClick={() => setToast("")}><X size={14} /></button></div>}
    {pending && <Modal title={pending.label} onClose={() => setPending(null)}><p className="modal-description">这会替换当前画布。你可以先下载当前项目；替换后也可以在本次会话中使用「撤销」恢复。</p><div className="modal-actions"><button className="button" onClick={saveProject}><Download size={15} />下载当前项目</button><button className="button primary" onClick={() => { state.replace(pending.doc); setPending(null); notify("画布已更新，可通过撤销恢复上一张图。"); }}>替换画布<ArrowRight size={15} /></button></div></Modal>}
    {showAi && <AiGenerator connection={aiConnection} onConnectionChange={setAiConnection} onClose={() => setShowAi(false)} onApply={generated => { state.replace(generated); setShowAi(false); notify("生成图形已放入画布，可以继续编辑；撤销可恢复原图。"); }} />}
    {showHelp && <Modal title="开始你的第一张科研图" onClose={() => setShowHelp(false)}><div className="help-content"><p>拖动模块调整位置，双击模块编辑文字。将模块边缘的圆点拖向另一模块，可以创建连接。</p><div className="shortcut-row"><span>撤销 / 重做</span><kbd>Ctrl Z / Ctrl Shift Z</kbd></div><div className="shortcut-row"><span>复制选中模块</span><kbd>Ctrl D</kbd></div><div className="shortcut-row"><span>下载项目</span><kbd>Ctrl S</kbd></div><div className="shortcut-row"><span>删除选中对象</span><kbd>Delete</kbd></div><p className="help-note">Mac 可使用 ⌘ 代替 Ctrl。自动保存只保留在当前浏览器，请下载项目文件进行备份。SVG 可在支持矢量的编辑器中继续修改；跨设备使用时请确保字体可用。</p><p className="help-note">点击「AI 生成」，连接模型后输入研究描述。生成结果先预览，放入画布后仍可编辑和撤销。研究内容需由作者核对。</p></div></Modal>}
  </div>;
}

export function Editor() {
  return <ReactFlowProvider><EditorWorkspace /></ReactFlowProvider>;
}
