"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Expand, Hand, Maximize2, Minus, Plus, ScanLine, Shrink } from "lucide-react";
import type { FigureDocument } from "@/lib/document";
import { exportSvg } from "@/lib/svg";
import { clampPreview, fitPreview, MAX_PREVIEW_SCALE, MIN_PREVIEW_SCALE, readablePreview, svgSize, zoomPreview, type PreviewTransform, type Size } from "@/lib/preview";

interface Frame { viewport: Size; transform: PreviewTransform; initialized: boolean; fit: boolean }

export function DiagramPreview({ document, expanded, onExpandedChange }: { document: FigureDocument; expanded: boolean; onExpandedChange: (expanded: boolean) => void }) {
  const svg = useMemo(() => exportSvg(document).replace(/^<\?xml[^>]*>\s*/, ""), [document]);
  const diagram = useMemo(() => svgSize(svg), [svg]);
  const viewportRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: number; x: number; y: number; initial: PreviewTransform } | null>(null);
  const [dragging, setDragging] = useState(false);
  const [frame, setFrame] = useState<Frame>({ viewport: { width: 0, height: 0 }, transform: { scale: .85, x: 0, y: 0 }, initialized: false, fit: false });

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const resize = () => {
      const size = { width: viewport.clientWidth, height: viewport.clientHeight };
      if (size.width <= 0 || size.height <= 0) return;
      setFrame(previous => ({ viewport: size, initialized: true, fit: previous.fit, transform: !previous.initialized ? readablePreview(diagram, size) : previous.fit ? fitPreview(diagram, size) : clampPreview({ ...previous.transform, x: previous.transform.x + (size.width - previous.viewport.width) / 2, y: previous.transform.y + (size.height - previous.viewport.height) / 2 }, diagram, size) }));
    };
    resize(); const observer = new ResizeObserver(resize); observer.observe(viewport);
    return () => observer.disconnect();
  }, [diagram]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = viewport.getBoundingClientRect();
      setFrame(previous => ({ ...previous, fit: false, transform: event.ctrlKey || event.metaKey
        ? zoomPreview(previous.transform, previous.transform.scale * Math.exp(-event.deltaY * .005), { x: event.clientX - rect.left, y: event.clientY - rect.top }, diagram, previous.viewport)
        : clampPreview({ ...previous.transform, x: previous.transform.x - (event.shiftKey ? event.deltaY : event.deltaX), y: previous.transform.y - (event.shiftKey ? 0 : event.deltaY) }, diagram, previous.viewport) }));
    };
    viewport.addEventListener("wheel", wheel, { passive: false });
    return () => viewport.removeEventListener("wheel", wheel);
  }, [diagram]);

  const zoomTo = (scale: number) => setFrame(previous => ({ ...previous, fit: false, transform: zoomPreview(previous.transform, scale, { x: previous.viewport.width / 2, y: previous.viewport.height / 2 }, diagram, previous.viewport) }));
  const fit = () => setFrame(previous => ({ ...previous, fit: true, transform: fitPreview(diagram, previous.viewport) }));
  const move = (x: number, y: number) => setFrame(previous => ({ ...previous, fit: false, transform: clampPreview({ ...previous.transform, x: previous.transform.x + x, y: previous.transform.y + y }, diagram, previous.viewport) }));

  return <div className="diagram-preview">
    <div className="preview-toolbar"><div className="preview-zoom"><button aria-label="缩小预览" title="缩小" disabled={frame.transform.scale <= MIN_PREVIEW_SCALE} onClick={() => zoomTo(frame.transform.scale / 1.25)}><Minus size={15} /></button><button className="preview-percent" aria-label="预览实际大小" title="实际大小 · 100%" onClick={() => zoomTo(1)}>{Math.round(frame.transform.scale * 100)}%</button><button aria-label="放大预览" title="放大" disabled={frame.transform.scale >= MAX_PREVIEW_SCALE} onClick={() => zoomTo(frame.transform.scale * 1.25)}><Plus size={15} /></button></div><div className="preview-view-actions"><button className={frame.fit ? "active" : ""} aria-label="预览适应窗口" title="显示完整图形" onClick={fit}><ScanLine size={15} /><span>适应窗口</span></button><span className="preview-toolbar-divider" /><button aria-label={expanded ? "收起预览" : "展开预览"} title={expanded ? "返回双栏" : "放大查看"} onClick={() => onExpandedChange(!expanded)}>{expanded ? <Shrink size={15} /> : <Expand size={15} />}</button></div></div>
    <div ref={viewportRef} className={`preview-viewport ${dragging ? "is-dragging" : ""}`} tabIndex={0} role="region" aria-label="图形预览画布" aria-describedby="preview-navigation-hint"
      onPointerDown={event => { if (event.button !== 0) return; event.currentTarget.focus({ preventScroll: true }); event.currentTarget.setPointerCapture(event.pointerId); drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, initial: frame.transform }; setDragging(true); }}
      onPointerMove={event => { const start = drag.current; if (!start || start.id !== event.pointerId) return; setFrame(previous => ({ ...previous, fit: false, transform: clampPreview({ ...start.initial, x: start.initial.x + event.clientX - start.x, y: start.initial.y + event.clientY - start.y }, diagram, previous.viewport) })); }}
      onPointerUp={event => { if (drag.current?.id === event.pointerId) { drag.current = null; setDragging(false); if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); } }}
      onLostPointerCapture={() => { drag.current = null; setDragging(false); }}
      onKeyDown={event => { if (["+", "=", "-", "0", "Home", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) event.preventDefault(); if (["+", "="].includes(event.key)) zoomTo(frame.transform.scale * 1.25); else if (event.key === "-") zoomTo(frame.transform.scale / 1.25); else if (event.key === "0") zoomTo(1); else if (event.key === "Home") fit(); else if (event.key === "ArrowLeft") move(40, 0); else if (event.key === "ArrowRight") move(-40, 0); else if (event.key === "ArrowUp") move(0, 40); else if (event.key === "ArrowDown") move(0, -40); }}>
      <div className="preview-surface" role="img" aria-label="AI 生成图形预览" style={{ width: diagram.width, height: diagram.height, opacity: frame.initialized ? 1 : 0, transform: `translate(${frame.transform.x}px, ${frame.transform.y}px) scale(${frame.transform.scale})` }} dangerouslySetInnerHTML={{ __html: svg }} />
    </div>
    <div className="preview-navigation" id="preview-navigation-hint"><span><Hand size={12} />拖动平移 · Ctrl / ⌘ + 滚轮缩放</span><span><Maximize2 size={11} />可展开查看</span></div>
  </div>;
}
