import { describe, expect, it } from "vitest";
import { clampPreview, fitPreview, readablePreview, svgSize, zoomPreview } from "./preview";

describe("readable diagram preview", () => {
  it("fits a large diagram inside the viewport with room at the edges", () => {
    const diagram = { width: 1400, height: 900 }; const viewport = { width: 520, height: 360 };
    const view = fitPreview(diagram, viewport);
    expect(view.x).toBeGreaterThanOrEqual(23);
    expect(view.y).toBeGreaterThanOrEqual(23);
    expect(view.x + diagram.width * view.scale).toBeLessThanOrEqual(viewport.width - 23);
    expect(view.y + diagram.height * view.scale).toBeLessThanOrEqual(viewport.height - 23);
  });
  it("keeps long workflows readable instead of shrinking every label to fit", () => {
    const view = readablePreview({ width: 6400, height: 500 }, { width: 480, height: 350 });
    expect(view.scale).toBeGreaterThanOrEqual(.85);
  });
  it("can still fit a twenty-step workflow into a narrow viewport", () => {
    const diagram = { width: 6500, height: 500 }; const viewport = { width: 300, height: 220 };
    const view = fitPreview(diagram, viewport);
    expect(view.x + diagram.width * view.scale).toBeLessThanOrEqual(viewport.width - 23);
    expect(view.y + diagram.height * view.scale).toBeLessThanOrEqual(viewport.height - 23);
  });
  it("keeps the world point under the cursor fixed during zoom", () => {
    const previous = { scale: .8, x: -100, y: -70 }; const anchor = { x: 250, y: 200 };
    const next = zoomPreview(previous, 1.2, anchor, { width: 1600, height: 1400 }, { width: 600, height: 500 });
    expect((anchor.x - next.x) / next.scale).toBeCloseTo((anchor.x - previous.x) / previous.scale);
    expect((anchor.y - next.y) / next.scale).toBeCloseTo((anchor.y - previous.y) / previous.scale);
  });
  it("prevents panning a diagram completely out of view and centers small diagrams", () => {
    const diagram = { width: 1000, height: 800 }; const viewport = { width: 500, height: 400 };
    const far = clampPreview({ scale: 1, x: -50000, y: 50000 }, diagram, viewport);
    expect(far.x + diagram.width).toBeGreaterThan(viewport.width - 25);
    expect(far.y).toBeLessThanOrEqual(24);
    expect(clampPreview({ scale: 1, x: 5000, y: -8000 }, { width: 100, height: 100 }, viewport)).toEqual({ scale: 1, x: 200, y: 150 });
  });
  it("uses SVG viewBox dimensions including negative-origin export padding", () => {
    expect(svgSize('<svg viewBox="-48 -48 1296 458"></svg>')).toEqual({ width: 1296, height: 458 });
    expect(() => svgSize('<svg viewBox="0 0 0 20"></svg>')).toThrow();
  });
});
