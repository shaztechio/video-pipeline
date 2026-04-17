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
import { nodeRegistry } from '../nodeRegistry.js'

describe('nodeRegistry', () => {
  // ── structure ─────────────────────────────────────────────────────────────

  it('exports an object with expected node type keys', () => {
    expect(nodeRegistry).toHaveProperty('video-stitcher')
    expect(nodeRegistry).toHaveProperty('video-cutter')
    expect(nodeRegistry).toHaveProperty('output-folder')
    expect(nodeRegistry).toHaveProperty('input-file')
    expect(nodeRegistry).toHaveProperty('input-folder')
  })

  it('video-stitcher has a label', () => {
    expect(nodeRegistry['video-stitcher'].label).toBe('Video Stitcher')
  })

  it('video-stitcher has correct defaults', () => {
    expect(nodeRegistry['video-stitcher'].defaults).toEqual({
      inputOrder: [],
      inputs: [],
      imageDuration: 1,
      bgAudio: null,
      bgAudioVolume: 1.0
    })
  })

  it('video-cutter has correct defaults', () => {
    expect(nodeRegistry['video-cutter'].defaults).toEqual({
      segments: 2,
      duration: null,
      sceneDetect: null,
      output: null,
      verify: false,
      reEncode: false
    })
  })

  // ── video-stitcher onConnect ──────────────────────────────────────────────

  it('onConnect appends a new edge entry when inputOrder already exists', () => {
    const data = {
      config: {
        inputOrder: [{ type: 'fixed', value: '/existing' }]
      }
    }
    const connection = { source: 'node-abc' }
    const result = nodeRegistry['video-stitcher'].onConnect(data, connection)

    expect(result.config.inputOrder).toEqual([
      { type: 'fixed', value: '/existing' },
      { type: 'edge', nodeId: 'node-abc' }
    ])
  })

  it('onConnect builds inputOrder from inputs when inputOrder is null', () => {
    const data = {
      config: {
        inputOrder: null,
        inputs: ['/file1', '/file2']
      }
    }
    const connection = { source: 'node-xyz' }
    const result = nodeRegistry['video-stitcher'].onConnect(data, connection)

    expect(result.config.inputOrder).toEqual([
      { type: 'fixed', value: '/file1' },
      { type: 'fixed', value: '/file2' },
      { type: 'edge', nodeId: 'node-xyz' }
    ])
  })

  it('onConnect builds inputOrder from inputs when inputOrder is undefined', () => {
    const data = {
      config: {
        inputs: ['/only']
      }
    }
    const connection = { source: 'node-new' }
    const result = nodeRegistry['video-stitcher'].onConnect(data, connection)

    expect(result.config.inputOrder).toEqual([
      { type: 'fixed', value: '/only' },
      { type: 'edge', nodeId: 'node-new' }
    ])
  })

  it('onConnect with no inputOrder and no inputs produces a single edge entry', () => {
    const data = { config: {} }
    const connection = { source: 'src1' }
    const result = nodeRegistry['video-stitcher'].onConnect(data, connection)

    expect(result.config.inputOrder).toEqual([
      { type: 'edge', nodeId: 'src1' }
    ])
  })

  it('onConnect preserves other config fields', () => {
    const data = {
      config: {
        inputOrder: [],
        imageDuration: 3,
        bgAudio: '/music.mp3'
      }
    }
    const connection = { source: 'src2' }
    const result = nodeRegistry['video-stitcher'].onConnect(data, connection)

    expect(result.config.imageDuration).toBe(3)
    expect(result.config.bgAudio).toBe('/music.mp3')
  })

  it('onConnect preserves other data fields outside config', () => {
    const data = {
      label: 'My Stitcher',
      config: { inputOrder: [] }
    }
    const connection = { source: 'src3' }
    const result = nodeRegistry['video-stitcher'].onConnect(data, connection)
    expect(result.label).toBe('My Stitcher')
  })

  // ── video-stitcher onDisconnect ───────────────────────────────────────────

  it('onDisconnect removes edge entries whose nodeId is in removedSourceIds', () => {
    const data = {
      config: {
        inputOrder: [
          { type: 'edge', nodeId: 'node-a' },
          { type: 'edge', nodeId: 'node-b' },
          { type: 'fixed', value: '/file' }
        ]
      }
    }
    const result = nodeRegistry['video-stitcher'].onDisconnect(data, ['node-a'])
    expect(result.config.inputOrder).toEqual([
      { type: 'edge', nodeId: 'node-b' },
      { type: 'fixed', value: '/file' }
    ])
  })

  it('onDisconnect removes multiple edge entries at once', () => {
    const data = {
      config: {
        inputOrder: [
          { type: 'edge', nodeId: 'x' },
          { type: 'edge', nodeId: 'y' },
          { type: 'edge', nodeId: 'z' }
        ]
      }
    }
    const result = nodeRegistry['video-stitcher'].onDisconnect(data, ['x', 'z'])
    expect(result.config.inputOrder).toEqual([
      { type: 'edge', nodeId: 'y' }
    ])
  })

  it('onDisconnect keeps fixed entries untouched even when their value matches a removed id', () => {
    const data = {
      config: {
        inputOrder: [
          { type: 'fixed', value: 'node-a' },
          { type: 'edge', nodeId: 'node-a' }
        ]
      }
    }
    const result = nodeRegistry['video-stitcher'].onDisconnect(data, ['node-a'])
    expect(result.config.inputOrder).toEqual([
      { type: 'fixed', value: 'node-a' }
    ])
  })

  it('onDisconnect returns data unchanged when inputOrder is falsy', () => {
    const data = { config: {} }
    const result = nodeRegistry['video-stitcher'].onDisconnect(data, ['any'])
    expect(result).toBe(data)
  })

  it('onDisconnect returns data unchanged when inputOrder is null', () => {
    const data = { config: { inputOrder: null } }
    const result = nodeRegistry['video-stitcher'].onDisconnect(data, ['any'])
    expect(result).toBe(data)
  })

  it('onDisconnect preserves other config and data fields', () => {
    const data = {
      label: 'Stitcher',
      config: {
        inputOrder: [{ type: 'edge', nodeId: 'n1' }],
        bgAudio: '/bg.mp3'
      }
    }
    const result = nodeRegistry['video-stitcher'].onDisconnect(data, ['n1'])
    expect(result.label).toBe('Stitcher')
    expect(result.config.bgAudio).toBe('/bg.mp3')
  })
})
