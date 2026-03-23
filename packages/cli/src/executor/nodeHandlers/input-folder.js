import os from 'os'
import path from 'path'
import { glob } from 'glob'
import chalk from 'chalk'

function expandPath(p) {
  return p.startsWith('~/') ? path.join(os.homedir(), p.slice(2)) : p
}

/**
 * Globs the configured folder using the optional filter pattern and stores
 * all matching file paths as the outputs array.
 *
 * @param {object} node - the spec node
 * @param {Map} context - runtime context keyed by nodeId
 * @param {string} _tempRoot - unused
 * @param {object} opts - { dryRun }
 */
export async function handleInputFolder(node, context, _tempRoot, opts = {}) {
  const { config } = node
  const folderPath = config.path ? expandPath(config.path) : null

  if (!folderPath && !opts.dryRun) {
    throw new Error(`Node "${node.id}" (input-folder): no folder path configured`)
  }

  if (opts.dryRun || !folderPath) {
    context.set(node.id, { outputs: [] })
    return
  }

  // Use the user-supplied filter as a glob pattern; default to all files (non-recursive top level)
  const pattern = config.filter?.trim() || '*'
  const files = (await glob(pattern, { cwd: folderPath, absolute: true, nodir: true })).sort()

  console.log(chalk.dim(`  Input folder: ${folderPath} — ${files.length} file(s) matched`))

  context.set(node.id, { outputs: files })
}
