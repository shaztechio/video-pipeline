import { useEffect, useState } from 'react'
import { useStore } from '../store.js'
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

  const serverStatus = useServerStatus()

  const saveLabel =
    saveStatus === 'saving' ? 'Saving…'
    : saveStatus === 'saved' ? '✓ Saved'
    : saveStatus === 'error' ? '⚠ Error'
    : isDirty ? 'Save (⌘S)' : 'Saved'

  return (
    <div className={styles.toolbar}>
      <div className={styles.left}>
        <span className={styles.pipelineName}>{specMeta.name}</span>
        <div className={styles.divider} />
        <button
          className={`${styles.addBtn} ${styles.cutter}`}
          onClick={() => addNode('video-cutter')}
        >
          ✂ Add Cutter
        </button>
        <button
          className={`${styles.addBtn} ${styles.stitcher}`}
          onClick={() => addNode('video-stitcher')}
        >
          ⧓ Add Stitcher
        </button>
        <button
          className={`${styles.addBtn} ${styles.outputFolder}`}
          onClick={() => addNode('output-folder')}
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
      </div>
    </div>
  )
}
