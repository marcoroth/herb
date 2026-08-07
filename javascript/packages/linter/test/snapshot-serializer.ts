import { resolve } from "path"
import type { SnapshotSerializer } from "vitest"

const projectRoot = resolve(__dirname, "..")
const repoRoot = resolve(__dirname, "../../../..")

const serializer: SnapshotSerializer = {
  serialize(value: string, config, indentation, depth, refs, printer) {
    const normalized = value
      .replaceAll(repoRoot, "/test/herb")
      .replaceAll(projectRoot, "/test/herb/javascript/packages/linter")

    return printer(normalized, config, indentation, depth, refs)
  },

  test(value: unknown) {
    return typeof value === "string" && value.includes(projectRoot)
  },
}

export default serializer
