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

import os from 'os'
import path from 'path'

function expandPath(p) {
  return p.startsWith('~/') ? path.join(os.homedir(), p.slice(2)) : p
}

/**
 * Resolves the configured file path and stores it as a single-element outputs array.
 *
 * @param {object} node - the spec node
 * @param {Map} context - runtime context keyed by nodeId
 * @param {string} _tempRoot - unused
 * @param {object} opts - { dryRun }
 */
export async function handleInputFile(node, context, _tempRoot, opts = {}) {
  const { config } = node
  const filePath = config.path ? expandPath(config.path) : null

  if (!filePath && !opts.dryRun) {
    throw new Error(`Node "${node.id}" (input-file): no file path configured`)
  }

  context.set(node.id, { outputs: filePath ? [filePath] : [] })
}
