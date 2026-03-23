import os from 'os'
import path from 'path'
import { mkdirSync, existsSync } from 'fs'
import { run } from '../runner.js'

function expandPath(p) {
  return p.startsWith('~/') ? path.join(os.homedir(), p.slice(2)) : p
}

/**
 * Builds the list of per-run inputs from inputOrder + edge outputs.
 * Returns an array of { inputs: string[], name: string } — one entry per output file.
 *
 * When an edge item expands to N files, N runs are produced (one per edge file),
 * with fixed items applied to every run. The output filename equals the basename
 * of the corresponding edge file.
 */
function buildRuns(config, incomingEdges, context, nodeId) {
  // Collect edge outputs keyed by source nodeId
  const edgeOutputs = new Map()
  for (const edge of incomingEdges) {
    const sourceCtx = context.get(edge.source)
    if (!sourceCtx) {
      throw new Error(
        `Node "${nodeId}" (video-stitcher): upstream node "${edge.source}" has no outputs in context`
      )
    }
    edgeOutputs.set(edge.source, sourceCtx.outputs ?? [])
  }

  if (Array.isArray(config.inputOrder) && config.inputOrder.length > 0) {
    const edgeItems = config.inputOrder.filter((i) => i.type === 'edge')

    if (edgeItems.length === 0) {
      // No edge connections — single run with all fixed inputs
      const inputs = config.inputOrder
        .filter((i) => i.type === 'fixed' && i.value)
        .map((i) => i.value)
      return [{ inputs, name: 'output.mp4' }]
    }

    // Number of runs = max file count across all edge items
    let runCount = 1
    for (const item of edgeItems) {
      const files = edgeOutputs.get(item.nodeId) ?? []
      if (files.length > runCount) runCount = files.length
    }

    const runs = []
    const pivotFiles = edgeOutputs.get(edgeItems[0].nodeId) ?? []

    for (let i = 0; i < runCount; i++) {
      const inputs = []
      for (const item of config.inputOrder) {
        if (item.type === 'fixed') {
          if (item.value) inputs.push(item.value)
        } else if (item.type === 'edge') {
          const files = edgeOutputs.get(item.nodeId) ?? []
          // Use file i; clamp to last available if this edge has fewer files
          const file = files[Math.min(i, files.length - 1)]
          if (file) inputs.push(file)
        }
      }
      const pivotFile = pivotFiles[i]
      const name = pivotFile
        ? path.basename(pivotFile)
        : `output_${String(i + 1).padStart(3, '0')}.mp4`
      runs.push({ inputs, name })
    }
    return runs
  } else {
    // Legacy: fixed inputs first, then all edge outputs — single run
    const fixedInputs = Array.isArray(config.inputs) ? config.inputs.filter(Boolean) : []
    const variableInputs = []
    for (const edge of incomingEdges) {
      const sourceCtx = context.get(edge.source)
      if (!sourceCtx) {
        throw new Error(
          `Node "${nodeId}" (video-stitcher): upstream node "${edge.source}" has no outputs in context`
        )
      }
      variableInputs.push(...(sourceCtx.outputs ?? []))
    }
    return [{ inputs: [...fixedInputs, ...variableInputs], name: 'output.mp4' }]
  }
}

/**
 * Builds argv and executes video-stitcher for a node.
 * Produces one output file per edge segment (N inputs → N outputs),
 * all written into the configured output folder.
 *
 * @param {object} node - the spec node
 * @param {Map} context - runtime context keyed by nodeId
 * @param {string} tempRoot - base temp directory for this run
 * @param {object[]} incomingEdges - edges where edge.target === node.id
 * @param {object} opts - { dryRun, overwrite }
 */
export async function handleVideoStitcher(node, context, tempRoot, incomingEdges, opts = {}) {
  const { config } = node

  // Determine output directory
  const outputDir = config.output
    ? expandPath(config.output)
    : path.join(tempRoot, node.id)

  if (!opts.dryRun) mkdirSync(outputDir, { recursive: true })

  const runs = buildRuns(config, incomingEdges, context, node.id)

  const outputFiles = []

  for (const { inputs, name } of runs) {
    if (inputs.length < 2) {
      throw new Error(
        `Node "${node.id}" (video-stitcher): at least 2 inputs required for "${name}", got ${inputs.length}`
      )
    }

    const outputFile = path.join(outputDir, name)

    if (!opts.dryRun && !opts.overwrite && existsSync(outputFile)) {
      throw new Error(
        `Output file already exists: ${outputFile}\nUse --overwrite to replace it.`
      )
    }

    const argv = [...inputs, '-o', outputFile]

    if (config.imageDuration != null && config.imageDuration !== 1) {
      argv.push('-d', String(config.imageDuration))
    }
    if (config.bgAudio) {
      argv.push('--bg-audio', config.bgAudio)
    }
    if (config.bgAudioVolume != null && config.bgAudioVolume !== 1.0) {
      argv.push('--bg-audio-volume', String(config.bgAudioVolume))
    }

    await run('video-stitcher', argv, {
      label: node.label ?? node.id,
      dryRun: opts.dryRun
    })

    outputFiles.push(outputFile)
  }

  context.set(node.id, { outputDir, outputs: outputFiles })
}
