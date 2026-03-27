#!/usr/bin/env node

import { existsSync, writeFileSync } from "fs"
import { fileURLToPath } from "url"
import { dirname, join } from "path"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const ENTITIES_URL = "https://html.spec.whatwg.org/entities.json"
const OUTPUT_PATH = join(__dirname, "..", "src", "html-entities.json")

async function downloadEntities() {
  if (existsSync(OUTPUT_PATH)) {
    console.log(`HTML entities already present at ${OUTPUT_PATH}, skipping download.`)
    return
  }

  console.log(`Downloading HTML named character references from ${ENTITIES_URL}...`)

  const response = await fetch(ENTITIES_URL)

  if (!response.ok) {
    throw new Error(`Failed to fetch entities: ${response.status} ${response.statusText}`)
  }

  const data = await response.json()
  const entities = {}

  for (const [key, value] of Object.entries(data).sort(([a], [b]) => a.localeCompare(b))) {
    if (key.endsWith(";")) {
      const name = key.slice(1, -1)
      entities[name] = {
        characters: value.characters,
        codepoints: value.codepoints,
      }
    }
  }

  const count = Object.keys(entities).length

  writeFileSync(OUTPUT_PATH, JSON.stringify(entities, null, 2) + "\n")

  console.log(`Wrote ${count} named character references to ${OUTPUT_PATH}`)
}

downloadEntities().catch((error) => {
  console.error(error)
  process.exit(1)
})
