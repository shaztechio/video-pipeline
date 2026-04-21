import { BaseEdge, EdgeLabelRenderer, getBezierPath } from '@xyflow/react'
import { useStore } from '../store.js'

export default function DeleteableEdge({
  id, sourceX, sourceY, targetX, targetY,
  sourcePosition, targetPosition, selected
}) {
  const onEdgesChange = useStore((s) => s.onEdgesChange)
  const [edgePath, labelX, labelY] = getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition })

  const onDelete = (e) => {
    e.stopPropagation()
    onEdgesChange([{ id, type: 'remove' }])
  }

  return (
    <>
      <BaseEdge path={edgePath} />
      {selected && (
        <EdgeLabelRenderer>
          <button
            className="edge-delete-btn"
            style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}
            onClick={onDelete}
          >
            ×
          </button>
        </EdgeLabelRenderer>
      )}
    </>
  )
}
