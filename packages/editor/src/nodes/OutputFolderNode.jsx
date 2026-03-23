import { Handle, Position } from '@xyflow/react'
import { useStore } from '../store.js'
import styles from './Node.module.css'
import FileInput from '../components/FileInput.jsx'

export default function OutputFolderNode({ id, data, selected }) {
  const { config, label } = data
  const updateConfig = useStore((s) => s.updateNodeConfig)
  const updateLabel = useStore((s) => s.updateNodeLabel)
  const deleteNode = useStore((s) => s.deleteNode)

  return (
    <div className={`${styles.node} ${styles.outputFolder} ${selected ? styles.selected : ''}`}>
      <button className={styles.deleteBtn} onPointerDown={(e) => e.stopPropagation()} onClick={() => deleteNode(id)}>×</button>
      <Handle type="target" position={Position.Left} id="input" className={styles.handle} />

      <div className={styles.header}>
        <span className={styles.badge}>📁 output folder</span>
        <input
          className={styles.labelInput}
          value={label}
          onChange={(e) => updateLabel(id, e.target.value)}
        />
      </div>

      <div className={styles.body}>
        <label className={styles.fieldLabel}>Output Folder</label>
        <FileInput
          showBasename
          folder
          placeholder="/path/to/output/"
          value={config.path ?? ''}
          onChange={(val) => updateConfig(id, { path: val })}
        />
      </div>
    </div>
  )
}
