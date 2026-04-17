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

import { describe, it, expect } from 'vitest'
import { specToFlow } from '../utils/specToFlow.js'

describe('specToFlow', () => {
  // ── basic mapping ─────────────────────────────────────────────────────────

  it('converts a simple spec node to a React Flow node', () => {
    const spec = {
      nodes: [
        { id: 'n1', type: 'input-file', position: { x: 10, y: 20 }, label: 'My Input', config: { path: '/foo' } }
      ],
      edges: []
    }
    const { nodes, edges } = specToFlow(spec)
    expect(nodes).toHaveLength(1)
    expect(nodes[0]).toEqual({
      id: 'n1',
      type: 'input-file',
      position: { x: 10, y: 20 },
      data: { label: 'My Input', config: { path: '/foo' } }
    })
    expect(edges).toHaveLength(0)
  })

  it('converts a spec edge to a React Flow edge', () => {
    const spec = {
      nodes: [],
      edges: [
        { id: 'e1', source: 'a', sourceHandle: 'output', target: 'b', targetHandle: 'inputs' }
      ]
    }
    const { edges } = specToFlow(spec)
    expect(edges).toHaveLength(1)
    expect(edges[0]).toEqual({
      id: 'e1',
      source: 'a',
      sourceHandle: 'output',
      target: 'b',
      targetHandle: 'inputs'
    })
  })

  // ── ?? defaults ───────────────────────────────────────────────────────────

  it('defaults nodes to [] when spec.nodes is undefined', () => {
    const { nodes } = specToFlow({ edges: [] })
    expect(nodes).toEqual([])
  })

  it('defaults edges to [] when spec.edges is undefined', () => {
    const { edges } = specToFlow({ nodes: [] })
    expect(edges).toEqual([])
  })

  it('defaults position to {x:0,y:0} when node.position is missing', () => {
    const spec = {
      nodes: [{ id: 'n1', type: 'input-file', label: 'L', config: {} }],
      edges: []
    }
    const { nodes } = specToFlow(spec)
    expect(nodes[0].position).toEqual({ x: 0, y: 0 })
  })

  it('defaults label to node.type when node.label is missing', () => {
    const spec = {
      nodes: [{ id: 'n1', type: 'input-file', config: {} }],
      edges: []
    }
    const { nodes } = specToFlow(spec)
    expect(nodes[0].data.label).toBe('input-file')
  })

  it('uses provided label when present', () => {
    const spec = {
      nodes: [{ id: 'n1', type: 'input-file', label: 'Custom Label', config: {} }],
      edges: []
    }
    const { nodes } = specToFlow(spec)
    expect(nodes[0].data.label).toBe('Custom Label')
  })

  // ── video-stitcher migration: inputOrder missing ──────────────────────────

  it('injects inputOrder for video-stitcher when inputOrder is missing', () => {
    const spec = {
      nodes: [
        { id: 'vs', type: 'video-stitcher', config: {} }
      ],
      edges: [
        { id: 'e1', source: 'src1', sourceHandle: 'output', target: 'vs', targetHandle: 'inputs' },
        { id: 'e2', source: 'src2', sourceHandle: 'output', target: 'vs', targetHandle: 'inputs' }
      ]
    }
    const { nodes } = specToFlow(spec)
    const vsNode = nodes[0]
    expect(vsNode.data.config.inputOrder).toEqual([
      { type: 'edge', nodeId: 'src1' },
      { type: 'edge', nodeId: 'src2' }
    ])
  })

  it('merges fixed inputs and edge-based inputOrder during migration', () => {
    const spec = {
      nodes: [
        { id: 'vs', type: 'video-stitcher', config: { inputs: ['/fixed1', '/fixed2'] } }
      ],
      edges: [
        { id: 'e1', source: 'dyn1', sourceHandle: 'output', target: 'vs', targetHandle: 'inputs' }
      ]
    }
    const { nodes } = specToFlow(spec)
    expect(nodes[0].data.config.inputOrder).toEqual([
      { type: 'fixed', value: '/fixed1' },
      { type: 'fixed', value: '/fixed2' },
      { type: 'edge', nodeId: 'dyn1' }
    ])
  })

  it('does NOT migrate video-stitcher when inputOrder is already present', () => {
    const existingOrder = [{ type: 'edge', nodeId: 'x' }]
    const spec = {
      nodes: [
        { id: 'vs', type: 'video-stitcher', config: { inputOrder: existingOrder } }
      ],
      edges: [
        { id: 'e1', source: 'y', sourceHandle: 'output', target: 'vs', targetHandle: 'inputs' }
      ]
    }
    const { nodes } = specToFlow(spec)
    // inputOrder should remain exactly as provided, not merged with incoming edges
    expect(nodes[0].data.config.inputOrder).toEqual(existingOrder)
  })

  it('does NOT migrate non-video-stitcher nodes even without inputOrder', () => {
    const spec = {
      nodes: [
        { id: 'n1', type: 'video-cutter', config: {} }
      ],
      edges: []
    }
    const { nodes } = specToFlow(spec)
    expect(nodes[0].data.config.inputOrder).toBeUndefined()
  })

  it('handles video-stitcher migration with no incoming edges and no inputs', () => {
    const spec = {
      nodes: [
        { id: 'vs', type: 'video-stitcher', config: {} }
      ],
      edges: []
    }
    const { nodes } = specToFlow(spec)
    expect(nodes[0].data.config.inputOrder).toEqual([])
  })

  // ── config is a shallow copy ──────────────────────────────────────────────

  it('spreads config so mutations on the original do not affect output', () => {
    const originalConfig = { path: '/original' }
    const spec = {
      nodes: [{ id: 'n1', type: 'input-file', config: originalConfig }],
      edges: []
    }
    const { nodes } = specToFlow(spec)
    originalConfig.path = '/changed'
    expect(nodes[0].data.config.path).toBe('/original')
  })

  // ── full round-trip with multiple nodes ───────────────────────────────────

  it('converts multiple nodes and edges at once', () => {
    const spec = {
      nodes: [
        { id: 'a', type: 'input-file', position: { x: 0, y: 0 }, label: 'A', config: { path: '/a' } },
        { id: 'b', type: 'video-stitcher', position: { x: 100, y: 0 }, label: 'B', config: { inputOrder: [] } }
      ],
      edges: [
        { id: 'e1', source: 'a', sourceHandle: 'output', target: 'b', targetHandle: 'inputs' }
      ]
    }
    const { nodes, edges } = specToFlow(spec)
    expect(nodes).toHaveLength(2)
    expect(edges).toHaveLength(1)
    expect(nodes[0].id).toBe('a')
    expect(nodes[1].id).toBe('b')
    expect(edges[0].id).toBe('e1')
  })
})
