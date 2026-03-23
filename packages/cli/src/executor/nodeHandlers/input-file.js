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
