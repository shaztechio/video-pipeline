import { useStore } from '../store.js'
import styles from './Toolbar.module.css'

export default function Toolbar() {
  const addNode = useStore((s) => s.addNode)
  const saveNow = useStore((s) => s.saveNow)
  const isDirty = useStore((s) => s.isDirty)
  const saveStatus = useStore((s) => s.saveStatus)
  const specMeta = useStore((s) => s.specMeta)

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
      </div>

      <div className={styles.right}>
        <button
          className={`${styles.saveBtn} ${saveStatus === 'saved' ? styles.savedGreen : ''} ${saveStatus === 'error' ? styles.errorRed : ''}`}
          onClick={saveNow}
          disabled={saveStatus === 'saving'}
        >
          {isDirty && saveStatus === 'idle' && <span className={styles.dirtyDot} />}
          {saveLabel}
        </button>
      </div>
    </div>
  )
}
