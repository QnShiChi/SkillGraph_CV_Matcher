"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import type { CandidateKnowledgeGraph } from "@/lib/api";

type PositionedNode = CandidateKnowledgeGraph["nodes"][number] & {
  x: number;
  y: number;
  widthClass: string;
  highlight: boolean;
};

type DragState = {
  id: string;
  pointerId: number;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function placePerimeter(
  nodes: CandidateKnowledgeGraph["nodes"],
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
      highlight: false,
      widthClass: node.status === "missing" ? "w-[9rem] max-w-[9rem]" : "w-[10rem] max-w-[10rem]",
    });
  });

  return positioned;
}

function layoutGraph(graph: CandidateKnowledgeGraph): PositionedNode[] {
  const primary =
    graph.nodes.find((node) => node.status === "possessed") ??
    graph.nodes.find((node) => node.status === "missing") ??
    graph.nodes[0];

  if (!primary) {
    return [];
  }

  const positioned: PositionedNode[] = [
    {
      ...primary,
      x: 50,
      y: 50,
      highlight: true,
      widthClass: "w-[12rem] max-w-[12rem]",
    },
  ];

  const remaining = graph.nodes.filter((node) => node.id !== primary.id);
  const possessed = remaining.filter((node) => node.status === "possessed");
  const missing = remaining.filter((node) => node.status === "missing");
  const related = remaining.filter((node) => node.status === "related");

  positioned.push(...placePerimeter(possessed, 16, 18, 84, 78));
  positioned.push(...placePerimeter(missing, 22, 24, 78, 72));
  positioned.push(...placePerimeter(related, 30, 32, 70, 64));

  return positioned;
}

function nodeClasses(status: PositionedNode["status"], highlight: boolean) {
  if (status === "missing") {
    return highlight
      ? "border-[#dc2626] bg-[#dc2626] text-white shadow-[0_24px_50px_rgba(220,38,38,0.28)]"
      : "border-[rgba(220,38,38,0.2)] bg-[rgba(220,38,38,0.08)] text-[#8d2020]";
  }

  if (status === "related") {
    return highlight
      ? "border-[#a7bff4] bg-[#e8f0ff] text-[#223463] shadow-[0_24px_50px_rgba(90,120,180,0.18)]"
      : "border-[rgba(167,191,244,0.55)] bg-[#eef4ff] text-[#334a72]";
  }

  return highlight
    ? "border-[#16a34a] bg-[linear-gradient(135deg,#6ffbbe_0%,#4edea3_100%)] text-[#052b1a] shadow-[0_26px_54px_rgba(78,222,163,0.26)]"
    : "border-[rgba(78,222,163,0.38)] bg-[rgba(111,251,190,0.18)] text-[#085a38]";
}

function edgeStyle(kind: CandidateKnowledgeGraph["edges"][number]["kind"]) {
  if (kind === "prerequisite") {
    return {
      stroke: "#7c8ed6",
      strokeDasharray: "8 8",
      strokeWidth: 2,
    };
  }

  return {
    stroke: "#5a63f6",
    strokeDasharray: undefined,
    strokeWidth: 2.2,
  };
}

export function SkillGraphVisualization({
  graph,
}: {
  graph: CandidateKnowledgeGraph | null;
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
      <section className="overflow-hidden rounded-[32px] border border-[#c9d7ff] bg-white/88 p-6 shadow-[0_28px_90px_rgba(75,65,225,0.12)]">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--color-brand-dark)]">
            Graph View
          </p>
          <h3 className="mt-2 text-2xl font-bold tracking-[-0.03em] text-[var(--color-text)]">
            Skill graph visualization
          </h3>
        </div>
        <p className="mt-6 text-sm leading-6 text-[var(--color-muted)]">
          Candidate graph could not be loaded from Neo4j.
        </p>
      </section>
    );
  }

  if (!graph.available || !graph.nodes.length) {
    return (
      <section className="overflow-hidden rounded-[32px] border border-[#c9d7ff] bg-white/88 p-6 shadow-[0_28px_90px_rgba(75,65,225,0.12)]">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--color-brand-dark)]">
            Graph View
          </p>
          <h3 className="mt-2 text-2xl font-bold tracking-[-0.03em] text-[var(--color-text)]">
            Skill graph visualization
          </h3>
        </div>
        <p className="mt-6 text-sm leading-6 text-[var(--color-muted)]">
          {graph.message ?? "No Neo4j projection is available for this candidate yet."}
        </p>
      </section>
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
    const x = clamp(((event.clientX - rect.left) / rect.width) * 100, 8, 92);
    const y = clamp(((event.clientY - rect.top) / rect.height) * 100, 12, 88);

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
            Graph View
          </p>
          <h3 className="mt-2 text-2xl font-bold tracking-[-0.03em] text-[var(--color-text)]">
            Skill graph visualization
          </h3>
          <p className="mt-2 text-sm leading-6 text-[var(--color-muted)]">
            Connected from Neo4j for {graph.candidate_name}.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-[var(--color-muted)]">
          <span className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-[#4edea3]" />
            Possessed
          </span>
          <span className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-[#dc2626]" />
            Missing
          </span>
          <span className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-[#dbe7ff]" />
            Related
          </span>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-3 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-muted)]">
        <span className="rounded-full border border-[rgba(134,155,189,0.18)] bg-[rgba(75,65,225,0.05)] px-3 py-2">
          Matched {graph.matched_count}
        </span>
        <span className="rounded-full border border-[rgba(220,38,38,0.12)] bg-[rgba(220,38,38,0.05)] px-3 py-2 text-[#8d2020]">
          Gaps {graph.missing_count}
        </span>
        <span className="rounded-full border border-[rgba(134,155,189,0.18)] bg-[rgba(75,65,225,0.05)] px-3 py-2">
          Neo4j {graph.node_count} nodes
        </span>
        <button
          type="button"
          onClick={() => setPositionedNodes(baseLayout)}
          className="rounded-full border border-[rgba(134,155,189,0.18)] bg-white px-3 py-2 text-[var(--color-brand-dark)] transition hover:border-[#4b41e1] hover:text-[#4b41e1]"
        >
          Reset layout
        </button>
      </div>

      <div className="mt-5 overflow-hidden rounded-[28px] border border-[rgba(134,155,189,0.2)] bg-[#fbfdff]">
        <div
          ref={containerRef}
          className="relative h-[34rem] bg-[radial-gradient(circle_at_center,rgba(200,214,255,0.55)_0,rgba(255,255,255,0)_72%)]"
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
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
              style={{ left: `${node.x}%`, top: `${node.y}%` }}
            >
              <div
                role="button"
                tabIndex={0}
                onPointerDown={(event) => handlePointerDown(event, node.id)}
                className={`${node.widthClass} cursor-grab rounded-[22px] border px-4 py-3 text-center active:cursor-grabbing ${nodeClasses(
                  node.status,
                  node.highlight,
                )}`}
              >
                <p className={`${node.highlight ? "text-[1.05rem]" : "text-base"} font-bold tracking-[-0.03em]`}>
                  {node.label}
                </p>
                <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.16em] opacity-80">
                  {node.subtitle}
                </p>
              </div>
            </div>
          ))}

          <div className="absolute bottom-5 right-5 rounded-[20px] border border-[rgba(134,155,189,0.18)] bg-white/92 p-4 text-xs text-[var(--color-muted)] shadow-[0_18px_50px_rgba(30,41,59,0.08)]">
            <div className="flex items-center gap-3">
              <span className="block h-[2px] w-9 rounded-full bg-[#5a63f6]" />
              <span>RELATED_TO</span>
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
