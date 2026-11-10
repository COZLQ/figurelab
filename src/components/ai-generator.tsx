"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, Check, ChevronDown, CircleAlert, Clock3, KeyRound, LoaderCircle, Network, RefreshCw, Settings2, ShieldCheck, Sparkles, Square, X } from "lucide-react";
import { Modal } from "./modal";
import { DiagramPreview } from "./diagram-preview";
import { defaultConnection, diagramTypeLabels, diagramTypes, type AiConnection, type GenerationRequest } from "@/lib/ai/plan";
import { parseDocument, type FigureDocument } from "@/lib/document";

interface ConnectionStatus { configured: boolean; baseUrl: string; model: string; jsonMode: boolean }
interface GeneratedResult { document: FigureDocument; notes: string[]; model: string }
const examples = [
  { label: "药物递送", type: "workflow" as const, text: "绘制纳米颗粒药物递送研究流程：先制备载药纳米颗粒并表征粒径和载药情况，再进行体外释放实验与细胞摄取观察，最后比较不同制剂的递送表现。请保留制剂表征和体外实验的并行关系，尚未提供的实验参数标为待确认。" },
  { label: "图像分类", type: "architecture" as const, text: "绘制图像分类模型架构：输入图像经过预处理，再由两个并行分支提取局部特征和全局特征，随后融合特征并输出分类预测。另用独立测试集评估模型。请清楚区分模型主干与评估流程。" },
  { label: "对照实验", type: "experiment" as const, text: "绘制对照实验设计：研究对象经过筛选和基线测量后随机分为对照组与干预组，两组分别接受预先规定的处理，然后在统一时间点测量结果并开展组间比较。未确定的样本量和处理参数列为待确认事项，不要编造具体数值。" },
];

