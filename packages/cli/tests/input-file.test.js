import { describe, it, expect } from 'vitest'
import os from 'os'
import path from 'path'
import { handleInputFile } from '../src/executor/nodeHandlers/input-file.js'

function makeNode(id, config) {
  return { id, config }
}

describe('handleInputFile', () => {
  // ── error path: no path configured ───────────────────────────────────────

  it('throws when config.path is absent and dryRun is false', async () => {
    const node = makeNode('file1', {})
    const ctx = new Map()
    await expect(
      handleInputFile(node, ctx, '/tmp', {})
    ).rejects.toThrow('Node "file1" (input-file): no file path configured')
  })

  it('throws when config.path is null and dryRun is false', async () => {
    const node = makeNode('file1', { path: null })
    const ctx = new Map()
    await expect(
      handleInputFile(node, ctx, '/tmp', {})
    ).rejects.toThrow('Node "file1" (input-file): no file path configured')
  })

  it('throws when config.path is empty string and dryRun is false', async () => {
    // Empty string is falsy — treated same as missing
    const node = makeNode('file1', { path: '' })
    const ctx = new Map()
    await expect(
      handleInputFile(node, ctx, '/tmp', {})
    ).rejects.toThrow('Node "file1" (input-file): no file path configured')
  })

  // ── dryRun with no path: empty outputs ───────────────────────────────────

  it('sets outputs to [] when dryRun is true and no path is configured', async () => {
    const node = makeNode('file1', {})
    const ctx = new Map()
    await handleInputFile(node, ctx, '/tmp', { dryRun: true })
    expect(ctx.get('file1')).toEqual({ outputs: [] })
  })

  it('sets outputs to [] when dryRun is true and path is null', async () => {
    const node = makeNode('file1', { path: null })
    const ctx = new Map()
    await handleInputFile(node, ctx, '/tmp', { dryRun: true })
    expect(ctx.get('file1')).toEqual({ outputs: [] })
  })

  // ── normal path: single-element outputs ──────────────────────────────────

  it('sets outputs to [filePath] when config.path is an absolute path', async () => {
    const node = makeNode('file1', { path: '/videos/clip.mp4' })
    const ctx = new Map()
    await handleInputFile(node, ctx, '/tmp', {})
    expect(ctx.get('file1')).toEqual({ outputs: ['/videos/clip.mp4'] })
  })

  it('expands ~ in config.path', async () => {
    const node = makeNode('file1', { path: '~/Videos/clip.mp4' })
    const ctx = new Map()
    await handleInputFile(node, ctx, '/tmp', {})
    const expected = path.join(os.homedir(), 'Videos/clip.mp4')
    expect(ctx.get('file1')).toEqual({ outputs: [expected] })
  })

  it('does not modify absolute paths that do not start with ~/', async () => {
    const node = makeNode('file1', { path: '/absolute/path.mp4' })
    const ctx = new Map()
    await handleInputFile(node, ctx, '/tmp', {})
    expect(ctx.get('file1')).toEqual({ outputs: ['/absolute/path.mp4'] })
  })

  // ── dryRun with a valid path: still resolves ──────────────────────────────

  it('still stores the resolved path when dryRun is true and path is set', async () => {
    const node = makeNode('file1', { path: '/videos/clip.mp4' })
    const ctx = new Map()
    await handleInputFile(node, ctx, '/tmp', { dryRun: true })
    // filePath is truthy, so outputs = [filePath]
    expect(ctx.get('file1')).toEqual({ outputs: ['/videos/clip.mp4'] })
  })

  // ── opts defaults (no opts argument) ──────────────────────────────────────

  it('works without opts argument when path is provided', async () => {
    const node = makeNode('file1', { path: '/clip.mp4' })
    const ctx = new Map()
    // Calling without the fourth argument — opts defaults to {}
    await handleInputFile(node, ctx, '/tmp')
    expect(ctx.get('file1')).toEqual({ outputs: ['/clip.mp4'] })
  })

  it('throws without opts argument when no path is configured', async () => {
    const node = makeNode('file1', {})
    const ctx = new Map()
    await expect(handleInputFile(node, ctx, '/tmp')).rejects.toThrow(
      'Node "file1" (input-file): no file path configured'
    )
  })
})
