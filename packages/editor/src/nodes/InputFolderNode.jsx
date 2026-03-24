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
