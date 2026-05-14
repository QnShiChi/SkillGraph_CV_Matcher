"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import type { JobKnowledgeGraph } from "@/lib/api";

import { StateCard } from "@/components/state-card";

type PositionedNode = JobKnowledgeGraph["nodes"][number] & {
  x: number;
  y: number;
  radius: number;
};

type DragState = {
  id: string;
  pointerId: number;
};

function chunkNodes<T>(nodes: T[], size: number) {
  const chunks: T[][] = [];

  for (let index = 0; index < nodes.length; index += size) {
    chunks.push(nodes.slice(index, index + size));
  }

  return chunks;
}

function placePerimeter(
  nodes: JobKnowledgeGraph["nodes"],
  left: number,
  top: number,
  right: number,
  bottom: number,
) {
  const positioned: PositionedNode[] = [];

  if (!nodes.length) {
    return positioned;
  }

  const width = right - left;
  const height = bottom - top;
  const perimeter = width * 2 + height * 2;

  nodes.forEach((node, index) => {
    const distance = ((index + 0.5) / nodes.length) * perimeter;
    let x = left;
    let y = top;

    if (distance <= width) {
      x = left + distance;
      y = top;
    } else if (distance <= width + height) {
      x = right;
      y = top + (distance - width);
    } else if (distance <= width * 2 + height) {
      x = right - (distance - width - height);
      y = bottom;
    } else {
      x = left;
      y = bottom - (distance - width * 2 - height);
    }

    positioned.push({
      ...node,
      x,
      y,
      radius: node.kind === "skill" ? 11 : 10,
    });
  });

  return positioned;
}

