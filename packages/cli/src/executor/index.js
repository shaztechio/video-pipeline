import os from 'os'
import path from 'path'
import { mkdirSync, rmSync } from 'fs'
import chalk from 'chalk'
import PQueue from 'p-queue'
import { topoSort } from './topoSort.js'
import { handleVideoCutter } from './nodeHandlers/video-cutter.js'
import { handleVideoStitcher } from './nodeHandlers/video-stitcher.js'
import { handleInputFile } from './nodeHandlers/input-file.js'
import { handleInputFolder } from './nodeHandlers/input-folder.js'

const HANDLERS = {
  'video-cutter': handleVideoCutter,
  'video-stitcher': handleVideoStitcher,
  'output-folder': async () => {}, // resolved during cutter/stitcher execution
  'input-file': handleInputFile,
  'input-folder': handleInputFolder
}

/**
 * Executes a validated pipeline spec.
 *
 * @param {object} spec - parsed pipeline spec
 * @param {{ keepTemp?: boolean, dryRun?: boolean }} opts
 */
export async function executePipeline(spec, opts = {}) {
  const { keepTemp = false, dryRun = false, overwrite = false } = opts

  const levels = topoSort(spec.nodes, spec.edges)

  const tempRoot = path.join(
    os.tmpdir(),
    'video-pipeline',
    `${spec.name}-${Date.now()}`
  )

  if (!dryRun) {
    mkdirSync(tempRoot, { recursive: true })
  }

  console.log(chalk.bold(`\nPipeline: ${spec.name}`))
  console.log(chalk.dim(`  ${spec.nodes.length} node(s) across ${levels.length} level(s)`))
  if (dryRun) console.log(chalk.yellow('  [dry-run mode]\n'))

  // context stores runtime outputs keyed by nodeId
  const context = new Map()

  // Build a nodeId -> node map and edge lookup
  const nodeMap = new Map(spec.nodes.map((n) => [n.id, n]))

  for (let i = 0; i < levels.length; i++) {
    const level = levels[i]
    console.log(chalk.dim(`\nLevel ${i + 1}: ${level.join(', ')}`))

    const queue = new PQueue({ concurrency: os.cpus().length })

    const tasks = level.map((nodeId) =>
      queue.add(async () => {
        const node = nodeMap.get(nodeId)
        const handler = HANDLERS[node.type]

        if (!handler) {
          throw new Error(`No handler for node type: ${node.type}`)
        }

        // Find edges where this node is the target
        const incomingEdges = spec.edges.filter((e) => e.target === nodeId)

        if (node.type === 'video-stitcher') {
          // Collect output-folder paths from connected output-folder nodes
          const outputFolderPaths = spec.edges
            .filter((e) => e.source === nodeId)
            .map((e) => nodeMap.get(e.target))
            .filter((n) => n?.type === 'output-folder' && n.config?.path)
            .map((n) => n.config.path)

          // If no output configured (and no output-folder node), derive default from the single cutter's input dir
          let effectiveNode = node
          if (!node.config.output && outputFolderPaths.length === 0) {
            const cutters = spec.nodes.filter((n) => n.type === 'video-cutter')
            if (cutters.length === 1 && cutters[0].config.input) {
              const inputDir = path.dirname(cutters[0].config.input)
              effectiveNode = { ...node, config: { ...node.config, output: path.join(inputDir, 'stitch-output') } }
            }
          }
          await handler(effectiveNode, context, tempRoot, incomingEdges, { dryRun, overwrite, outputFolderPaths })
        } else if (node.type === 'video-cutter') {
          // Collect output-folder paths from connected output-folder nodes
          const outputFolderPaths = spec.edges
            .filter((e) => e.source === nodeId)
            .map((e) => nodeMap.get(e.target))
            .filter((n) => n?.type === 'output-folder' && n.config?.path)
            .map((n) => n.config.path)

          // Collect input files from connected input-file / input-folder nodes
          const inputFiles = spec.edges
            .filter((e) => e.target === nodeId)
            .map((e) => nodeMap.get(e.source))
            .filter((n) => n?.type === 'input-file' || n?.type === 'input-folder')
            .flatMap((n) => context.get(n.id)?.outputs ?? [])

          await handler(node, context, tempRoot, { dryRun, overwrite, outputFolderPaths, inputFiles })
        } else {
          await handler(node, context, tempRoot, { dryRun, overwrite })
        }
      })
    )

    await Promise.all(tasks)
    await queue.onIdle()
  }

  // Print final outputs
  console.log(chalk.green('\n✓ Pipeline complete\n'))
  for (const [nodeId, ctx] of context) {
    if (ctx.outputs?.length) {
      for (const f of ctx.outputs) {
        console.log(chalk.green(`  Output [${nodeId}]: ${f}`))
      }
    }
  }

  if (!dryRun && !keepTemp) {
    try {
      rmSync(tempRoot, { recursive: true, force: true })
    } catch {
      // Non-fatal: temp cleanup failure
    }
  } else if (!dryRun && keepTemp) {
    console.log(chalk.dim(`\n  Temp files: ${tempRoot}`))
  }
}
