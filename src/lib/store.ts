import { create } from "zustand";
import { FigureData, FigureDocument, FigureEdge, FigureNode } from "./document";
import { createTemplate, TemplateKey } from "./templates";

interface EditorState {
  doc: FigureDocument;
  selectedNode: string | null;
  selectedEdge: string | null;
  past: FigureDocument[];
  future: FigureDocument[];
  fitRevision: number;
  select: (node: string | null, edge?: string | null) => void;
  checkpoint: () => void;
  replace: (doc: FigureDocument) => void;
  loadTemplate: (key: TemplateKey) => void;
  patchDocument: (patch: Partial<FigureDocument>) => void;
  patchNode: (id: string, patch: Omit<Partial<FigureNode>, "data"> & { data?: Partial<FigureData> }) => void;
  patchEdge: (id: string, patch: Partial<FigureEdge>) => void;
  addNode: (kind: FigureData["kind"], position: { x: number; y: number }) => string | null;
  duplicateNode: () => void;
  removeSelection: () => void;
  connect: (edge: FigureEdge) => void;
  undo: () => void;
  redo: () => void;
}

const touch = (doc: FigureDocument) => ({ ...doc, updatedAt: new Date().toISOString() });

export const useEditorStore = create<EditorState>((set, get) => ({
  doc: createTemplate("research"), selectedNode: "node-2", selectedEdge: null, past: [], future: [], fitRevision: 0,
  select: (node, edge = null) => set({ selectedNode: node, selectedEdge: edge }),
  checkpoint: () => set(s => ({ past: [...s.past.slice(-79), s.doc], future: [] })),
  replace: doc => { get().checkpoint(); set(s => ({ doc: touch(doc), selectedNode: null, selectedEdge: null, fitRevision: s.fitRevision + 1 })); },
  loadTemplate: key => get().replace(createTemplate(key)),
  patchDocument: patch => set(s => ({ doc: touch({ ...s.doc, ...patch }) })),
  patchNode: (id, patch) => set(s => ({ doc: touch({ ...s.doc, nodes: s.doc.nodes.map(node => node.id === id ? { ...node, ...patch, data: { ...node.data, ...patch.data } } : node) }) })),
  patchEdge: (id, patch) => set(s => ({ doc: touch({ ...s.doc, edges: s.doc.edges.map(edge => edge.id === id ? { ...edge, ...patch } : edge) }) })),
  addNode: (kind, position) => {
    if (get().doc.nodes.length >= 300) return null;
    get().checkpoint(); const id = crypto.randomUUID();
    set(s => ({ doc: touch({ ...s.doc, nodes: [...s.doc.nodes, { id, position, width: 220, height: 132, data: { kind, title: kind === "note" ? "补充说明" : "新的研究模块", subtitle: "双击模块或在右侧编辑", kicker: kind === "note" ? "NOTE" : "STEP", color: kind === "note" ? "#BB9655" : "#4D9688" } }] }), selectedNode: id, selectedEdge: null }));
    return id;
  },
  duplicateNode: () => {
    const node = get().doc.nodes.find(n => n.id === get().selectedNode);
    if (!node || get().doc.nodes.length >= 300) return;
    get().checkpoint(); const id = crypto.randomUUID();
    set(s => ({ doc: touch({ ...s.doc, nodes: [...s.doc.nodes, { ...node, id, position: { x: node.position.x + 35, y: node.position.y + 35 }, data: { ...node.data } }] }), selectedNode: id, selectedEdge: null }));
  },
  removeSelection: () => {
    const { selectedNode, selectedEdge } = get(); if (!selectedNode && !selectedEdge) return;
    get().checkpoint();
    set(s => ({ doc: touch({ ...s.doc, nodes: s.doc.nodes.filter(n => n.id !== selectedNode), edges: s.doc.edges.filter(e => e.id !== selectedEdge && e.source !== selectedNode && e.target !== selectedNode) }), selectedNode: null, selectedEdge: null }));
  },
  connect: edge => {
    const state = get();
    if (state.doc.edges.length >= 1000 || edge.source === edge.target || state.doc.edges.some(e => e.source === edge.source && e.target === edge.target && e.sourceAnchor === edge.sourceAnchor && e.targetAnchor === edge.targetAnchor)) return;
    get().checkpoint(); set(s => ({ doc: touch({ ...s.doc, edges: [...s.doc.edges, edge] }) }));
  },
  undo: () => set(s => {
    if (!s.past.length) return s;
    return { doc: touch(s.past[s.past.length - 1]), past: s.past.slice(0, -1), future: [s.doc, ...s.future].slice(0, 80), selectedNode: null, selectedEdge: null };
  }),
  redo: () => set(s => {
    if (!s.future.length) return s;
    return { doc: touch(s.future[0]), past: [...s.past, s.doc].slice(-80), future: s.future.slice(1), selectedNode: null, selectedEdge: null };
  }),
}));
