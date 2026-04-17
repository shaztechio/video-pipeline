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

vi.mock('fs', () => ({
  existsSync: vi.fn(() => true),
  writeFileSync: vi.fn(),
}))

vi.mock('../src/executor/runner.js', () => ({
  run: vi.fn(() => Promise.resolve()),
}))

import { existsSync, writeFileSync } from 'fs'
import { run } from '../src/executor/runner.js'
import { annotateImageWithSequence } from '../src/executor/nodeHandlers/imageAnnotate.js'

beforeEach(() => {
  vi.clearAllMocks()
  existsSync.mockReturnValue(true)
})

describe('annotateImageWithSequence', () => {
  // ── required field validation ────────────────────────────────────────────

  it('throws when fontFile is not provided', async () => {
    await expect(
      annotateImageWithSequence('/img.png', {
        index: 1, total: 3, destPath: '/out/1_img.png',
      })
    ).rejects.toThrow('fontFile is required')
  })

  it('throws when fontFile path does not exist (non-dry-run)', async () => {
    existsSync.mockReturnValue(false)
    await expect(
      annotateImageWithSequence('/img.png', {
        index: 1, total: 3, fontFile: '/missing.ttf', destPath: '/out/1_img.png',
      })
    ).rejects.toThrow('fontFile not found')
  })

  it('skips the existsSync check in dry-run mode', async () => {
    existsSync.mockReturnValue(false)
    // Should not throw even though existsSync returns false
    await expect(
      annotateImageWithSequence('/img.png', {
        index: 1, total: 3, fontFile: '/missing.ttf', destPath: '/out/1_img.png', dryRun: true,
      })
    ).resolves.toBeUndefined()
    expect(existsSync).not.toHaveBeenCalled()
  })

  // ── label text composition ───────────────────────────────────────────────

  it('writes "N/M" to the text sidecar file when no prefix', async () => {
    await annotateImageWithSequence('/img.png', {
      index: 5, total: 10, fontFile: '/f.ttf', destPath: '/out/5_img.png',
    })
    expect(writeFileSync).toHaveBeenCalledOnce()
    const [, text] = writeFileSync.mock.calls[0]
    expect(text).toBe('5/10')
  })

  it('writes "prefix N/M" to the text sidecar file when prefix is set', async () => {
    await annotateImageWithSequence('/img.png', {
      index: 2, total: 8, prefix: 'scene', fontFile: '/f.ttf', destPath: '/out/2_img.png',
    })
    const [, text] = writeFileSync.mock.calls[0]
    expect(text).toBe('scene 2/8')
  })

  it('applies totalOffset to the denominator', async () => {
    await annotateImageWithSequence('/img.png', {
      index: 9, total: 9, totalOffset: -1, fontFile: '/f.ttf', destPath: '/out/9_img.png',
    })
    const [, text] = writeFileSync.mock.calls[0]
    expect(text).toBe('9/8')
  })

  it('totalOffset defaults to 0 when omitted', async () => {
    await annotateImageWithSequence('/img.png', {
      index: 1, total: 5, fontFile: '/f.ttf', destPath: '/out/1_img.png',
    })
    const [, text] = writeFileSync.mock.calls[0]
    expect(text).toBe('1/5')
  })

  it('writes the sidecar file next to destPath with .txt extension', async () => {
    await annotateImageWithSequence('/img.png', {
      index: 1, total: 3, fontFile: '/f.ttf', destPath: '/out/annotated/1_img.png',
    })
    const [filePath] = writeFileSync.mock.calls[0]
    expect(filePath).toBe('/out/annotated/1_img.png.txt')
  })

  it('skips writeFileSync in dry-run mode', async () => {
    await annotateImageWithSequence('/img.png', {
      index: 1, total: 3, fontFile: '/f.ttf', destPath: '/out/1_img.png', dryRun: true,
    })
    expect(writeFileSync).not.toHaveBeenCalled()
  })

  // ── ffmpeg invocation ────────────────────────────────────────────────────

  it('calls run with ffmpeg and correct base argv', async () => {
    await annotateImageWithSequence('/img.png', {
      index: 1, total: 3, fontFile: '/fonts/Arial.ttf', destPath: '/out/1_img.png',
    })
    expect(run).toHaveBeenCalledOnce()
    const [bin, argv, opts] = run.mock.calls[0]
    expect(bin).toBe('ffmpeg')
    expect(argv[0]).toBe('-nostdin')
    expect(argv[1]).toBe('-loglevel')
    expect(argv[2]).toBe('warning')
    expect(argv[3]).toBe('-y')
    expect(argv[4]).toBe('-i')
    expect(argv[5]).toBe('/img.png')
    expect(argv[6]).toBe('-vf')
    expect(argv[8]).toBe('-frames:v')
    expect(argv[9]).toBe('1')
    expect(argv[10]).toBe('/out/1_img.png')
    expect(opts.dryRun).toBe(false)
  })

  it('passes dryRun: true to run() in dry-run mode', async () => {
    await annotateImageWithSequence('/img.png', {
      index: 1, total: 3, fontFile: '/f.ttf', destPath: '/out/1_img.png', dryRun: true,
    })
    const [, , opts] = run.mock.calls[0]
    expect(opts.dryRun).toBe(true)
  })

  // ── filter string composition ────────────────────────────────────────────

  it('includes fontfile and textfile in the -vf filter string', async () => {
    await annotateImageWithSequence('/img.png', {
      index: 1, total: 3, fontFile: '/fonts/Arial.ttf', destPath: '/out/1_img.png',
    })
    const filterStr = run.mock.calls[0][1][7] // argv[7] is the filter value (argv[6] is '-vf')
    expect(filterStr).toContain('drawtext=fontfile=')
    expect(filterStr).toContain('textfile=')
  })

  it('applies default fontSize=48, fontColor=white, padding=20', async () => {
    await annotateImageWithSequence('/img.png', {
      index: 1, total: 3, fontFile: '/f.ttf', destPath: '/out/1_img.png',
    })
    const filterStr = run.mock.calls[0][1][7]
    expect(filterStr).toContain('fontsize=48')
    expect(filterStr).toContain('fontcolor=white')
    expect(filterStr).toContain('x=w-tw-20')
    expect(filterStr).toContain('y=h-th-20')
  })

  it('uses custom fontSize, fontColor, and padding when provided', async () => {
    await annotateImageWithSequence('/img.png', {
      index: 1, total: 3, fontFile: '/f.ttf', destPath: '/out/1_img.png',
      fontSize: 72, fontColor: 'yellow', padding: 40,
    })
    const filterStr = run.mock.calls[0][1][7]
    expect(filterStr).toContain('fontsize=72')
    expect(filterStr).toContain('fontcolor=yellow')
    expect(filterStr).toContain('x=w-tw-40')
    expect(filterStr).toContain('y=h-th-40')
  })

  it('omits box clause when box is false (default)', async () => {
    await annotateImageWithSequence('/img.png', {
      index: 1, total: 3, fontFile: '/f.ttf', destPath: '/out/1_img.png',
    })
    const filterStr = run.mock.calls[0][1][7]
    expect(filterStr).not.toContain('box=1')
  })

  it('includes box clause when box is true', async () => {
    await annotateImageWithSequence('/img.png', {
      index: 1, total: 3, fontFile: '/f.ttf', destPath: '/out/1_img.png', box: true,
    })
    const filterStr = run.mock.calls[0][1][7]
    expect(filterStr).toContain('box=1')
    expect(filterStr).toContain('boxcolor=black@0.5')
    expect(filterStr).toContain('boxborderw=8')
  })

  it('uses custom boxColor when box is true and boxColor is set', async () => {
    await annotateImageWithSequence('/img.png', {
      index: 1, total: 3, fontFile: '/f.ttf', destPath: '/out/1_img.png',
      box: true, boxColor: 'navy@0.8',
    })
    const filterStr = run.mock.calls[0][1][7]
    expect(filterStr).toContain('boxcolor=navy@0.8')
  })

  it('escapes colons in fontFile path for ffmpeg filter syntax', async () => {
    // Windows-style path with a colon after the drive letter
    const winPath = 'C:/fonts/Arial.ttf'
    await annotateImageWithSequence('/img.png', {
      index: 1, total: 3, fontFile: winPath, destPath: '/out/1_img.png',
    })
    const filterStr = run.mock.calls[0][1][7]
    // The colon after C must be escaped as \:
    expect(filterStr).toContain('C\\:/fonts/Arial.ttf')
  })

  it('escapes colons in destPath (textfile path) for ffmpeg filter syntax', async () => {
    const winDestPath = 'C:/out/1_img.png'
    await annotateImageWithSequence('/img.png', {
      index: 1, total: 3, fontFile: '/f.ttf', destPath: winDestPath,
    })
    const filterStr = run.mock.calls[0][1][7]
    // textfile= value should have the colon escaped
    expect(filterStr).toContain('textfile=C\\:/out/1_img.png.txt')
  })
})
