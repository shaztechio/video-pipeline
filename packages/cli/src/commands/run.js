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
import { readFileSync, existsSync } from 'fs'
import chalk from 'chalk'
import { validateSpec } from '../spec/schema.js'
import { executePipeline } from '../executor/index.js'

export function runCommand() {
  return new Command('run')
    .description('Execute a pipeline from a spec file')
    .argument('<spec>', 'Path to pipeline spec JSON file')
    .option('--keep-temp', 'Keep intermediate temp files after execution')
    .option('--dry-run', 'Print execution plan without running')
    .option('--overwrite', 'Overwrite output files if they already exist')
    .action(async (specArg, opts) => {
      if (!existsSync(specArg)) {
        console.error(chalk.red(`File not found: ${specArg}`))
        process.exit(1)
      }

      let spec
      try {
        spec = JSON.parse(readFileSync(specArg, 'utf8'))
      } catch (err) {
        console.error(chalk.red(`Invalid JSON: ${err.message}`))
        process.exit(1)
      }

      const validation = validateSpec(spec)
      if (!validation.valid) {
        console.error(chalk.red('Invalid pipeline spec:'))
        for (const err of validation.errors) {
          console.error(chalk.red(`  • ${err}`))
        }
        process.exit(1)
      }

      try {
        await executePipeline(spec, {
          keepTemp: opts.keepTemp ?? false,
          dryRun: opts.dryRun ?? false,
          overwrite: opts.overwrite ?? false
        })
      } catch (err) {
        console.error(chalk.red(`Pipeline failed: ${err.message}`))
        process.exit(1)
      }
    })
}
