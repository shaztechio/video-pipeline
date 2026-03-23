import { Command } from 'commander'
import { existsSync, writeFileSync } from 'fs'
import path from 'path'
import chalk from 'chalk'
import { createDefaultSpec } from '../spec/defaultSpec.js'
import { startEditorServer } from '../server/index.js'

export function editCommand() {
  return new Command('edit')
    .description('Open the visual pipeline editor in a browser')
    .argument('[spec]', 'Path to pipeline spec JSON file', 'pipeline.json')
    .option('-p, --port <port>', 'Server port (default: auto-detect)', parseInt)
    .action(async (specArg, opts) => {
      const specPath = path.resolve(process.cwd(), specArg)

      if (!existsSync(specPath)) {
        const name = path.basename(specArg, '.json')
        const spec = createDefaultSpec(name)
        writeFileSync(specPath, JSON.stringify(spec, null, 2) + '\n', 'utf8')
        console.log(chalk.dim(`Created new spec: ${specArg}`))
      }

      const { url } = await startEditorServer(specPath, { port: opts.port })

      console.log(chalk.green(`\n  Editor ready: ${url}\n`))
      console.log(chalk.dim('  Press Ctrl+C to stop\n'))

      const { default: open } = await import('open')
      await open(url)

      // Keep process alive
      await new Promise((resolve) => {
        process.once('SIGINT', () => {
          console.log(chalk.dim('\n  Editor closed.'))
          resolve()
        })
      })

      process.exit(0)
    })
}
