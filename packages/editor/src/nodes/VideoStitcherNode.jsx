import { useRef, useState } from 'react'
import { Handle, Position } from '@xyflow/react'
import { useStore } from '../store.js'
import styles from './Node.module.css'
import FileInput from '../components/FileInput.jsx'

export default function VideoStitcherNode({ id, data, selected }) {
  const { config, label } = data
  const updateConfig = useStore((s) => s.updateNodeConfig)
  const updateLabel = useStore((s) => s.updateNodeLabel)
  const allNodes = useStore((s) => s.nodes)

  const listRef = useRef(null)
  const activeRef = useRef({ from: null, over: null })
  const [dragVisual, setDragVisual] = useState({ from: null, over: null })
  const [durationText, setDurationText] = useState(String(config.imageDuration ?? 1))

  // Migrate from legacy config.inputs if inputOrder not yet present
  const inputOrder = config.inputOrder ??
    (config.inputs ?? []).map((v) => ({ type: 'fixed', value: v }))

  function syncOrder(next) {
    updateConfig(id, {
      inputOrder: next,
      inputs: next.filter((i) => i.type === 'fixed').map((i) => i.value)
    })
  }

  function reorder(from, to) {
    // to is in range 0..N where N = inputOrder.length (insert after last)
    if (to === from || to === from + 1) return
    const next = [...inputOrder]
    const [item] = next.splice(from, 1)
    next.splice(to > from ? to - 1 : to, 0, item)
    syncOrder(next)
  }

  function addFixedInput() {
    syncOrder([...inputOrder, { type: 'fixed', value: '' }])
  }

  function removeItem(index) {
    syncOrder(inputOrder.filter((_, i) => i !== index))
  }

  function updateFixedValue(index, value) {
    syncOrder(inputOrder.map((item, i) => (i === index ? { ...item, value } : item)))
  }

  function startDrag(e, index) {
    e.preventDefault()
    e.stopPropagation()
    // Capture pointer to this element so all move/up events are guaranteed
    // to arrive here, even when the cursor leaves the node or React Flow
    // intercepts events on the canvas.
    e.currentTarget.setPointerCapture(e.pointerId)
    activeRef.current = { from: index, over: index }
    setDragVisual({ from: index, over: index })

    const el = e.currentTarget

    function onMove(ev) {
      if (!listRef.current) return
      const rows = listRef.current.querySelectorAll('[data-drag-row]')
      if (!rows.length) return
      // target is in range 0..N where N means "append after last row"
      let target = rows.length
      for (let i = 0; i < rows.length; i++) {
        const { top, height } = rows[i].getBoundingClientRect()
        if (ev.clientY < top + height / 2) { target = i; break }
      }
      if (activeRef.current.over !== target) {
        activeRef.current.over = target
        setDragVisual((v) => ({ ...v, over: target }))
      }
    }

    function onUp() {
      const { from, over } = activeRef.current
      if (from !== null && over !== null) reorder(from, over)
      activeRef.current = { from: null, over: null }
      setDragVisual({ from: null, over: null })
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerup', onUp)
      el.removeEventListener('pointercancel', onUp)
    }

    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerup', onUp)
    el.addEventListener('pointercancel', onUp)
  }

  return (
    <div className={`${styles.node} ${styles.stitcher} ${selected ? styles.selected : ''}`}>
      <Handle type="target" position={Position.Left} id="inputs" className={styles.handle} />
      <Handle type="source" position={Position.Right} id="video-out" className={styles.handle} />

      <div className={styles.header}>
        <span className={styles.badge}>⧓ stitcher</span>
        <input
          className={styles.labelInput}
          value={label}
          onChange={(e) => updateLabel(id, e.target.value)}
        />
      </div>

      <div className={styles.body}>
        <label className={styles.fieldLabel}>Output folder</label>
        <FileInput
          folder
          showBasename
          placeholder="/path/to/output/folder"
          value={config.output ?? ''}
          onChange={(val) => updateConfig(id, { output: val })}
        />

        <div className={styles.sectionHeader}>
          <label className={styles.fieldLabel}>Inputs</label>
          <button className={styles.addBtn} onClick={addFixedInput}>+ Add file</button>
        </div>

        {inputOrder.length === 0 && (
          <div className={styles.hint}>Add files or connect a cutter node</div>
        )}

        <div ref={listRef}>
          {inputOrder.map((item, i) => (
            <div
              key={item.type === 'edge' ? `edge-${item.nodeId}` : `fixed-${i}`}
              data-drag-row
              className={[
                styles.inputRow,
                dragVisual.from === i ? styles.dragging : '',
                dragVisual.over === i && dragVisual.from !== null ? styles.dropTarget : '',
                dragVisual.over === inputOrder.length && i === inputOrder.length - 1 && dragVisual.from !== null ? styles.dropAfter : ''
              ].join(' ')}
            >
              <span
                className={styles.dragHandle}
                title="Drag to reorder"
                onPointerDown={(e) => startDrag(e, i)}
              >
                ⠿
              </span>
              {item.type === 'fixed' ? (
                <>
                  <FileInput
                    showBasename
                    placeholder="/path/to/video.mp4"
                    value={item.value}
                    accept="video/*,image/*"
                    onChange={(v) => updateFixedValue(i, v)}
                  />
                  <button className={styles.removeBtn} onClick={() => removeItem(i)}>✕</button>
                </>
              ) : (
                <div className={styles.edgeItem}>
                  <span className={styles.edgeBadge}>edge</span>
                  {allNodes.find((n) => n.id === item.nodeId)?.data.label ?? item.nodeId}
                </div>
              )}
            </div>
          ))}
        </div>

        <label className={styles.fieldLabel}>Image duration (s)</label>
        <div className={styles.stepperRow}>
          <input
            className={styles.input}
            type="text"
            inputMode="decimal"
            value={durationText}
            onChange={(e) => setDurationText(e.target.value)}
            onBlur={() => {
              const val = parseFloat(durationText)
              if (!isNaN(val) && val > 0) {
                updateConfig(id, { imageDuration: val })
                setDurationText(String(val))
              } else {
                setDurationText(String(config.imageDuration ?? 1))
              }
            }}
          />
          <div className={styles.stepperBtns}>
            <button
              className={styles.stepBtn}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => {
                const next = Math.round(((config.imageDuration ?? 1) + 0.5) * 10) / 10
                updateConfig(id, { imageDuration: next })
                setDurationText(String(next))
              }}
            >▲</button>
            <button
              className={styles.stepBtn}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => {
                const next = Math.max(0.5, Math.round(((config.imageDuration ?? 1) - 0.5) * 10) / 10)
                updateConfig(id, { imageDuration: next })
                setDurationText(String(next))
              }}
            >▼</button>
          </div>
        </div>

        <label className={styles.fieldLabel}>Background audio</label>
        <FileInput
          placeholder="/path/to/audio.mp3 (optional)"
          value={config.bgAudio ?? ''}
          accept="audio/*"
          onChange={(val) => updateConfig(id, { bgAudio: val || null })}
        />

        {config.bgAudio && (
          <>
            <label className={styles.fieldLabel}>Audio volume (0–2)</label>
            <input
              className={styles.input}
              type="number"
              min={0}
              max={2}
              step={0.1}
              value={config.bgAudioVolume ?? 1.0}
              onChange={(e) => updateConfig(id, { bgAudioVolume: Number(e.target.value) })}
            />
          </>
        )}
      </div>
    </div>
  )
}
