import dedent from "dedent"
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
    expect(result.stdout).toContain("@herb-tools/printer@")
  })

  it("should show version when -v flag is provided", async () => {
    const result = await execBinary(["-v"])

    expectExitCode(result, 0)
    expect(result.stdout).toContain("Versions:")
    expect(result.stdout).toContain("@herb-tools/formatter@")
    expect(result.stdout).toContain("@herb-tools/printer@")
  })

  it("should format HTML/ERB from stdin", async () => {
    const input = '<div class="test"><div><%= user.name %></div></div>'
    const result = await execBinary([], input)

    expectExitCode(result, 0)
    expect(result.stdout).toContain('<div class="test">')
    expect(result.stdout).toContain('  <div><%= user.name %></div>')
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
      expect(formattedContent).toBe(dedent`
        <div class="container">
          <%= "Hello" %>
          <p>World</p>
        </div>
      ` + '\n')
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
    const input = '<div>Already formatted</div>\n'

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
    const input = '<div><p>   Unformatted   </p></div>'

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
    const input = '<div><p>   Test   </p></div>'

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
    const input = '<div>\n  <p>Already formatted</p>\n</div>\n'

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
    const input = '<div><p>   Not formatted   </p></div>'

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

    await writeFile(formattedFile, '<div>\n  <p>Formatted</p>\n</div>\n')
    await writeFile(unformattedFile, '<div><p>   Unformatted   </p></div>')

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
    expect(result.stdout).toContain('<div>Hello</div>')

    const lines = result.stdout.split('\n')
    const formattedLines = lines.slice(2) // Skip experimental preview lines
    expect(formattedLines.join('\n')).toBe('<div>Hello</div>\n')
  })

  it("CLI should preserve existing trailing newline", async () => {
    const input = '<div>Hello</div>\n'
    const result = await execBinary([], input)

    expectExitCode(result, 0)
    expect(result.stdout.endsWith('\n')).toBe(true)
    expect(result.stdout).toContain("⚠️  Experimental Preview")
    expect(result.stdout).toContain('<div>Hello</div>')

    const lines = result.stdout.split('\n')
    const formattedLines = lines.slice(2) // Skip experimental preview lines
    expect(formattedLines.join('\n')).toBe('<div>Hello</div>\n')
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

  describe("Glob Pattern Support", () => {
    beforeEach(async () => {
      await mkdir("test-fixtures", { recursive: true })
      await mkdir("test-fixtures/nested", { recursive: true })
    })

    afterEach(async () => {
      await rm("test-fixtures", { recursive: true }).catch(() => {})
    })

    it("should format single .xml.erb file", async () => {
      const content = '<?xml version="1.0"?>\n<root><% if true %><item/><% end %></root>'
      const expectedContent = dedent`
        <?xml version="1.0"?>

        <root>
          <% if true %>
            <item />
          <% end %>
        </root>
      `

      await writeFile("test-fixtures/test.xml.erb", content)
      const result = await execBinary(["test-fixtures/test.xml.erb"])

      expectExitCode(result, 0)
      expect(result.stdout).toContain("Formatted: test-fixtures/test.xml.erb")

      const actualContent = await readFile("test-fixtures/test.xml.erb", "utf-8")
      expect(actualContent.trim()).toBe(expectedContent)
    })

    it("should handle glob pattern for .xml.erb files", async () => {
      const content1 = '<?xml version="1.0"?><root><item/></root>'
      const content2 = '<?xml version="1.0"?><config><setting/></config>'

      await writeFile("test-fixtures/file1.xml.erb", content1)
      await writeFile("test-fixtures/file2.xml.erb", content2)
      await writeFile("test-fixtures/ignored.html.erb", "<div></div>")

      const result = await execBinary(["test-fixtures/*.xml.erb"])

      expectExitCode(result, 0)
      expect(result.stdout).toContain("Formatted: test-fixtures/file1.xml.erb")
      expect(result.stdout).toContain("Formatted: test-fixtures/file2.xml.erb")
      expect(result.stdout).not.toContain("ignored.html.erb")
      expect(result.stdout).toContain("Checked 2 files, formatted 2 files")
    })

    it("should handle recursive glob pattern", async () => {
      const content = '<?xml version="1.0"?><root><item/></root>'

      await writeFile("test-fixtures/top.xml.erb", content)
      await writeFile("test-fixtures/nested/deep.xml.erb", content)

      const result = await execBinary(["test-fixtures/**/*.xml.erb"])

      expectExitCode(result, 0)
      expect(result.stdout).toContain("Formatted: test-fixtures/top.xml.erb")
      expect(result.stdout).toContain("Formatted: test-fixtures/nested/deep.xml.erb")
      expect(result.stdout).toContain("Checked 2 files, formatted 2 files")
    })

    it("should handle mixed file extensions with glob", async () => {
      const xmlContent = '<?xml version="1.0"?><root><item/></root>'
      const htmlContent = '<div><p></p></div>'

      await writeFile("test-fixtures/file.xml.erb", xmlContent)
      await writeFile("test-fixtures/file.html.erb", htmlContent)

      const result = await execBinary(["test-fixtures/*.erb"])

      expectExitCode(result, 0)
      expect(result.stdout).toContain("Formatted: test-fixtures/file.xml.erb")
      expect(result.stdout).toContain("Formatted: test-fixtures/file.html.erb")
      expect(result.stdout).toContain("Checked 2 files, formatted 2 files")
    })

    it("should handle glob with --check mode", async () => {
      const wellFormattedContent = dedent`
        <?xml version="1.0"?>

        <root>
          <% if true %>
            <item />
          <% end %>
        </root>
      `
      const poorlyFormattedContent = '<?xml version="1.0"?><root><% if true %><item/><% end %></root>'

      await writeFile("test-fixtures/good.xml.erb", wellFormattedContent + '\n')
      await writeFile("test-fixtures/bad.xml.erb", poorlyFormattedContent)

      const result = await execBinary(["--check", "test-fixtures/*.xml.erb"])

      expectExitCode(result, 1)
      expect(result.stdout).toContain("The following")
      expect(result.stdout).toContain("not formatted")
      expect(result.stdout).toContain("bad.xml.erb")
      expect(result.stdout).not.toContain("good.xml.erb")
      expect(result.stdout).toContain("Checked 2 files, found 1 unformatted file")
    })

    it("should handle no files matching glob pattern", async () => {
      const result = await execBinary(["test-fixtures/*.nonexistent"])

      expectExitCode(result, 0)
      expect(result.stdout).toContain("No files found matching pattern")
      expect(result.stdout).toContain("test-fixtures/*.nonexistent")
    })

    it("should error for non-existent specific file", async () => {
      const result = await execBinary(["test-fixtures/nonexistent.xml.erb"])

      expectExitCode(result, 1)
      expect(result.stderr).toContain("Error: Cannot access 'test-fixtures/nonexistent.xml.erb'")
    })

    it("should handle relative path glob patterns", async () => {
      const content = '<?xml version="1.0"?><root><item/></root>'

      await writeFile("test-fixtures/test.xml.erb", content)

      const result = await execBinary(["./test-fixtures/*.xml.erb"])

      expectExitCode(result, 0)
      expect(result.stdout).toContain("Formatted: test-fixtures/test.xml.erb")
      expect(result.stdout).toContain("Checked 1 file, formatted 1 file")
    })
  })

  describe("Advanced CLI Patterns", () => {
    beforeEach(async () => {
      await mkdir("test-advanced", { recursive: true })
      await mkdir("test-advanced/sub1", { recursive: true })
      await mkdir("test-advanced/sub2", { recursive: true })
    })

    afterEach(async () => {
      await rm("test-advanced", { recursive: true }).catch(() => {})
    })

    it("should handle complex nested glob patterns", async () => {
      const content = '<?xml version="1.0"?><root><item/></root>'

      await writeFile("test-advanced/root.xml.erb", content)
      await writeFile("test-advanced/sub1/file1.xml.erb", content)
      await writeFile("test-advanced/sub1/file2.xml.erb", content)
      await writeFile("test-advanced/sub2/file3.xml.erb", content)
      await writeFile("test-advanced/sub2/ignore.html.erb", "<div></div>")

      const result = await execBinary(["test-advanced/**/file*.xml.erb"])

      expectExitCode(result, 0)
      expect(result.stdout).toContain("Formatted: test-advanced/sub1/file1.xml.erb")
      expect(result.stdout).toContain("Formatted: test-advanced/sub1/file2.xml.erb")
      expect(result.stdout).toContain("Formatted: test-advanced/sub2/file3.xml.erb")
      expect(result.stdout).not.toContain("root.xml.erb")
      expect(result.stdout).not.toContain("ignore.html.erb")
      expect(result.stdout).toContain("Checked 3 files, formatted 3 files")
    })

    it("should handle brace expansion patterns", async () => {
      const content = '<?xml version="1.0"?><root><item/></root>'

      await writeFile("test-advanced/config.xml.erb", content)
      await writeFile("test-advanced/manifest.xml.erb", content)
      await writeFile("test-advanced/other.erb", content)

      const result = await execBinary(["test-advanced/{config,manifest}.xml.erb"])

      expectExitCode(result, 0)
      expect(result.stdout).toContain("Formatted: test-advanced/config.xml.erb")
      expect(result.stdout).toContain("Formatted: test-advanced/manifest.xml.erb")
      expect(result.stdout).not.toContain("other.erb")
      expect(result.stdout).toContain("Checked 2 files, formatted 2 files")
    })

    it("should handle directory argument with mixed file types", async () => {
      const xmlContent = '<?xml version="1.0"?><root><item/></root>'
      const htmlContent = '<div><p></p></div>'

      await writeFile("test-advanced/file.xml.erb", xmlContent)
      await writeFile("test-advanced/page.html.erb", htmlContent)
      await writeFile("test-advanced/readme.txt", "plain text")

      const result = await execBinary(["test-advanced/"])

      expectExitCode(result, 0)
      expect(result.stdout).toContain("Formatted: test-advanced/page.html.erb")
      expect(result.stdout).not.toContain("file.xml.erb") // Only .html.erb by default for directories
      expect(result.stdout).not.toContain("readme.txt")
      expect(result.stdout).toContain("Checked 1 file, formatted 1 file")
    })

    it("should handle empty directory gracefully", async () => {
      const result = await execBinary(["test-advanced/"])

      expectExitCode(result, 0)
      expect(result.stdout).toContain("No files found matching pattern")
      expect(result.stdout).toContain("test-advanced/**/*.html.erb")
    })

    it("should handle mixed file arguments", async () => {
      const xmlContent = '<?xml version="1.0"?><root><item/></root>'
      const htmlContent = '<div><p></p></div>'

      await writeFile("test-advanced/specific.xml.erb", xmlContent)
      await writeFile("test-advanced/another.html.erb", htmlContent)

      const result1 = await execBinary(["test-advanced/specific.xml.erb"])
      expectExitCode(result1, 0)
      expect(result1.stdout).toContain("Formatted: test-advanced/specific.xml.erb")

      const result2 = await execBinary(["test-advanced/another.html.erb"])
      expectExitCode(result2, 0)
      expect(result2.stdout).toContain("Formatted: test-advanced/another.html.erb")
    })

    it("should preserve glob patterns in error messages", async () => {
      const result = await execBinary(["test-advanced/non-existent-*.xml.erb"])

      expectExitCode(result, 0)
      expect(result.stdout).toContain("No files found matching pattern")
      expect(result.stdout).toContain("test-advanced/non-existent-*.xml.erb")
    })

    it("should handle check mode with complex patterns", async () => {
      const formattedContent = dedent`
        <?xml version="1.0"?>

        <root>
          <item />
        </root>
      `
      const unformattedContent = '<?xml version="1.0"?><root><item/></root>'

      await writeFile("test-advanced/good1.xml.erb", formattedContent + '\n')
      await writeFile("test-advanced/good2.xml.erb", formattedContent + '\n')
      await writeFile("test-advanced/sub1/bad.xml.erb", unformattedContent)

      const result = await execBinary(["--check", "test-advanced/**/*.xml.erb"])

      expectExitCode(result, 1)
      expect(result.stdout).toContain("The following")
      expect(result.stdout).toContain("not formatted")
      expect(result.stdout).toContain("bad.xml.erb")
      expect(result.stdout).not.toContain("good1.xml.erb")
      expect(result.stdout).not.toContain("good2.xml.erb")
      expect(result.stdout).toContain("Checked 3 files, found 1 unformatted file")
    })
  })
})
