/**
 * Converts React Flow nodes and edges back to a pipeline spec JSON.
 */
export function flowToSpec(rfNodes, rfEdges, specMeta) {
  const nodes = rfNodes.map((node) => ({
    id: node.id,
    type: node.type,
    label: node.data.label,
    position: { x: Math.round(node.position.x), y: Math.round(node.position.y) },
    config: { ...node.data.config }
  }))

  const edges = rfEdges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    sourceHandle: edge.sourceHandle ?? 'output',
    target: edge.target,
    targetHandle: edge.targetHandle ?? 'inputs'
  }))

  return {
    version: specMeta.version ?? '1',
    name: specMeta.name ?? 'pipeline',
    nodes,
    edges
  }
}
