export interface Size { width: number; height: number }
export interface PreviewTransform { scale: number; x: number; y: number }
export const MIN_PREVIEW_SCALE = 0.01;
export const MAX_PREVIEW_SCALE = 3;
const PADDING = 24;

export function svgSize(svg: string): Size {
  const values = svg.match(/\bviewBox="([^"]+)"/)?.[1].split(/\s+/).map(Number);
  if (!values || values.length !== 4 || !values.every(Number.isFinite) || values[2] <= 0 || values[3] <= 0) throw new Error("无效的预览尺寸");
  return { width: values[2], height: values[3] };
}

export function clampPreview(transform: PreviewTransform, diagram: Size, viewport: Size): PreviewTransform {
  const scale = Math.max(MIN_PREVIEW_SCALE, Math.min(MAX_PREVIEW_SCALE, transform.scale));
  const axis = (offset: number, content: number, available: number) => content <= available - PADDING * 2
    ? (available - content) / 2
    : Math.max(available - content - PADDING, Math.min(PADDING, offset));
  return { scale, x: axis(transform.x, diagram.width * scale, viewport.width), y: axis(transform.y, diagram.height * scale, viewport.height) };
}

export function fitPreview(diagram: Size, viewport: Size): PreviewTransform {
  const scale = Math.max(MIN_PREVIEW_SCALE, Math.min(1.25, Math.max(1, viewport.width - PADDING * 2) / diagram.width, Math.max(1, viewport.height - PADDING * 2) / diagram.height));
  return clampPreview({ scale, x: (viewport.width - diagram.width * scale) / 2, y: (viewport.height - diagram.height * scale) / 2 }, diagram, viewport);
}

export function readablePreview(diagram: Size, viewport: Size): PreviewTransform {
  return clampPreview({ scale: Math.min(1, Math.max(.85, fitPreview(diagram, viewport).scale)), x: PADDING, y: PADDING }, diagram, viewport);
}

export function zoomPreview(transform: PreviewTransform, newScale: number, anchor: { x: number; y: number }, diagram: Size, viewport: Size): PreviewTransform {
  const scale = Math.max(MIN_PREVIEW_SCALE, Math.min(MAX_PREVIEW_SCALE, newScale));
  const ratio = scale / transform.scale;
  return clampPreview({ scale, x: anchor.x - (anchor.x - transform.x) * ratio, y: anchor.y - (anchor.y - transform.y) * ratio }, diagram, viewport);
}
