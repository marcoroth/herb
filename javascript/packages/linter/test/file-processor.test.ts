import { describe, test, expect, beforeAll } from "vitest"
import { Herb } from "@herb-tools/node-wasm"

import { FileProcessor } from "../src/cli/file-processor.js"

describe("FileProcessor", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  test("doesn't inline file content into offenses", async () => {
    const processor = new FileProcessor()
    const result = await processor.processFiles(["test/fixtures/multiple-rule-offenses.html.erb"], "simple")

    expect(result.allOffenses.length).toBeGreaterThan(0)

    for (const offense of result.allOffenses) {
      expect(offense.content).toBeUndefined()
    }
  })
})
