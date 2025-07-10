import { describe, it, expect } from "vitest"
import { spawn } from "child_process"
import { writeFile, unlink } from "fs/promises"

const execBinary = (args: string[] = [], input?: string): Promise<{stdout: string, stderr: string, exitCode: number}> => {
  return new Promise((resolve) => {
    const child = spawn("node", ["bin/herb-formatter", ...args], {
      stdio: ["pipe", "pipe", "pipe"]
    })

    let stdout = ""
    let stderr = ""

    child.stdout.on("data", (data) => {
      stdout += data.toString()
    })

    child.stderr.on("data", (data) => {
      stderr += data.toString()
    })

    child.on("close", (code) => {
      resolve({ stdout, stderr, exitCode: code || 0 })
    })

    if (input) {
      child.stdin.write(input)
    }

    child.stdin.end()
  })
}

describe("CLI Binary", () => {
  it("should show help when --help flag is provided", async () => {
    const result = await execBinary(["--help"])

    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain("Usage: herb-formatter")
    expect(result.stdout).toContain("Arguments:")
    expect(result.stdout).toContain("Options:")
  })

  it("should show help when -h flag is provided", async () => {
    const result = await execBinary(["-h"])

    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain("Usage: herb-formatter")
    expect(result.stdout).toContain("Arguments:")
    expect(result.stdout).toContain("Options:")
  })

  it.skip("should show version when --version flag is provided", async () => {
    const result = await execBinary(["--version"])

    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain("Versions:")
    expect(result.stdout).toContain("@herb-tools/formatter@")
  })

  it.skip("should show version when -v flag is provided", async () => {
    const result = await execBinary(["-v"])

    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain("Versions:")
    expect(result.stdout).toContain("@herb-tools/formatter@")
  })

  it.skip("should format HTML/ERB from stdin", async () => {
    const input = '<div class="test"><%= user.name %></div>'
    const result = await execBinary([], input)

    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain('<div class="test">')
    expect(result.stdout).toContain('  <%= user.name %>')
    expect(result.stdout).toContain('</div>')
  })

  it.skip("should format HTML/ERB from file", async () => {
    const testFile = "test-format.html.erb"
    const input = '<div class="container"><%= "Hello" %><p>World</p></div>'

    await writeFile(testFile, input)

    try {
      const result = await execBinary([testFile])

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('<div class="container">')
      expect(result.stdout).toContain('  <%= "Hello" %>')
      expect(result.stdout).toContain('  <p>')
      expect(result.stdout).toContain('    World')
      expect(result.stdout).toContain('  </p>')
      expect(result.stdout).toContain('</div>')
    } finally {
      await unlink(testFile).catch(() => {})
    }
  })
})
