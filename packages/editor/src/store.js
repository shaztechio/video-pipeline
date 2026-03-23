import { create } from 'zustand'
import { applyNodeChanges, applyEdgeChanges } from '@xyflow/react'
import { specToFlow } from './utils/specToFlow.js'
import { flowToSpec } from './utils/flowToSpec.js'
import { saveSpec } from './api.js'

let nodeCounter = 1

// Given a file path, return its parent directory (no trailing slash)
function dirOf(filePath) {
  if (!filePath) return ''
  return filePath.replace(/[/\\][^/\\]+$/, '')
}

// If there is exactly one cutter with an input set, return its suggested output dir
function derivedStitcherOutput(nodes, cutterInput) {
  const cutters = nodes.filter((n) => n.type === 'video-cutter')
  if (cutters.length !== 1) return ''
  const input = cutterInput ?? cutters[0].data.config.input
  const dir = dirOf(input)
  return dir ? dir + '/output' : ''
}

function makeId(prefix) {
  return `${prefix}-${Date.now()}-${nodeCounter++}`
}

export const useStore = create((set, get) => ({
  nodes: [],
  edges: [],
  specMeta: { name: 'pipeline', version: '1' },
  isDirty: false,
  lastSaved: null,
  saveStatus: 'idle', // 'idle' | 'saving' | 'saved' | 'error'

  loadSpec(spec) {
    let { nodes, edges } = specToFlow(spec)

    // Auto-fill empty stitcher outputs on load (same rule as addNode/updateNodeConfig)
    const suggested = derivedStitcherOutput(nodes)
    if (suggested) {
      nodes = nodes.map((n) =>
        n.type === 'video-stitcher' && !n.data.config.output
          ? { ...n, data: { ...n.data, config: { ...n.data.config, output: suggested } } }
          : n
      )
    }

    set({
      nodes,
      edges,
      specMeta: { name: spec.name, version: spec.version },
      isDirty: false,
      lastSaved: null
    })
  },

  onNodesChange(changes) {
    // 'dimensions' and 'select' are fired automatically by React Flow on
    // initial render and selection state — they don't represent user edits.
    const edits = changes.filter((c) => c.type !== 'dimensions' && c.type !== 'select')
    set((s) => ({
      nodes: applyNodeChanges(changes, s.nodes),
      isDirty: s.isDirty || edits.length > 0
    }))
  },

  onEdgesChange(changes) {
    set((s) => {
      const removes = changes.filter((c) => c.type === 'remove')

      let nodes = s.nodes
      if (removes.length > 0) {
        const removedEdges = removes
          .map((c) => s.edges.find((e) => e.id === c.id))
          .filter(Boolean)

        nodes = s.nodes.map((n) => {
          if (n.type !== 'video-stitcher' || !n.data.config.inputOrder) return n
          const affected = removedEdges.filter((e) => e.target === n.id)
          if (affected.length === 0) return n
          const removedNodeIds = new Set(affected.map((e) => e.source))
          const inputOrder = n.data.config.inputOrder.filter(
            (item) => !(item.type === 'edge' && removedNodeIds.has(item.nodeId))
          )
          return { ...n, data: { ...n.data, config: { ...n.data.config, inputOrder } } }
        })
      }

      return { edges: applyEdgeChanges(changes, s.edges), nodes, isDirty: true }
    })
  },

  onConnect(connection) {
    set((s) => {
      const edge = { ...connection, id: makeId('edge') }

      const nodes = s.nodes.map((n) => {
        if (n.id !== connection.target || n.type !== 'video-stitcher') return n
        const existing = n.data.config.inputOrder ??
          (n.data.config.inputs ?? []).map((v) => ({ type: 'fixed', value: v }))
        return {
          ...n,
          data: {
            ...n.data,
            config: {
              ...n.data.config,
              inputOrder: [...existing, { type: 'edge', nodeId: connection.source }]
            }
          }
        }
      })

      return { edges: [...s.edges, edge], nodes, isDirty: true }
    })
  },

  updateNodeConfig(nodeId, configPatch) {
    set((s) => {
      let nodes = s.nodes.map((n) =>
        n.id === nodeId
          ? { ...n, data: { ...n.data, config: { ...n.data.config, ...configPatch } } }
          : n
      )

      // When a cutter's input changes, auto-fill empty stitcher output fields
      if ('input' in configPatch) {
        const suggested = derivedStitcherOutput(nodes, configPatch.input)
        if (suggested) {
          nodes = nodes.map((n) =>
            n.type === 'video-stitcher' && !n.data.config.output
              ? { ...n, data: { ...n.data, config: { ...n.data.config, output: suggested } } }
              : n
          )
        }
      }

      return { nodes, isDirty: true }
    })
  },

  updateNodeLabel(nodeId, label) {
    set((s) => ({
      nodes: s.nodes.map((n) =>
        n.id === nodeId ? { ...n, data: { ...n.data, label } } : n
      ),
      isDirty: true
    }))
  },

  addNode(type) {
    const id = makeId(type)
    const { nodes: currentNodes } = get()
    const stitcherOutput = type === 'video-stitcher' ? derivedStitcherOutput(currentNodes) : ''
    const defaults = type === 'video-cutter'
      ? { input: '', segments: 2, duration: null, sceneDetect: null, output: null, verify: false, reEncode: false }
      : { inputOrder: [], inputs: [], output: stitcherOutput, imageDuration: 1, bgAudio: null, bgAudioVolume: 1.0 }

    const node = {
      id,
      type,
      position: { x: 200 + Math.random() * 200, y: 150 + Math.random() * 150 },
      data: { label: type === 'video-cutter' ? 'Video Cutter' : 'Video Stitcher', config: defaults }
    }

    set((s) => ({ nodes: [...s.nodes, node], isDirty: true }))
  },

  deleteNode(nodeId) {
    set((s) => {
      const removedEdges = s.edges.filter((e) => e.source === nodeId || e.target === nodeId)
      const removedEdgeSourceIds = new Set(removedEdges.filter((e) => e.target !== nodeId).map((e) => e.source))

      const nodes = s.nodes
        .filter((n) => n.id !== nodeId)
        .map((n) => {
          if (n.type !== 'video-stitcher' || !n.data.config.inputOrder) return n
          // Remove edge items pointing to the deleted node
          const inputOrder = n.data.config.inputOrder.filter(
            (item) => !(item.type === 'edge' && (item.nodeId === nodeId || removedEdgeSourceIds.has(item.nodeId)))
          )
          if (inputOrder.length === n.data.config.inputOrder.length) return n
          return { ...n, data: { ...n.data, config: { ...n.data.config, inputOrder } } }
        })

      return {
        nodes,
        edges: s.edges.filter((e) => e.source !== nodeId && e.target !== nodeId),
        isDirty: true
      }
    })
  },

  async saveNow() {
    const { nodes, edges, specMeta } = get()
    set({ saveStatus: 'saving' })
    try {
      const spec = flowToSpec(nodes, edges, specMeta)
      await saveSpec(spec)
      set({ isDirty: false, lastSaved: Date.now(), saveStatus: 'saved' })
      setTimeout(() => set((s) => s.saveStatus === 'saved' ? { saveStatus: 'idle' } : {}), 2000)
    } catch (err) {
      set({ saveStatus: 'error' })
      console.error('Save failed:', err)
    }
  }
}))
