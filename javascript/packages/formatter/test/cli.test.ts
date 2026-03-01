import dedent from "dedent"
import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { writeFile, unlink, mkdir, rm, readFile } from "fs/promises"
import { join } from "path"

import { execBinary, expectExitCode } from "./cli/cli-helpers"

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
    expect(result.stdout).toContain("files|directories|glob-patterns")
    expect(result.stdout).toContain("Arguments:")
    expect(result.stdout).toContain("Options:")
    expect(result.stdout).toContain("Examples:")
  })

  it("should show help when -h flag is provided", async () => {
    const result = await execBinary(["-h"])

    expectExitCode(result, 0)
    expect(result.stdout).toContain("Usage: herb-format")
    expect(result.stdout).toContain("files|directories|glob-patterns")
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

  it("should show experimental preview message on stderr", async () => {
    const result = await execBinary([])

    expect(result.stderr).toContain("⚠️  Experimental Preview")
    expect(result.stderr).toContain("early development")
    expect(result.stderr).toContain("github.com/marcoroth/herb/issues")
  })

  it("should not include experimental preview message in stdout", async () => {
    const input = '<div>test</div>'
    const result = await execBinary([], input)

    expectExitCode(result, 0)
    expect(result.stdout).not.toContain("⚠️  Experimental Preview")
    expect(result.stdout).toContain('<div>test</div>')
  })

  it("stdout should contain only formatted output without warnings", async () => {
    const input = '<div class="test"><p>Hello</p></div>'
    const result = await execBinary([], input)

    expectExitCode(result, 0)

    expect(result.stderr).toContain("⚠️  Experimental Preview")
    expect(result.stdout).not.toContain("⚠️")
    expect(result.stdout).not.toContain("Experimental")
    expect(result.stdout).toBe('<div class="test">\n  <p>Hello</p>\n</div>\n')
  })

  it("should format empty input from stdin when no args provided", async () => {
    const result = await execBinary([], "")

    expectExitCode(result, 0)
    expect(result.stderr).toContain("⚠️  Experimental Preview")
    expect(result.stdout).toBe("\n")
  })

  it("should handle no files found in empty directory", async () => {
    await mkdir("test-empty-dir", { recursive: true })

    try {
      const result = await execBinary(["test-empty-dir"])

      expectExitCode(result, 0)
      expect(result.stderr).toContain("⚠️  Experimental Preview")
      expect(result.stdout).toContain("No files found matching pattern")
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
      expect(result.stdout).toContain("No files found matching pattern")
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
      expect(result.stdout).toContain("all files are properly formatted")
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
      expect(result.stdout).toContain("not formatted")
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
    expect(result.stderr).toContain("⚠️  Experimental Preview")
    expect(result.stdout).toBe('<div>Hello</div>\n')
  })

  it("CLI should preserve existing trailing newline", async () => {
    const input = '<div>Hello</div>\n'
    const result = await execBinary([], input)

    expectExitCode(result, 0)
    expect(result.stdout.endsWith('\n')).toBe(true)
    expect(result.stderr).toContain("⚠️  Experimental Preview")
    expect(result.stdout).toBe('<div>Hello</div>\n')
  })

  it("CLI should add trailing newline to empty input", async () => {
    const input = ''
    const result = await execBinary([], input)

    expectExitCode(result, 0)
    expect(result.stderr).toContain("⚠️  Experimental Preview")
    expect(result.stdout).toBe('\n')
  })

  it("should show --indent-width option in help", async () => {
    const result = await execBinary(["--help"])

    expectExitCode(result, 0)
    expect(result.stdout).toContain("herb-format --indent-width")
    expect(result.stdout).toContain("number of spaces per indentation level")
  })

  it("should accept valid --indent-width", async () => {
    const input = '<div>\n<p>Test</p>\n</div>'
    const result = await execBinary(["--indent-width", "4"], input)

    expectExitCode(result, 0)
    expect(result.stdout).toContain("    <p>Test</p>") // 4 spaces instead of 2
  })

  it("should show --max-line-length option in help", async () => {
    const result = await execBinary(["--help"])

    expectExitCode(result, 0)
    expect(result.stdout).toContain("herb-format --max-line-length")
    expect(result.stdout).toContain("maximum line length before wrapping")
  })

  it("should accept valid --max-line-length", async () => {
    const input = '<p>Short text that wraps</p>'
    const result = await execBinary(["--max-line-length", "20"], input)

    expectExitCode(result, 0)
    expect(result.stdout).toContain("Short text that")
    expect(result.stdout).toContain("wraps")
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

  describe("Multiple File Arguments", () => {
    beforeEach(async () => {
      await mkdir("test-multi", { recursive: true })
    })

    afterEach(async () => {
      await rm("test-multi", { recursive: true }).catch(() => {})
    })

    it("should format multiple files successfully", async () => {
      const unformattedContent = '<div><p>Test</p></div>'

      await writeFile("test-multi/file1.html.erb", unformattedContent)
      await writeFile("test-multi/file2.html.erb", unformattedContent)

      const result = await execBinary(["test-multi/file1.html.erb", "test-multi/file2.html.erb"])

      expectExitCode(result, 0)
      expect(result.stdout).toContain("Formatted: test-multi/file1.html.erb")
      expect(result.stdout).toContain("Formatted: test-multi/file2.html.erb")
      expect(result.stdout).toContain("Checked 2 files, formatted 2 files")
    })

    it("should handle multiple files with mixed formatting states", async () => {
      const formattedContent = '<div>\n  <p>Test</p>\n</div>\n'
      const unformattedContent = '<div><p>Test</p></div>'

      await writeFile("test-multi/formatted.html.erb", formattedContent)
      await writeFile("test-multi/unformatted.html.erb", unformattedContent)

      const result = await execBinary(["test-multi/formatted.html.erb", "test-multi/unformatted.html.erb"])

      expectExitCode(result, 0)
      expect(result.stdout).not.toContain("Formatted: test-multi/formatted.html.erb")
      expect(result.stdout).toContain("Formatted: test-multi/unformatted.html.erb")
      expect(result.stdout).toContain("Checked 2 files, formatted 1 file")
    })

    it("should exit with error if one file doesn't exist", async () => {
      const content = '<div><p>Test</p></div>'
      await writeFile("test-multi/exists.html.erb", content)

      const result = await execBinary(["test-multi/exists.html.erb", "test-multi/nonexistent.html.erb"])

      expectExitCode(result, 1)
      expect(result.stderr).toContain("Cannot access")
      expect(result.stderr).toContain("nonexistent.html.erb")
    })

    it("should deduplicate files passed multiple times", async () => {
      const unformattedContent = '<div><p>Test</p></div>'
      await writeFile("test-multi/duplicate.html.erb", unformattedContent)

      const result = await execBinary(["test-multi/duplicate.html.erb", "test-multi/duplicate.html.erb"])

      expectExitCode(result, 0)
      // Should only format once
      expect(result.stdout).toContain("Checked 1 file, formatted 1 file")
    })

    it("should handle --check with multiple files", async () => {
      const formattedContent = '<div>\n  <p>Test</p>\n</div>\n'
      const unformattedContent = '<div><p>Test</p></div>'

      await writeFile("test-multi/file1.html.erb", formattedContent)
      await writeFile("test-multi/file2.html.erb", unformattedContent)

      const result = await execBinary(["--check", "test-multi/file1.html.erb", "test-multi/file2.html.erb"])

      expectExitCode(result, 1)
      expect(result.stdout).toContain("The following")
      expect(result.stdout).toContain("not formatted")
      expect(result.stdout).toContain("file2.html.erb")
      expect(result.stdout).not.toContain("file1.html.erb")
      expect(result.stdout).toContain("Checked 2 files, found 1 unformatted file")
    })

    it("should reject stdin mixed with file arguments", async () => {
      const content = '<div><p>Test</p></div>'
      await writeFile("test-multi/file.html.erb", content)

      const result = await execBinary(["-", "test-multi/file.html.erb"])

      expectExitCode(result, 1)
      expect(result.stderr).toContain("Cannot mix stdin ('-') with file arguments")
    })

    it("should handle mix of files and globs", async () => {
      const unformattedContent = '<div><p>Test</p></div>'

      await writeFile("test-multi/specific.html.erb", unformattedContent)
      await writeFile("test-multi/pattern1.xml.erb", '<?xml version="1.0"?><root></root>')
      await writeFile("test-multi/pattern2.xml.erb", '<?xml version="1.0"?><config></config>')

      const result = await execBinary(["test-multi/specific.html.erb", "test-multi/*.xml.erb"])

      expectExitCode(result, 0)
      expect(result.stdout).toContain("Formatted: test-multi/specific.html.erb")
      expect(result.stdout).toContain("Formatted: test-multi/pattern1.xml.erb")
      expect(result.stdout).toContain("Formatted: test-multi/pattern2.xml.erb")
      expect(result.stdout).toContain("Checked 3 files, formatted 3 files")
    })
  })

  describe("Config Auto-Discovery", () => {
    const configContent = dedent`
      files:
        include:
          - "**/*.html.erb"

      formatter:
        enabled: true
        indentWidth: 4
        maxLineLength: 120
    `

    beforeEach(async () => {
      await mkdir("test-config-discovery", { recursive: true })
      await mkdir("test-config-discovery/subdir", { recursive: true })
      await writeFile("test-config-discovery/.herb.yml", configContent)
    })

    afterEach(async () => {
      await rm("test-config-discovery", { recursive: true }).catch(() => {})
    })

    it("should auto-discover config file in current directory", async () => {
      const testFile = "test-config-discovery/test.html.erb"
      const input = '<div><p>Test</p></div>'

      await writeFile(testFile, input)

      const result = await execBinary([testFile])

      expectExitCode(result, 0)
      expect(result.stderr).toContain("Using Herb config file at")
      expect(result.stderr).toContain(".herb.yml")

      const formatted = await readFile(testFile, 'utf-8')
      expect(formatted).toContain('    <p>Test</p>')
      expect(formatted).not.toMatch(/^\s{2}<p>/m)
    })

    it("should auto-discover config file from subdirectory", async () => {
      const testFile = "test-config-discovery/subdir/nested.html.erb"
      const input = '<div><p>Nested</p></div>'

      await writeFile(testFile, input)

      const result = await execBinary([testFile])

      expectExitCode(result, 0)
      expect(result.stderr).toContain("Using Herb config file at")
      expect(result.stderr).toContain(".herb.yml")

      const formatted = await readFile(testFile, 'utf-8')
      expect(formatted).toContain('    <p>Nested</p>')
    })

    it("should use config maxLineLength setting", async () => {
      const testFile = "test-config-discovery/long-line.html.erb"
      const input = '<div class="container"><p>This is a pretty long line of text that is exactly one hundred and fifteen characters long</p></div>'

      await writeFile(testFile, input)

      const result = await execBinary([testFile])

      expectExitCode(result, 0)

      const formatted = await readFile(testFile, 'utf-8')
      expect(formatted).toContain('This is a pretty long line')
    })

    it("should override config with CLI flags", async () => {
      const testFile = "test-config-discovery/override.html.erb"
      const input = '<div><p>Test</p></div>'

      await writeFile(testFile, input)

      const result = await execBinary([testFile, '--indent-width', '2'])

      expectExitCode(result, 0)

      const formatted = await readFile(testFile, 'utf-8')
      expect(formatted).toContain('  <p>Test</p>')
      expect(formatted).not.toMatch(/^\s{4}<p>/m)
    })

    it("should work without config file (use defaults)", async () => {
      await mkdir("test-no-config", { recursive: true })
      const testFile = "test-no-config/test.html.erb"
      const input = '<div><p>Test</p></div>'

      await writeFile(testFile, input)

      const result = await execBinary([testFile])

      expectExitCode(result, 0)
      expect(result.stderr).not.toContain("Using Herb config file")

      const formatted = await readFile(testFile, 'utf-8')
      expect(formatted).toContain('  <p>Test</p>')

      await rm("test-no-config", { recursive: true })
    })

    it("should honor explicit --config-file flag", async () => {
      await mkdir("test-explicit-config", { recursive: true })

      const altConfigContent = dedent`
        files:
          include:
            - "**/*.html.erb"

        formatter:
          enabled: true
          indentWidth: 8
      `

      await writeFile("test-explicit-config/.herb.yml", altConfigContent)

      const testFile = "test-explicit-config/explicit.html.erb"
      const input = '<div><p>Test</p></div>'

      await writeFile(testFile, input)

      const result = await execBinary([testFile, '--config-file', 'test-explicit-config/.herb.yml'])

      expectExitCode(result, 0)
      expect(result.stderr).toContain("Using Herb config file")

      const formatted = await readFile(testFile, 'utf-8')
      expect(formatted).toContain('        <p>Test</p>')

      await rm("test-explicit-config", { recursive: true })
    })

    it("should format multiple files with config from project root", async () => {
      const file1 = "test-config-discovery/file1.html.erb"
      const file2 = "test-config-discovery/subdir/file2.html.erb"
      const input = '<div><p>Test</p></div>'

      await writeFile(file1, input)
      await writeFile(file2, input)

      const result = await execBinary([file1, file2])

      expectExitCode(result, 0)
      expect(result.stderr).toContain("Using Herb config file")
      expect(result.stdout).toContain("Checked 2 files, formatted 2 files")

      const formatted1 = await readFile(file1, 'utf-8')
      const formatted2 = await readFile(file2, 'utf-8')

      expect(formatted1).toContain('    <p>Test</p>')
      expect(formatted2).toContain('    <p>Test</p>')
    })
  })

  describe("Config Auto-Discovery Regression Tests (Issue #1177)", () => {
    const configContent = dedent`
      files:
        include:
          - "**/*.html.erb"

      formatter:
        enabled: true
        indentWidth: 3
        maxLineLength: 100
    `

    beforeEach(async () => {
      await mkdir("test-issue-1177", { recursive: true })
      await mkdir("test-issue-1177/deep/nested/path", { recursive: true })
      await writeFile("test-issue-1177/.herb.yml", configContent)
    })

    afterEach(async () => {
      await rm("test-issue-1177", { recursive: true }).catch(() => {})
    })

    it("should auto-discover config when formatting a single file in project root", async () => {
      const testFile = "test-issue-1177/index.html.erb"
      const input = '<div><p>Test</p></div>'

      await writeFile(testFile, input)

      const result = await execBinary([testFile])

      expectExitCode(result, 0)
      expect(result.stderr).toContain("Using Herb config file")
      expect(result.stderr).toContain("test-issue-1177/.herb.yml")

      const formatted = await readFile(testFile, 'utf-8')
      expect(formatted).toContain('   <p>Test</p>')
      expect(formatted).toMatch(/^\s{3}<p>/m)
    })

    it("should auto-discover config when formatting a deeply nested file", async () => {
      const testFile = "test-issue-1177/deep/nested/path/deep.html.erb"
      const input = '<div><p>Deep nested file</p></div>'

      await writeFile(testFile, input)

      const result = await execBinary([testFile])

      expectExitCode(result, 0)
      expect(result.stderr).toContain("Using Herb config file")
      expect(result.stderr).toContain("test-issue-1177/.herb.yml")

      const formatted = await readFile(testFile, 'utf-8')
      expect(formatted).toContain('   <p>Deep nested file</p>')
    })

    it("should use config settings without requiring --config-file flag", async () => {
      const testFile = "test-issue-1177/test.html.erb"
      const input = '<div><p>This is a line that is exactly ninety five characters long for testing config</p></div>'

      await writeFile(testFile, input)

      const result = await execBinary([testFile])

      expectExitCode(result, 0)
      expect(result.stderr).toContain("Using Herb config file")

      const formatted = await readFile(testFile, 'utf-8')
      expect(formatted).toContain('ninety five characters long for testing config')
      expect(formatted).toContain('   <p>')
    })

    it("should consistently use config across multiple file arguments", async () => {
      const file1 = "test-issue-1177/file1.html.erb"
      const file2 = "test-issue-1177/deep/file2.html.erb"
      const file3 = "test-issue-1177/deep/nested/file3.html.erb"
      const input = '<div><p>Test</p></div>'

      await writeFile(file1, input)
      await writeFile(file2, input)
      await writeFile(file3, input)

      const result = await execBinary([file1, file2, file3])

      expectExitCode(result, 0)
      expect(result.stderr).toContain("Using Herb config file")
      expect(result.stdout).toContain("Checked 3 files")

      const formatted1 = await readFile(file1, 'utf-8')
      const formatted2 = await readFile(file2, 'utf-8')
      const formatted3 = await readFile(file3, 'utf-8')

      expect(formatted1).toContain('   <p>Test</p>')
      expect(formatted2).toContain('   <p>Test</p>')
      expect(formatted3).toContain('   <p>Test</p>')
    })

    it("should respect config when using glob patterns", async () => {
      await writeFile("test-issue-1177/a.html.erb", '<div><p>A</p></div>')
      await writeFile("test-issue-1177/b.html.erb", '<div><p>B</p></div>')
      await writeFile("test-issue-1177/deep/c.html.erb", '<div><p>C</p></div>')

      const result = await execBinary(["test-issue-1177/**/*.html.erb"])

      expectExitCode(result, 0)
      expect(result.stderr).toContain("Using Herb config file")

      const formattedA = await readFile("test-issue-1177/a.html.erb", 'utf-8')
      const formattedB = await readFile("test-issue-1177/b.html.erb", 'utf-8')
      const formattedC = await readFile("test-issue-1177/deep/c.html.erb", 'utf-8')

      expect(formattedA).toContain('   <p>A</p>')
      expect(formattedB).toContain('   <p>B</p>')
      expect(formattedC).toContain('   <p>C</p>')
    })

    it("should use config in --check mode", async () => {
      const testFile = "test-issue-1177/check.html.erb"
      const alreadyFormatted = '<div>\n   <p>Test</p>\n</div>\n'

      await writeFile(testFile, alreadyFormatted)

      const result = await execBinary(["--check", testFile])

      expectExitCode(result, 0)
      expect(result.stderr).toContain("Using Herb config file")
      expect(result.stdout).toContain("all files are properly formatted")
    })

    it("should detect unformatted files correctly with config settings", async () => {
      const testFile = "test-issue-1177/unformatted.html.erb"
      const wrongFormatting = '<div>\n  <p>Test</p>\n</div>\n'

      await writeFile(testFile, wrongFormatting)

      const result = await execBinary(["--check", testFile])

      expectExitCode(result, 1)
      expect(result.stderr).toContain("Using Herb config file")
      expect(result.stdout).toContain("not formatted")
      expect(result.stdout).toContain("unformatted.html.erb")
    })
  })
})
