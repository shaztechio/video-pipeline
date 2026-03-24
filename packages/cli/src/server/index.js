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

import http from 'http'
import net from 'net'
import path from 'path'
import { fileURLToPath } from 'url'
import express from 'express'
import { WebSocketServer } from 'ws'
import { createRoutes } from './routes.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const EDITOR_DIST = path.resolve(__dirname, '../../dist/editor')

/**
 * Finds an available TCP port starting from `start`.
 */
function findFreePort(start = 3847) {
  return new Promise((resolve, reject) => {
    const server = net.createServer()
    server.listen(start, () => {
      const { port } = server.address()
      server.close(() => resolve(port))
    })
    server.on('error', () => findFreePort(start + 1).then(resolve).catch(reject))
  })
}

/**
 * Starts the editor Express + WebSocket server.
 * @param {string} specPath - absolute path to the spec JSON file
 * @param {{ port?: number }} opts
 * @returns {Promise<{ url: string, server: http.Server, wss: WebSocketServer }>}
 */
export async function startEditorServer(specPath, opts = {}) {
  const port = opts.port ?? (await findFreePort())

  const app = express()
  const httpServer = http.createServer(app)
  const wss = new WebSocketServer({ server: httpServer })

  function broadcast(data) {
    const msg = JSON.stringify(data)
    for (const client of wss.clients) {
      if (client.readyState === 1 /* OPEN */) {
        client.send(msg)
      }
    }
  }

  app.use(express.json({ limit: '10mb' }))
  app.use(createRoutes(specPath, broadcast))
  app.use(express.static(EDITOR_DIST))

  // Fallback for SPA routing
  app.get('/*path', (_req, res) => {
    res.sendFile(path.join(EDITOR_DIST, 'index.html'))
  })

  wss.on('connection', (ws) => {
    ws.send(JSON.stringify({ type: 'ready', specPath }))
  })

  await new Promise((resolve) => httpServer.listen(port, resolve))

  const url = `http://localhost:${port}`
  return { url, server: httpServer, wss }
}
