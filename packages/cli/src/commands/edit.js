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
