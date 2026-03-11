"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import { Network, RefreshCw, Loader, X, ExternalLink } from "lucide-react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  MarkerType,
  Handle,
  Position,
  type Node,
  type Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useRegion } from "@/components/RegionProvider";

/* ─── Color palette per type ──────────────────────────────────────── */
const typeColors: Record<string, { bg: string; border: string; text: string; glow: string }> = {
  internet:      { bg: "#1a1a2e", border: "#6366f1", text: "#a5b4fc", glow: "0 0 20px rgba(99,102,241,.3)" },
  vpc:           { bg: "#0f172a", border: "#475569", text: "#94a3b8", glow: "none" },
  alb:           { bg: "#042f2e", border: "#14b8a6", text: "#5eead4", glow: "0 0 14px rgba(20,184,166,.25)" },
  ec2:           { bg: "#1c1917", border: "#f97316", text: "#fdba74", glow: "0 0 14px rgba(249,115,22,.25)" },
  ecs:           { bg: "#1e1b4b", border: "#8b5cf6", text: "#c4b5fd", glow: "0 0 14px rgba(139,92,246,.25)" },
  "ecs-cluster": { bg: "#1e1b4b", border: "#7c3aed", text: "#a78bfa", glow: "0 0 14px rgba(124,58,237,.25)" },
  rds:           { bg: "#0c1a3d", border: "#3b82f6", text: "#93c5fd", glow: "0 0 14px rgba(59,130,246,.25)" },
  elasticache:   { bg: "#1a0f1e", border: "#ec4899", text: "#f9a8d4", glow: "0 0 14px rgba(236,72,153,.25)" },
  s3:            { bg: "#1a1a00", border: "#eab308", text: "#fde68a", glow: "0 0 14px rgba(234,179,8,.25)" },
};

const typeIcons: Record<string, string> = {
  internet: "🌐", vpc: "☁️", alb: "⚖️", ec2: "🖥️", ecs: "📦",
  "ecs-cluster": "📦", rds: "🗄️", elasticache: "⚡", s3: "🪣",
};

/* ─── Dashboard links by type ─────────────────────────────────────── */
const typeLinks: Record<string, string> = {
  ec2: "/ec2", rds: "/rds", ecs: "/ecs", "ecs-cluster": "/ecs",
  alb: "/alb", elasticache: "/elasticache", s3: "/s3",
};

/* ─── Custom Node (with handles + click-to-select) ─────────────────── */
function CustomNode({ data }: { data: Record<string, unknown> }) {
  const t = typeColors[data.type as string] || typeColors.ec2;
  const icon = typeIcons[data.type as string] || "📌";
  const isSelected = data._selected as boolean;
  const isConnected = data._connected as boolean;
  const isDimmed = data._dimmed as boolean;
  const link = typeLinks[data.type as string];

  const statusDot = ["running","available","active","healthy"].includes(data.status as string)
    ? "#22c55e" : ["stopped","unavailable"].includes(data.status as string) ? "#ef4444" : "#eab308";

  return (
    <div
      style={{
        background: t.bg,
        border: `2px solid ${isSelected ? "#fff" : isConnected ? t.border : isDimmed ? `${t.border}40` : t.border}`,
        borderRadius: 14,
        padding: "12px 16px",
        minWidth: 180,
        boxShadow: isSelected ? `0 0 24px ${t.border}80, ${t.glow}` : isConnected ? t.glow : "none",
        fontFamily: "Inter, system-ui, sans-serif",
        position: "relative",
        opacity: isDimmed ? 0.35 : 1,
        transition: "all 0.3s ease",
        cursor: "pointer",
      }}
    >
      <Handle type="target" position={Position.Left} style={{ background: t.border, width: 6, height: 6, border: "none", opacity: isSelected || isConnected ? 1 : 0 }} />
      <Handle type="source" position={Position.Right} style={{ background: t.border, width: 6, height: 6, border: "none", opacity: isSelected || isConnected ? 1 : 0 }} />

      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 5 }}>
        <span style={{ fontSize: 15 }}>{icon}</span>
        <span style={{ color: t.text, fontWeight: 700, fontSize: 11.5, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {data.label as string}
        </span>
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: statusDot, flexShrink: 0, boxShadow: `0 0 8px ${statusDot}` }} />
      </div>
      <div style={{ color: "#64748b", fontSize: 9.5, lineHeight: 1.4 }}>
        {data.subLabel as string}
      </div>
      {link && (
        <a
          href={link}
          onClick={(e) => e.stopPropagation()}
          style={{ display: "flex", alignItems: "center", gap: 3, marginTop: 6, fontSize: 9, color: "#60a5fa", textDecoration: "none" }}
        >
          Open Dashboard <ExternalLink size={8} />
        </a>
      )}
    </div>
  );
}

