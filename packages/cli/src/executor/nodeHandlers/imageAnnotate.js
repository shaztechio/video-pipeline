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

import path from 'path'
import { existsSync, writeFileSync, unlinkSync } from 'fs'
import chalk from 'chalk'
import { run } from '../runner.js'

/**
 * Escapes a file path for use inside an ffmpeg filter string value.
 * In ffmpeg filter syntax the following characters must be escaped with a backslash:
 *   \  :  '
 * (The path is embedded as a value in drawtext=fontfile=...:textfile=...)
 */
function escapeFilterPath(p) {
  // Replace backslashes first, then colons, then single-quotes
  return p.replace(/\\/g, '\\\\').replace(/:/g, '\\:').replace(/'/g, "\\'")
}

/**
 * Validates fontFile and composes the drawtext filter string and sidecar text file path.
 * Shared by both image and video annotation helpers.
 */
function buildDrawtextArgs(srcLabel, {
  index,
  total,
  totalOffset = 0,
  prefix,
  fontFile,
  fontSize = 48,
  fontColor = 'white',
  box = false,
  boxColor = 'black@0.5',
  padding = 20,
  destPath,
  dryRun = false,
}) {
  if (!fontFile) {
    throw new Error(
      `sequenceLabel: fontFile is required but was not provided (item: "${srcLabel}")`
    )
  }

  if (!dryRun && !existsSync(fontFile)) {
    throw new Error(
      `sequenceLabel: fontFile not found: ${fontFile}`
    )
  }

  const effectiveTotal = total + totalOffset
  const text = prefix ? `${prefix} ${index}/${effectiveTotal}` : `${index}/${effectiveTotal}`

  const textFile = `${destPath}.txt`

  const escapedFontFile = escapeFilterPath(fontFile)
  const escapedTextFile = escapeFilterPath(textFile)
  const x = `w-tw-${padding}`
  const y = `h-th-${padding}`

  let filterStr =
    `drawtext=fontfile=${escapedFontFile}` +
    `:textfile=${escapedTextFile}` +
    `:fontsize=${fontSize}` +
    `:fontcolor=${fontColor}` +
    `:x=${x}` +
    `:y=${y}`

  if (box) {
    filterStr += `:box=1:boxcolor=${boxColor}:boxborderw=8`
  }

  return { text, textFile, filterStr }
}

/**
 * Burns a sequence label (e.g. "scene 3/10") into the bottom-right corner of
 * an image using ffmpeg drawtext.
 *
 * @param {string} srcPath - absolute path to the source image
 * @param {object} opts
 * @param {number}  opts.index     - 1-based sequence index
 * @param {number}  opts.total     - total item count
 * @param {string}  [opts.prefix]  - optional prefix, e.g. "scene" → "scene 3/10"
 * @param {string}  opts.fontFile  - path to a .ttf/.otf/.ttc font file (required)
 * @param {number}  [opts.fontSize=48]
 * @param {string}  [opts.fontColor='white']
 * @param {boolean} [opts.box=false]          - draw a semi-transparent background box
 * @param {string}  [opts.boxColor='black@0.5']
 * @param {number}  [opts.padding=20]         - px distance from right & bottom edges
 * @param {number}  [opts.totalOffset=0]      - integer added to the denominator
 * @param {string}  opts.destPath  - absolute path to write the annotated image
 * @param {string}  [opts.label]   - display label for the run() spinner
 * @param {boolean} [opts.dryRun=false]
 */
export async function annotateImageWithSequence(srcPath, opts) {
  const { destPath, label, dryRun = false, index, total } = opts
  const { text, textFile, filterStr } = buildDrawtextArgs(srcPath, opts)

  console.log(
    chalk.dim(`  [seq-label] Annotating ${path.basename(srcPath)} `) +
    chalk.cyan(`"${text}"`) +
    chalk.dim(` → ${path.basename(destPath)}`)
  )

  if (!dryRun) {
    console.log(chalk.dim(`  [seq-label]   text file: ${textFile}`))
    writeFileSync(textFile, text, 'utf8')
    console.log(chalk.dim(`  [seq-label]   font file: ${opts.fontFile}`))
    console.log(chalk.dim(`  [seq-label]   dest path: ${destPath}`))
  }

  const argv = [
    '-nostdin',
    '-loglevel', 'warning',
    '-y',
    '-i', srcPath,
    '-vf', filterStr,
    '-frames:v', '1',
    destPath,
  ]

  await run('ffmpeg', argv, {
    label: label ?? `annotate ${index}/${total}`,
    dryRun,
  })

  if (!dryRun) {
    try { unlinkSync(textFile) } catch {}
  }
}

/**
 * Burns a sequence label (e.g. "scene 3/10") into the bottom-right corner of
 * a video file using ffmpeg drawtext. Used for the whole-output-video label on
 * a stitcher node. Audio is stream-copied to avoid re-encoding.
 *
 * @param {string} srcPath - absolute path to the source video
 * @param {object} opts    - same signature as annotateImageWithSequence
 */
export async function annotateVideoWithSequence(srcPath, opts) {
  const { destPath, label, dryRun = false, index, total } = opts
  const { text, textFile, filterStr } = buildDrawtextArgs(srcPath, opts)

  console.log(
    chalk.dim(`  [seq-label] Annotating ${path.basename(srcPath)} `) +
    chalk.cyan(`"${text}"`) +
    chalk.dim(` → ${path.basename(destPath)}`)
  )

  if (!dryRun) {
    console.log(chalk.dim(`  [seq-label]   text file: ${textFile}`))
    writeFileSync(textFile, text, 'utf8')
    console.log(chalk.dim(`  [seq-label]   font file: ${opts.fontFile}`))
    console.log(chalk.dim(`  [seq-label]   dest path: ${destPath}`))
  }

  const argv = [
    '-nostdin',
    '-loglevel', 'warning',
    '-y',
    '-i', srcPath,
    '-vf', filterStr,
    '-c:a', 'copy',
    destPath,
  ]

  await run('ffmpeg', argv, {
    label: label ?? `annotate ${index}/${total}`,
    dryRun,
  })

  if (!dryRun) {
    try { unlinkSync(textFile) } catch {}
  }
}
