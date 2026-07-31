import { describe, test, expect, afterEach } from "vitest"

import { workerMemoryLimitMb } from "../src/cli/file-processor.js"

const GB = 1024 * 1024 * 1024

afterEach(() => {
  delete process.env.HERB_WORKER_MEMORY_MB
})

describe("workerMemoryLimitMb", () => {
  test("splits the non-reserved memory between the workers", () => {
    expect(workerMemoryLimitMb(2, 16 * GB)).toBe(5734)
  })

  test("gives each worker less as the worker count grows", () => {
    const two = workerMemoryLimitMb(2, 16 * GB)
    const four = workerMemoryLimitMb(4, 16 * GB)

    expect(four).toBeLessThan(two)
    expect(four * 4).toBeLessThan(16 * 1024)
  })

  test("never hands out more than the machine has", () => {
    for (const workers of [1, 2, 4, 8, 16]) {
      expect(workerMemoryLimitMb(workers, 16 * GB) * workers).toBeLessThanOrEqual(16 * 1024)
    }
  })

  test("keeps a floor on small machines", () => {
    expect(workerMemoryLimitMb(16, 1 * GB)).toBe(512)
  })

  test("caps the ceiling so a huge machine does not exceed what V8 will use", () => {
    expect(workerMemoryLimitMb(1, 256 * GB)).toBe(8192)
  })

  test("an explicit override wins", () => {
    process.env.HERB_WORKER_MEMORY_MB = "1234"

    expect(workerMemoryLimitMb(8, 16 * GB)).toBe(1234)
  })

  test("ignores a nonsensical override", () => {
    process.env.HERB_WORKER_MEMORY_MB = "not-a-number"

    expect(workerMemoryLimitMb(2, 16 * GB)).toBe(5734)
  })
})
