import { Handle, Position } from '@xyflow/react'
import { useStore } from '../store.js'
import styles from './Node.module.css'
import FileInput from '../components/FileInput.jsx'

export default function InputFileNode({ id, data, selected }) {
  const { config, label } = data
  const updateConfig = useStore((s) => s.updateNodeConfig)
  const updateLabel = useStore((s) => s.updateNodeLabel)
  const deleteNode = useStore((s) => s.deleteNode)

  return (
    <div className={`${styles.node} ${styles.inputFile} ${selected ? styles.selected : ''}`}>
      <button className={styles.deleteBtn} onPointerDown={(e) => e.stopPropagation()} onClick={() => deleteNode(id)}>×</button>
      <Handle type="source" position={Position.Right} id="output" className={styles.handle} />

      <div className={styles.header}>
        <span className={styles.badge}>📄 input file</span>
        <input
          className={styles.labelInput}
          value={label}
          onChange={(e) => updateLabel(id, e.target.value)}
        />
      </div>

      <div className={styles.body}>
        <label className={styles.fieldLabel}>File</label>
        <FileInput
          showBasename
          placeholder="/path/to/video.mp4"
          value={config.path ?? ''}
          accept="video/*,image/*"
          onChange={(val) => updateConfig(id, { path: val })}
        />
      </div>
    </div>
  )
}