function layoutGraph(graph: JobKnowledgeGraph): PositionedNode[] {
  const root = graph.nodes.find((node) => node.kind === "job") ?? graph.nodes[0];

  if (!root) {
    return [];
  }

  const positioned: PositionedNode[] = [
    {
      ...root,
      x: 50,
      y: 50,
      radius: 18,
    },
  ];

  const others = graph.nodes.filter((node) => node.id !== root.id);
  const skillNodes = others.filter((node) => node.kind === "skill");
  const dependencyNodes = others.filter((node) => node.kind === "dependency");

  const placeRing = (
    nodes: JobKnowledgeGraph["nodes"],
    orbitX: number,
    orbitY: number,
    startAngle: number,
  ) => {
    if (!nodes.length) {
      return;
    }

    nodes.forEach((node, index) => {
      const angle = startAngle + (index / nodes.length) * Math.PI * 2;
      positioned.push({
        ...node,
        x: 50 + Math.cos(angle) * orbitX,
        y: 50 + Math.sin(angle) * orbitY,
        radius: node.kind === "skill" ? 11 : 10,
      });
    });
  };

  positioned.push(...placePerimeter(skillNodes, 7, 16, 93, 84));

  const dependencyRings = chunkNodes(dependencyNodes, 6);
  dependencyRings.forEach((ring, index) => {
    placeRing(ring, 20 + index * 8, 15 + index * 6, -Math.PI / 3 + index * 0.4);
  });

  return positioned;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function nodeClasses(kind: PositionedNode["kind"], highlight: boolean) {
  if (kind === "job") {
    return "border-[#4b41e1] bg-[linear-gradient(135deg,#4b41e1_0%,#3028b4_100%)] text-white shadow-[0_24px_50px_rgba(75,65,225,0.22)]";
  }

  if (kind === "skill") {
    return highlight
      ? "border-[#16a34a] bg-[linear-gradient(135deg,#6ffbbe_0%,#4edea3_100%)] text-[#052b1a] shadow-[0_22px_46px_rgba(78,222,163,0.22)]"
      : "border-[rgba(78,222,163,0.35)] bg-[rgba(111,251,190,0.18)] text-[#085a38]";
  }

  return "border-[rgba(134,155,189,0.35)] bg-[rgba(75,65,225,0.06)] text-[var(--color-text)]";
}

function edgeStyle(kind: JobKnowledgeGraph["edges"][number]["kind"]) {
  if (kind === "prerequisite") {
    return {
      stroke: "#7c8ed6",
      strokeDasharray: "8 8",
      strokeWidth: 2,
    };
  }

  return {
    stroke: "#4b41e1",
    strokeDasharray: undefined,
    strokeWidth: 2.2,
  };
}

function nodeCardClasses(node: PositionedNode) {
  if (node.kind === "job") {
    return "w-[12rem] max-w-[12rem] rounded-[24px] px-5 py-4";
  }

  if (node.kind === "skill") {
    return "w-[7.5rem] max-w-[7.5rem] rounded-[18px] px-3 py-2.5";
  }

  return "w-[6.5rem] max-w-[6.5rem] rounded-[16px] px-3 py-2";
}

export function JobKnowledgeGraphView({
  graph,
}: {
  graph: JobKnowledgeGraph | null;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const baseLayout = useMemo(() => (graph ? layoutGraph(graph) : []), [graph]);
  const [positionedNodes, setPositionedNodes] = useState<PositionedNode[]>(baseLayout);

  useEffect(() => {
    setPositionedNodes(baseLayout);
  }, [baseLayout]);

  if (!graph) {
    return (
      <StateCard
        title="Neo4j Knowledge Graph"
        description="The job graph could not be loaded from Neo4j."
      />
    );
  }

  if (!graph.available || !graph.nodes.length) {
    return (
      <StateCard
        title="Neo4j Knowledge Graph"
        description={graph.message ?? "No graph projection is available for this job yet."}
      />
    );
  }

  const nodeById = new Map(positionedNodes.map((node) => [node.id, node]));

  const handlePointerDown = (
    event: React.PointerEvent<HTMLDivElement>,
    nodeId: string,
  ) => {
    if (!containerRef.current) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragState({
      id: nodeId,
      pointerId: event.pointerId,
    });
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragState || dragState.pointerId !== event.pointerId || !containerRef.current) {
      return;
    }

    const rect = containerRef.current.getBoundingClientRect();
    const x = clamp(((event.clientX - rect.left) / rect.width) * 100, 6, 94);
    const y = clamp(((event.clientY - rect.top) / rect.height) * 100, 10, 90);

    setPositionedNodes((nodes) =>
      nodes.map((node) =>
        node.id === dragState.id
          ? {
              ...node,
              x,
              y,
            }
          : node,
      ),
    );
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    setDragState(null);
  };

  return (
    <section className="overflow-hidden rounded-[32px] border border-[#c9d7ff] bg-white/88 p-6 shadow-[0_28px_90px_rgba(75,65,225,0.12)]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--color-brand-dark)]">
            Neo4j Graph
          </p>
          <h3 className="mt-2 text-2xl font-bold tracking-[-0.03em] text-[var(--color-text)]">
            Job knowledge graph
          </h3>
          <p className="mt-2 text-sm leading-6 text-[var(--color-muted)]">
            Connected from Neo4j for {graph.title}.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <div className="rounded-full border border-[rgba(134,155,189,0.18)] bg-[rgba(75,65,225,0.05)] px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-muted)]">
            {graph.node_count} nodes
          </div>
          <button
            type="button"
            onClick={() => setPositionedNodes(baseLayout)}
            className="rounded-full border border-[rgba(134,155,189,0.18)] bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-brand-dark)] transition hover:border-[#4b41e1] hover:text-[#4b41e1]"
          >
            Reset layout
          </button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-3 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-muted)]">
        <span className="rounded-full border border-[rgba(134,155,189,0.18)] bg-[rgba(75,65,225,0.05)] px-3 py-2">
          {graph.edge_count} edges
        </span>
        <span className="rounded-full border border-[rgba(134,155,189,0.18)] bg-[rgba(75,65,225,0.05)] px-3 py-2">
          {graph.graph_sync_status}
        </span>
        <span className="rounded-full border border-[rgba(134,155,189,0.18)] bg-[rgba(75,65,225,0.05)] px-3 py-2">
          {graph.status}
        </span>
        <span className="rounded-full border border-[rgba(134,155,189,0.18)] bg-[rgba(75,65,225,0.05)] px-3 py-2">
          Drag nodes to inspect the graph
        </span>
      </div>

      <div className="mt-5 overflow-hidden rounded-[28px] border border-[rgba(134,155,189,0.2)] bg-[#fbfdff]">
        <div
          ref={containerRef}
          className="relative h-[42rem] bg-[radial-gradient(circle_at_center,rgba(200,214,255,0.55)_0,rgba(255,255,255,0)_72%)]"
        >
          <div
            className="absolute inset-0 opacity-90"
            style={{
              backgroundImage:
                "radial-gradient(circle, rgba(198, 210, 238, 0.9) 1px, transparent 1px)",
              backgroundSize: "24px 24px",
            }}
          />

          <svg className="absolute inset-0 h-full w-full" aria-hidden="true">
            {graph.edges.map((edge) => {
              const from = nodeById.get(edge.source);
              const to = nodeById.get(edge.target);

              if (!from || !to) {
                return null;
              }

              const style = edgeStyle(edge.kind);

              return (
                <line
                  key={`${edge.source}:${edge.target}:${edge.kind}`}
                  x1={`${from.x}%`}
                  y1={`${from.y}%`}
                  x2={`${to.x}%`}
                  y2={`${to.y}%`}
                  stroke={style.stroke}
                  strokeDasharray={style.strokeDasharray}
                  strokeWidth={style.strokeWidth}
                  strokeLinecap="round"
                />
              );
            })}
          </svg>

          {positionedNodes.map((node) => (
            <div
              key={node.id}
              className="absolute -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${node.x}%`, top: `${node.y}%`, zIndex: node.kind === "job" ? 20 : 10 }}
            >
              <div
                role="button"
                tabIndex={0}
                onPointerDown={(event) => handlePointerDown(event, node.id)}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                className={`border text-center transition hover:-translate-y-0.5 ${nodeCardClasses(node)} ${nodeClasses(
                  node.kind,
                  node.kind === "job",
                )} ${dragState?.id === node.id ? "cursor-grabbing" : "cursor-grab"}`}
              >
                <p
                  className={`text-center font-bold tracking-[-0.03em] ${
                    node.kind === "job"
                      ? "text-[1rem] leading-6"
                      : "text-[0.82rem] leading-4"
                  }`}
                >
                  {node.label}
                </p>
                <p className="mt-1 text-[9px] font-semibold uppercase tracking-[0.14em] opacity-80">
                  {node.subtitle}
                </p>
              </div>
            </div>
          ))}

          <div className="absolute bottom-5 right-5 rounded-[20px] border border-[rgba(134,155,189,0.18)] bg-white/92 p-4 text-xs text-[var(--color-muted)] shadow-[0_18px_50px_rgba(30,41,59,0.08)]">
            <div className="flex items-center gap-3">
              <span className="block h-[2px] w-9 rounded-full bg-[#4b41e1]" />
              <span>REQUIRES</span>
            </div>
            <div className="mt-3 flex items-center gap-3">
              <span
                className="block h-[2px] w-9 rounded-full"
                style={{
                  backgroundImage:
                    "repeating-linear-gradient(90deg, #7c8ed6 0, #7c8ed6 8px, transparent 8px, transparent 14px)",
                }}
              />
              <span>PREREQUISITE_OF</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
