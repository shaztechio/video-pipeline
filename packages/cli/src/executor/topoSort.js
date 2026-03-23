/**
 * Kahn's topological sort algorithm.
 * Returns an array of levels, where each level is an array of node IDs
 * that can be executed in parallel (all their dependencies are in prior levels).
 * Throws if a cycle is detected.
 */
export function topoSort(nodes, edges) {
  const nodeIds = new Set(nodes.map((n) => n.id))

  // Build adjacency: source -> [targets]
  const outEdges = new Map()
  const inDegree = new Map()

  for (const id of nodeIds) {
    outEdges.set(id, [])
    inDegree.set(id, 0)
  }

  for (const edge of edges) {
    outEdges.get(edge.source)?.push(edge.target)
    inDegree.set(edge.target, (inDegree.get(edge.target) ?? 0) + 1)
  }

  const levels = []
  let remaining = new Set(nodeIds)

  while (remaining.size > 0) {
    const level = [...remaining].filter((id) => inDegree.get(id) === 0)

    if (level.length === 0) {
      throw new Error('Pipeline has a cycle — cannot execute')
    }

    levels.push(level)

    for (const id of level) {
      remaining.delete(id)
      for (const target of outEdges.get(id) ?? []) {
        inDegree.set(target, inDegree.get(target) - 1)
      }
    }
  }

  return levels
}
