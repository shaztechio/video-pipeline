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
