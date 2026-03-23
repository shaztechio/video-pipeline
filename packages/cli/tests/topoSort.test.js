import { describe, it, expect, vi, afterEach } from 'vitest'
import { topoSort } from '../src/executor/topoSort.js'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('topoSort', () => {
  // ── empty graph ──────────────────────────────────────────────────────────

  it('returns an empty array for an empty node list', () => {
    const result = topoSort([], [])
    expect(result).toEqual([])
  })

  // ── single node ──────────────────────────────────────────────────────────

  it('returns a single level with one node when there are no edges', () => {
    const result = topoSort([{ id: 'a' }], [])
    expect(result).toEqual([['a']])
  })

  // ── linear chain ─────────────────────────────────────────────────────────

  it('returns sequential levels for a linear chain a → b → c', () => {
    const nodes = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]
    const edges = [
      { source: 'a', target: 'b' },
      { source: 'b', target: 'c' }
    ]
    const result = topoSort(nodes, edges)
    expect(result).toEqual([['a'], ['b'], ['c']])
  })

  // ── parallel nodes ────────────────────────────────────────────────────────

  it('puts independent nodes in the same level', () => {
    // a and b are independent; c depends on both
    const nodes = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]
    const edges = [
      { source: 'a', target: 'c' },
      { source: 'b', target: 'c' }
    ]
    const result = topoSort(nodes, edges)
    // First level should contain both a and b (order may vary)
    expect(result).toHaveLength(2)
    expect(result[0].sort()).toEqual(['a', 'b'])
    expect(result[1]).toEqual(['c'])
  })

  // ── diamond graph ─────────────────────────────────────────────────────────

  it('handles a diamond: a → b, a → c, b → d, c → d', () => {
    const nodes = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }]
    const edges = [
      { source: 'a', target: 'b' },
      { source: 'a', target: 'c' },
      { source: 'b', target: 'd' },
      { source: 'c', target: 'd' }
    ]
    const result = topoSort(nodes, edges)
    expect(result).toHaveLength(3)
    expect(result[0]).toEqual(['a'])
    expect(result[1].sort()).toEqual(['b', 'c'])
    expect(result[2]).toEqual(['d'])
  })

  // ── cycle detection ───────────────────────────────────────────────────────

  it('throws when a direct cycle a → b → a is detected', () => {
    const nodes = [{ id: 'a' }, { id: 'b' }]
    const edges = [
      { source: 'a', target: 'b' },
      { source: 'b', target: 'a' }
    ]
    expect(() => topoSort(nodes, edges)).toThrow('Pipeline has a cycle — cannot execute')
  })

  it('throws when a self-loop is present', () => {
    const nodes = [{ id: 'a' }]
    const edges = [{ source: 'a', target: 'a' }]
    expect(() => topoSort(nodes, edges)).toThrow('Pipeline has a cycle — cannot execute')
  })

  it('throws when a longer cycle a → b → c → a is detected', () => {
    const nodes = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]
    const edges = [
      { source: 'a', target: 'b' },
      { source: 'b', target: 'c' },
      { source: 'c', target: 'a' }
    ]
    expect(() => topoSort(nodes, edges)).toThrow('Pipeline has a cycle — cannot execute')
  })

  // ── edges referencing unknown nodes ───────────────────────────────────────

  it('ignores edges whose source is not in the node set (outEdges.get returns undefined)', () => {
    // outEdges.get(edge.source)?.push(...) — the ?. short-circuits when source is missing.
    // The target's inDegree is still incremented (it's in the map), so the target
    // will never reach inDegree 0 — cycle error is expected.
    const nodes = [{ id: 'a' }, { id: 'b' }]
    const edges = [
      { source: 'UNKNOWN', target: 'b' }
    ]
    // b's inDegree is 1 but no node can reduce it → cycle error
    expect(() => topoSort(nodes, edges)).toThrow('Pipeline has a cycle — cannot execute')
  })

  // ── multiple disconnected components ─────────────────────────────────────

  it('handles two disconnected linear chains in the same graph', () => {
    const nodes = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }]
    const edges = [
      { source: 'a', target: 'b' },
      { source: 'c', target: 'd' }
    ]
    const result = topoSort(nodes, edges)
    // Level 0: a and c (both have inDegree 0)
    // Level 1: b and d
    expect(result).toHaveLength(2)
    expect(result[0].sort()).toEqual(['a', 'c'])
    expect(result[1].sort()).toEqual(['b', 'd'])
  })

  // ── branch: inDegree.get(edge.target) ?? 0 (line 21) ─────────────────────

  it('fires the ?? 0 fallback when edge.target is not in the node set', () => {
    // When edge.target is not in nodeIds, inDegree.get(target) returns undefined,
    // triggering the ?? 0 branch. The unknown target never appears in `remaining`
    // so the algorithm completes normally.
    const nodes = [{ id: 'a' }, { id: 'b' }]
    const edges = [
      { source: 'UNKNOWN_SRC', target: 'UNKNOWN_TARGET' }
    ]
    // Both source and target are unknown — the ?? 0 fires on line 21.
    // a and b both have inDegree 0 (no valid edges affect them) → single level.
    const result = topoSort(nodes, edges)
    expect(result).toHaveLength(1)
    expect(result[0].sort()).toEqual(['a', 'b'])
  })

  // ── branch: outEdges.get(id) ?? [] (line 38) ─────────────────────────────

  it('fires the ?? [] fallback when outEdges.get returns undefined for a node', () => {
    // outEdges is pre-populated for all nodeIds, so .get() normally returns [].
    // To cover the ?? [] branch, spy on Map.prototype.get so that for a specific
    // call sequence the outEdges lookup returns undefined instead of [].
    // With topoSort([{id:'a'}], []):
    //   Call 1: inDegree.get('a') during level filter (returns 0)
    //   Call 2: outEdges.get('a') in inner loop — we intercept this to return undefined
    // The ?? [] then fires, resulting in an empty iterable → no targets → same output.
    let callCount = 0
    const originalGet = Map.prototype.get
    vi.spyOn(Map.prototype, 'get').mockImplementation(function (key) {
      callCount++
      if (callCount === 2 && key === 'a') {
        return undefined  // force the ?? [] branch to fire
      }
      return originalGet.call(this, key)
    })

    const result = topoSort([{ id: 'a' }], [])
    expect(result).toEqual([['a']])
  })
})
