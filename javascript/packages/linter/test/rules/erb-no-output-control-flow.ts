import { describe, it, beforeAll } from "vitest"
import { Herb } from "@herb-tools/node-wasm"
import dedent from "dedent";

describe("erb-no-output-control-flow", () => {
  beforeAll(async () => {
    await Herb.load()
  })
  it.todo("should not allow if statments with output tags")
  it.todo("should not allow unless statements with output tags")
  it.todo("should not allow end statements with output tags")
  it.todo("should not nested control flow blocks with output tags")
})