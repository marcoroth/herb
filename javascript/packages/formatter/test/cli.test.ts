import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { spawn } from "child_process"
import { writeFile, unlink, mkdir, rm, readFile } from "fs/promises"
import { join } from "path"

type ExecResult = {
  stdout: string
  stderr: string
  exitCode: number
}

const expectExitCode = (result: ExecResult, expectedCode: number) => {
  if (result.exitCode !== expectedCode) {
    const errorInfo = {
      expectedExitCode: expectedCode,
      actualExitCode: result.exitCode,
      stdout: result.stdout,
      stderr: result.stderr
    }

    expect.fail(`Exit code mismatch:\n${JSON.stringify(errorInfo, null, 2)}`)
  }
}

const execBinary = (args: string[] = [], input?: string): Promise<ExecResult> => {
  return new Promise((resolve) => {
    const child = spawn("node", ["bin/herb-format", ...args], {
      stdio: ["pipe", "pipe", "pipe"]
    })

    let stdout = ""
    let stderr = ""

    const timeout = setTimeout(() => {
      child.kill()
      resolve({ stdout, stderr, exitCode: 1 })
    }, 5000)

    child.stdout.on("data", (data) => {
      stdout += data.toString()
    })

    child.stderr.on("data", (data) => {
      stderr += data.toString()
    })

    child.on("close", (code) => {
      clearTimeout(timeout)
      resolve({ stdout, stderr, exitCode: code || 0 })
    })

    if (input) {
      child.stdin.write(input)
    }

    child.stdin.end()
  })
}

