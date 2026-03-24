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

/**
 * Converts a pipeline spec JSON to React Flow nodes and edges.
 */
export function specToFlow(spec) {
  const specEdges = spec.edges ?? []

  const nodes = (spec.nodes ?? []).map((node) => {
    const config = { ...node.config }

    // Migrate stitcher nodes that have no inputOrder yet
    if (node.type === 'video-stitcher' && !config.inputOrder) {
      const incomingEdges = specEdges.filter((e) => e.target === node.id)
      config.inputOrder = [
        ...(config.inputs ?? []).map((v) => ({ type: 'fixed', value: v })),
        ...incomingEdges.map((e) => ({ type: 'edge', nodeId: e.source }))
      ]
    }

    return {
      id: node.id,
      type: node.type,
      position: node.position ?? { x: 0, y: 0 },
      data: { label: node.label ?? node.type, config }
    }
  })

  const edges = (spec.edges ?? []).map((edge) => ({
    id: edge.id,
    source: edge.source,
    sourceHandle: edge.sourceHandle,
    target: edge.target,
    targetHandle: edge.targetHandle
  }))

  return { nodes, edges }
}
