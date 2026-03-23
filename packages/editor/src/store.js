import { create } from 'zustand'
import { applyNodeChanges, applyEdgeChanges } from '@xyflow/react'
import { specToFlow } from './utils/specToFlow.js'
import { flowToSpec } from './utils/flowToSpec.js'
import { saveSpec } from './api.js'

let nodeCounter = 1

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
    const { nodes, edges } = specToFlow(spec)
    set({
      nodes,
      edges,
      specMeta: { name: spec.name, version: spec.version },
      isDirty: false,
      lastSaved: null
    })
  },

  onNodesChange(changes) {
    set((s) => ({
      nodes: applyNodeChanges(changes, s.nodes),
      isDirty: true
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
    set((s) => ({
      nodes: s.nodes.map((n) =>
        n.id === nodeId
          ? { ...n, data: { ...n.data, config: { ...n.data.config, ...configPatch } } }
          : n
      ),
      isDirty: true
    }))
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
    const defaults = type === 'video-cutter'
      ? { input: '', segments: 2, duration: null, sceneDetect: null, output: null, verify: false, reEncode: false }
      : { inputOrder: [], inputs: [], output: '', imageDuration: 1, bgAudio: null, bgAudioVolume: 1.0 }

    const node = {
      id,
      type,
      position: { x: 200 + Math.random() * 200, y: 150 + Math.random() * 150 },
      data: { label: type === 'video-cutter' ? 'Video Cutter' : 'Video Stitcher', config: defaults }
    }

    set((s) => ({ nodes: [...s.nodes, node], isDirty: true }))
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
