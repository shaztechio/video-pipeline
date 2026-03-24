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

import { useEffect, useState } from 'react'
import { useReactFlow } from '@xyflow/react'
import { useStore } from '../store.js'
import { flowToSpec } from '../utils/flowToSpec.js'
import styles from './Toolbar.module.css'

function useServerStatus(intervalMs = 5000) {
  const [status, setStatus] = useState('unknown') // 'online' | 'offline' | 'unknown'

  useEffect(() => {
    let cancelled = false

    async function check() {
      try {
        const res = await fetch('/api/spec', { method: 'HEAD' })
        if (!cancelled) setStatus(res.ok || res.status === 405 ? 'online' : 'offline')
      } catch {
        if (!cancelled) setStatus('offline')
      }
    }

    check()
    const id = setInterval(check, intervalMs)
    return () => { cancelled = true; clearInterval(id) }
  }, [intervalMs])

  return status
}

export default function Toolbar() {
  const addNode = useStore((s) => s.addNode)
  const saveNow = useStore((s) => s.saveNow)
  const isDirty = useStore((s) => s.isDirty)
  const saveStatus = useStore((s) => s.saveStatus)
  const specMeta = useStore((s) => s.specMeta)
  const updateSpecName = useStore((s) => s.updateSpecName)
  const nodes = useStore((s) => s.nodes)
  const edges = useStore((s) => s.edges)

  const [editingName, setEditingName] = useState(false)
  const [nameText, setNameText] = useState(specMeta.name)

  // Keep local text in sync when spec loads
  useEffect(() => { setNameText(specMeta.name) }, [specMeta.name])

  function commitName() {
    const trimmed = nameText.trim()
    if (trimmed && trimmed !== specMeta.name) updateSpecName(trimmed)
    else setNameText(specMeta.name)
    setEditingName(false)
  }

  const { screenToFlowPosition } = useReactFlow()
  const serverStatus = useServerStatus()
  const isOnline = serverStatus === 'online'

  function handleDownload() {
    const spec = flowToSpec(nodes, edges, specMeta)
    const blob = new Blob([JSON.stringify(spec, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${specMeta.name}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  function handleAddNode(type) {
    // Place the new node at the current viewport center
    const pos = screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 })
    addNode(type, { x: pos.x - 140, y: pos.y - 100 })
  }

  const saveLabel =
    saveStatus === 'saving' ? 'Saving…'
    : saveStatus === 'saved' ? '✓ Saved'
    : saveStatus === 'error' ? '⚠ Error'
    : isDirty ? 'Save (⌘S)' : 'Saved'

  return (
    <div className={styles.toolbar}>
      <div className={styles.left}>
        {editingName ? (
          <input
            className={styles.pipelineNameInput}
            value={nameText}
            autoFocus
            onChange={(e) => setNameText(e.target.value)}
            onBlur={commitName}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitName()
              if (e.key === 'Escape') { setNameText(specMeta.name); setEditingName(false) }
            }}
          />
        ) : (
          <span
            className={styles.pipelineName}
            title="Click to rename"
            onClick={() => setEditingName(true)}
          >
            {specMeta.name}
          </span>
        )}
        <div className={styles.divider} />
        <button
          className={`${styles.addBtn} ${styles.inputFile}`}
          onClick={() => handleAddNode('input-file')}
        >
          📄 Add Input File
        </button>
        <button
          className={`${styles.addBtn} ${styles.inputFolder}`}
          onClick={() => handleAddNode('input-folder')}
        >
          📂 Add Input Folder
        </button>
        <button
          className={`${styles.addBtn} ${styles.cutter}`}
          onClick={() => handleAddNode('video-cutter')}
        >
          ✂ Add Cutter
        </button>
        <button
          className={`${styles.addBtn} ${styles.stitcher}`}
          onClick={() => handleAddNode('video-stitcher')}
        >
          ⧓ Add Stitcher
        </button>
        <button
          className={`${styles.addBtn} ${styles.outputFolder}`}
          onClick={() => handleAddNode('output-folder')}
        >
          📁 Add Output Folder
        </button>
      </div>

      <div className={styles.right}>
        <div className={`${styles.serverStatus} ${styles[serverStatus]}`}>
          <span className={styles.serverDot} />
          <span className={styles.serverLabel}>
            {serverStatus === 'online' ? 'Online' : serverStatus === 'offline' ? 'Offline' : 'Checking…'}
          </span>
        </div>
        {isOnline ? (
          <button
            className={`${styles.saveBtn} ${isDirty && saveStatus === 'idle' ? styles.dirty : ''} ${saveStatus === 'saved' ? styles.savedGreen : ''} ${saveStatus === 'error' ? styles.errorRed : ''}`}
            onClick={saveNow}
            disabled={saveStatus === 'saving'}
          >
            {isDirty && saveStatus === 'idle' && (
              <svg className={styles.saveIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                <polyline points="17 21 17 13 7 13 7 21"/>
                <polyline points="7 3 7 8 15 8"/>
              </svg>
            )}
            {saveLabel}
          </button>
        ) : (
          <button className={`${styles.saveBtn} ${styles.dirty}`} onClick={handleDownload}>
            ⬇ Download
          </button>
        )}
      </div>
    </div>
  )
}
