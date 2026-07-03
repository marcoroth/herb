import fs from "node:fs"
import path from "node:path"
import { describe, test, expect } from "vitest"

import { rules } from "../src/rules.js"

const docsDir = path.resolve(__dirname, "../docs/rules")
const readmePath = path.join(docsDir, "README.md")
const readmeContent = fs.readFileSync(readmePath, "utf-8")

describe("rule documentation completeness", () => {
  const ruleNames = rules.map((r) => r.ruleName)

  test.each(ruleNames)("%s has a docs page", (ruleName) => {
    const docPath = path.join(docsDir, `${ruleName}.md`)
    expect(fs.existsSync(docPath), `Missing docs page: docs/rules/${ruleName}.md`).toBe(true)
  })

  test.each(ruleNames)("%s is linked from the README", (ruleName) => {
    expect(readmeContent, `Missing README entry for ${ruleName}`).toContain(`(./${ruleName}.md)`)
  })
})
