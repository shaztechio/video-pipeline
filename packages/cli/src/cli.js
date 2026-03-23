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
