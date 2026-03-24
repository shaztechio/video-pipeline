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
import { createCommand } from './commands/create.js'
import { editCommand } from './commands/edit.js'
import { runCommand } from './commands/run.js'
import { validateCommand } from './commands/validate.js'

const program = new Command()

program
  .name('video-pipeline')
  .description('Visual node-based video processing pipeline')
  .version('1.0.0')

program.addCommand(createCommand())
program.addCommand(editCommand())
program.addCommand(runCommand())
program.addCommand(validateCommand())

program.parse()
