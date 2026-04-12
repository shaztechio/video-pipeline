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

import { describe, it, expect, vi, beforeEach } from 'vitest'
import os from 'os'
import path from 'path'

// Mock fs module before importing the handler
vi.mock('fs', () => ({
  mkdirSync: vi.fn(),
  existsSync: vi.fn(() => false),
  copyFileSync: vi.fn()
}))

// Mock the runner module
vi.mock('../src/executor/runner.js', () => ({
  run: vi.fn(() => Promise.resolve())
}))

// Mock imageAnnotate so handler tests don't need a real ffmpeg or font file
vi.mock('../src/executor/nodeHandlers/imageAnnotate.js', () => ({
  annotateImageWithSequence: vi.fn(() => Promise.resolve())
}))

import { mkdirSync, existsSync, copyFileSync } from 'fs'
import { run } from '../src/executor/runner.js'
import { handleVideoStitcher } from '../src/executor/nodeHandlers/video-stitcher.js'
import { annotateImageWithSequence } from '../src/executor/nodeHandlers/imageAnnotate.js'

// Helper: build a minimal node object
function makeNode(id, config, label) {
  return { id, config, label }
}

// Helper: build a context Map
function makeContext(entries = {}) {
  const ctx = new Map()
  for (const [k, v] of Object.entries(entries)) {
    ctx.set(k, v)
  }
  return ctx
}

beforeEach(() => {
  vi.clearAllMocks()
  // Default: output file does not exist
  existsSync.mockReturnValue(false)
})

