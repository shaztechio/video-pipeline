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

import { create } from 'zustand'
import { applyNodeChanges, applyEdgeChanges } from '@xyflow/react'
import { specToFlow } from './utils/specToFlow.js'
import { flowToSpec } from './utils/flowToSpec.js'
import { saveSpec } from './api.js'
import { nodeRegistry } from './nodeRegistry.js'

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
          const handler = nodeRegistry[n.type]?.onDisconnect
          if (!handler) return n
          const affected = removedEdges.filter((e) => e.target === n.id)
          if (affected.length === 0) return n
          return { ...n, data: handler(n.data, affected.map((e) => e.source)) }
        })
      }

      return { edges: applyEdgeChanges(changes, s.edges), nodes, isDirty: true }
    })
  },

  onConnect(connection) {
    set((s) => {
      const edge = { ...connection, id: makeId('edge') }

      const nodes = s.nodes.map((n) => {
        if (n.id !== connection.target) return n
        const handler = nodeRegistry[n.type]?.onConnect
        if (!handler) return n
        return { ...n, data: handler(n.data, connection) }
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

  updateSpecName(name) {
    set((s) => ({ specMeta: { ...s.specMeta, name }, isDirty: true }))
  },

  updateNodeLabel(nodeId, label) {
    set((s) => ({
      nodes: s.nodes.map((n) =>
        n.id === nodeId ? { ...n, data: { ...n.data, label } } : n
      ),
      isDirty: true
    }))
  },

  addNode(type, position) {
    const id = makeId(type)
    const entry = nodeRegistry[type] ?? {}

    const node = {
      id,
      type,
      position: position ?? { x: 200 + Math.random() * 200, y: 150 + Math.random() * 150 },
      data: { label: entry.label ?? type, config: entry.defaults ?? {} }
    }

    set((s) => ({ nodes: [...s.nodes, node], isDirty: true }))
    return node
  },

  deleteNode(nodeId) {
    set((s) => {
      const removedEdges = s.edges.filter((e) => e.source === nodeId || e.target === nodeId)

      const nodes = s.nodes
        .filter((n) => n.id !== nodeId)
        .map((n) => {
          const handler = nodeRegistry[n.type]?.onDisconnect
          if (!handler) return n
          const disconnectedSources = [...new Set([
            nodeId,
            ...removedEdges.filter((e) => e.target === n.id).map((e) => e.source)
          ])]
          const updated = handler(n.data, disconnectedSources)
          if (updated === n.data) return n
          return { ...n, data: updated }
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
