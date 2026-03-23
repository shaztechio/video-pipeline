const KNOWN_NODE_TYPES = new Set(['video-cutter', 'video-stitcher'])

/**
 * Validates a pipeline spec object.
 * Returns { valid: true } or { valid: false, errors: string[] }
 */
export function validateSpec(spec) {
  const errors = []

  if (!spec || typeof spec !== 'object') {
    return { valid: false, errors: ['Spec must be a JSON object'] }
  }

  if (spec.version !== '1') {
    errors.push(`Unsupported spec version: ${spec.version} (expected "1")`)
  }

  if (!spec.name || typeof spec.name !== 'string') {
    errors.push('spec.name must be a non-empty string')
  }

  if (!Array.isArray(spec.nodes)) {
    errors.push('spec.nodes must be an array')
  }

  if (!Array.isArray(spec.edges)) {
    errors.push('spec.edges must be an array')
  }

  if (errors.length > 0) return { valid: false, errors }

  const nodeIds = new Set()

  for (const node of spec.nodes) {
    if (!node.id || typeof node.id !== 'string') {
      errors.push(`Node missing valid id: ${JSON.stringify(node)}`)
      continue
    }
    if (nodeIds.has(node.id)) {
      errors.push(`Duplicate node id: ${node.id}`)
    }
    nodeIds.add(node.id)

    if (!KNOWN_NODE_TYPES.has(node.type)) {
      errors.push(`Node "${node.id}" has unknown type: ${node.type}`)
    }

    if (!node.config || typeof node.config !== 'object') {
      errors.push(`Node "${node.id}" missing config object`)
    }
  }

  for (const edge of spec.edges) {
    if (!edge.id) errors.push(`Edge missing id: ${JSON.stringify(edge)}`)
    if (!nodeIds.has(edge.source)) {
      errors.push(`Edge "${edge.id}" references unknown source node: ${edge.source}`)
    }
    if (!nodeIds.has(edge.target)) {
      errors.push(`Edge "${edge.id}" references unknown target node: ${edge.target}`)
    }
  }

  return errors.length === 0 ? { valid: true } : { valid: false, errors }
}
