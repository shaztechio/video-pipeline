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
import { validateSpec } from '../src/spec/schema.js'

// A minimal valid spec used as a base for most tests
const validSpec = () => ({
  version: '1',
  name: 'test pipeline',
  nodes: [
    { id: 'a', type: 'input-file', config: {} },
    { id: 'b', type: 'video-stitcher', config: {} }
  ],
  edges: [
    { id: 'e1', source: 'a', target: 'b' }
  ]
})

describe('validateSpec', () => {
  // ── top-level guard ──────────────────────────────────────────────────────

  it('returns invalid when spec is null', () => {
    const result = validateSpec(null)
    expect(result).toEqual({ valid: false, errors: ['Spec must be a JSON object'] })
  })

  it('returns invalid when spec is a string', () => {
    const result = validateSpec('hello')
    expect(result).toEqual({ valid: false, errors: ['Spec must be a JSON object'] })
  })

  it('returns invalid when spec is a number', () => {
    const result = validateSpec(42)
    expect(result).toEqual({ valid: false, errors: ['Spec must be a JSON object'] })
  })

  // ── early-return on structural errors ────────────────────────────────────

  it('returns invalid and stops early when version, name, nodes, and edges are all wrong', () => {
    const result = validateSpec({ version: '2', name: '', nodes: null, edges: null })
    expect(result.valid).toBe(false)
    // All four structural errors should be present (early return after 4 errors)
    expect(result.errors).toContain('Unsupported spec version: 2 (expected "1")')
    expect(result.errors).toContain('spec.name must be a non-empty string')
    expect(result.errors).toContain('spec.nodes must be an array')
    expect(result.errors).toContain('spec.edges must be an array')
  })

  it('returns early (before node/edge detail checks) when nodes is not an array', () => {
    const result = validateSpec({ version: '1', name: 'x', nodes: 'bad', edges: [] })
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('spec.nodes must be an array')
  })

  it('returns early when edges is not an array', () => {
    const result = validateSpec({ version: '1', name: 'x', nodes: [], edges: 'bad' })
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('spec.edges must be an array')
  })

  // ── version validation ───────────────────────────────────────────────────

  it('returns invalid for version "2"', () => {
    const spec = { ...validSpec(), version: '2' }
    const result = validateSpec(spec)
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('Unsupported spec version: 2 (expected "1")')
  })

  it('returns invalid when version is undefined', () => {
    const spec = { ...validSpec(), version: undefined }
    const result = validateSpec(spec)
    expect(result.valid).toBe(false)
    expect(result.errors[0]).toMatch(/Unsupported spec version/)
  })

  // ── name validation ───────────────────────────────────────────────────────

  it('returns invalid when name is an empty string', () => {
    const spec = { ...validSpec(), name: '' }
    const result = validateSpec(spec)
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('spec.name must be a non-empty string')
  })

  it('returns invalid when name is a number', () => {
    const spec = { ...validSpec(), name: 42 }
    const result = validateSpec(spec)
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('spec.name must be a non-empty string')
  })

  it('returns invalid when name is missing', () => {
    const spec = { ...validSpec(), name: undefined }
    const result = validateSpec(spec)
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('spec.name must be a non-empty string')
  })

  // ── node validation ───────────────────────────────────────────────────────

  it('returns invalid when a node is missing id', () => {
    const spec = validSpec()
    spec.nodes.push({ type: 'input-file', config: {} })
    const result = validateSpec(spec)
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.includes('Node missing valid id'))).toBe(true)
  })

  it('returns invalid when a node has a non-string id', () => {
    const spec = validSpec()
    spec.nodes.push({ id: 99, type: 'input-file', config: {} })
    const result = validateSpec(spec)
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.includes('Node missing valid id'))).toBe(true)
  })

  it('returns invalid for duplicate node ids', () => {
    const spec = validSpec()
    spec.nodes.push({ id: 'a', type: 'input-file', config: {} })
    const result = validateSpec(spec)
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('Duplicate node id: a')
  })

  it('returns invalid for unknown node type', () => {
    const spec = validSpec()
    spec.nodes[0].type = 'unknown-type'
    const result = validateSpec(spec)
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('Node "a" has unknown type: unknown-type')
  })

  it('returns invalid when node is missing config', () => {
    const spec = validSpec()
    spec.nodes[0].config = null
    const result = validateSpec(spec)
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('Node "a" missing config object')
  })

  it('returns invalid when node config is not an object (string)', () => {
    const spec = validSpec()
    spec.nodes[0].config = 'bad'
    const result = validateSpec(spec)
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('Node "a" missing config object')
  })

  it('accepts every valid KNOWN_NODE_TYPE', () => {
    const types = ['video-cutter', 'video-stitcher', 'output-folder', 'input-file', 'input-folder']
    for (const type of types) {
      const spec = {
        version: '1',
        name: 'x',
        nodes: [{ id: 'n1', type, config: {} }],
        edges: []
      }
      const result = validateSpec(spec)
      expect(result.valid, `type "${type}" should be valid`).toBe(true)
    }
  })

  // ── edge validation ───────────────────────────────────────────────────────

  it('returns invalid when edge is missing id', () => {
    const spec = validSpec()
    spec.edges.push({ source: 'a', target: 'b' })
    const result = validateSpec(spec)
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.includes('Edge missing id'))).toBe(true)
  })

  it('returns invalid when edge source references unknown node', () => {
    const spec = validSpec()
    spec.edges.push({ id: 'e2', source: 'NONEXISTENT', target: 'b' })
    const result = validateSpec(spec)
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('Edge "e2" references unknown source node: NONEXISTENT')
  })

  it('returns invalid when edge target references unknown node', () => {
    const spec = validSpec()
    spec.edges.push({ id: 'e2', source: 'a', target: 'NONEXISTENT' })
    const result = validateSpec(spec)
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('Edge "e2" references unknown target node: NONEXISTENT')
  })

  // ── valid spec ────────────────────────────────────────────────────────────

  it('returns valid for a well-formed spec with nodes and edges', () => {
    const result = validateSpec(validSpec())
    expect(result).toEqual({ valid: true })
  })

  it('returns valid for a spec with no nodes and no edges', () => {
    const result = validateSpec({ version: '1', name: 'empty', nodes: [], edges: [] })
    expect(result).toEqual({ valid: true })
  })

  // ── node with invalid id skips type/config checks via continue ────────────

  it('does not push type/config errors for a node that already failed id check', () => {
    // A node with no id should only produce the "Node missing valid id" error,
    // not additional type/config errors (because of the `continue` statement).
    const spec = {
      version: '1',
      name: 'x',
      nodes: [{ type: 'input-file', config: {} }],
      edges: []
    }
    const result = validateSpec(spec)
    expect(result.valid).toBe(false)
    // Should have exactly one error for the node
    const nodeErrors = result.errors.filter((e) => e.includes('Node'))
    expect(nodeErrors).toHaveLength(1)
    expect(nodeErrors[0]).toMatch(/Node missing valid id/)
  })
})
