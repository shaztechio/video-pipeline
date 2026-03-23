import { useState } from 'react'
import styles from './FileInput.module.css'

async function browseFile(folder = false) {
  const res = await fetch(folder ? '/api/browse-folder' : '/api/browse')
  const data = await res.json()
  return data.path ?? null
}

export default function FileInput({ value, onChange, placeholder, folder = false, showBasename = false }) {
  const [isDragOver, setIsDragOver] = useState(false)
  const [isFocused, setIsFocused] = useState(false)
  const [browseError, setBrowseError] = useState(null)

  const displayValue = showBasename && value && !isFocused
    ? (value.replace(/[/\\]+$/, '').split(/[/\\]/).pop() || value)
    : value

  function handleDragOver(e) {
    e.preventDefault()
    setIsDragOver(true)
  }

  function handleDragLeave(e) {
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setIsDragOver(false)
    }
  }

  function handleDrop(e) {
    e.preventDefault()
    setIsDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) onChange(file.name)
  }

  async function handleBrowse() {
    setBrowseError(null)
    try {
      const filePath = await browseFile(folder)
      if (filePath) onChange(filePath)
    } catch {
      setBrowseError('Server unavailable')
    }
  }

  return (
    <div className={styles.container}>
      <div
        className={`${styles.wrapper} ${isDragOver ? styles.dragOver : ''} ${browseError ? styles.error : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <input
          className={styles.textInput}
          type="text"
          placeholder={isDragOver ? 'Drop file here…' : placeholder}
          value={displayValue}
          title={value || undefined}
          onFocus={() => { setIsFocused(true); setBrowseError(null) }}
          onBlur={() => setIsFocused(false)}
          onChange={(e) => onChange(e.target.value)}
        />
        <button
          className={styles.browseBtn}
          type="button"
          title="Browse for file"
          onClick={handleBrowse}
        >
          &#128193;
        </button>
      </div>
      {browseError && <div className={styles.errorMsg}>{browseError}</div>}
    </div>
  )
}
