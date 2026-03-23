import { execa } from 'execa'
import { spawn } from 'child_process'
import { fileURLToPath } from 'url'
import path from 'path'
import { existsSync, realpathSync } from 'fs'
import chalk from 'chalk'

/**
 * Resolves a CLI binary from the workspace node_modules/.bin,
 * falling back to global PATH.
 */
function resolveBin(name) {
  // Walk up from this file to find node_modules/.bin
  const here = fileURLToPath(import.meta.url)
  let dir = path.dirname(here)
  for (let i = 0; i < 8; i++) {
    const candidate = path.join(dir, 'node_modules', '.bin', name)
    if (existsSync(candidate)) {
      try { return realpathSync(candidate) } catch { return candidate }
    }
    dir = path.dirname(dir)
  }
  // Fall back to name on PATH
  return name
}

/**
 * Runs a CLI tool with the given args, streaming output.
 * @param {string} bin - binary name (e.g. 'video-cutter')
 * @param {string[]} args - argv array
 * @param {{ label?: string, dryRun?: boolean }} opts
 */
export async function run(bin, args, opts = {}) {
  const resolved = resolveBin(bin)
  const label = opts.label ?? bin

  if (opts.dryRun) {
    console.log(chalk.dim(`[dry-run] ${resolved} ${args.join(' ')}`))
    return
  }

  console.log(chalk.cyan(`▶ ${label}`) + chalk.dim(` $ ${bin} ${args.join(' ')}`))

  if (opts.input !== undefined) {
    // Use native spawn so stdin can be piped while stdout/stderr use real inherited file descriptors
    await new Promise((resolve, reject) => {
      const proc = spawn(resolved, args, { stdio: ['pipe', 'inherit', 'inherit'] })
      proc.stdin.write(opts.input)
      proc.stdin.end()
      proc.on('close', (code) => {
        if (code === 0) resolve()
        else reject(new Error(`${bin} exited with code ${code}`))
      })
      proc.on('error', reject)
    })
  } else {
    await execa(resolved, args, { stdio: 'inherit' })
  }
}
