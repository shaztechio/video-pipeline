import { Handle, Position } from '@xyflow/react'
import { useStore } from '../store.js'
import styles from './Node.module.css'
import FileInput from '../components/FileInput.jsx'

const CUTTING_MODES = [
  { key: 'segments', label: 'Equal segments', placeholder: 'e.g. 3' },
  { key: 'duration', label: 'Fixed duration (s)', placeholder: 'e.g. 30' },
  { key: 'sceneDetect', label: 'Scene detect (threshold)', placeholder: 'e.g. 10' }
]

export default function VideoCutterNode({ id, data, selected }) {
  const { config, label } = data
  const updateConfig = useStore((s) => s.updateNodeConfig)
  const updateLabel = useStore((s) => s.updateNodeLabel)
  const deleteNode = useStore((s) => s.deleteNode)

  const activeCutMode = config.segments != null
    ? 'segments'
    : config.duration != null
    ? 'duration'
    : config.sceneDetect != null
    ? 'sceneDetect'
    : 'segments'

  function setCutMode(mode) {
    updateConfig(id, {
      segments: mode === 'segments' ? (config.segments ?? 2) : null,
      duration: mode === 'duration' ? (config.duration ?? 30) : null,
      sceneDetect: mode === 'sceneDetect' ? (config.sceneDetect ?? 10) : null
    })
  }

  return (
    <div className={`${styles.node} ${styles.cutter} ${selected ? styles.selected : ''}`}>
      <button className={styles.deleteBtn} onPointerDown={(e) => e.stopPropagation()} onClick={() => deleteNode(id)}>×</button>
      <Handle type="source" position={Position.Right} id="output" className={styles.handle} />

      <div className={styles.header}>
        <span className={styles.badge}>✂ cutter</span>
        <input
          className={styles.labelInput}
          value={label}
          onChange={(e) => updateLabel(id, e.target.value)}
        />
      </div>

      <div className={styles.body}>
        <label className={styles.fieldLabel}>Input file</label>
        <FileInput
          showBasename
          placeholder="/path/to/video.mp4"
          value={config.input ?? ''}
          accept="video/*,image/*"
          onChange={(val) => updateConfig(id, { input: val })}
        />

        <label className={styles.fieldLabel}>Cut method</label>
        <div className={styles.radioGroup}>
          {CUTTING_MODES.map(({ key, label: modeLabel }) => (
            <label key={key} className={styles.radio}>
              <input
                type="radio"
                name={`${id}-cut-mode`}
                checked={activeCutMode === key}
                onChange={() => setCutMode(key)}
              />
              {modeLabel}
            </label>
          ))}
        </div>

        <input
          className={styles.input}
          type="number"
          min={1}
          placeholder={CUTTING_MODES.find((m) => m.key === activeCutMode)?.placeholder}
          value={config[activeCutMode] ?? ''}
          onChange={(e) =>
            updateConfig(id, { [activeCutMode]: e.target.value ? Number(e.target.value) : null })
          }
        />

        <div className={styles.checkboxRow}>
          <label className={styles.checkbox}>
            <input
              type="checkbox"
              checked={config.verify ?? false}
              onChange={(e) => updateConfig(id, { verify: e.target.checked })}
            />
            Verify segments
          </label>
          <label className={styles.checkbox}>
            <input
              type="checkbox"
              checked={config.reEncode ?? false}
              onChange={(e) => updateConfig(id, { reEncode: e.target.checked })}
            />
            Re-encode
          </label>
        </div>
      </div>
    </div>
  )
}
