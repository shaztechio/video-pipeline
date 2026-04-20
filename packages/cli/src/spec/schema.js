/*
 * Copyright 2026 Shazron Abdullah
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const KNOWN_NODE_TYPES = new Set(['video-cutter', 'video-stitcher', 'output-folder', 'input-file', 'input-folder'])

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

    if (node.type === 'video-stitcher' && node.config) {
      const videoSlEnabled = node.config.sequenceLabel?.enabled === true
      const imageSlEnabled = (node.config.inputOrder ?? []).some((i) => i.sequenceLabel?.enabled === true)
      if (videoSlEnabled && imageSlEnabled) {
        errors.push(
          `Node "${node.id}" (video-stitcher): config.sequenceLabel.enabled and per-image sequenceLabel.enabled are mutually exclusive`
        )
      }
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
