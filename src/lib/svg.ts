import { getSmoothStepPath, Position } from "@xyflow/react";
import { Anchor, FigureDocument, FigureNode, fileName, parseDocument } from "./document";

export const FONT_STACK = "'Segoe UI', 'Microsoft YaHei', 'PingFang SC', sans-serif";
export function escapeXml(value: string): string {
  return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g, "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

function charWidth(char: string, size: number) {
  return /[\u2e80-\uffff]/.test(char) ? size : char === " " ? size * .32 : size * .58;
}

export function wrapText(text: string, maxWidth: number, size: number, maxLines: number): string[] {
  const lines: string[] = []; let line = ""; let width = 0;
  const chars = Array.from(text.replace(/\r/g, ""));
  for (let i = 0; i < chars.length; i++) {
    const char = chars[i]; const w = charWidth(char, size);
    if (char === "\n" || width + w > maxWidth) {
      lines.push(line); line = ""; width = 0;
      if (lines.length === maxLines) {
        lines[maxLines - 1] = lines[maxLines - 1].replace(/.{1,2}$/, "") + "…";
        return lines;
      }
      if (char === "\n") continue;
    }
    line += char; width += w;
  }
  if (line || !lines.length) lines.push(line);
  return lines;
}

// Used by both the interactive node and the SVG exporter. All user text is XML-escaped.
export function nodeSvgContent(node: FigureNode): string {
  const { width: w, height: h, data } = node;
  const safeColor = /^#[0-9a-fA-F]{6}$/.test(data.color) ? data.color : "#65717B";
  const note = data.kind === "note";
  const radius = data.kind === "capsule" ? Math.min(w, h) / 2 : 14;
  const inset = data.kind === "capsule" ? 30 : 20;
  const textWidth = w - inset * 2;
  const titleLines = wrapText(data.title || "未命名模块", textWidth, 17, 2);
  const subtitleLines = wrapText(data.subtitle, textWidth, 10.5, h >= 120 ? 2 : 1);
  const titleY = data.kicker ? 55 : 38;
  const subtitleY = Math.max(titleY + titleLines.length * 22 + 5, h - (subtitleLines.length > 1 ? 30 : 23));
  return [
    `<rect x="0.75" y="0.75" width="${w - 1.5}" height="${h - 1.5}" rx="${radius}" fill="${note ? "#FFFCF4" : "#FFFFFF"}" stroke="${note ? "#D8C8A6" : "#DCE1DD"}" stroke-width="1.5"${note ? ' stroke-dasharray="5 4"' : ""}/>` ,
    data.kicker ? `<text x="${inset}" y="26" font-size="9" font-weight="650" letter-spacing="1" fill="${safeColor}">${escapeXml(wrapText(data.kicker, textWidth - 15, 9, 1)[0])}</text>` : "",
    `<circle cx="${w - inset - 3}" cy="23" r="3" fill="${safeColor}" opacity=".65"/>`,
    ...titleLines.map((line, i) => `<text x="${inset}" y="${titleY + i * 22}" font-size="17" font-weight="600" fill="#293E36">${escapeXml(line)}</text>`),
    ...subtitleLines.filter(Boolean).map((line, i) => `<text x="${inset}" y="${subtitleY + i * 15}" font-size="10.5" fill="#7E8A84">${escapeXml(line)}</text>`),
  ].join("");
}

export function anchorPoint(node: FigureNode, anchor: Anchor) {
  const { x, y } = node.position;
  return {
    top: { x: x + node.width / 2, y },
    right: { x: x + node.width, y: y + node.height / 2 },
    bottom: { x: x + node.width / 2, y: y + node.height },
    left: { x, y: y + node.height / 2 },
  }[anchor];
}

export const anchorPosition: Record<Anchor, Position> = { top: Position.Top, right: Position.Right, bottom: Position.Bottom, left: Position.Left };

export function exportSvg(input: FigureDocument): string {
  const doc = parseDocument(input);
  const nodeMap = new Map(doc.nodes.map(n => [n.id, n]));
  const edgeLayouts = doc.edges.map(edge => {
    const source = anchorPoint(nodeMap.get(edge.source)!, edge.sourceAnchor);
    const target = anchorPoint(nodeMap.get(edge.target)!, edge.targetAnchor);
    const [path, labelX, labelY] = getSmoothStepPath({ sourceX: source.x, sourceY: source.y, targetX: target.x, targetY: target.y, sourcePosition: anchorPosition[edge.sourceAnchor], targetPosition: anchorPosition[edge.targetAnchor], borderRadius: 16, offset: 24 });
    const labelWidth = Array.from(edge.label).length * 12 + 16;
    return { edge, path, labelX, labelY, labelWidth };
  });
  const labels = edgeLayouts.filter(item => item.edge.label);
  const minX = Math.min(...(doc.nodes.length ? doc.nodes.map(n => n.position.x) : [0]), ...labels.map(item => item.labelX - item.labelWidth / 2)) - 48;
  const minY = Math.min(...(doc.nodes.length ? doc.nodes.map(n => n.position.y) : [0]), ...labels.map(item => item.labelY - 12)) - 48;
  const maxX = Math.max(...(doc.nodes.length ? doc.nodes.map(n => n.position.x + n.width) : [300]), ...labels.map(item => item.labelX + item.labelWidth / 2)) + 48;
  const maxY = Math.max(...(doc.nodes.length ? doc.nodes.map(n => n.position.y + n.height) : [200]), ...labels.map(item => item.labelY + 12)) + 48;
  const width = maxX - minX; const height = maxY - minY;
  const edges = edgeLayouts.map(({ edge, path, labelX, labelY, labelWidth }) => {
    return `<g data-edge-id="${edge.id}"><path d="${path}" fill="none" stroke="${edge.color}" stroke-width="1.6" marker-end="url(#arrow-${edge.id})"/>${edge.label ? `<rect x="${labelX - labelWidth / 2}" y="${labelY - 12}" width="${labelWidth}" height="24" rx="5" fill="#FFFFFF"/><text x="${labelX}" y="${labelY + 4}" text-anchor="middle" font-size="11" fill="#69766F">${escapeXml(edge.label)}</text>` : ""}</g>`;
  }).join("");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${minX} ${minY} ${width} ${height}" font-family="${FONT_STACK}"><title>${escapeXml(doc.title)}</title><desc>Editable diagram created with FigureLab. Text, shapes and connectors are separate vector objects.</desc><defs>${doc.edges.map(e => `<marker id="arrow-${e.id}" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto" markerUnits="userSpaceOnUse"><path d="M1 1L7 4L1 7" fill="none" stroke="${e.color}" stroke-width="1.4" stroke-linejoin="round"/></marker>`).join("")}</defs>${edges}${doc.nodes.map(node => `<g data-node-id="${node.id}" transform="translate(${node.position.x},${node.position.y})">${nodeSvgContent(node)}</g>`).join("")}</svg>`;
}

export function getPngDimensions(width: number, height: number) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) throw new Error("无效的图片尺寸");
  const maxPixels = 32_000_000;
  const maxDimension = 16_384;
  const scale = Math.min(2, Math.sqrt(maxPixels / (width * height)), maxDimension / width, maxDimension / height);
  return { width: Math.max(1, Math.floor(width * scale)), height: Math.max(1, Math.floor(height * scale)) };
}

export function downloadFile(content: BlobPart, filename: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement("a"); anchor.href = url; anchor.download = filename;
  document.body.appendChild(anchor); anchor.click(); anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function downloadPng(doc: FigureDocument) {
  await document.fonts.ready;
  const svg = exportSvg(doc);
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error("图像转换失败")); image.src = url; });
    const dimensions = getPngDimensions(image.width, image.height);
    const canvas = document.createElement("canvas"); canvas.width = dimensions.width; canvas.height = dimensions.height;
    const context = canvas.getContext("2d"); if (!context) throw new Error("浏览器不支持图像导出");
    context.fillStyle = "#FFFFFF"; context.fillRect(0, 0, canvas.width, canvas.height); context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error("PNG 生成失败")), "image/png"));
    downloadFile(blob, `${fileName(doc.title)}.png`, "image/png");
  } finally { URL.revokeObjectURL(url); }
}
