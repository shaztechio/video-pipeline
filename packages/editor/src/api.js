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

const BASE = ''

export async function loadSpec() {
  const res = await fetch(`${BASE}/api/spec`)
  if (!res.ok) throw new Error(`Failed to load spec: ${res.statusText}`)
  return res.json()
}

export async function saveSpec(spec) {
  const res = await fetch(`${BASE}/api/spec`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(spec)
  })
  if (!res.ok) throw new Error(`Failed to save spec: ${res.statusText}`)
  return res.json()
}

export function connectWS(onMessage) {
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:'
  const ws = new WebSocket(`${proto}//${location.host}`)

  ws.addEventListener('message', (e) => {
    try {
      onMessage(JSON.parse(e.data))
    } catch {
      // ignore malformed messages
    }
  })

  return ws
}
