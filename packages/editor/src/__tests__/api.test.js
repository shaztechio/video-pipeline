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

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { loadSpec, saveSpec, connectWS } from '../api.js'

// ── helpers ───────────────────────────────────────────────────────────────────

function makeFetchOk(body) {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: vi.fn().mockResolvedValue(body)
  })
}

function makeFetchFail(statusText) {
  return vi.fn().mockResolvedValue({
    ok: false,
    statusText
  })
}

// ── setup / teardown ──────────────────────────────────────────────────────────

beforeEach(() => {
  // Provide a default location global (http)
  global.location = { protocol: 'http:', host: 'localhost:3000' }
})

afterEach(() => {
  vi.restoreAllMocks()
  delete global.location
  delete global.fetch
  delete global.WebSocket
})

// ── loadSpec ──────────────────────────────────────────────────────────────────

describe('loadSpec', () => {
  it('fetches /api/spec and returns parsed JSON on success', async () => {
    const specData = { version: '1', name: 'test', nodes: [], edges: [] }
    global.fetch = makeFetchOk(specData)

    const result = await loadSpec()

    expect(global.fetch).toHaveBeenCalledOnce()
    expect(global.fetch).toHaveBeenCalledWith('/api/spec')
    expect(result).toEqual(specData)
  })

  it('throws with the statusText when the response is not ok', async () => {
    global.fetch = makeFetchFail('Not Found')

    await expect(loadSpec()).rejects.toThrow('Failed to load spec: Not Found')
  })
})

// ── saveSpec ──────────────────────────────────────────────────────────────────

describe('saveSpec', () => {
  it('POSTs to /api/spec with JSON body and returns parsed response', async () => {
    const spec = { version: '1', name: 'p', nodes: [], edges: [] }
    const responseBody = { ok: true }
    global.fetch = makeFetchOk(responseBody)

    const result = await saveSpec(spec)

    expect(global.fetch).toHaveBeenCalledOnce()
    expect(global.fetch).toHaveBeenCalledWith('/api/spec', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(spec)
    })
    expect(result).toEqual(responseBody)
  })

  it('throws with the statusText when the response is not ok', async () => {
    global.fetch = makeFetchFail('Internal Server Error')

    await expect(saveSpec({})).rejects.toThrow('Failed to save spec: Internal Server Error')
  })
})

// ── connectWS ─────────────────────────────────────────────────────────────────

describe('connectWS', () => {
  // The production code calls `new WebSocket(url)`, so global.WebSocket must be
  // a real constructor (class or function).  We assign the class directly rather
  // than wrapping it in vi.fn(), which would produce a non-constructor arrow fn.
  function makeFakeWSClass() {
    const listeners = {}
    let lastInstance = null

    class FakeWS {
      constructor (url) {
        this.url = url
        this.addEventListener = vi.fn((event, handler) => {
          listeners[event] = handler
        })
        lastInstance = this
      }
    }

    const trigger = (event, data) => listeners[event]?.(data)
    const getInstance = () => lastInstance

    return { FakeWS, trigger, getInstance }
  }

  it('uses ws: protocol when location.protocol is http:', () => {
    global.location = { protocol: 'http:', host: 'localhost:3000' }
    const { FakeWS, getInstance } = makeFakeWSClass()
    global.WebSocket = FakeWS

    connectWS(vi.fn())

    expect(getInstance().url).toBe('ws://localhost:3000')
  })

  it('uses wss: protocol when location.protocol is https:', () => {
    global.location = { protocol: 'https:', host: 'example.com' }
    const { FakeWS, getInstance } = makeFakeWSClass()
    global.WebSocket = FakeWS

    connectWS(vi.fn())

    expect(getInstance().url).toBe('wss://example.com')
  })

  it('returns the WebSocket instance', () => {
    const { FakeWS, getInstance } = makeFakeWSClass()
    global.WebSocket = FakeWS

    const result = connectWS(vi.fn())

    expect(result).toBe(getInstance())
  })

  it('calls onMessage with parsed JSON when a valid message arrives', () => {
    const { FakeWS, trigger } = makeFakeWSClass()
    global.WebSocket = FakeWS
    const onMessage = vi.fn()

    connectWS(onMessage)

    const payload = { type: 'update', data: 42 }
    trigger('message', { data: JSON.stringify(payload) })

    expect(onMessage).toHaveBeenCalledOnce()
    expect(onMessage).toHaveBeenCalledWith(payload)
  })

  it('silently ignores malformed (non-JSON) messages without throwing', () => {
    const { FakeWS, trigger } = makeFakeWSClass()
    global.WebSocket = FakeWS
    const onMessage = vi.fn()

    connectWS(onMessage)

    // Triggering with invalid JSON should not throw
    expect(() => {
      trigger('message', { data: 'not-json{{' })
    }).not.toThrow()

    expect(onMessage).not.toHaveBeenCalled()
  })

  it('registers the message event listener on the WebSocket', () => {
    const { FakeWS, getInstance } = makeFakeWSClass()
    global.WebSocket = FakeWS

    connectWS(vi.fn())

    expect(getInstance().addEventListener).toHaveBeenCalledWith('message', expect.any(Function))
  })
})
