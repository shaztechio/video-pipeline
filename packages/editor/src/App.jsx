import { useEffect, useCallback } from 'react'
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  BackgroundVariant
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

import { useStore } from './store.js'
import { loadSpec, connectWS } from './api.js'
import Toolbar from './components/Toolbar.jsx'
import VideoCutterNode from './nodes/VideoCutterNode.jsx'
import VideoStitcherNode from './nodes/VideoStitcherNode.jsx'
import OutputFolderNode from './nodes/OutputFolderNode.jsx'
import InputFileNode from './nodes/InputFileNode.jsx'
import InputFolderNode from './nodes/InputFolderNode.jsx'
import './App.css'

const NODE_TYPES = {
  'video-cutter': VideoCutterNode,
  'video-stitcher': VideoStitcherNode,
  'output-folder': OutputFolderNode,
  'input-file': InputFileNode,
  'input-folder': InputFolderNode
}

export default function App() {
  return <ReactFlowProvider><AppInner /></ReactFlowProvider>
}

function AppInner() {
  const nodes = useStore((s) => s.nodes)
  const edges = useStore((s) => s.edges)
  const onNodesChange = useStore((s) => s.onNodesChange)
  const onEdgesChange = useStore((s) => s.onEdgesChange)
  const onConnect = useStore((s) => s.onConnect)
  const storeLoad = useStore((s) => s.loadSpec)
  const saveNow = useStore((s) => s.saveNow)

  // Load spec on mount
  useEffect(() => {
    loadSpec()
      .then((spec) => storeLoad(spec))
      .catch((err) => console.error('Failed to load spec:', err))
  }, [storeLoad])

  // WebSocket for save notifications
  useEffect(() => {
    const ws = connectWS((msg) => {
      if (msg.type === 'saved') {
        // Already handled by saveNow; could show external-save toast here
      }
    })
    return () => ws.close()
  }, [])

  // Cmd/Ctrl+S to save
  const handleKeyDown = useCallback(
    (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        saveNow()
      }
    },
    [saveNow]
  )

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  return (
    <div className="app">
      <Toolbar />
      <div className="canvas-wrapper">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={NODE_TYPES}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          deleteKeyCode="Backspace"
          minZoom={0.25}
          maxZoom={2}
        >
          <Background variant={BackgroundVariant.Dots} color="#21262d" gap={20} size={1} />
          <Controls position="bottom-right" />
          <MiniMap
            position="bottom-left"
            nodeColor={(n) =>
              n.type === 'video-cutter' ? '#e94560'
              : n.type === 'output-folder' ? '#2ea043'
              : n.type === 'input-file' ? '#388bfd'
              : n.type === 'input-folder' ? '#d29922'
              : '#533483'
            }
            maskColor="rgba(13,17,23,0.7)"
            maskStrokeColor="#e94560"
            maskStrokeWidth={4}
            style={{ background: '#0d1117', border: '1px solid #21262d' }}
          />
        </ReactFlow>
      </div>
    </div>
  )
}
