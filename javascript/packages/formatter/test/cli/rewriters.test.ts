import dedent from "dedent"
import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { writeFile, mkdir, rm, readFile } from "fs/promises"
import { join } from "path"

import { execBinary, expectExitCode, } from "./cli-helpers"

/**
 * Normalizes stderr output by replacing absolute paths with relative paths
 * This makes snapshots consistent across different environments (local vs CI)
 */
function normalizeStderr(stderr: string): string {
  const cwd = process.cwd()
  return stderr.replace(new RegExp(cwd + '/', 'g'), '')
}

describe("CLI", () => {
  describe("Rewriters", () => {
    const testDir = "test-rewriters"
    const configPath = join(testDir, ".herb.yml")

    beforeEach(async () => {
      await mkdir(testDir, { recursive: true })
    })

    afterEach(async () => {
      await rm(testDir, { recursive: true }).catch(() => {})
    })

    it("should show rewriter info on stderr when pre-format rewriters are configured", async () => {
      const config = dedent`
        formatter:
          enabled: true
          rewriter:
            pre:
              - tailwind-class-sorter
      `

      await writeFile(configPath, config)

      const testFile = join(testDir, "test.html.erb")
      await writeFile(testFile, '<div class="px-4 bg-blue-500"></div>')

      const result = await execBinary([testFile])

      expectExitCode(result, 0)
      expect(normalizeStderr(result.stderr)).toMatchSnapshot()
    })

    it("should show multiple rewriters on stderr", async () => {
      const config = dedent`
        formatter:
          enabled: true
          rewriter:
            pre:
              - tailwind-class-sorter
      `

      await writeFile(configPath, config)

      const testFile = join(testDir, "test.html.erb")
      await writeFile(testFile, '<div></div>')

      const result = await execBinary([testFile])

      expectExitCode(result, 0)
      expect(normalizeStderr(result.stderr)).toMatchSnapshot()
    })

    it("should actually apply Tailwind class sorting", async () => {
      const config = dedent`
        formatter:
          enabled: true
          rewriter:
            pre:
              - tailwind-class-sorter
      `

      await writeFile(configPath, config)

      const testFile = join(testDir, "test.html.erb")
      const unsortedContent = `<div class="px-4 bg-blue-500 text-white rounded"></div>`

      await writeFile(testFile, unsortedContent)

      const result = await execBinary([testFile])

      expectExitCode(result, 0)
      expect(normalizeStderr(result.stderr)).toMatchSnapshot()

      const formattedContent = await readFile(testFile, 'utf-8')
      expect(formattedContent).toBe(`<div class="rounded bg-blue-500 px-4 text-white"></div>\n`)
    })

    it("should format from stdin with rewriters configured", async () => {
      const config = dedent`
        formatter:
          enabled: true
          rewriter:
            pre:
              - tailwind-class-sorter
      `

      await writeFile(configPath, config)

      const input = `<div class="px-4 bg-blue-500 text-white"></div>`
      const result = await execBinary(["--config-file", configPath], input)

      expectExitCode(result, 0)
      expect(normalizeStderr(result.stderr)).toMatchSnapshot()
      expect(result.stdout).toMatchSnapshot()
    })

    it("should show warning for unknown rewriters on stderr", async () => {
      const config = dedent`
        formatter:
          enabled: true
          rewriter:
            pre:
              - non-existent-rewriter
      `

      await writeFile(configPath, config)

      const testFile = join(testDir, "test.html.erb")
      await writeFile(testFile, `<div>test</div>`)

      const result = await execBinary([testFile])

      expectExitCode(result, 0)
      expect(normalizeStderr(result.stderr)).toMatchSnapshot()
    })

    it("should not show rewriter info when no rewriters are configured", async () => {
      const config = dedent`
        formatter:
          enabled: true
      `

      await writeFile(configPath, config)

      const testFile = join(testDir, "test.html.erb")
      await writeFile(testFile, `<div>test</div>`)

      const result = await execBinary([testFile])

      expectExitCode(result, 0)
      expect(normalizeStderr(result.stderr)).toMatchSnapshot()
    })

    it("should handle both pre and post rewriters", async () => {
      const config = dedent`
        formatter:
          enabled: true
          rewriter:
            pre:
              - tailwind-class-sorter
      `

      await writeFile(configPath, config)

      const testFile = join(testDir, "test.html.erb")
      await writeFile(testFile, `<div class="px-4 bg-blue-500"></div>`)

      const result = await execBinary([testFile])

      expectExitCode(result, 0)
      expect(normalizeStderr(result.stderr)).toMatchSnapshot()
    })
  })
})
