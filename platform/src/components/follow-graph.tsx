"use client";

import { useRef, useEffect, useCallback, useState, useMemo } from "react";
import dynamic from "next/dynamic";
import {
  useFollowGraph,
  type GraphNode as APIGraphNode,
} from "@/lib/hooks/use-follow-graph";

// Dynamic import for react-force-graph-2d since it requires window
const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
      Loading graph...
    </div>
  ),
});

type GraphNode = {
  id: string;
  name: string;
  userLink: string;
  order: number;
  numFollowers: number;
  isRoot: boolean;
};

type GraphLink = {
  source: string;
  target: string;
};

type GraphData = {
  nodes: GraphNode[];
  links: GraphLink[];
};

type FollowGraphProps = {
  userHandle: string | null;
  order: number;
  onSelect?: (userLink: string) => void;
};

function transformGraphData(
  apiNodes: APIGraphNode[],
  apiEdges: { source: number; target: number }[],
): GraphData {
  const nodes: GraphNode[] = apiNodes.map((n) => ({
    id: String(n.id),
    name: `${n.firstName} ${n.lastName}`,
    userLink: n.userLink,
    order: n.order,
    numFollowers: n.numFollowers,
    isRoot: n.order === 0,
  }));

  const links: GraphLink[] = apiEdges.map((e) => ({
    source: String(e.source),
    target: String(e.target),
  }));

  return { nodes, links };
}

// Hook to get container dimensions - uses ref measurement with fallback to container size
function useContainerDimensions(ref: React.RefObject<HTMLDivElement | null>) {
  const [dimensions, setDimensions] = useState<{
    width: number;
    height: number;
  } | null>(null);

  useEffect(() => {
    const container = ref.current;
    if (!container) return;

    let mounted = true;

    const updateDimensions = () => {
      if (!mounted || !container) return;

      const rect = container.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setDimensions({ width: rect.width, height: rect.height });
      }
    };

    // Measure after layout with requestAnimationFrame
    const rafId = requestAnimationFrame(() => {
      requestAnimationFrame(updateDimensions);
    });

    // Also use ResizeObserver
    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry && mounted) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          setDimensions({ width, height });
        }
      }
    });
    resizeObserver.observe(container);

    return () => {
      mounted = false;
      cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
    };
  }, [ref]);

  // Return measured dimensions or a reasonable default based on typical panel size
  return dimensions ?? { width: 350, height: 400 };
}

export function FollowGraph({ userHandle, order, onSelect }: FollowGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const dimensions = useContainerDimensions(containerRef);
  const hoveredNodeRef = useRef<string | null>(null);

  const { data: graphResponse, isLoading } = useFollowGraph({
    user_handle: userHandle ?? undefined,
    order,
  });

  // Memoize graph data to prevent recreation on every render
  const graphData = useMemo(() => {
    if (!graphResponse) return { nodes: [], links: [] };
    return transformGraphData(graphResponse.nodes, graphResponse.edges);
  }, [graphResponse]);

  // Find root user name for legend
  const rootUserName = graphData.nodes.find((n) => n.isRoot)?.name ?? "You";

  const handleNodeClick = useCallback(
    (node: GraphNode) => {
      if (node.isRoot) return;
      onSelect?.(node.userLink);
    },
    [onSelect],
  );

  // Handle hover without causing re-render (uses ref instead of state)
  const handleNodeHover = useCallback((node: GraphNode | null) => {
    hoveredNodeRef.current = node ? node.id : null;
  }, []);

  const getNodeColor = useCallback((node: GraphNode) => {
    if (node.isRoot) return "#f97316"; // orange for root
    if (node.order === 1) return "#3b82f6"; // blue for order 1
    return "#8b5cf6"; // purple for order 2
  }, []);

  const getNodeSize = useCallback((node: GraphNode) => {
    if (node.isRoot) return 8;
    // Scale based on followers, with min 4 and max 7
    const base = 4;
    const scale = Math.log10(Math.max(node.numFollowers, 1) + 1);
    return Math.min(base + scale, 7);
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
        Loading graph...
      </div>
    );
  }

  if (!graphData.nodes.length || graphData.nodes.length <= 1) {
    return (
      <div className="text-sm text-muted-foreground">
        No follows for this degree.
      </div>
    );
  }

  // Create a key that changes when dimensions change significantly from default
  // This forces ForceGraph to remount with correct dimensions
  const graphKey = `${Math.round(dimensions.width / 10)}-${Math.round(dimensions.height / 10)}`;

  return (
    <div ref={containerRef} className="w-full h-[400px]">
      <ForceGraph2D
        key={graphKey}
        width={dimensions.width}
        height={dimensions.height}
        graphData={graphData}
        nodeLabel={(node) => (node as GraphNode).name}
        nodeColor={(node) => getNodeColor(node as GraphNode)}
        nodeVal={(node) => getNodeSize(node as GraphNode)}
        linkColor={() => "rgba(100, 100, 100, 0.3)"}
        linkWidth={1}
        linkDirectionalArrowLength={3}
        linkDirectionalArrowRelPos={1}
        onNodeClick={(node) => handleNodeClick(node as GraphNode)}
        onNodeHover={(node) => handleNodeHover(node as GraphNode | null)}
        nodeCanvasObject={(node, ctx, globalScale) => {
          const n = node as GraphNode;
          const nodeSize = getNodeSize(n);
          const x = (node as { x?: number }).x ?? 0;
          const y = (node as { y?: number }).y ?? 0;

          // Draw node circle
          ctx.beginPath();
          ctx.arc(x, y, nodeSize, 0, 2 * Math.PI);
          ctx.fillStyle = getNodeColor(n);
          ctx.fill();
        }}
        nodePointerAreaPaint={(node, color, ctx) => {
          const n = node as GraphNode;
          const nodeSize = getNodeSize(n);
          const x = (node as { x?: number }).x ?? 0;
          const y = (node as { y?: number }).y ?? 0;
          ctx.beginPath();
          ctx.arc(x, y, nodeSize + 5, 0, 2 * Math.PI);
          ctx.fillStyle = color;
          ctx.fill();
        }}
        backgroundColor="transparent"
        cooldownTicks={500}
        d3AlphaDecay={0.02}
        d3VelocityDecay={0.3}
      />
      {/* Legend */}
      <div className="absolute bottom-2 left-2 text-xs text-muted-foreground space-y-1 bg-background/80 rounded p-2">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-orange-500" />
          <span>{rootUserName}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-blue-500" />
          <span>1° follows</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-purple-500" />
          <span>2° follows</span>
        </div>
      </div>
    </div>
  );
}
