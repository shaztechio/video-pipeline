import { describe, it, expect, vi, beforeEach } from 'vitest'
import os from 'os'
import path from 'path'

// Mock glob before importing the handler
vi.mock('glob', () => ({
  glob: vi.fn()
}))

// Mock chalk to avoid ESM colorize noise in test output
vi.mock('chalk', () => ({
  default: {
    dim: (s) => s
  }
}))

import { glob } from 'glob'
import { handleInputFolder } from '../src/executor/nodeHandlers/input-folder.js'

function makeNode(id, config) {
  return { id, config }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('handleInputFolder', () => {
  // ── dryRun: sets empty outputs without touching fs ────────────────────────

  it('sets outputs to [] on dryRun regardless of config.path', async () => {
    const node = makeNode('folder1', { path: '/some/path' })
    const ctx = new Map()
    await handleInputFolder(node, ctx, '/tmp', { dryRun: true })
    expect(ctx.get('folder1')).toEqual({ outputs: [] })
    expect(glob).not.toHaveBeenCalled()
  })

  it('sets outputs to [] on dryRun when path is absent', async () => {
    const node = makeNode('folder1', {})
    const ctx = new Map()
    await handleInputFolder(node, ctx, '/tmp', { dryRun: true })
    expect(ctx.get('folder1')).toEqual({ outputs: [] })
  })

  // ── no path configured (not dryRun) ─────────────────────────────────────

  it('throws when no path is configured and dryRun is false', async () => {
    const node = makeNode('folder1', {})
    const ctx = new Map()
    await expect(
      handleInputFolder(node, ctx, '/tmp', {})
    ).rejects.toThrow('Node "folder1" (input-folder): no folder path configured')
  })

  it('throws when path is null and dryRun is false', async () => {
    const node = makeNode('folder1', { path: null })
    const ctx = new Map()
    await expect(
      handleInputFolder(node, ctx, '/tmp', {})
    ).rejects.toThrow('Node "folder1" (input-folder): no folder path configured')
  })

  // ── normal glob path ─────────────────────────────────────────────────────

  it('globs with default pattern * when no filter configured', async () => {
    glob.mockResolvedValue(['/some/path/b.mp4', '/some/path/a.mp4'])
    const node = makeNode('folder1', { path: '/some/path' })
    const ctx = new Map()
    await handleInputFolder(node, ctx, '/tmp', {})
    expect(glob).toHaveBeenCalledWith('*', {
      cwd: '/some/path',
      absolute: true,
      nodir: true
    })
  })

  it('uses config.filter as the glob pattern when provided', async () => {
    glob.mockResolvedValue(['/some/path/clip.mp4'])
    const node = makeNode('folder1', { path: '/some/path', filter: '*.mp4' })
    const ctx = new Map()
    await handleInputFolder(node, ctx, '/tmp', {})
    expect(glob).toHaveBeenCalledWith('*.mp4', {
      cwd: '/some/path',
      absolute: true,
      nodir: true
    })
  })

  it('falls back to * when filter is whitespace-only', async () => {
    glob.mockResolvedValue([])
    const node = makeNode('folder1', { path: '/some/path', filter: '   ' })
    const ctx = new Map()
    await handleInputFolder(node, ctx, '/tmp', {})
    expect(glob).toHaveBeenCalledWith('*', expect.any(Object))
  })

  it('sorts and stores the glob results as outputs', async () => {
    glob.mockResolvedValue(['/dir/c.mp4', '/dir/a.mp4', '/dir/b.mp4'])
    const node = makeNode('folder1', { path: '/dir' })
    const ctx = new Map()
    await handleInputFolder(node, ctx, '/tmp', {})
    expect(ctx.get('folder1')).toEqual({
      outputs: ['/dir/a.mp4', '/dir/b.mp4', '/dir/c.mp4']
    })
  })

  it('stores empty outputs array when glob returns no matches', async () => {
    glob.mockResolvedValue([])
    const node = makeNode('folder1', { path: '/empty/dir' })
    const ctx = new Map()
    await handleInputFolder(node, ctx, '/tmp', {})
    expect(ctx.get('folder1')).toEqual({ outputs: [] })
  })

  // ── tilde expansion ─────────────────────────────────────────────────────

  it('expands ~ in config.path before globbing', async () => {
    glob.mockResolvedValue([])
    const node = makeNode('folder1', { path: '~/videos' })
    const ctx = new Map()
    await handleInputFolder(node, ctx, '/tmp', {})
    expect(glob).toHaveBeenCalledWith('*', expect.objectContaining({
      cwd: path.join(os.homedir(), 'videos')
    }))
  })

  it('does not expand paths that do not start with ~/', async () => {
    glob.mockResolvedValue([])
    const node = makeNode('folder1', { path: '/absolute/path' })
    const ctx = new Map()
    await handleInputFolder(node, ctx, '/tmp', {})
    expect(glob).toHaveBeenCalledWith('*', expect.objectContaining({
      cwd: '/absolute/path'
    }))
  })

  // ── no-path but dryRun=false guard (second branch of combined condition) ──

  it('sets empty outputs when folderPath is null and dryRun is true', async () => {
    // This hits: if (opts.dryRun || !folderPath) with !folderPath = true, dryRun = false
    // i.e. dryRun=false but folderPath=null — reaches the same early-return
    // Note: the error guard fires first (line 23-25) — so for folderPath=null + !dryRun
    // the throw fires. To hit the second branch (return with empty outputs) without
    // dryRun=true and with folderPath=null, we'd need opts.dryRun=false, folderPath=null.
    // But that path is caught by the error guard first — so the || !folderPath in line 27
    // is only reachable when dryRun=true (folderPath may or may not be null).
    // This test confirms dryRun=true path with no path configured.
    const node = makeNode('folder1', {})
    const ctx = new Map()
    await handleInputFolder(node, ctx, '/tmp', { dryRun: true })
    expect(ctx.get('folder1')).toEqual({ outputs: [] })
    expect(glob).not.toHaveBeenCalled()
  })
})