describe("CLI Binary", () => {
  beforeEach(async () => {
    await cleanup()
  })

  afterEach(async () => {
    await cleanup()
  })

  const cleanup = async () => {
    const testFiles = [
      "test-format.html.erb",
      "test-unchanged.html.erb",
      "test-changed.html.erb"
    ]

    for (const file of testFiles) {
      await unlink(file).catch(() => {})
    }

    await rm("test-dir", { recursive: true }).catch(() => {})
  }

  it("should show help when --help flag is provided", async () => {
    const result = await execBinary(["--help"])

    expectExitCode(result, 0)
    expect(result.stdout).toContain("Usage: herb-format")
    expect(result.stdout).toContain("file|directory")
    expect(result.stdout).toContain("Arguments:")
    expect(result.stdout).toContain("Options:")
    expect(result.stdout).toContain("Examples:")
  })

  it("should show help when -h flag is provided", async () => {
    const result = await execBinary(["-h"])

    expectExitCode(result, 0)
    expect(result.stdout).toContain("Usage: herb-format")
    expect(result.stdout).toContain("file|directory")
    expect(result.stdout).toContain("Arguments:")
    expect(result.stdout).toContain("Options:")
    expect(result.stdout).toContain("Examples:")
  })

  it("should show version when --version flag is provided", async () => {
    const result = await execBinary(["--version"])

    expectExitCode(result, 0)
    expect(result.stdout).toContain("Versions:")
    expect(result.stdout).toContain("@herb-tools/formatter@")
  })

  it("should show version when -v flag is provided", async () => {
    const result = await execBinary(["-v"])

    expectExitCode(result, 0)
    expect(result.stdout).toContain("Versions:")
    expect(result.stdout).toContain("@herb-tools/formatter@")
  })

  it("should format HTML/ERB from stdin", async () => {
    const input = '<div class="test"><%= user.name %></div>'
    const result = await execBinary([], input)

    expectExitCode(result, 0)
    expect(result.stdout).toContain('<div class="test">')
    expect(result.stdout).toContain('  <%= user.name %>')
    expect(result.stdout).toContain('</div>')
  })

  it("should format HTML/ERB from file", async () => {
    const testFile = "test-format.html.erb"
    const input = '<div class="container"><%= "Hello" %><p>World</p></div>'

    await writeFile(testFile, input)

    try {
      const result = await execBinary([testFile])

      expectExitCode(result, 0)
      expect(result.stdout).toContain('Formatted: test-format.html.erb')

      const formattedContent = await readFile(testFile, 'utf-8')
      expect(formattedContent).toContain('<div class="container">')
      expect(formattedContent).toContain('  <%= "Hello" %>')
      expect(formattedContent).toContain('  <p>')
      expect(formattedContent).toContain('    World')
      expect(formattedContent).toContain('  </p>')
      expect(formattedContent).toContain('</div>')
    } finally {
      await unlink(testFile).catch(() => {})
    }
  })

  it("should show experimental preview message", async () => {
    const result = await execBinary([])

    expect(result.stdout).toContain("⚠️  Experimental Preview")
    expect(result.stdout).toContain("early development")
    expect(result.stdout).toContain("github.com/marcoroth/herb/issues")
  })

  it("should format empty input from stdin when no args provided", async () => {
    const result = await execBinary([], "")

    expectExitCode(result, 0)
    expect(result.stdout).toContain("⚠️  Experimental Preview")
    expect(result.stdout).toContain("\n\n")
  })

  it("should handle no files found in empty directory", async () => {
    await mkdir("test-empty-dir", { recursive: true })

    try {
      const result = await execBinary(["test-empty-dir"])

      expectExitCode(result, 0)
      expect(result.stdout).toContain("⚠️  Experimental Preview")
      expect(result.stdout).toContain("No files found matching pattern:")
      expect(result.stdout).toContain("test-empty-dir/**/*.html.erb")
    } finally {
      await rm("test-empty-dir", { recursive: true }).catch(() => {})
    }
  })

  it("should only show formatted message when file changes", async () => {
    const testFile = "test-unchanged.html.erb"
    const input = '<div>\n  Already formatted\n</div>'

    await writeFile(testFile, input)

    try {
      const result = await execBinary([testFile])

      expectExitCode(result, 0)
      expect(result.stdout).not.toContain(`Formatted: ${testFile}`)

      const fileContent = await readFile(testFile, 'utf-8')
      expect(fileContent).toBe(input)
    } finally {
      await unlink(testFile).catch(() => {})
    }
  })

  it("should show formatted message when file changes", async () => {
    const testFile = "test-changed.html.erb"
    const input = '<div><p>Unformatted</p></div>'

    await writeFile(testFile, input)

    try {
      const result = await execBinary([testFile])

      expectExitCode(result, 0)
      expect(result.stdout).toContain(`Formatted: ${testFile}`)

      const fileContent = await readFile(testFile, 'utf-8')
      expect(fileContent).not.toBe(input)
    } finally {
      await unlink(testFile).catch(() => {})
    }
  })

  it("should handle directory with no files", async () => {
    await mkdir("test-dir", { recursive: true })

    try {
      const result = await execBinary(["test-dir"])

      expectExitCode(result, 0)
      expect(result.stdout).toContain("No files found matching pattern:")
      expect(result.stdout).toContain("test-dir/**/*.html.erb")
    } finally {
      await rm("test-dir", { recursive: true }).catch(() => {})
    }
  })

  it("should handle directory with files", async () => {
    await mkdir("test-dir", { recursive: true })
    const testFile = join("test-dir", "test.html.erb")
    const input = '<div><p>Test</p></div>'

    await writeFile(testFile, input)

    try {
      const result = await execBinary(["test-dir"])

      expectExitCode(result, 0)
      expect(result.stdout).toContain("Checked 1 file, formatted")
      expect(result.stdout).toContain(`Formatted: ${testFile}`)
    } finally {
      await rm("test-dir", { recursive: true }).catch(() => {})
    }
  })

  it("should use proper singular/plural forms", async () => {
    await mkdir("test-dir", { recursive: true })
    const testFile1 = join("test-dir", "test1.html.erb")
    const testFile2 = join("test-dir", "test2.html.erb")
    const input = '<div><p>Test</p></div>'

    await writeFile(testFile1, input)
    await writeFile(testFile2, input)

    try {
      const result = await execBinary(["test-dir"])

      expectExitCode(result, 0)
      expect(result.stdout).toContain("Checked 2 files, formatted")
      expect(result.stdout).not.toContain("file(s)")
    } finally {
      await rm("test-dir", { recursive: true }).catch(() => {})
    }
  })

  it("should handle non-existent file gracefully", async () => {
    const result = await execBinary(["non-existent-file.html.erb"])

    expectExitCode(result, 1)
    expect(result.stderr).toContain("Error: Cannot access 'non-existent-file.html.erb'")
  })

  it("should show --check option in help", async () => {
    const result = await execBinary(["--help"])

    expectExitCode(result, 0)
    expect(result.stdout).toContain("--check")
    expect(result.stdout).toContain("check if files are formatted")
    expect(result.stdout).toContain("herb-format --check")
  })

  it("should reject --check with stdin", async () => {
    const result = await execBinary(["--check"], "<div>test</div>")

    expectExitCode(result, 1)
    expect(result.stderr).toContain("Error: --check mode is not supported with stdin")
  })

  it("should reject -c with stdin", async () => {
    const result = await execBinary(["-c"], "<div>test</div>")

    expectExitCode(result, 1)
    expect(result.stderr).toContain("Error: --check mode is not supported with stdin")
  })

  it("should pass --check when file is already formatted", async () => {
    const testFile = "test-formatted.html.erb"
    const input = '<div>\n  <p>\n    Already formatted\n  </p>\n</div>'

    await writeFile(testFile, input)

    try {
      const result = await execBinary(["--check", testFile])

      expectExitCode(result, 0)
      expect(result.stdout).toContain("File is properly formatted")
    } finally {
      await unlink(testFile).catch(() => {})
    }
  })

  it("should fail --check when file is not formatted", async () => {
    const testFile = "test-unformatted.html.erb"
    const input = '<div><p>Not formatted</p></div>'

    await writeFile(testFile, input)

    try {
      const result = await execBinary(["--check", testFile])

      expectExitCode(result, 1)
      expect(result.stdout).toContain("File is not formatted")
    } finally {
      await unlink(testFile).catch(() => {})
    }
  })

  it("should handle --check with directory containing mixed files", async () => {
    await mkdir("test-dir", { recursive: true })
    const formattedFile = join("test-dir", "formatted.html.erb")
    const unformattedFile = join("test-dir", "unformatted.html.erb")

    await writeFile(formattedFile, '<div>\n  <p>\n    Formatted\n  </p>\n</div>')
    await writeFile(unformattedFile, '<div><p>Unformatted</p></div>')

    try {
      const result = await execBinary(["--check", "test-dir"])

      expectExitCode(result, 1)
      expect(result.stdout).toContain("The following")
      expect(result.stdout).toContain("not formatted")
      expect(result.stdout).toContain("unformatted.html.erb")
      expect(result.stdout).toContain("Checked 2 files, found 1 unformatted file")
    } finally {
      await rm("test-dir", { recursive: true }).catch(() => {})
    }
  })

  it("CLI output should end with trailing newline", async () => {
    const input = '<div>Hello</div>'
    const result = await execBinary([], input)

    expectExitCode(result, 0)
    expect(result.stdout.endsWith('\n')).toBe(true)
    expect(result.stdout).toContain("⚠️  Experimental Preview")
    expect(result.stdout).toContain('<div>\n  Hello\n</div>')

    const lines = result.stdout.split('\n')
    const formattedLines = lines.slice(2) // Skip experimental preview lines
    expect(formattedLines.join('\n')).toBe('<div>\n  Hello\n</div>\n')
  })

  it("CLI should preserve existing trailing newline", async () => {
    const input = '<div>Hello</div>\n'
    const result = await execBinary([], input)

    expectExitCode(result, 0)
    expect(result.stdout.endsWith('\n')).toBe(true)
    expect(result.stdout).toContain("⚠️  Experimental Preview")
    expect(result.stdout).toContain('<div>\n  Hello\n</div>')

    const lines = result.stdout.split('\n')
    const formattedLines = lines.slice(2) // Skip experimental preview lines
    expect(formattedLines.join('\n')).toBe('<div>\n  Hello\n</div>\n')
  })

  it("CLI should add trailing newline to empty input", async () => {
    const input = ''
    const result = await execBinary([], input)

    expectExitCode(result, 0)
    expect(result.stdout).toContain("⚠️  Experimental Preview")

    const lines = result.stdout.split('\n')
    const formattedLines = lines.slice(2) // Skip experimental preview lines
    expect(formattedLines.join('\n')).toBe('\n')
  })
})
