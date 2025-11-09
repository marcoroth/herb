import dedent from "dedent"
import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { writeFile, mkdir, rm, readFile } from "fs/promises"
import { join } from "path"

import { execBinary, expectExitCode, } from "./cli-helpers"

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
      expect(result.stderr).toContain("Using 1 pre-format rewriter: tailwind-class-sorter")
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
      expect(result.stderr).toContain("Using 1 pre-format rewriter: tailwind-class-sorter")
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
      expect(result.stdout).toContain("Formatted: test-rewriters/test.html.erb")

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
      expect(result.stderr).toContain(`Using 1 pre-format rewriter: tailwind-class-sorter`)
      expect(result.stdout).toContain(`class="bg-blue-500 px-4 text-white"`)
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
      expect(result.stderr).toContain("⚠️")
      expect(result.stderr).toContain("non-existent-rewriter")
      expect(result.stderr).toContain("not found")
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
      expect(result.stderr).not.toContain("pre-format rewriter")
      expect(result.stderr).not.toContain("post-format rewriter")
      expect(result.stderr).toContain("⚠️  Experimental Preview")
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
      expect(result.stderr).toContain("Using 1 pre-format rewriter: tailwind-class-sorter")
      expect(result.stderr).not.toContain("post-format")
    })
  })
})