export function AiGenerator({ connection, onConnectionChange, onApply, onClose }: {
  connection: AiConnection; onConnectionChange: (connection: AiConnection) => void;
  onApply: (doc: FigureDocument) => void; onClose: () => void;
}) {
  const [description, setDescription] = useState("");
  const [diagramType, setDiagramType] = useState<GenerationRequest["diagramType"]>("workflow");
  const [direction, setDirection] = useState<"LR" | "TB">("TB");
  const [status, setStatus] = useState<ConnectionStatus | null>(null);
  const [statusFailed, setStatusFailed] = useState(false);
  const [source, setSource] = useState<"server" | "session">("session");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [errorCode, setErrorCode] = useState("");
  const [info, setInfo] = useState("");
  const [result, setResult] = useState<GeneratedResult | null>(null);
  const [resultSignature, setResultSignature] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [notesOpen, setNotesOpen] = useState(true);
  const [elapsed, setElapsed] = useState(0);
  const [stage, setStage] = useState<"waiting" | "validating">("waiting");
  const [connectionVerified, setConnectionVerified] = useState(false);
  const request = useRef<AbortController | null>(null);
  const settingsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/ai/status", { cache: "no-store", signal: controller.signal }).then(async response => {
      if (!response.ok) throw new Error();
      const data = await response.json() as ConnectionStatus;
      if (typeof data.configured !== "boolean" || typeof data.model !== "string" || typeof data.baseUrl !== "string") throw new Error();
      setStatus(data);
      if (data.configured && !connection.apiKey.trim()) setSource("server");
      else if (!connection.apiKey.trim()) setSettingsOpen(true);
    }).catch(() => { if (!controller.signal.aborted) { setStatusFailed(true); setSettingsOpen(true); } });
    return () => controller.abort();
    // Session configuration belongs to the parent and is read once on opening.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => () => { request.current?.abort(); }, []);
  useEffect(() => {
    if (!busy) return;
    const start = performance.now(); setElapsed(0);
    const timer = setInterval(() => setElapsed(Math.floor((performance.now() - start) / 1000)), 1000);
    return () => clearInterval(timer);
  }, [busy]);
  useEffect(() => { setConnectionVerified(false); }, [connection.apiKey, connection.baseUrl, connection.model, connection.jsonMode, source]);

  const ready = source === "server" ? !!status?.configured : !!(connection.apiKey.trim() && connection.baseUrl.trim() && connection.model.trim());
  const usedModel = source === "server" ? status?.model : connection.model;
  const inputSignature = JSON.stringify([description.trim(), diagramType, direction]);
  const previewOutdated = !!result && resultSignature !== inputSignature;
  const updateConnection = (patch: Partial<AiConnection>) => { setError(""); onConnectionChange({ ...connection, ...patch }); };
  const close = () => { request.current?.abort(); onClose(); };
  const cancel = () => { request.current?.abort(); request.current = null; setBusy(false); setInfo("已取消生成，当前画布未改动。"); };
  const showSettings = () => { setSettingsOpen(true); requestAnimationFrame(() => settingsRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" })); };
  const needsConnectionCheck = ["NOT_CONFIGURED", "AUTH_FAILED", "INVALID_ENDPOINT", "MODEL_REQUEST_REJECTED", "NETWORK_ERROR", "QUOTA_EXCEEDED"].includes(errorCode);

  const generate = async () => {
    if (busy) return;
    setError(""); setErrorCode(""); setInfo("");
    if (description.trim().length < 10) { setErrorCode("INVALID_REQUEST"); setError("请至少输入 10 个字，描述研究目标或关键步骤。"); return; }
    if (!ready) { showSettings(); setErrorCode("NOT_CONFIGURED"); setError("请先填写模型连接信息，再开始生成。"); return; }
    const controller = new AbortController(); request.current = controller;
    setBusy(true); setStage("waiting");
    try {
      const response = await fetch("/api/generate", {
        method: "POST", headers: { "Content-Type": "application/json" }, signal: controller.signal,
        body: JSON.stringify({ description: description.trim(), diagramType, direction, ...(source === "session" ? { connection } : {}) }),
      });
      const payload = await response.json();
      if (controller.signal.aborted) return;
      if (!response.ok) { setError(payload?.error?.message || "生成未完成，请稍后重试。"); setErrorCode(payload?.error?.code || "GENERATION_FAILED"); return; }
      setStage("validating");
      const document = parseDocument(payload.document);
      if (!Array.isArray(payload.notes) || payload.notes.some((note: unknown) => typeof note !== "string") || typeof payload.model !== "string") throw new Error();
      setResult({ document, notes: payload.notes, model: payload.model });
      setResultSignature(JSON.stringify([description.trim(), diagramType, direction]));
      setNotesOpen(true); setConnectionVerified(true);
    } catch {
      if (!controller.signal.aborted) { setErrorCode("NETWORK_ERROR"); setError("生成未完成，请检查网络或模型连接设置。当前画布未修改。"); }
    } finally { if (request.current === controller) { request.current = null; setBusy(false); } }
  };

  return <Modal title="AI 生成科研图" className={`ai-modal ${expanded ? "ai-modal-expanded" : ""}`} onClose={close}>
    <div className="ai-layout">
      <section className="ai-compose"><div className="ai-compose-scroll"><div className="ai-eyebrow"><Sparkles size={13} />FROM WORDS TO FIGURES</div><h3>写下研究，<span>看见结构。</span></h3><p className="ai-intro">描述你的研究目标、关键步骤和连接关系。</p>
        <label className="ai-description-label"><span>研究描述 <small>{description.length}/6000</small></span><textarea aria-label="研究描述" placeholder="例如：研究对象随机分为对照组与干预组，两组分别处理后测量结果，最后进行组间比较……" rows={6} maxLength={6000} disabled={busy} value={description} onChange={event => { setDescription(event.target.value); setError(""); }} onKeyDown={event => { if ((event.ctrlKey || event.metaKey) && event.key === "Enter") { event.preventDefault(); generate(); } }} /></label>
        <div className="ai-examples"><span>试一试</span>{examples.map(example => <button key={example.label} disabled={busy} onClick={() => { setDescription(example.text); setDiagramType(example.type); setError(""); }}>{example.label}<ArrowRight size={10} /></button>)}</div>
        <div className="ai-options"><label><span>图形类型</span><select aria-label="生成图形类型" disabled={busy} value={diagramType} onChange={event => { setDiagramType(event.target.value as GenerationRequest["diagramType"]); }}>{diagramTypes.map(type => <option key={type} value={type}>{diagramTypeLabels[type]}</option>)}</select></label><label><span>排列方向</span><select aria-label="生成排列方向" disabled={busy} value={direction} onChange={event => { setDirection(event.target.value as "LR" | "TB"); }}><option value="TB">从上到下</option><option value="LR">从左到右</option></select></label></div>
        <div className="ai-connection" ref={settingsRef}><button className="ai-connection-heading" aria-expanded={settingsOpen} onClick={() => setSettingsOpen(!settingsOpen)}><span><Settings2 size={14} />模型连接</span><span className={ready ? "connection-ready" : "connection-pending"}>{connectionVerified ? "连接已验证" : ready ? source === "server" ? "使用本机配置" : "会话信息已填写" : status || statusFailed ? "待配置" : "检查配置中"}<ChevronDown size={13} /></span></button>
          {settingsOpen && <div className="ai-connection-form">
            {status?.configured && <div className="ai-config-source"><button disabled={busy} className={source === "server" ? "active" : ""} onClick={() => setSource("server")}>本机配置</button><button disabled={busy} className={source === "session" ? "active" : ""} onClick={() => setSource("session")}>本次会话</button></div>}
            {source === "server" && status?.configured ? <p className="ai-server-config"><ShieldCheck size={15} /><span>{status.model}<small>{status.baseUrl}</small></span></p> : <>
              <label className="field"><span>API 地址</span><input type="url" aria-label="AI API 地址" disabled={busy} value={connection.baseUrl} placeholder={defaultConnection.baseUrl} onChange={event => updateConnection({ baseUrl: event.target.value })} spellCheck={false} /></label>
              <label className="field"><span>模型名称</span><input aria-label="AI 模型名称" disabled={busy} value={connection.model} placeholder={defaultConnection.model} onChange={event => updateConnection({ model: event.target.value })} spellCheck={false} /></label>
              <label className="field"><span>API Key</span><input type="password" aria-label="AI API Key" autoComplete="off" disabled={busy} value={connection.apiKey} placeholder="粘贴你的密钥，仅本次会话使用" onChange={event => updateConnection({ apiKey: event.target.value })} spellCheck={false} /></label>
              <label className="ai-json-toggle"><input type="checkbox" checked={connection.jsonMode} disabled={busy} onChange={event => updateConnection({ jsonMode: event.target.checked })} />服务支持 JSON 输出模式</label>
              <p className="ai-key-note"><KeyRound size={12} />密钥不写入图表或浏览器存储，刷新页面后需重填。</p>
            </>}
            {statusFailed && <p className="ai-key-note">暂时无法读取本机配置，可填写本次会话连接信息。</p>}
          </div>}
        </div>
        </div><footer className="ai-compose-footer">
        {error && <div className="ai-error" role="alert"><CircleAlert size={16} /><div><strong>这次生成未完成</strong><p>{error}</p><button className="ai-error-action" onClick={needsConnectionCheck ? showSettings : generate}>{needsConnectionCheck ? <Settings2 size={12} /> : <RefreshCw size={12} />}{needsConnectionCheck ? "检查连接设置" : "重新尝试"}</button></div><button className="ai-dismiss-error" aria-label="关闭生成错误提示" onClick={() => setError("")}><X size={13} /></button></div>}
        {info && <div className="ai-info" role="status"><Check size={14} />{info}</div>}
        {busy && <div className="ai-request-status" role="status"><span><span className="ai-wait-dot" />{stage === "waiting" ? "等待模型返回研究结构" : "正在校验图形结构"}</span><span><Clock3 size={12} />已等待 {elapsed} 秒</span></div>}
        <div className="ai-generate-actions">{busy ? <><button className="button ai-cancel" onClick={cancel}><Square size={12} />取消</button><button className="button primary ai-generate" disabled><LoaderCircle size={16} className="spin" />{stage === "waiting" ? "正在生成…" : "正在校验…"}</button></> : <button className="button primary ai-generate" disabled={description.trim().length < 10} onClick={generate}><Sparkles size={16} />{result ? "重新生成" : "生成可编辑图形"}<ArrowRight size={15} /></button>}</div>
        <p className="ai-send-note">点击生成后，研究描述将发送到你配置的模型服务。请核对生成内容的科学准确性。</p>
        </footer>
      </section>
      <section className="ai-result"><div className="ai-result-heading"><span><Network size={14} />生成预览</span>{result && <small>{result.document.nodes.length} 个模块 · {result.document.edges.length} 条连线</small>}</div>
        {result ? <>
          <div className="ai-preview-title"><h4>{result.document.title}</h4><span><Check size={12} />结构校验通过 · 可继续编辑</span></div>
          {busy && <div className="ai-preview-notice" role="status"><LoaderCircle size={13} className="spin" /><span>正在重新生成 · 已等待 {elapsed} 秒，上次预览仍保留</span><button onClick={cancel}>取消</button></div>}
          {!busy && (error || previewOutdated) && <div className="ai-preview-notice is-retained"><CircleAlert size={13} />{previewOutdated ? "描述或选项已修改，当前仍显示上次结果" : "仍显示上一次成功生成的预览"}</div>}
          <DiagramPreview key={result.document.id} document={result.document} expanded={expanded} onExpandedChange={value => { setExpanded(value); if (value) setNotesOpen(false); }} />
          <div className="ai-result-summary"><span>由 {result.model} 生成</span><span>文字、形状与连线均可编辑</span></div>
          {result.notes.length > 0 && <details className="ai-notes" open={notesOpen} onToggle={event => setNotesOpen(event.currentTarget.open)}><summary>待核对事项<span>{result.notes.length} 项</span><ChevronDown size={12} /></summary><div className="ai-notes-content">{result.notes.map((note, index) => <p key={index}>{note}</p>)}</div></details>}
          <footer className="ai-apply"><p><ShieldCheck size={13} />{previewOutdated ? "可使用上次结果，或重新生成后再放入。" : "确认后替换当前画布，原图可撤销恢复。"}</p><button className="button primary" disabled={busy} onClick={() => onApply(result.document)}>{previewOutdated ? "使用上次结果" : "放入画布"}<ArrowRight size={15} /></button></footer>
        </> : <div className={`ai-preview-empty ${busy ? "generating" : ""}`}><div className="ai-preview-symbol">{busy ? <LoaderCircle size={31} className="spin" /> : <Sparkles size={31} strokeWidth={1.3} />}</div><h4>{busy ? "正在构建研究图形" : "你的下一张图，从这里开始"}</h4><p>{busy ? "等待模型响应，返回后会检查步骤与连接关系。" : "生成后先预览，满意后再放入画布。"}</p><div className="ai-empty-diagram" aria-hidden="true"><i /><span /><i /><span /><i /></div><small>{busy ? `正在请求 ${usedModel || "模型服务"} · 已等待 ${elapsed} 秒` : "每个模块都能继续拖动、改字与导出。"}</small>{busy && <button className="ai-empty-cancel" onClick={cancel}>取消本次生成</button>}</div>}
      </section>
    </div>
  </Modal>;
}
