import { describe, test, expect, vi, beforeEach, afterEach } from "vitest"
import { GitHubActionsFormatter } from "../../src/cli/formatters/github-actions-formatter.js"
import { name, version } from "../../package.json"
import type { ProcessedFile } from "../../src/cli/file-processor.js"
import type { Diagnostic } from "@herb-tools/core"

describe("GitHubActionsFormatter", () => {
  let formatter: GitHubActionsFormatter
  let consoleLogSpy: ReturnType<typeof vi.spyOn>
  const linterTitle = `${name}@${version}`

  beforeEach(() => {
    formatter = new GitHubActionsFormatter(true, false)
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation()
  })

  afterEach(() => {
    consoleLogSpy.mockRestore()
  })

  function createDiagnostic(overrides: Partial<Diagnostic> = {}): Diagnostic {
    return {
      message: "Test error message",
      location: {
        start: { line: 10, column: 5 },
        end: { line: 10, column: 15 },
        toJSON: () => ({
          start: { line: 10, column: 5 },
          end: { line: 10, column: 15 }
        })
      },
      severity: "error",
      code: "test-rule",
      source: "Herb Linter",
      rule: "test-rule",
      ...overrides
    } as Diagnostic
  }

  test("formats error diagnostics correctly", async () => {
    const files: ProcessedFile[] = [{
      filename: "test.html.erb",
      offense: createDiagnostic(),
      content: "<div>test</div>"
    }]

    await formatter.format(files)

    expect(consoleLogSpy).toHaveBeenCalledWith(
      `\n::error file=test.html.erb,line=10,col=5,title=test-rule • ${linterTitle}::Test error message [test-rule]%0A%0A%0Atest.html.erb:10:5%0A%0A%0A`
    )
  })

  test("formats warning diagnostics correctly", async () => {
    const files: ProcessedFile[] = [{
      filename: "test.html.erb",
      offense: createDiagnostic({ severity: "warning" }),
      content: "<div>test</div>"
    }]

    await formatter.format(files)

    expect(consoleLogSpy).toHaveBeenCalledWith(
      `\n::warning file=test.html.erb,line=10,col=5,title=test-rule • ${linterTitle}::Test error message [test-rule]%0A%0A%0Atest.html.erb:10:5%0A%0A%0A`
    )
  })

  test("escapes percent signs in messages", async () => {
    const files: ProcessedFile[] = [{
      filename: "test.html.erb",
      offense: createDiagnostic({ message: "Error: 100% failure rate" }),
      content: "<div>test</div>"
    }]

    await formatter.format(files)

    expect(consoleLogSpy).toHaveBeenCalledWith(
      `\n::error file=test.html.erb,line=10,col=5,title=test-rule • ${linterTitle}::Error: 100%25 failure rate [test-rule]%0A%0A%0Atest.html.erb:10:5%0A%0A%0A`
    )
  })

  test("escapes newlines in messages", async () => {
    const files: ProcessedFile[] = [{
      filename: "test.html.erb",
      offense: createDiagnostic({ message: "Error on line 1\nContinued on line 2" }),
      content: "<div>test</div>"
    }]

    await formatter.format(files)

    expect(consoleLogSpy).toHaveBeenCalledWith(
      `\n::error file=test.html.erb,line=10,col=5,title=test-rule • ${linterTitle}::Error on line 1%0AContinued on line 2 [test-rule]%0A%0AContinued on line 2 (test-rule)%0A%0Atest.html.erb:10:5%0A%0A%0A`
    )
  })

  test("escapes carriage returns in messages", async () => {
    const files: ProcessedFile[] = [{
      filename: "test.html.erb",
      offense: createDiagnostic({ message: "Error\rMessage" }),
      content: "<div>test</div>"
    }]

    await formatter.format(files)

    expect(consoleLogSpy).toHaveBeenCalledWith(
      `\n::error file=test.html.erb,line=10,col=5,title=test-rule • ${linterTitle}::Error%0DMessage [test-rule]%0A%0A%0Atest.html.erb:10:5%0A%0A%0A`
    )
  })

  test("handles multiple diagnostics", async () => {
    const files: ProcessedFile[] = [
      {
        filename: "test1.html.erb",
        offense: createDiagnostic({ message: "Error 1" }),
        content: "<div>test</div>"
      },
      {
        filename: "test2.html.erb",
        offense: createDiagnostic({
          message: "Error 2",
          severity: "warning",
          location: {
            start: { line: 5, column: 10 },
            end: { line: 5, column: 20 },
            toJSON: () => ({
              start: { line: 5, column: 10 },
              end: { line: 5, column: 20 }
            })
          }
        }),
        content: "<p>test</p>"
      }
    ]

    await formatter.format(files)

    expect(consoleLogSpy).toHaveBeenCalledWith(
      `\n::error file=test1.html.erb,line=10,col=5,title=test-rule • ${linterTitle}::Error 1 [test-rule]%0A%0A%0Atest1.html.erb:10:5%0A%0A%0A`
    )
    expect(consoleLogSpy).toHaveBeenCalledWith(
      `\n::warning file=test2.html.erb,line=5,col=10,title=test-rule • ${linterTitle}::Error 2 [test-rule]%0A%0A%0Atest2.html.erb:5:10%0A%0A%0A`
    )
  })

  test("handles diagnostics without code", async () => {
    const files: ProcessedFile[] = [{
      filename: "test.html.erb",
      offense: createDiagnostic({ code: undefined }),
      content: "<div>test</div>"
    }]

    await formatter.format(files)

    expect(consoleLogSpy).toHaveBeenCalledWith(
      "\n::error file=test.html.erb,line=10,col=5::Test error message%0A%0A%0Atest.html.erb:10:5%0A%0A%0A"
    )
  })

  test("adds final newline only when there are diagnostics", async () => {
    await formatter.format([])

    expect(consoleLogSpy).not.toHaveBeenCalled()
  })

  test("formatFile method works correctly", () => {
    const diagnostics: Diagnostic[] = [
      createDiagnostic({ message: "Error 1" }),
      createDiagnostic({ message: "Error 2", severity: "warning" })
    ]

    formatter.formatFile("test.html.erb", diagnostics)

    expect(consoleLogSpy).toHaveBeenCalledWith(
      `\n::error file=test.html.erb,line=10,col=5,title=test-rule • ${linterTitle}::Error 1 [test-rule]`
    )
    expect(consoleLogSpy).toHaveBeenCalledWith(
      `\n::warning file=test.html.erb,line=10,col=5,title=test-rule • ${linterTitle}::Error 2 [test-rule]`
    )
  })

  test("escapes special characters in filename", async () => {
    const files: ProcessedFile[] = [{
      filename: "test:file,name%.html.erb",
      offense: createDiagnostic({ message: "Test error" }),
      content: "<div>test</div>"
    }]

    await formatter.format(files)

    expect(consoleLogSpy).toHaveBeenCalledWith(
      `\n::error file=test%3Afile%2Cname%25.html.erb,line=10,col=5,title=test-rule • ${linterTitle}::Test error [test-rule]%0A%0A%0Atest:file,name%25.html.erb:10:5%0A%0A%0A`
    )
  })

  test("escapes all special characters correctly", async () => {
    const files: ProcessedFile[] = [{
      filename: "path:with,special%chars\nand\rnewlines.erb",
      offense: createDiagnostic({
        message: "Error: 50% failure\nOn multiple\rlines"
      }),
      content: "<div>test</div>"
    }]

    await formatter.format(files)

    expect(consoleLogSpy).toHaveBeenCalledWith(
      `\n::error file=path%3Awith%2Cspecial%25chars%0Aand%0Dnewlines.erb,line=10,col=5,title=test-rule • ${linterTitle}::Error: 50%25 failure%0AOn multiple%0Dlines [test-rule]%0A%0AOn multiple%0Dlines (test-rule)%0A%0Apath:with,special%25chars%0Aand%0Dnewlines.erb:10:5%0A%0A%0A`
    )
  })
})
