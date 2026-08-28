import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    isolate: false,
    snapshotSerializers: ["./test/snapshot-serializer.ts"],
  },
})
