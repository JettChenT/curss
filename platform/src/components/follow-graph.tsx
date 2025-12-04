"use client";

import { useRef, useEffect, useCallback, useState } from "react";
import dynamic from "next/dynamic";
import type { FollowWithOrder, FollowingUser, User } from "@/lib/types";

// Dynamic import for react-force-graph since it requires window
const ForceGraph2D = dynamic(
  () => import("react-force-graph").then((mod) => mod.ForceGraph2D),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
        Loading graph...
      </div>
    ),
  },
);

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
  order: number;
};

type GraphData = {
  nodes: GraphNode[];
  links: GraphLink[];
};

type FollowGraphProps = {
  rootUser: User | null;
  items: FollowWithOrder[];
  onSelect?: (user: FollowingUser) => void;
};

function buildGraphData(
  rootUser: User | null,
  items: FollowWithOrder[],
): GraphData {
  const nodes: GraphNode[] = [];
  const links: GraphLink[] = [];
  const nodeMap = new Map<string, GraphNode>();

  // Add root user as central node
  if (rootUser) {
    const rootNode: GraphNode = {
      id: String(rootUser.id),
      name: `${rootUser.firstName} ${rootUser.lastName}`,
      userLink: rootUser.userLink,
      order: 0,
      numFollowers: rootUser.numFollowers,
      isRoot: true,
    };
    nodes.push(rootNode);
    nodeMap.set(rootNode.id, rootNode);
  }

  // Group items by order to build hierarchical connections
  const byOrder = new Map<number, FollowWithOrder[]>();
  for (const item of items) {
    const orderItems = byOrder.get(item.order) ?? [];
    orderItems.push(item);
    byOrder.set(item.order, orderItems);
  }

  // Add all followed users as nodes
  for (const item of items) {
    const u = item.followingUser;
    const nodeId = String(u.id);

    if (!nodeMap.has(nodeId)) {
      const node: GraphNode = {
        id: nodeId,
        name: `${u.firstName} ${u.lastName}`,
        userLink: u.userLink,
        order: item.order,
        numFollowers: u.numFollowers,
        isRoot: false,
      };
      nodes.push(node);
      nodeMap.set(nodeId, node);
    }
  }

  // Create links from root to order-1 users
  if (rootUser) {
    const order1 = byOrder.get(1) ?? [];
    for (const item of order1) {
      links.push({
        source: String(rootUser.id),
        target: String(item.followingUser.id),
        order: 1,
      });
    }
  }

  // For order-2 users, we connect to random order-1 users (since we don't have exact follow info)
  // In a real scenario, you'd have the actual follow relationship data
  const order1Users = byOrder.get(1) ?? [];
  const order2Users = byOrder.get(2) ?? [];

  if (order1Users.length > 0) {
    for (const item of order2Users) {
      // Connect to a "random" order-1 user based on id hash for consistency
      const targetIdx = Math.abs(item.followingUser.id) % order1Users.length;
      const targetUser = order1Users[targetIdx];
      if (targetUser) {
        links.push({
          source: String(targetUser.followingUser.id),
          target: String(item.followingUser.id),
          order: 2,
        });
      }
    }
  }

  return { nodes, links };
}

export function FollowGraph({ rootUser, items, onSelect }: FollowGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 400, height: 300 });
  const graphData = buildGraphData(rootUser, items);

  // Update dimensions on mount and resize
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const { clientWidth, clientHeight } = containerRef.current;
        setDimensions({
          width: clientWidth || 400,
          height: clientHeight || 300,
        });
      }
    };

    updateDimensions();
    window.addEventListener("resize", updateDimensions);
    return () => window.removeEventListener("resize", updateDimensions);
  }, []);

  const handleNodeClick = useCallback(
    (node: GraphNode) => {
      if (node.isRoot) return;

      // Find the matching item to get FollowingUser type
      const item = items.find((f) => String(f.followingUser.id) === node.id);
      if (item && onSelect) {
        onSelect(item.followingUser);
      }
    },
    [items, onSelect],
  );

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

  if (!items?.length) {
    return (
      <div className="text-sm text-muted-foreground">
        No follows for this degree.
      </div>
    );
  }

  return (
    <div ref={containerRef} className="w-full h-full min-h-[300px]">
      <ForceGraph2D
        width={dimensions.width}
        height={dimensions.height}
        graphData={graphData}
        nodeLabel={(node) => {
          const n = node as GraphNode;
          return `${n.name}${n.isRoot ? " (you)" : ""}\n${n.numFollowers} followers`;
        }}
        nodeColor={(node) => getNodeColor(node as GraphNode)}
        nodeVal={(node) => getNodeSize(node as GraphNode)}
        linkColor={(link) => {
          const l = link as GraphLink;
          return l.order === 1
            ? "rgba(59, 130, 246, 0.4)"
            : "rgba(139, 92, 246, 0.3)";
        }}
        linkWidth={(link) => {
          const l = link as GraphLink;
          return l.order === 1 ? 1.5 : 1;
        }}
        onNodeClick={(node) => handleNodeClick(node as GraphNode)}
        nodeCanvasObject={(node, ctx, globalScale) => {
          const n = node as GraphNode;
          const label = n.name;
          const fontSize = 12 / globalScale;
          const nodeSize = getNodeSize(n);
          const x = (node as { x?: number }).x ?? 0;
          const y = (node as { y?: number }).y ?? 0;

          // Draw node circle
          ctx.beginPath();
          ctx.arc(x, y, nodeSize, 0, 2 * Math.PI);
          ctx.fillStyle = getNodeColor(n);
          ctx.fill();

          // Draw label
          ctx.font = `${fontSize}px sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillStyle = "#e5e5e5";
          ctx.fillText(label, x, y + nodeSize + fontSize);
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
        cooldownTicks={100}
        d3AlphaDecay={0.02}
        d3VelocityDecay={0.3}
      />
      {/* Legend */}
      <div className="absolute bottom-2 left-2 text-xs text-muted-foreground space-y-1 bg-background/80 rounded p-2">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-orange-500" />
          <span>You</span>
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