describe('handleVideoStitcher', () => {
  // ── output directory resolution ──────────────────────────────────────────

  it('uses outputFolderPaths[0] when provided', async () => {
    const node = makeNode('stitch1', {
      inputOrder: [
        { type: 'fixed', value: '/a.mp4' },
        { type: 'fixed', value: '/b.mp4' }
      ]
    })
    const ctx = makeContext()
    await handleVideoStitcher(node, ctx, '/tmp/root', [], {
      outputFolderPaths: ['/custom/output']
    })
    expect(mkdirSync).toHaveBeenCalledWith('/custom/output', { recursive: true })
  })

  it('uses config.output when no outputFolderPaths provided', async () => {
    const node = makeNode('stitch1', {
      output: '/from/config',
      inputOrder: [
        { type: 'fixed', value: '/a.mp4' },
        { type: 'fixed', value: '/b.mp4' }
      ]
    })
    const ctx = makeContext()
    await handleVideoStitcher(node, ctx, '/tmp/root', [], {})
    expect(mkdirSync).toHaveBeenCalledWith('/from/config', { recursive: true })
  })

  it('expands ~ in config.output', async () => {
    const node = makeNode('stitch1', {
      output: '~/my-output',
      inputOrder: [
        { type: 'fixed', value: '/a.mp4' },
        { type: 'fixed', value: '/b.mp4' }
      ]
    })
    const ctx = makeContext()
    await handleVideoStitcher(node, ctx, '/tmp/root', [], {})
    const expected = path.join(os.homedir(), 'my-output')
    expect(mkdirSync).toHaveBeenCalledWith(expected, { recursive: true })
  })

  it('falls back to tempRoot/nodeId when neither outputFolderPaths nor config.output is set', async () => {
    const node = makeNode('stitch1', {
      inputOrder: [
        { type: 'fixed', value: '/a.mp4' },
        { type: 'fixed', value: '/b.mp4' }
      ]
    })
    const ctx = makeContext()
    await handleVideoStitcher(node, ctx, '/tmp/root', [], {})
    expect(mkdirSync).toHaveBeenCalledWith('/tmp/root/stitch1', { recursive: true })
  })

  it('expands ~ in outputFolderPaths entries', async () => {
    const node = makeNode('stitch1', {
      inputOrder: [
        { type: 'fixed', value: '/a.mp4' },
        { type: 'fixed', value: '/b.mp4' }
      ]
    })
    const ctx = makeContext()
    await handleVideoStitcher(node, ctx, '/tmp/root', [], {
      outputFolderPaths: ['~/expanded-path']
    })
    const expected = path.join(os.homedir(), 'expanded-path')
    expect(mkdirSync).toHaveBeenCalledWith(expected, { recursive: true })
  })

  // ── dryRun mode ──────────────────────────────────────────────────────────

  it('skips mkdirSync and existsSync in dryRun mode', async () => {
    const node = makeNode('stitch1', {
      inputOrder: [
        { type: 'fixed', value: '/a.mp4' },
        { type: 'fixed', value: '/b.mp4' }
      ]
    })
    const ctx = makeContext()
    await handleVideoStitcher(node, ctx, '/tmp/root', [], { dryRun: true })
    expect(mkdirSync).not.toHaveBeenCalled()
    expect(existsSync).not.toHaveBeenCalled()
    expect(run).toHaveBeenCalledWith(
      'video-stitcher',
      expect.any(Array),
      expect.objectContaining({ dryRun: true })
    )
  })

  // ── overwrite guard ──────────────────────────────────────────────────────

  it('throws when output file exists and overwrite is not set', async () => {
    existsSync.mockReturnValue(true)
    const node = makeNode('stitch1', {
      inputOrder: [
        { type: 'fixed', value: '/a.mp4' },
        { type: 'fixed', value: '/b.mp4' }
      ]
    })
    const ctx = makeContext()
    await expect(
      handleVideoStitcher(node, ctx, '/tmp/root', [], {})
    ).rejects.toThrow('Output file already exists')
  })

  it('does not throw when output file exists but overwrite is true', async () => {
    existsSync.mockReturnValue(true)
    const node = makeNode('stitch1', {
      inputOrder: [
        { type: 'fixed', value: '/a.mp4' },
        { type: 'fixed', value: '/b.mp4' }
      ]
    })
    const ctx = makeContext()
    await expect(
      handleVideoStitcher(node, ctx, '/tmp/root', [], { overwrite: true })
    ).resolves.toBeUndefined()
  })

  // ── too-few inputs guard ─────────────────────────────────────────────────

  it('throws when a run ends up with fewer than 2 inputs', async () => {
    const node = makeNode('stitch1', {
      inputOrder: [
        { type: 'fixed', value: '/only-one.mp4' }
      ]
    })
    const ctx = makeContext()
    await expect(
      handleVideoStitcher(node, ctx, '/tmp/root', [], {})
    ).rejects.toThrow('at least 2 inputs required')
  })

  // ── run() argv construction ──────────────────────────────────────────────

  it('passes inputs and -o flag to run()', async () => {
    const node = makeNode('stitch1', {
      inputOrder: [
        { type: 'fixed', value: '/a.mp4' },
        { type: 'fixed', value: '/b.mp4' }
      ]
    })
    const ctx = makeContext()
    await handleVideoStitcher(node, ctx, '/tmp/root', [], {})
    expect(run).toHaveBeenCalledWith(
      'video-stitcher',
      ['/a.mp4', '/b.mp4', '-o', '/tmp/root/stitch1/output.mp4'],
      { label: 'stitch1', dryRun: undefined }
    )
  })

  it('passes node.label as the label option when provided', async () => {
    const node = makeNode('stitch1', {
      inputOrder: [
        { type: 'fixed', value: '/a.mp4' },
        { type: 'fixed', value: '/b.mp4' }
      ]
    }, 'My Stitcher')
    const ctx = makeContext()
    await handleVideoStitcher(node, ctx, '/tmp/root', [], {})
    expect(run).toHaveBeenCalledWith(
      'video-stitcher',
      expect.any(Array),
      expect.objectContaining({ label: 'My Stitcher' })
    )
  })

  it('appends -d flag when imageDuration is set and not 1', async () => {
    const node = makeNode('stitch1', {
      imageDuration: 3,
      inputOrder: [
        { type: 'fixed', value: '/a.mp4' },
        { type: 'fixed', value: '/b.mp4' }
      ]
    })
    const ctx = makeContext()
    await handleVideoStitcher(node, ctx, '/tmp/root', [], {})
    const argv = run.mock.calls[0][1]
    expect(argv).toContain('-d')
    expect(argv).toContain('3')
  })

  it('does not append -d when imageDuration is exactly 1', async () => {
    const node = makeNode('stitch1', {
      imageDuration: 1,
      inputOrder: [
        { type: 'fixed', value: '/a.mp4' },
        { type: 'fixed', value: '/b.mp4' }
      ]
    })
    const ctx = makeContext()
    await handleVideoStitcher(node, ctx, '/tmp/root', [], {})
    const argv = run.mock.calls[0][1]
    expect(argv).not.toContain('-d')
  })

  it('does not append -d when imageDuration is null', async () => {
    const node = makeNode('stitch1', {
      imageDuration: null,
      inputOrder: [
        { type: 'fixed', value: '/a.mp4' },
        { type: 'fixed', value: '/b.mp4' }
      ]
    })
    const ctx = makeContext()
    await handleVideoStitcher(node, ctx, '/tmp/root', [], {})
    const argv = run.mock.calls[0][1]
    expect(argv).not.toContain('-d')
  })

  it('appends --bg-audio flag when bgAudio is set', async () => {
    const node = makeNode('stitch1', {
      bgAudio: '/music.mp3',
      inputOrder: [
        { type: 'fixed', value: '/a.mp4' },
        { type: 'fixed', value: '/b.mp4' }
      ]
    })
    const ctx = makeContext()
    await handleVideoStitcher(node, ctx, '/tmp/root', [], {})
    const argv = run.mock.calls[0][1]
    expect(argv).toContain('--bg-audio')
    expect(argv).toContain('/music.mp3')
  })

  it('does not append --bg-audio when bgAudio is falsy', async () => {
    const node = makeNode('stitch1', {
      inputOrder: [
        { type: 'fixed', value: '/a.mp4' },
        { type: 'fixed', value: '/b.mp4' }
      ]
    })
    const ctx = makeContext()
    await handleVideoStitcher(node, ctx, '/tmp/root', [], {})
    const argv = run.mock.calls[0][1]
    expect(argv).not.toContain('--bg-audio')
  })

  it('appends --bg-audio-volume when bgAudioVolume is set and not 1.0', async () => {
    const node = makeNode('stitch1', {
      bgAudioVolume: 0.5,
      inputOrder: [
        { type: 'fixed', value: '/a.mp4' },
        { type: 'fixed', value: '/b.mp4' }
      ]
    })
    const ctx = makeContext()
    await handleVideoStitcher(node, ctx, '/tmp/root', [], {})
    const argv = run.mock.calls[0][1]
    expect(argv).toContain('--bg-audio-volume')
    expect(argv).toContain('0.5')
  })

  it('does not append --bg-audio-volume when bgAudioVolume is exactly 1.0', async () => {
    const node = makeNode('stitch1', {
      bgAudioVolume: 1.0,
      inputOrder: [
        { type: 'fixed', value: '/a.mp4' },
        { type: 'fixed', value: '/b.mp4' }
      ]
    })
    const ctx = makeContext()
    await handleVideoStitcher(node, ctx, '/tmp/root', [], {})
    const argv = run.mock.calls[0][1]
    expect(argv).not.toContain('--bg-audio-volume')
  })

  it('does not append --bg-audio-volume when bgAudioVolume is null', async () => {
    const node = makeNode('stitch1', {
      bgAudioVolume: null,
      inputOrder: [
        { type: 'fixed', value: '/a.mp4' },
        { type: 'fixed', value: '/b.mp4' }
      ]
    })
    const ctx = makeContext()
    await handleVideoStitcher(node, ctx, '/tmp/root', [], {})
    const argv = run.mock.calls[0][1]
    expect(argv).not.toContain('--bg-audio-volume')
  })

  // ── context output registration ──────────────────────────────────────────

  it('registers outputs in context after running', async () => {
    const node = makeNode('stitch1', {
      inputOrder: [
        { type: 'fixed', value: '/a.mp4' },
        { type: 'fixed', value: '/b.mp4' }
      ]
    })
    const ctx = makeContext()
    await handleVideoStitcher(node, ctx, '/tmp/root', [], {})
    const output = ctx.get('stitch1')
    expect(output).toBeDefined()
    expect(output.outputDir).toBe('/tmp/root/stitch1')
    expect(output.outputs).toEqual(['/tmp/root/stitch1/output.mp4'])
  })

  // ── multiple outputFolderPaths (copy to additional dirs) ─────────────────

  it('copies output files to additional outputFolderPaths', async () => {
    const node = makeNode('stitch1', {
      inputOrder: [
        { type: 'fixed', value: '/a.mp4' },
        { type: 'fixed', value: '/b.mp4' }
      ]
    })
    const ctx = makeContext()
    await handleVideoStitcher(node, ctx, '/tmp/root', [], {
      outputFolderPaths: ['/primary', '/secondary']
    })
    expect(copyFileSync).toHaveBeenCalledWith(
      '/primary/output.mp4',
      '/secondary/output.mp4'
    )
    expect(mkdirSync).toHaveBeenCalledWith('/secondary', { recursive: true })
  })

  // ── buildRuns: no inputOrder (legacy path) ───────────────────────────────

  it('falls through to legacy path when inputOrder is absent', async () => {
    const node = makeNode('stitch1', {
      inputs: ['/legacy-a.mp4', '/legacy-b.mp4']
    })
    const ctx = makeContext()
    // No inputOrder — should use legacy inputs
    await handleVideoStitcher(node, ctx, '/tmp/root', [], {})
    expect(run).toHaveBeenCalledWith(
      'video-stitcher',
      ['/legacy-a.mp4', '/legacy-b.mp4', '-o', '/tmp/root/stitch1/output.mp4'],
      expect.any(Object)
    )
  })

  it('uses legacy path when inputOrder is an empty array', async () => {
    const node = makeNode('stitch1', {
      inputOrder: [],
      inputs: ['/a.mp4', '/b.mp4']
    })
    const ctx = makeContext()
    await handleVideoStitcher(node, ctx, '/tmp/root', [], {})
    expect(run).toHaveBeenCalledWith(
      'video-stitcher',
      ['/a.mp4', '/b.mp4', '-o', '/tmp/root/stitch1/output.mp4'],
      expect.any(Object)
    )
  })

  it('legacy path concatenates edge outputs after fixed inputs', async () => {
    const node = makeNode('stitch1', {
      inputs: ['/fixed.mp4']
    })
    const ctx = makeContext({
      'upstream': { outputs: ['/edge-a.mp4', '/edge-b.mp4'] }
    })
    const edges = [{ source: 'upstream', target: 'stitch1' }]
    await handleVideoStitcher(node, ctx, '/tmp/root', edges, {})
    const argv = run.mock.calls[0][1]
    expect(argv).toContain('/fixed.mp4')
    expect(argv).toContain('/edge-a.mp4')
    expect(argv).toContain('/edge-b.mp4')
  })

  it('legacy path throws when upstream has no context entry', async () => {
    const node = makeNode('stitch1', {
      inputs: ['/fixed.mp4']
    })
    const ctx = makeContext() // no upstream entry
    const edges = [{ source: 'missing-upstream', target: 'stitch1' }]
    await expect(
      handleVideoStitcher(node, ctx, '/tmp/root', edges, {})
    ).rejects.toThrow('upstream node "missing-upstream" has no outputs in context')
  })

  it('legacy path handles config.inputs being absent (no fixed inputs)', async () => {
    const node = makeNode('stitch1', {})
    const ctx = makeContext({
      'upstream': { outputs: ['/a.mp4', '/b.mp4'] }
    })
    const edges = [{ source: 'upstream', target: 'stitch1' }]
    await handleVideoStitcher(node, ctx, '/tmp/root', edges, {})
    const argv = run.mock.calls[0][1]
    expect(argv).toContain('/a.mp4')
    expect(argv).toContain('/b.mp4')
  })

  // ── buildRuns: inputOrder with only fixed items ───────────────────────────

  it('produces single run with fixed-only inputOrder', async () => {
    const node = makeNode('stitch1', {
      inputOrder: [
        { type: 'fixed', value: '/img.jpg', imageDuration: 2.5 },
        { type: 'fixed', value: '/vid.mp4' }
      ]
    })
    const ctx = makeContext()
    await handleVideoStitcher(node, ctx, '/tmp/root', [], {})
    const argv = run.mock.calls[0][1]
    // imageDuration causes value:duration formatting
    expect(argv[0]).toBe('/img.jpg:2.5')
    expect(argv[1]).toBe('/vid.mp4')
    expect(argv[2]).toBe('-o')
    expect(argv[3]).toBe('/tmp/root/stitch1/output.mp4')
  })

  it('fixed item with no value is filtered out in fixed-only inputOrder', async () => {
    // item has no value — should be skipped; but then we need at least 2 real items
    // Let's verify the filter: include two valid items + one without value
    const node = makeNode('stitch1', {
      inputOrder: [
        { type: 'fixed', value: '/a.mp4' },
        { type: 'fixed', value: '' },       // empty string — falsy, filtered
        { type: 'fixed', value: '/b.mp4' }
      ]
    })
    const ctx = makeContext()
    await handleVideoStitcher(node, ctx, '/tmp/root', [], {})
    const argv = run.mock.calls[0][1]
    expect(argv[0]).toBe('/a.mp4')
    expect(argv[1]).toBe('/b.mp4')
  })

  // ── buildRuns: inputOrder with edge items (N-runs path) ──────────────────

  it('produces N runs when an edge item expands to N files', async () => {
    const node = makeNode('stitch1', {
      inputOrder: [
        { type: 'edge', nodeId: 'upstream' },
        { type: 'fixed', value: '/bg.mp4' }
      ]
    })
    const ctx = makeContext({
      'upstream': { outputs: ['/seg1.mp4', '/seg2.mp4', '/seg3.mp4'] }
    })
    const edges = [{ source: 'upstream', target: 'stitch1' }]
    await handleVideoStitcher(node, ctx, '/tmp/root', edges, {})
    // Should call run 3 times
    expect(run).toHaveBeenCalledTimes(3)
  })

  it('uses basename of pivot file as run name (single-source)', async () => {
    const node = makeNode('stitch1', {
      inputOrder: [
        { type: 'edge', nodeId: 'upstream' },
        { type: 'fixed', value: '/bg.mp4' }
      ]
    })
    const ctx = makeContext({
      'upstream': { outputs: ['/out/seg1.mp4', '/out/seg2.mp4'] }
    })
    const edges = [{ source: 'upstream', target: 'stitch1' }]
    await handleVideoStitcher(node, ctx, '/tmp/root', edges, {})
    // Both files share the same parent directory → single source → basename only
    const firstArgv = run.mock.calls[0][1]
    expect(firstArgv).toContain('/tmp/root/stitch1/seg1.mp4')
    const secondArgv = run.mock.calls[1][1]
    expect(secondArgv).toContain('/tmp/root/stitch1/seg2.mp4')
  })

  it('uses subfolder/basename naming when pivot files span multiple directories (multiSource)', async () => {
    const node = makeNode('stitch1', {
      inputOrder: [
        { type: 'edge', nodeId: 'upstream' },
        { type: 'fixed', value: '/bg.mp4' }
      ]
    })
    const ctx = makeContext({
      // Files come from two different directories → multiSource = true
      'upstream': { outputs: ['/movieA/seg.mp4', '/movieB/seg.mp4'] }
    })
    const edges = [{ source: 'upstream', target: 'stitch1' }]
    await handleVideoStitcher(node, ctx, '/tmp/root', edges, {})
    const firstArgv = run.mock.calls[0][1]
    // multiSource → dir/basename: movieA/seg.mp4
    expect(firstArgv.find((a) => a.includes('movieA'))).toBeTruthy()
    const secondArgv = run.mock.calls[1][1]
    expect(secondArgv.find((a) => a.includes('movieB'))).toBeTruthy()
  })

  it('clamps edge file index when edge has fewer files than runCount', async () => {
    // edge1 has 3 files (drives runCount=3), edge2 has only 1 file (clamped)
    const node = makeNode('stitch1', {
      inputOrder: [
        { type: 'edge', nodeId: 'edge1' },
        { type: 'edge', nodeId: 'edge2' }
      ]
    })
    const ctx = makeContext({
      'edge1': { outputs: ['/a1.mp4', '/a2.mp4', '/a3.mp4'] },
      'edge2': { outputs: ['/b1.mp4'] }
    })
    const edges = [
      { source: 'edge1', target: 'stitch1' },
      { source: 'edge2', target: 'stitch1' }
    ]
    await handleVideoStitcher(node, ctx, '/tmp/root', edges, {})
    // run 3 (index 2): edge2 should use b1.mp4 (clamped to last = index 0)
    expect(run).toHaveBeenCalledTimes(3)
    const thirdArgv = run.mock.calls[2][1]
    expect(thirdArgv).toContain('/b1.mp4')
    // Also edge2 for run 2 (index 1) should use b1.mp4
    const secondArgv = run.mock.calls[1][1]
    expect(secondArgv).toContain('/b1.mp4')
  })

  it('uses fallback name output_NNN.mp4 when pivot file is beyond array bounds', async () => {
    // edge1 has only 1 file but edge2 has 2 — runCount driven by edge2,
    // but pivot is edge1 — pivot[1] is undefined → fallback name
    const node = makeNode('stitch1', {
      inputOrder: [
        { type: 'edge', nodeId: 'edge1' },   // pivot (first edge item)
        { type: 'edge', nodeId: 'edge2' }
      ]
    })
    const ctx = makeContext({
      'edge1': { outputs: ['/pivot.mp4'] },                 // only 1 file
      'edge2': { outputs: ['/x1.mp4', '/x2.mp4'] }          // 2 files → runCount=2
    })
    const edges = [
      { source: 'edge1', target: 'stitch1' },
      { source: 'edge2', target: 'stitch1' }
    ]
    await handleVideoStitcher(node, ctx, '/tmp/root', edges, {})
    expect(run).toHaveBeenCalledTimes(2)
    // Second run (i=1): pivotFile is undefined → fallback name output_002.mp4
    const secondArgv = run.mock.calls[1][1]
    expect(secondArgv).toContain('/tmp/root/stitch1/output_002.mp4')
  })

  it('throws when upstream node is missing from context in inputOrder path', async () => {
    const node = makeNode('stitch1', {
      inputOrder: [
        { type: 'edge', nodeId: 'missing' },
        { type: 'fixed', value: '/b.mp4' }
      ]
    })
    // Context has no entry for 'missing'
    const ctx = makeContext()
    const edges = [{ source: 'missing', target: 'stitch1' }]
    await expect(
      handleVideoStitcher(node, ctx, '/tmp/root', edges, {})
    ).rejects.toThrow('upstream node "missing" has no outputs in context')
  })

  it('edge item with no files in edgeOutputs is skipped in inputs array', async () => {
    // The edge item's nodeId resolves to empty array — file is undefined — if(file) skips push
    const node = makeNode('stitch1', {
      inputOrder: [
        { type: 'fixed', value: '/fixed.mp4' },
        { type: 'edge', nodeId: 'empty-source' }
      ]
    })
    const ctx = makeContext({
      'empty-source': { outputs: [] }
    })
    const edges = [{ source: 'empty-source', target: 'stitch1' }]
    // Only 1 input (fixed) + 0 edge → throws "at least 2 inputs required"
    await expect(
      handleVideoStitcher(node, ctx, '/tmp/root', edges, {})
    ).rejects.toThrow('at least 2 inputs required')
  })

  it('fixed item inside N-runs loop with imageDuration formats as value:duration', async () => {
    const node = makeNode('stitch1', {
      inputOrder: [
        { type: 'fixed', value: '/img.jpg', imageDuration: 5 },
        { type: 'edge', nodeId: 'upstream' }
      ]
    })
    const ctx = makeContext({
      'upstream': { outputs: ['/seg.mp4', '/seg2.mp4'] }
    })
    const edges = [{ source: 'upstream', target: 'stitch1' }]
    await handleVideoStitcher(node, ctx, '/tmp/root', edges, {})
    const firstArgv = run.mock.calls[0][1]
    expect(firstArgv[0]).toBe('/img.jpg:5')
  })

  it('fixed item inside N-runs loop without value is skipped', async () => {
    // fixed item with no value should not push anything
    const node = makeNode('stitch1', {
      inputOrder: [
        { type: 'fixed', value: '' },       // no value — skipped
        { type: 'edge', nodeId: 'upstream' },
        { type: 'fixed', value: '/real.mp4' }
      ]
    })
    const ctx = makeContext({
      'upstream': { outputs: ['/seg.mp4'] }
    })
    const edges = [{ source: 'upstream', target: 'stitch1' }]
    await handleVideoStitcher(node, ctx, '/tmp/root', edges, {})
    const argv = run.mock.calls[0][1]
    // Should have /seg.mp4 and /real.mp4 but NOT an empty string
    expect(argv).toContain('/seg.mp4')
    expect(argv).toContain('/real.mp4')
    expect(argv[0]).not.toBe('')
  })

  it('edge item with nodeId not in edgeOutputs map falls back to empty array', async () => {
    // The incomingEdges include only edge1, but inputOrder references edge2 (not in edgeOutputs)
    // edgeOutputs.get(item.nodeId) ?? [] should return []
    const node = makeNode('stitch1', {
      inputOrder: [
        { type: 'fixed', value: '/a.mp4' },
        { type: 'edge', nodeId: 'edge-not-in-map' },  // will ?? to []
        { type: 'fixed', value: '/b.mp4' }
      ]
    })
    // Context only has edge1, not edge-not-in-map
    const ctx = makeContext({
      'edge1': { outputs: ['/e1.mp4'] }
    })
    const edges = [{ source: 'edge1', target: 'stitch1' }]
    // runCount driven by edge1 (1 file). edge-not-in-map resolves to [] → file undefined → skipped
    await handleVideoStitcher(node, ctx, '/tmp/root', edges, {})
    const argv = run.mock.calls[0][1]
    expect(argv).toContain('/a.mp4')
    expect(argv).toContain('/b.mp4')
  })

  // ── branch: sourceCtx.outputs ?? [] (edgeOutputs population) ────────────

  it('uses empty array when upstream context entry has no outputs property (inputOrder path)', async () => {
    // sourceCtx is defined but has no .outputs — triggers the ?? [] fallback
    const node = makeNode('stitch1', {
      inputOrder: [
        { type: 'fixed', value: '/a.mp4' },
        { type: 'fixed', value: '/b.mp4' }
      ]
    })
    // Context has upstream with no outputs property
    const ctx = makeContext({ 'upstream': {} })
    const edges = [{ source: 'upstream', target: 'stitch1' }]
    // The edgeOutputs for 'upstream' will be [] (via ?? [])
    await handleVideoStitcher(node, ctx, '/tmp/root', edges, {})
    expect(run).toHaveBeenCalled()
  })

  // ── branch: else clause in N-runs inputOrder loop (unknown item type) ────

  it('skips inputOrder items with type other than fixed or edge (in N-runs path)', async () => {
    // The else-of-else-if at line 63 is inside the N-runs loop (which requires an edge item).
    // Include an edge item to enter that path, plus an unknown-type item to hit the else branch.
    const node = makeNode('stitch1', {
      inputOrder: [
        { type: 'edge', nodeId: 'upstream' },
        { type: 'unknown', value: '/ignored.mp4' },  // neither fixed nor edge → else branch
        { type: 'fixed', value: '/b.mp4' }
      ]
    })
    const ctx = makeContext({
      'upstream': { outputs: ['/seg.mp4'] }
    })
    const edges = [{ source: 'upstream', target: 'stitch1' }]
    await handleVideoStitcher(node, ctx, '/tmp/root', edges, {})
    const argv = run.mock.calls[0][1]
    expect(argv).toContain('/seg.mp4')
    expect(argv).toContain('/b.mp4')
    expect(argv).not.toContain('/ignored.mp4')
  })

  // ── branch: legacy path sourceCtx.outputs ?? [] ──────────────────────────

  it('handles upstream context entry with no outputs in legacy path', async () => {
    // Legacy path: no inputOrder, upstream context entry exists but has no .outputs
    const node = makeNode('stitch1', {
      inputs: ['/fixed.mp4']
    })
    const ctx = makeContext({
      'upstream': {}  // no outputs property — triggers ?? [] in legacy path
    })
    const edges = [{ source: 'upstream', target: 'stitch1' }]
    // fixedInputs = ['/fixed.mp4'], variableInputs = [] (from ?? []) → total 1 input → throws
    await expect(
      handleVideoStitcher(node, ctx, '/tmp/root', edges, {})
    ).rejects.toThrow('at least 2 inputs required')
  })

  // ── branch: legacy path throw when source missing (line 88) ─────────────

  it('throws in legacy path when context entry disappears for an edge source', async () => {
    // We need: all sources present during edgeOutputs population (lines 21-28),
    // but then missing when legacy path iterates incomingEdges (lines 85-93).
    // Achieve this by spying on Map.get to return a value for the first call
    // per key and undefined for subsequent calls for a specific source.
    const node = makeNode('stitch1', {
      // No inputOrder → legacy path
      inputs: []
    })
    const ctx = new Map()
    // Use a custom Map that returns a context entry on first get() for 'edge-src'
    // but undefined on the second get() for the same key
    let callCount = 0
    const originalGet = ctx.get.bind(ctx)
    ctx.set('edge-src', { outputs: ['/file.mp4'] })
    vi.spyOn(ctx, 'get').mockImplementation((key) => {
      if (key === 'edge-src') {
        callCount++
        if (callCount === 1) return { outputs: ['/file.mp4'] }
        return undefined  // second call → triggers throw at legacy path line 87-91
      }
      return originalGet(key)
    })

    const edges = [{ source: 'edge-src', target: 'stitch1' }]
    await expect(
      handleVideoStitcher(node, ctx, '/tmp/root', edges, {})
    ).rejects.toThrow('upstream node "edge-src" has no outputs in context')
  })

  // ── sequenceLabel annotation ─────────────────────────────────────────────

  it('calls annotateImageWithSequence for a fixed image with sequenceLabel.enabled', async () => {
    const node = makeNode('stitch1', {
      inputOrder: [
        { type: 'fixed', value: '/title.png', sequenceLabel: { enabled: true, fontFile: '/fonts/Arial.ttf' } },
        { type: 'edge', nodeId: 'cutter1' },
      ],
    })
    const ctx = makeContext({ cutter1: { outputs: ['/seg1.mp4'] } })

    await handleVideoStitcher(node, ctx, '/tmp/root', [{ source: 'cutter1', target: 'stitch1' }], { dryRun: true })

    expect(annotateImageWithSequence).toHaveBeenCalledTimes(1)
    const [srcPath, opts] = annotateImageWithSequence.mock.calls[0]
    expect(srcPath).toBe('/title.png')
    expect(opts.index).toBe(1)
    expect(opts.total).toBe(1)
    expect(opts.fontFile).toBe('/fonts/Arial.ttf')
    expect(opts.dryRun).toBe(true)
  })

  it('passes prefix and styling options to annotateImageWithSequence', async () => {
    const node = makeNode('stitch1', {
      inputOrder: [
        {
          type: 'fixed',
          value: '/title.png',
          sequenceLabel: {
            enabled: true,
            prefix: 'scene',
            fontFile: '/fonts/Arial.ttf',
            fontSize: 64,
            fontColor: 'yellow',
            box: true,
            boxColor: 'black@0.7',
            padding: 30,
          },
        },
        { type: 'edge', nodeId: 'cutter1' },
      ],
    })
    const ctx = makeContext({ cutter1: { outputs: ['/seg1.mp4'] } })

    await handleVideoStitcher(node, ctx, '/tmp/root', [{ source: 'cutter1', target: 'stitch1' }], { dryRun: true })

    const [, opts] = annotateImageWithSequence.mock.calls[0]
    expect(opts.prefix).toBe('scene')
    expect(opts.fontSize).toBe(64)
    expect(opts.fontColor).toBe('yellow')
    expect(opts.box).toBe(true)
    expect(opts.boxColor).toBe('black@0.7')
    expect(opts.padding).toBe(30)
  })

  it('annotates each run with increasing index and correct total', async () => {
    const node = makeNode('stitch1', {
      inputOrder: [
        { type: 'fixed', value: '/title.png', sequenceLabel: { enabled: true, fontFile: '/f.ttf' } },
        { type: 'edge', nodeId: 'cutter1' },
      ],
    })
    const ctx = makeContext({ cutter1: { outputs: ['/s1.mp4', '/s2.mp4', '/s3.mp4'] } })

    await handleVideoStitcher(node, ctx, '/tmp/root', [{ source: 'cutter1', target: 'stitch1' }], { dryRun: true })

    expect(annotateImageWithSequence).toHaveBeenCalledTimes(3)
    expect(annotateImageWithSequence.mock.calls[0][1].index).toBe(1)
    expect(annotateImageWithSequence.mock.calls[0][1].total).toBe(3)
    expect(annotateImageWithSequence.mock.calls[1][1].index).toBe(2)
    expect(annotateImageWithSequence.mock.calls[1][1].total).toBe(3)
    expect(annotateImageWithSequence.mock.calls[2][1].index).toBe(3)
    expect(annotateImageWithSequence.mock.calls[2][1].total).toBe(3)
  })

  it('substitutes the annotated path in the video-stitcher argv', async () => {
    const node = makeNode('stitch1', {
      inputOrder: [
        { type: 'fixed', value: '/title.png', sequenceLabel: { enabled: true, fontFile: '/f.ttf' } },
        { type: 'edge', nodeId: 'cutter1' },
      ],
    })
    const ctx = makeContext({ cutter1: { outputs: ['/seg1.mp4'] } })

    await handleVideoStitcher(node, ctx, '/tmp/root', [{ source: 'cutter1', target: 'stitch1' }], { dryRun: true })

    // The video-stitcher call should use the annotated path, not the original
    const stitcherCall = run.mock.calls.find((c) => c[0] === 'video-stitcher')
    expect(stitcherCall).toBeDefined()
    const stitcherArgv = stitcherCall[1]
    // Original path should not appear; annotated path under tempRoot/.../annotated/ should
    expect(stitcherArgv).not.toContain('/title.png')
    expect(stitcherArgv.some((a) => a.includes('annotated') && a.includes('1_title.png'))).toBe(true)
  })

  it('preserves :imageDuration suffix on the annotated path', async () => {
    const node = makeNode('stitch1', {
      inputOrder: [
        { type: 'fixed', value: '/title.png', imageDuration: 3, sequenceLabel: { enabled: true, fontFile: '/f.ttf' } },
        { type: 'edge', nodeId: 'cutter1' },
      ],
    })
    const ctx = makeContext({ cutter1: { outputs: ['/seg1.mp4'] } })

    await handleVideoStitcher(node, ctx, '/tmp/root', [{ source: 'cutter1', target: 'stitch1' }], { dryRun: true })

    const stitcherCall = run.mock.calls.find((c) => c[0] === 'video-stitcher')
    const argv = stitcherCall[1]
    // First argv entry should be the annotated path with :3 suffix
    expect(argv[0]).toMatch(/1_title\.png:3$/)
  })

  it('creates the annotated subdir and calls annotateImageWithSequence in non-dryRun mode', async () => {
    const node = makeNode('stitch1', {
      inputOrder: [
        { type: 'fixed', value: '/title.png', sequenceLabel: { enabled: true, fontFile: '/f.ttf' } },
        { type: 'edge', nodeId: 'cutter1' },
      ],
    })
    const ctx = makeContext({ cutter1: { outputs: ['/seg1.mp4'] } })

    await handleVideoStitcher(node, ctx, '/tmp/root', [{ source: 'cutter1', target: 'stitch1' }], {})

    // annotated subdir is created for non-dryRun
    const annotDir = path.join('/tmp/root', 'stitch1', 'annotated')
    expect(mkdirSync).toHaveBeenCalledWith(annotDir, { recursive: true })
    expect(annotateImageWithSequence).toHaveBeenCalledTimes(1)
  })

  it('does not call annotateImageWithSequence when sequenceLabel.enabled is false', async () => {
    const node = makeNode('stitch1', {
      inputOrder: [
        { type: 'fixed', value: '/title.png', sequenceLabel: { enabled: false, fontFile: '/f.ttf' } },
        { type: 'edge', nodeId: 'cutter1' },
      ],
    })
    const ctx = makeContext({ cutter1: { outputs: ['/seg1.mp4'] } })

    await handleVideoStitcher(node, ctx, '/tmp/root', [{ source: 'cutter1', target: 'stitch1' }], { dryRun: true })

    expect(annotateImageWithSequence).not.toHaveBeenCalled()
  })

  it('does not annotate when sequenceLabel.enabled is true but path is not an image', async () => {
    const node = makeNode('stitch1', {
      inputOrder: [
        { type: 'fixed', value: '/intro.mp4', sequenceLabel: { enabled: true, fontFile: '/f.ttf' } },
        { type: 'edge', nodeId: 'cutter1' },
      ],
    })
    const ctx = makeContext({ cutter1: { outputs: ['/seg1.mp4'] } })

    await handleVideoStitcher(node, ctx, '/tmp/root', [{ source: 'cutter1', target: 'stitch1' }], { dryRun: true })

    expect(annotateImageWithSequence).not.toHaveBeenCalled()
    // Original path passes through unchanged
    const stitcherCall = run.mock.calls.find((c) => c[0] === 'video-stitcher')
    expect(stitcherCall[1][0]).toBe('/intro.mp4')
  })

  it('does not annotate edge items even if they happen to be images', async () => {
    // Edge items never carry sequenceLabel — they're just file paths from upstream
    const node = makeNode('stitch1', {
      inputOrder: [
        { type: 'fixed', value: '/intro.mp4' },
        { type: 'edge', nodeId: 'cutter1' },
      ],
    })
    const ctx = makeContext({ cutter1: { outputs: ['/title.png'] } })

    await handleVideoStitcher(node, ctx, '/tmp/root', [{ source: 'cutter1', target: 'stitch1' }], { dryRun: true })

    expect(annotateImageWithSequence).not.toHaveBeenCalled()
  })
})
