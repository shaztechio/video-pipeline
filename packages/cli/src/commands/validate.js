import { Command } from 'commander'
import { readFileSync, existsSync } from 'fs'
import { fileURLToPath } from 'url'
import path from 'path'
import chalk from 'chalk'
import Ajv from 'ajv'
import { validateSpec } from '../spec/schema.js'

// Resolve the schema relative to the repo root (works both installed and local)
const here = path.dirname(fileURLToPath(import.meta.url))
const schemaPath = path.resolve(here, '../../../../pipeline.schema.json')
const schema = JSON.parse(readFileSync(schemaPath, 'utf8'))

const ajv = new Ajv({ allErrors: true, strict: false })
const ajvValidate = ajv.compile(schema)

export function validateCommand() {
  return new Command('validate')
    .description('Validate a pipeline spec file against the JSON schema and semantic rules')
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

      const errors = []

      // 1. JSON Schema validation
      const schemaValid = ajvValidate(spec)
      if (!schemaValid) {
        for (const err of ajvValidate.errors) {
          const loc = err.instancePath || '(root)'
          errors.push(`Schema: ${loc} ${err.message}`)
        }
      }

      // 2. Semantic validation (duplicate ids, edge references, etc.)
      const result = validateSpec(spec)
      if (!result.valid) {
        errors.push(...result.errors)
      }

      if (errors.length === 0) {
        console.log(chalk.green(`✓ Valid pipeline: ${spec.name}`))
        console.log(chalk.dim(`  ${spec.nodes.length} node(s), ${spec.edges.length} edge(s)`))
      } else {
        console.error(chalk.red('✗ Invalid pipeline:'))
        for (const err of errors) {
          console.error(chalk.red(`  • ${err}`))
        }
        process.exit(1)
      }
    })
}
