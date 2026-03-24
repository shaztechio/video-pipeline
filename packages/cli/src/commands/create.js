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
import { writeFileSync, existsSync } from 'fs'
import path from 'path'
import chalk from 'chalk'
import { createDefaultSpec } from '../spec/defaultSpec.js'

export function createCommand() {
  return new Command('create')
    .description('Create a new pipeline spec file')
    .argument('[name]', 'Pipeline name (also used as filename)', 'pipeline')
    .option('-f, --force', 'Overwrite if file already exists')
    .action((name, opts) => {
      const filename = name.endsWith('.json') ? name : `${name}.json`
      const filepath = path.resolve(process.cwd(), filename)

      if (existsSync(filepath) && !opts.force) {
        console.error(chalk.red(`File already exists: ${filename}`))
        console.error(chalk.dim('Use --force to overwrite'))
        process.exit(1)
      }

      const spec = createDefaultSpec(name.replace(/\.json$/, ''))
      writeFileSync(filepath, JSON.stringify(spec, null, 2) + '\n', 'utf8')
      console.log(chalk.green(`Created: ${filename}`))
      console.log(chalk.dim(`Edit it visually: video-pipeline edit ${filename}`))
    })
}
