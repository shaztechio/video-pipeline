import os from 'os'
import path from 'path'
import { mkdirSync, rmSync } from 'fs'
import chalk from 'chalk'
import PQueue from 'p-queue'
import { topoSort } from './topoSort.js'
import { handleVideoCutter } from './nodeHandlers/video-cutter.js'
import { handleVideoStitcher } from './nodeHandlers/video-stitcher.js'

const HANDLERS = {
  'video-cutter': handleVideoCutter,
  'video-stitcher': handleVideoStitcher
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
          await handler(node, context, tempRoot, incomingEdges, { dryRun, overwrite })
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
