import { Handle, Position } from '@xyflow/react'
import { useStore } from '../store.js'
import styles from './Node.module.css'
import FileInput from '../components/FileInput.jsx'

export default function InputFolderNode({ id, data, selected }) {
  const { config, label } = data
  const updateConfig = useStore((s) => s.updateNodeConfig)
  const updateLabel = useStore((s) => s.updateNodeLabel)
  const deleteNode = useStore((s) => s.deleteNode)

  return (
    <div className={`${styles.node} ${styles.inputFolder} ${selected ? styles.selected : ''}`}>
      <button className={styles.deleteBtn} onPointerDown={(e) => e.stopPropagation()} onClick={() => deleteNode(id)}>×</button>
      <Handle type="source" position={Position.Right} id="output" className={styles.handle} />

      <div className={styles.header}>
        <span className={styles.badge}>📂 input folder</span>
        <input
          className={styles.labelInput}
          value={label}
          onChange={(e) => updateLabel(id, e.target.value)}
        />
      </div>

      <div className={styles.body}>
        <label className={styles.fieldLabel}>Folder</label>
        <FileInput
          showBasename
          folder
          placeholder="/path/to/folder"
          value={config.path ?? ''}
          onChange={(val) => updateConfig(id, { path: val })}
        />
        <label className={styles.fieldLabel}>File filter (glob)</label>
        <input
          className={styles.input}
          type="text"
          placeholder="*.mp4  (blank = all files)"
          value={config.filter ?? ''}
          onChange={(e) => updateConfig(id, { filter: e.target.value })}
        />
      </div>
    </div>
  )
}
