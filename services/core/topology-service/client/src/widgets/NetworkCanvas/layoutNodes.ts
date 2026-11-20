// File: services/core/topology-service/client/src/widgets/NetworkCanvas/layoutNodes.ts
type Position = { x: number; y: number };
type Edge = { from: string; to: string };

const NODE_SPACING = 350;

function buildNeighbors(edges: readonly Edge[]): Map<string, string[]> {
  const neighbors = new Map<string, string[]>();
  for (const { from, to } of edges) {
    neighbors.set(from, [...(neighbors.get(from) ?? []), to]);
    neighbors.set(to, [...(neighbors.get(to) ?? []), from]);
  }
  return neighbors;
}

function findConnectedNode(
  remaining: Set<string>,
  neighbors: Map<string, string[]>,
  positions: Record<string, Position>,
): string | undefined {
  return [...remaining].find((id) => neighbors.get(id)?.some((neighbor) => positions[neighbor]));
}

function findBestPosition(anchor: Position, placed: Position[]): Position {
  let best = { x: anchor.x + NODE_SPACING, y: anchor.y };
  let bestClearance = -1;
  for (let i = 0; i < 16; i++) {
    const angle = i * Math.PI / 8;
    const candidate = {
      x: Math.round(anchor.x + NODE_SPACING * Math.cos(angle)),
      y: Math.round(anchor.y + NODE_SPACING * Math.sin(angle)),
    };
    const clearance = Math.min(...placed.map((point) => Math.hypot(candidate.x - point.x, candidate.y - point.y)));
    if (clearance > bestClearance) {
      best = candidate;
      bestClearance = clearance;
    }
  }
  return best;
}

function getNodePosition(
  anchorId: string | undefined,
  positions: Record<string, Position>,
): Position {
  const placed = Object.values(positions);
  if (!anchorId) {
    return { x: placed.length ? Math.max(...placed.map((point) => point.x)) + NODE_SPACING : 0, y: 0 };
  }
  return findBestPosition(positions[anchorId], placed);
}

export function layoutNewNodes(
  nodeIds: readonly string[],
  edges: readonly Edge[],
  existingPositions: Record<string, Position>,
): Record<string, Position> {
  const positions = { ...existingPositions };
  const remaining = new Set(nodeIds);
  const neighbors = buildNeighbors(edges);

  while (remaining.size) {
    const connectedId = findConnectedNode(remaining, neighbors, positions);
    const id = connectedId ?? remaining.values().next().value;
    if (id === undefined) break;
    const anchorId = neighbors.get(id)?.find((neighbor) => positions[neighbor]);
    positions[id] = getNodePosition(anchorId, positions);
    remaining.delete(id);
  }

  return positions;
}
