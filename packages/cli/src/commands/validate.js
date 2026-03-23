import { Command } from 'commander'
import { readFileSync, existsSync } from 'fs'
import chalk from 'chalk'
import { validateSpec } from '../spec/schema.js'

export function validateCommand() {
  return new Command('validate')
    .description('Validate a pipeline spec file without executing it')
    .argument('<spec>', 'Path to pipeline spec JSON file')
    .action((specArg) => {
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

      const result = validateSpec(spec)

      if (result.valid) {
        console.log(chalk.green(`✓ Valid pipeline: ${spec.name}`))
        console.log(chalk.dim(`  ${spec.nodes.length} node(s), ${spec.edges.length} edge(s)`))
      } else {
        console.error(chalk.red(`✗ Invalid pipeline:`))
        for (const err of result.errors) {
          console.error(chalk.red(`  • ${err}`))
        }
        process.exit(1)
      }
    })
}
