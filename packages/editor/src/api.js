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
