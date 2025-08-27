#!/usr/bin/env node

import fs from 'fs/promises'
import path from 'path'
import yaml from 'yaml'
import dedent from 'dedent'

import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const args = process.argv.slice(2)
const forceOverwrite = args.includes('--force')
const showHelp = args.includes('--help') || args.includes('-h')

function showUsage() {
  console.log(dedent`
    Generate node test files for all node types defined in config.yml

    Usage:
      node scripts/generate-node-tests.mjs [options]

    Options:
      --force    Overwrite existing test files
      --help     Show this help message

    Examples:
      node scripts/generate-node-tests.mjs          # Generate new files only
      node scripts/generate-node-tests.mjs --force  # Overwrite all files
  `)
}

async function getNodeTypes() {
  const configPath = path.resolve(__dirname, '../../../../config.yml')
  const configContent = await fs.readFile(configPath, 'utf-8')
  const config = yaml.parse(configContent)

  return config.nodes.types.map(node => ({
    name: node.name,
    fields: node.fields || []
  }))
}

function generateNodeTest(nodeInfo) {
  const { name: nodeName, fields } = nodeInfo

  let astType = nodeName

  if (astType.startsWith('HTML')) {
    astType = astType.replace(/^HTML/, 'HTML_')
  } else if (astType.startsWith('ERB')) {
    astType = astType.replace(/^ERB/, 'ERB_')
  }

  astType = astType
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .toUpperCase()

  astType = 'AST_' + astType

  const standardProperties = [
    `type: "${astType}"`,
    'location: createLocation()',
    'errors: []'
  ]

  const nodeSpecificProperties = fields.map(field => {
    const value = (() => {
      switch (field.type) {
        case 'string':
          return `"example_${field.name}"`
        case 'boolean':
          return 'false'
        case 'array':
          return '[]'
        case 'token':
          return `createToken()`
        case 'node':
          return 'null'
        case 'analyzed_ruby':
          return 'null'
        default:
          return 'null'
      }
    })()

    return `${field.name}: ${value}`
  })

  const allProperties = [...standardProperties, ...nodeSpecificProperties]
  const formattedArgs = allProperties.map(prop => `          ${prop}`).join(',\n')

  return dedent`
    import dedent from "dedent"
    import { describe, test, beforeAll } from "vitest"

    import { Herb } from "@herb-tools/node-wasm"
    import { ${nodeName} } from "@herb-tools/core"

    import { expectNodeToPrint, expectPrintRoundTrip, createLocation, createToken } from "../helpers/printer-test-helpers.js"

    describe("${nodeName} Printing", () => {
      beforeAll(async () => {
        await Herb.load()
      })

      test("can print from node", () => {
        const node = ${nodeName}.from({
${formattedArgs}
        })

        expectNodeToPrint(node, "TODO: Test not implemented yet for ${nodeName}")
      })

      test("can print from source", () => {
        expectPrintRoundTrip(dedent\`
          TODO: Add template that produces ${nodeName}
        \`)
      })
    })

  `
}

async function main() {
  if (showHelp) {
    showUsage()

    process.exit(0)
  }

  try {
    const nodeTypes = await getNodeTypes()
    const testDir = path.resolve(__dirname, '../test/nodes')

    await fs.mkdir(testDir, { recursive: true })

    console.log(`Generating tests for ${nodeTypes.length} node types...`)

    let generatedCount = 0
    let skippedCount = 0

    for (const nodeInfo of nodeTypes) {
      const { name: nodeTypeName } = nodeInfo

      const kebabCase = nodeTypeName
        .replace(/^HTML/, 'html-')
        .replace(/^ERB/, 'erb-')
        .replace(/([A-Z])/g, '-$1')
        .toLowerCase()
        .replace(/^-/, '')
        .replace(/--/g, '-')

      const testFile = path.join(testDir, `${kebabCase}.test.ts`)

      let fileExists = false
      try {
        await fs.access(testFile)
        fileExists = true
      } catch {
        // File doesn't exist
      }

      if (fileExists && !forceOverwrite) {
        console.log(`↷ Skipped test/nodes/${kebabCase}.test.ts (already exists)`)
        skippedCount++
        continue
      }

      const testContent = generateNodeTest(nodeInfo)
      await fs.writeFile(testFile, testContent)
      console.log(`✓ Generated test/nodes/${kebabCase}.test.ts`)
      generatedCount++
    }

    console.log(`\nFinished processing ${nodeTypes.length} node test files in test/nodes/`)
    console.log(`Generated: ${generatedCount}, Skipped: ${skippedCount}`)
    console.log('\nNext steps:')
    console.log('1. Add real test cases for each node type')
    console.log('2. Create example templates that produce each node type')
    console.log('3. Verify round-trip printing works for each node')
    console.log('\nTo overwrite existing files, run: node scripts/generate-node-tests.mjs --force')

  } catch (error) {
    console.error('Error generating node tests:', error)
    process.exit(1)
  }
}

main()