const nodeTypes = { custom: CustomNode };

/* ─── Layout ──────────────────────────────────────────────────────── */
const layerOrder = ["internet", "vpc", "alb", "ecs-cluster", "ecs", "ec2", "rds", "elasticache", "s3"];

function autoLayout(rawNodes: Record<string, unknown>[]): Node[] {
  const groups: Record<string, Record<string, unknown>[]> = {};
  for (const n of rawNodes) {
    const t = n.type as string;
    if (!groups[t]) groups[t] = [];
    groups[t].push(n);
  }
  const result: Node[] = [];
  let x = 0;
  const xGap = 300;
  const yGap = 115;
  for (const layer of layerOrder) {
    const items = groups[layer];
    if (!items || items.length === 0) continue;
    const totalH = items.length * yGap;
    const startY = -totalH / 2;
    items.forEach((item, i) => {
      result.push({
        id: item.id as string,
        type: "custom",
        position: { x, y: startY + i * yGap },
        data: { ...item, _selected: false, _connected: false, _dimmed: false },
      });
    });
    x += xGap;
  }
  return result;
}

/* ─── Page ────────────────────────────────────────────────────────── */
export default function InfrastructurePage() {
  const [rawNodes, setRawNodes] = useState<Record<string, unknown>[]>([]);
  const [rawEdges, setRawEdges] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const { region } = useRegion();
  const [error, setError] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch(`/api/infrastructure?region=${region}`);
      if (!res.ok) throw new Error((await res.json()).error || "Failed");
      const d = await res.json();
      setRawNodes(d.nodes || []);
      setRawEdges(d.edges || []);
    } catch (e: unknown) { setError(e instanceof Error ? e.message : "Unknown error"); }
    finally { setLoading(false); }
  }, [region]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Compute which nodes are connected to the selected node
  const connectedNodeIds = useMemo(() => {
    if (!selectedNodeId) return new Set<string>();
    const connected = new Set<string>();
    connected.add(selectedNodeId);
    for (const e of rawEdges) {
      if (e.source === selectedNodeId) connected.add(e.target as string);
      if (e.target === selectedNodeId) connected.add(e.source as string);
    }
    return connected;
  }, [selectedNodeId, rawEdges]);

  // Only show edges connected to the selected node
  const visibleEdges = useMemo(() => {
    if (!selectedNodeId) return [];
    return rawEdges
      .filter(e => e.source === selectedNodeId || e.target === selectedNodeId)
      .map(e => ({
        id: e.id as string,
        source: e.source as string,
        target: e.target as string,
        label: e.label as string | undefined,
        animated: true,
        style: { stroke: "#38bdf8", strokeWidth: 2.5 },
        labelStyle: { fill: "#e2e8f0", fontSize: 9, fontWeight: 600 },
        labelBgStyle: { fill: "#0f172a", fillOpacity: 0.95 },
        labelBgPadding: [6, 3] as [number, number],
        labelBgBorderRadius: 4,
        markerEnd: { type: MarkerType.ArrowClosed, color: "#38bdf8", width: 16, height: 16 },
      }));
  }, [selectedNodeId, rawEdges]);

  // Nodes with selection/dim state
  const nodes = useMemo(() => {
    const base = autoLayout(rawNodes);
    if (!selectedNodeId) return base;
    return base.map(n => ({
      ...n,
      data: {
        ...n.data,
        _selected: n.id === selectedNodeId,
        _connected: connectedNodeIds.has(n.id),
        _dimmed: !connectedNodeIds.has(n.id),
      },
    }));
  }, [rawNodes, selectedNodeId, connectedNodeIds]);

  const onNodeClick = useCallback((_: any, node: Node) => {
    setSelectedNodeId(prev => prev === node.id ? null : node.id);
  }, [region]);

  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null);
  }, [region]);

  const selectedNode = selectedNodeId ? rawNodes.find(n => n.id === selectedNodeId) : null;
  const connectionCount = selectedNodeId ? visibleEdges.length : rawEdges.length;

  return (
    <div className="flex flex-col gap-4 h-[calc(100vh-7rem)]">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Network size={22} className="text-blue-400" /> Infrastructure Flow
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {rawNodes.length} resources · {connectionCount} connections
            {selectedNodeId
              ? <span className="text-blue-400 ml-1">— Showing connections for <strong>{(selectedNode?.label as string) || selectedNodeId}</strong></span>
              : " — Click any node to reveal its connections"
            }
          </p>
        </div>
        <div className="flex gap-2">
          {selectedNodeId && (
            <button onClick={() => setSelectedNodeId(null)} className="flex items-center gap-2 px-3 py-2 bg-slate-700/50 hover:bg-slate-700 text-slate-300 text-sm rounded-lg transition-colors border border-slate-600/50">
              <X size={14} /> Clear Selection
            </button>
          )}
          <button onClick={fetchData} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-lg transition-colors font-medium">
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </div>

      {loading && (
        <div className="flex-1 flex items-center justify-center gap-3 text-slate-400">
          <Loader className="animate-spin" size={20} /> Discovering infrastructure…
        </div>
      )}
      {error && <div className="bg-red-900/20 border border-red-700/50 text-red-400 rounded-xl p-4 text-sm">Error: {error}</div>}

      {!loading && !error && (
        <div className="flex-1 rounded-2xl border border-white/[0.08] overflow-hidden" style={{ background: "#060912" }}>
          <ReactFlow
            nodes={nodes}
            edges={visibleEdges}
            nodeTypes={nodeTypes}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            fitView
            fitViewOptions={{ padding: 0.15 }}
            minZoom={0.1}
            maxZoom={2}
            defaultEdgeOptions={{ animated: true }}
            proOptions={{ hideAttribution: true }}
          >
            <Background color="#1e293b" gap={20} size={1} />
            <Controls
              showInteractive={false}
              style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 8 }}
            />
            <MiniMap
              nodeColor={(n) => {
                const t = (n.data as Record<string, unknown>)?.type as string;
                return typeColors[t]?.border || "#475569";
              }}
              maskColor="rgba(6,9,18,0.85)"
              style={{ background: "#0a0f1e", border: "1px solid #1e293b", borderRadius: 8 }}
            />
          </ReactFlow>
        </div>
      )}

      {/* Legend */}
      {!loading && !error && (
        <div className="flex flex-wrap gap-4 text-[10px] text-slate-500 shrink-0 pb-2">
          {Object.entries(typeIcons).map(([type, icon]) => (
            <span key={type} className="flex items-center gap-1">
              <span>{icon}</span>
              <span className="capitalize">{type.replace("-", " ")}</span>
              <span className="w-3 h-0.5 rounded" style={{ background: typeColors[type]?.border || "#475569" }} />
            </span>
          ))}
          <span className="ml-4 text-blue-400/60">Click a node to see its connections</span>
        </div>
      )}
    </div>
  );
}
