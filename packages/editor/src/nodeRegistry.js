export const nodeRegistry = {
  'video-stitcher': {
    label: 'Video Stitcher',
    defaults: { inputOrder: [], inputs: [], imageDuration: 1, bgAudio: null, bgAudioVolume: 1.0 },

    onConnect(data, connection) {
      const existing = data.config.inputOrder ??
        (data.config.inputs ?? []).map((v) => ({ type: 'fixed', value: v }))
      return {
        ...data,
        config: {
          ...data.config,
          inputOrder: [...existing, { type: 'edge', nodeId: connection.source }]
        }
      }
    },

    onDisconnect(data, removedSourceIds) {
      if (!data.config.inputOrder) return data
      const removed = new Set(removedSourceIds)
      return {
        ...data,
        config: {
          ...data.config,
          inputOrder: data.config.inputOrder.filter(
            (item) => !(item.type === 'edge' && removed.has(item.nodeId))
          )
        }
      }
    }
  },

  'video-cutter': {
    label: 'Video Cutter',
    defaults: { segments: 2, duration: null, sceneDetect: null, output: null, verify: false, reEncode: false }
  },

  'output-folder': { label: 'Output Folder', defaults: { path: '' } },
  'input-file':    { label: 'Input File',    defaults: { path: '' } },
  'input-folder':  { label: 'Input Folder',  defaults: { path: '', filter: '' } }
}
