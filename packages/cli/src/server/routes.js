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

import { readFileSync, writeFileSync, renameSync } from 'fs'
import { execFile } from 'child_process'
import path from 'path'
import { Router } from 'express'

function nativeBrowse() {
  return new Promise((resolve) => {
    const { platform } = process
    if (platform === 'darwin') {
      execFile('osascript', ['-e', 'POSIX path of (choose file)'], (err, stdout) => {
        resolve(err ? null : stdout.trim())
      })
    } else if (platform === 'linux') {
      execFile('zenity', ['--file-selection'], (err, stdout) => {
        if (!err) return resolve(stdout.trim())
        execFile('kdialog', ['--getopenfilename', '.'], (err2, stdout2) => {
          resolve(err2 ? null : stdout2.trim())
        })
      })
    } else if (platform === 'win32') {
      const ps = `Add-Type -AssemblyName System.Windows.Forms; $d = New-Object System.Windows.Forms.OpenFileDialog; if ($d.ShowDialog() -eq 'OK') { $d.FileName }`
      execFile('powershell', ['-Command', ps], (err, stdout) => {
        resolve(err ? null : stdout.trim())
      })
    } else {
      resolve(null)
    }
  })
}

function nativeBrowseFolder() {
  return new Promise((resolve) => {
    const { platform } = process
    if (platform === 'darwin') {
      execFile('osascript', ['-e', 'POSIX path of (choose folder)'], (err, stdout) => {
        resolve(err ? null : stdout.trim())
      })
    } else if (platform === 'linux') {
      execFile('zenity', ['--file-selection', '--directory'], (err, stdout) => {
        if (!err) return resolve(stdout.trim())
        execFile('kdialog', ['--getexistingdirectory', '.'], (err2, stdout2) => {
          resolve(err2 ? null : stdout2.trim())
        })
      })
    } else if (platform === 'win32') {
      const ps = `Add-Type -AssemblyName System.Windows.Forms; $d = New-Object System.Windows.Forms.FolderBrowserDialog; if ($d.ShowDialog() -eq 'OK') { $d.SelectedPath }`
      execFile('powershell', ['-Command', ps], (err, stdout) => {
        resolve(err ? null : stdout.trim())
      })
    } else {
      resolve(null)
    }
  })
}

/**
 * Creates Express router for the editor API.
 * @param {string} specPath - absolute path to the spec JSON file
 * @param {function} broadcast - WebSocket broadcast function
 */
export function createRoutes(specPath, broadcast) {
  const router = Router()

  // GET /api/spec — return current spec from disk
  router.get('/api/spec', (_req, res) => {
    try {
      const content = readFileSync(specPath, 'utf8')
      const spec = JSON.parse(content)
      res.json(spec)
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  // GET /api/browse — open a native OS file picker, return full path
  router.get('/api/browse', async (_req, res) => {
    const filePath = await nativeBrowse()
    res.json({ path: filePath })
  })

  // GET /api/browse-folder — open a native OS folder picker, return full path
  router.get('/api/browse-folder', async (_req, res) => {
    const folderPath = await nativeBrowseFolder()
    res.json({ path: folderPath })
  })

  // POST /api/spec — atomically write spec to disk
  router.post('/api/spec', (req, res) => {
    try {
      const spec = req.body
      if (!spec || typeof spec !== 'object') {
        return res.status(400).json({ error: 'Request body must be a JSON object' })
      }

      const tmp = `${specPath}.tmp`
      writeFileSync(tmp, JSON.stringify(spec, null, 2) + '\n', 'utf8')
      renameSync(tmp, specPath)

      broadcast({ type: 'saved', timestamp: Date.now() })
      res.json({ ok: true })
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  return router
}
