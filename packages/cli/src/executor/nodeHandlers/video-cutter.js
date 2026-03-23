import os from 'os'
import path from 'path'
import { mkdirSync, rmSync, readdirSync, copyFileSync } from 'fs'
import { glob } from 'glob'
import { run } from '../runner.js'

function expandPath(p) {
  return p.startsWith('~/') ? path.join(os.homedir(), p.slice(2)) : p
}

/**
 * Builds argv and executes video-cutter for a node.
 * After execution, globs the output directory for segment files
 * and stores them in context[nodeId].outputs (sorted).
 *
 * @param {object} node - the spec node
 * @param {Map} context - runtime context keyed by nodeId
 * @param {string} tempRoot - base temp directory for this run
 * @param {object} opts - { dryRun }
 */
export async function handleVideoCutter(node, context, _tempRoot, opts = {}) {
  const { config } = node

  // Resolve input: either static config or from upstream (future)
  const inputFile = config.input ? expandPath(config.input) : null
  if (!inputFile) {
    throw new Error(`Node "${node.id}" (video-cutter): no input file configured`)
  }

  // Output dir for this node's segments.
  // Preference: connected output-folder node(s) → explicit config.output → sibling "output" folder of input
  const outputFolderPaths = (opts.outputFolderPaths ?? []).map(expandPath).filter(Boolean)
  const outputDir = outputFolderPaths.length > 0
    ? outputFolderPaths[0]
    : config.output
    ? expandPath(config.output)
    : path.join(path.dirname(inputFile), 'cutter-output')
  if (!opts.dryRun) {
    if (opts.overwrite) {
      // Wipe and recreate so ffmpeg never encounters existing files
      // (ffmpeg hangs prompting on its stdin pipe when output files already exist)
      rmSync(outputDir, { recursive: true, force: true })
    }
    mkdirSync(outputDir, { recursive: true })
  }

  const argv = ['-i', inputFile, '-o', outputDir]

  // Cutting method (mutually exclusive)
  if (config.segments != null) {
    argv.push('-n', String(config.segments))
  } else if (config.duration != null) {
    argv.push('-d', String(config.duration))
  } else if (config.sceneDetect != null) {
    argv.push('--scene-detect', config.sceneDetect === true ? '' : String(config.sceneDetect))
  }

  if (config.verify) argv.push('--verify')
  if (config.reEncode) argv.push('--re-encode')

  await run('video-cutter', argv.filter(Boolean), {
    label: node.label ?? node.id,
    dryRun: opts.dryRun,
    input: 'y\n'  // auto-confirm any interactive prompts (e.g. short-segment warning)
  })

  if (opts.dryRun) {
    // Populate dummy context so downstream nodes can still print their dry-run commands
    const segCount = config.segments ?? 1
    const dummyOutputs = Array.from({ length: segCount }, (_, i) =>
      path.join(outputDir, `segment_${String(i + 1).padStart(3, '0')}.mp4`)
    )
    context.set(node.id, { outputDir, outputs: dummyOutputs })
    return
  }

  // Glob segment output files (use cwd form so ** reliably matches files in root)
  const files = (await glob('**/*.mp4', { cwd: outputDir, absolute: true })).sort()

  if (files.length === 0) {
    let contents = []
    try { contents = readdirSync(outputDir) } catch {}
    const detail = contents.length > 0
      ? `Output directory contains: ${contents.join(', ')}`
      : 'Output directory is empty'
    throw new Error(
      `Node "${node.id}" (video-cutter): produced no output segments\n  ${detail}\n  Input: ${inputFile}`
    )
  }

  // Copy segments to any additional output-folder paths
  const additionalDirs = outputFolderPaths.slice(1)
  for (const dir of additionalDirs) {
    console.log(`  Copying ${files.length} segment(s) → ${dir}`)
    mkdirSync(dir, { recursive: true })
    for (const file of files) {
      copyFileSync(file, path.join(dir, path.basename(file)))
    }
  }

  context.set(node.id, { outputDir, outputs: files })
}
