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
import { flowToSpec } from '../utils/flowToSpec.js'

describe('flowToSpec', () => {
  // ── basic round-trip ──────────────────────────────────────────────────────

  it('converts nodes with exact position rounding and config spread', () => {
    const rfNodes = [
      {
        id: 'n1',
        type: 'input-file',
        position: { x: 10.7, y: 20.3 },
        data: { label: 'Input', config: { path: '/foo' } }
      }
    ]
    const rfEdges = []
    const result = flowToSpec(rfNodes, rfEdges, { version: '1', name: 'my-pipeline' })

    expect(result.nodes).toHaveLength(1)
    expect(result.nodes[0]).toEqual({
      id: 'n1',
      type: 'input-file',
      label: 'Input',
      position: { x: 11, y: 20 },
      config: { path: '/foo' }
    })
  })

  it('converts edges with explicit sourceHandle and targetHandle', () => {
    const rfEdges = [
      {
        id: 'e1',
        source: 'n1',
        sourceHandle: 'out',
        target: 'n2',
        targetHandle: 'in'
      }
    ]
    const result = flowToSpec([], rfEdges, { version: '1', name: 'p' })
    expect(result.edges).toHaveLength(1)
    expect(result.edges[0]).toEqual({
      id: 'e1',
      source: 'n1',
      sourceHandle: 'out',
      target: 'n2',
      targetHandle: 'in'
    })
  })

  // ── ?? defaults on edge handles ───────────────────────────────────────────

  it('defaults sourceHandle to "output" when it is null/undefined', () => {
    const rfEdges = [
      { id: 'e1', source: 'n1', sourceHandle: null, target: 'n2', targetHandle: null }
    ]
    const result = flowToSpec([], rfEdges, { version: '1', name: 'p' })
    expect(result.edges[0].sourceHandle).toBe('output')
    expect(result.edges[0].targetHandle).toBe('inputs')
  })

  it('defaults sourceHandle to "output" when the field is missing (undefined)', () => {
    const rfEdges = [
      { id: 'e1', source: 'n1', target: 'n2' }
    ]
    const result = flowToSpec([], rfEdges, { version: '1', name: 'p' })
    expect(result.edges[0].sourceHandle).toBe('output')
    expect(result.edges[0].targetHandle).toBe('inputs')
  })

  // ── ?? defaults on specMeta ───────────────────────────────────────────────

  it('defaults version to "1" when specMeta.version is undefined', () => {
    const result = flowToSpec([], [], { name: 'p' })
    expect(result.version).toBe('1')
  })

  it('defaults name to "pipeline" when specMeta.name is undefined', () => {
    const result = flowToSpec([], [], { version: '1' })
    expect(result.name).toBe('pipeline')
  })

  it('uses provided version and name from specMeta', () => {
    const result = flowToSpec([], [], { version: '2', name: 'custom' })
    expect(result.version).toBe('2')
    expect(result.name).toBe('custom')
  })

  // ── position rounding ─────────────────────────────────────────────────────

  it('rounds positions using Math.round (0.5 rounds up)', () => {
    const rfNodes = [
      {
        id: 'n1',
        type: 'input-file',
        position: { x: 0.5, y: 0.5 },
        data: { label: 'L', config: {} }
      }
    ]
    const result = flowToSpec(rfNodes, [], { version: '1', name: 'p' })
    expect(result.nodes[0].position).toEqual({ x: 1, y: 1 })
  })

  it('rounds fractional positions down with Math.round', () => {
    const rfNodes = [
      {
        id: 'n1',
        type: 'input-file',
        position: { x: 10.4, y: 20.4 },
        data: { label: 'L', config: {} }
      }
    ]
    const result = flowToSpec(rfNodes, [], { version: '1', name: 'p' })
    expect(result.nodes[0].position).toEqual({ x: 10, y: 20 })
  })

  // ── config is a shallow copy ──────────────────────────────────────────────

  it('spreads config so mutations on the original do not affect output', () => {
    const originalConfig = { path: '/a' }
    const rfNodes = [
      {
        id: 'n1',
        type: 'input-file',
        position: { x: 0, y: 0 },
        data: { label: 'L', config: originalConfig }
      }
    ]
    const result = flowToSpec(rfNodes, [], { version: '1', name: 'p' })
    originalConfig.path = '/changed'
    expect(result.nodes[0].config.path).toBe('/a')
  })

  // ── empty inputs ─────────────────────────────────────────────────────────

  it('returns correct shape for empty nodes and edges', () => {
    const result = flowToSpec([], [], { version: '1', name: 'empty' })
    expect(result).toEqual({ version: '1', name: 'empty', nodes: [], edges: [] })
  })

  // ── multiple nodes and edges ──────────────────────────────────────────────

  it('maps multiple nodes and edges correctly', () => {
    const rfNodes = [
      { id: 'a', type: 'input-file', position: { x: 0, y: 0 }, data: { label: 'A', config: {} } },
      { id: 'b', type: 'video-stitcher', position: { x: 100, y: 50 }, data: { label: 'B', config: { inputOrder: [] } } }
    ]
    const rfEdges = [
      { id: 'e1', source: 'a', sourceHandle: 'output', target: 'b', targetHandle: 'inputs' }
    ]
    const result = flowToSpec(rfNodes, rfEdges, { version: '1', name: 'multi' })
    expect(result.nodes).toHaveLength(2)
    expect(result.edges).toHaveLength(1)
    expect(result.nodes[1].config.inputOrder).toEqual([])
  })
})
