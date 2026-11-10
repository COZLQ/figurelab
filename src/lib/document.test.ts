import { describe, expect, it } from "vitest";
import { createTemplate } from "./templates";
import { parseDocument, serializeDocument } from "./document";
import { exportSvg, getPngDimensions } from "./svg";

describe("FigureLab document integrity", () => {
  it("preserves all objects through project save and import", () => {
    const doc = createTemplate("research");
    expect(parseDocument(JSON.parse(serializeDocument(doc)))).toEqual(doc);
  });
  it("rejects broken connections and duplicate module IDs", () => {
    const doc = createTemplate("experiment");
    doc.edges[0].target = "missing";
    expect(() => parseDocument(doc)).toThrow();
    const duplicate = createTemplate("research");
    duplicate.nodes[1].id = duplicate.nodes[0].id;
    expect(() => parseDocument(duplicate)).toThrow();
  });
  it("exports separate vector objects without embedded screenshots", () => {
    const doc = createTemplate("model");
    const svg = exportSvg(doc);
    expect((svg.match(/data-node-id=/g) || []).length).toBe(6);
    expect((svg.match(/data-edge-id=/g) || []).length).toBe(5);
    expect(svg).toContain("<text");
    expect(svg).not.toMatch(/<image|foreignObject|data:image/);
  });
  it("escapes imported text and rejects invalid color markup", () => {
    const doc = createTemplate("research");
    doc.title = '<script>alert("x")</script>';
    doc.nodes[0].data.title = '<img onerror="x">';
    const svg = exportSvg(doc);
    expect(svg).not.toMatch(/<script|<img/);
    expect(svg).toContain("&lt;script&gt;");
    doc.nodes[0].data.color = 'red" onload="alert(1)';
    expect(() => exportSvg(doc)).toThrow();
  });
  it("keeps nodes with negative coordinates within the export bounds", () => {
    const doc = createTemplate("research");
    doc.nodes[0].position = { x: -500, y: -300 };
    expect(exportSvg(doc)).toContain('viewBox="-548 -348');
  });
  it("crops export bounds to the actual diagram after moving it far from the origin", () => {
    const doc = createTemplate("research");
    doc.nodes.forEach(node => { node.position.x += 5000; node.position.y += 7000; });
    expect(exportSvg(doc)).toContain('viewBox="4952 6952 896 458"');
  });
  it("includes long edge labels in the export bounds", () => {
    const doc = createTemplate("research");
    doc.nodes = doc.nodes.slice(0, 2); doc.edges = doc.edges.slice(0, 1);
    doc.edges[0].label = "研究".repeat(40);
    const viewBox = exportSvg(doc).match(/viewBox="([^"]+)"/)![1].split(" ").map(Number);
    expect(viewBox[0]).toBeLessThan(-190);
  });
  it("removes control characters that cannot appear in an XML document", () => {
    const doc = createTemplate("research");
    doc.nodes[0].data.title = "研究\u0001问题";
    expect(exportSvg(doc)).not.toContain("\u0001");
  });
  it("limits panoramic PNG exports by both pixel count and maximum dimension", () => {
    expect(getPngDimensions(800, 450)).toEqual({ width: 1600, height: 900 });
    for (const [width, height] of [[200500, 200], [200, 200500], [200500, 200500]]) {
      const output = getPngDimensions(width, height);
      expect(output.width).toBeLessThanOrEqual(16384);
      expect(output.height).toBeLessThanOrEqual(16384);
      expect(output.width * output.height).toBeLessThanOrEqual(32_000_000);
    }
  });
  it("exports an empty canvas with valid nonzero dimensions", () => {
    const doc = createTemplate("research"); doc.nodes = []; doc.edges = [];
    expect(exportSvg(doc)).toContain('width="396" height="296"');
  });
});
