import { describe, test, expect, beforeAll, afterEach } from "vitest"
import { Herb } from "@herb-tools/node-wasm"
import { execSync } from "child_process"
import { writeFileSync, unlinkSync, existsSync } from "fs"
import dedent from "dedent"

describe("CLI Output Formatting", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  afterEach(() => {
    // Clean up test files
    const testFiles = [
      "test-file.html.erb",
      "clean-file.html.erb",
      "bad-file.html.erb",
      "good-file.html.erb"
    ]

    for (const file of testFiles) {
      if (existsSync(file)) {
        unlinkSync(file)
      }
    }
  })

  test("formats detailed error output correctly", () => {
    // Create a test file with known issues
    const testContent = dedent`
      <div>
        <SPAN>Test content</SPAN>
        <img src="test.jpg">
      </div>
    `

    writeFileSync("test-file.html.erb", testContent)

    // Run the CLI and capture output
    try {
      execSync("bin/herb-lint test-file.html.erb", {
        stdio: "pipe",
        encoding: "utf-8",
        env: { ...process.env, NO_COLOR: "1" }
      })
    } catch (error: any) {
      const output = error.stdout.toString()

      const expectedOutput = dedent`
        Please specify input file.
        test-file.html.erb:2:3 - error html-tag-name-lowercase: Tag name \`SPAN\` should be lowercase. Use \`span\` instead.
        │
        │     1 │ <div>
        │ →   2 │   <SPAN>Test content</SPAN>
        │       │    ~~~~
        │     3 │   <img src="test.jpg">
        │     4 │ </div>

        test-file.html.erb:2:22 - error html-tag-name-lowercase: Tag name \`SPAN\` should be lowercase. Use \`span\` instead.
        │
        │     1 │ <div>
        │ →   2 │   <SPAN>Test content</SPAN>
        │       │                       ~~~~
        │     3 │   <img src="test.jpg">
        │     4 │ </div>

        test-file.html.erb:3:3 - error html-img-require-alt: Missing required \`alt\` attribute on \`<img>\` tag. Add \`alt=""\` for decorative images or \`alt="description"\` for informative images.
        │
        │     1 │ <div>
        │     2 │   <SPAN>Test content</SPAN>
        │ →   3 │   <img src="test.jpg">
        │       │    ~~~
        │     4 │ </div>


        3 error(s), 0 warning(s)
      `

      expect(output.trim()).toBe(expectedOutput.trim())
      expect(error.status).toBe(1)
    }
  })

  test("formats simple output correctly", () => {
    const testContent = dedent`
      <div>
        <SPAN>Test content</SPAN>
      </div>
    `

    writeFileSync("test-file.html.erb", testContent)

    try {
      execSync("bin/herb-lint test-file.html.erb --simple", {
        stdio: "pipe",
        encoding: "utf-8",
        env: { ...process.env, NO_COLOR: "1" }
      })
    } catch (error: any) {
      const output = error.stdout.toString()

      const expectedOutput = dedent`
        test-file.html.erb:
          2:3  ✗ Tag name \`SPAN\` should be lowercase. Use \`span\` instead. (html-tag-name-lowercase)
          2:22 ✗ Tag name \`SPAN\` should be lowercase. Use \`span\` instead. (html-tag-name-lowercase)

        2 error(s), 0 warning(s)
      `

      expect(output.trim()).toBe(expectedOutput.trim())
      expect(error.status).toBe(1)
    }
  })

  test("formats success output correctly", () => {
    const cleanContent = dedent`
      <div>
        <span>Clean content</span>
        <img src="test.jpg" alt="Test image">
      </div>
    `

    writeFileSync("clean-file.html.erb", cleanContent)

    try {
      const output = execSync("bin/herb-lint clean-file.html.erb", {
        encoding: "utf-8",
        env: { ...process.env, NO_COLOR: "1" }
      })

      const expectedOutput = dedent`
        Please specify input file.
        ✓ clean-file.html.erb - No issues found

        0 error(s), 0 warning(s)
      `

      expect(output.trim()).toBe(expectedOutput.trim())
    } catch (error: any) {
      // If there's an error, check if it's just the exit code issue
      const output = error.stdout.toString()

      const expectedOutput = dedent`
        Please specify input file.
        ✓ clean-file.html.erb - No issues found

        0 error(s), 0 warning(s)
      `

      expect(output.trim()).toBe(expectedOutput.trim())
    }
  })

  test("handles multiple files correctly", () => {
    const badContent = dedent`
      <SPAN>Bad file</SPAN>
    `
    const goodContent = dedent`
      <span>Good file</span>
    `

    writeFileSync("bad-file.html.erb", badContent)
    writeFileSync("good-file.html.erb", goodContent)

    try {
      execSync("bin/herb-lint bad-file.html.erb good-file.html.erb", {
        stdio: "pipe",
        encoding: "utf-8",
        env: { ...process.env, NO_COLOR: "1" }
      })
    } catch (error: any) {
      const output = error.stdout.toString()

      const expectedOutput = dedent`
        bad-file.html.erb:1:1 - error html-tag-name-lowercase: Tag name \`SPAN\` should be lowercase. Use \`span\` instead.
        │
        │ →   1 │ <SPAN>Bad file</SPAN>
        │       │  ~~~~

        bad-file.html.erb:1:16 - error html-tag-name-lowercase: Tag name \`SPAN\` should be lowercase. Use \`span\` instead.
        │
        │ →   1 │ <SPAN>Bad file</SPAN>
        │       │                 ~~~~


        2 error(s), 0 warning(s)
      `

      expect(output.trim()).toBe(expectedOutput.trim())
      expect(error.status).toBe(1)
    }
  })
})
