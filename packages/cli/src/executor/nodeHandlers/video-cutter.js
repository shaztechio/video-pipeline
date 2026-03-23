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
 * Input files come from (in priority order):
 *   1. Connected input-file / input-folder nodes (opts.inputFiles)
 *   2. config.input (legacy / backward-compat)
 *
 * When multiple input files are supplied each is cut into its own
 * sub-directory of the output dir; all resulting segments are pooled
 * into context[nodeId].outputs.
 *
 * @param {object} node - the spec node
 * @param {Map} context - runtime context keyed by nodeId
 * @param {string} _tempRoot - base temp directory (unused)
 * @param {object} opts - { dryRun, overwrite, outputFolderPaths, inputFiles }
 */
export async function handleVideoCutter(node, context, _tempRoot, opts = {}) {
  const { config } = node

  // Resolve input file(s)
  const inputFiles = opts.inputFiles?.length > 0
    ? opts.inputFiles.map(expandPath).filter(Boolean)
    : config.input ? [expandPath(config.input)] : []

  if (inputFiles.length === 0) {
    if (opts.dryRun) {
      // dry-run with no input: emit a placeholder so downstream nodes can print
      const outputDir = path.join(os.tmpdir(), 'video-pipeline', node.id)
      const segCount = config.segments ?? 1
      const dummyOutputs = Array.from({ length: segCount }, (_, i) =>
        path.join(outputDir, `segment_${String(i + 1).padStart(3, '0')}.mp4`)
      )
      context.set(node.id, { outputDir, outputs: dummyOutputs })
      return
    }
    throw new Error(`Node "${node.id}" (video-cutter): no input file configured — connect an InputFile or InputFolder node`)
  }

  // Output folder paths from connected OutputFolder nodes
  const outputFolderPaths = (opts.outputFolderPaths ?? []).map(expandPath).filter(Boolean)

  const allSegments = []
  const multiInput = inputFiles.length > 1

  // Determine base output dir (same for all input files)
  const baseOutputDir = outputFolderPaths.length > 0
    ? outputFolderPaths[0]
    : config.output
    ? expandPath(config.output)
    : path.join(path.dirname(inputFiles[0]), 'cutter-output')

  for (const inputFile of inputFiles) {
    // Each input file gets its own sub-directory when processing multiple files
    const outputDir = multiInput
      ? path.join(baseOutputDir, path.basename(inputFile, path.extname(inputFile)))
      : baseOutputDir

    if (!opts.dryRun) {
      if (opts.overwrite) rmSync(outputDir, { recursive: true, force: true })
      mkdirSync(outputDir, { recursive: true })
    }

    const argv = ['-i', inputFile, '-o', outputDir]

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
      input: 'y\n'
    })

    if (opts.dryRun) {
      const segCount = config.segments ?? 1
      for (let i = 0; i < segCount; i++) {
        allSegments.push(path.join(outputDir, `segment_${String(i + 1).padStart(3, '0')}.mp4`))
      }
      continue
    }

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

    allSegments.push(...files)
  }

  // Copy all segments to any additional output-folder paths
  const additionalDirs = outputFolderPaths.slice(1)
  for (const dir of additionalDirs) {
    console.log(`  Copying ${allSegments.length} segment(s) → ${dir}`)
    mkdirSync(dir, { recursive: true })
    for (const file of allSegments) {
      copyFileSync(file, path.join(dir, path.basename(file)))
    }
  }

  context.set(node.id, { outputDir: baseOutputDir, outputs: allSegments })
}
