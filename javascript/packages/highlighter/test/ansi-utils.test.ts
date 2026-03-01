import { describe, it, expect, beforeEach, afterEach } from "vitest"

import { colors, ANSI_ESCAPE, ANSI_REGEX, ANSI_REGEX_START, ANSI_REGEX_CAPTURE, colorize } from "../src/color.js"
import { applyDimToStyledText } from "../src/util.js"
import { TextFormatter } from "../src/text-formatter.js"
import { LineWrapper } from "../src/line-wrapper.js"
import { stripAnsiColors } from "./util.js"

describe("ANSI constants", () => {
  it("ANSI_ESCAPE matches the ESC control character", () => {
    expect(ANSI_ESCAPE).toBe("\x1b")
    expect(ANSI_ESCAPE.charCodeAt(0)).toBe(0x1b)
  })

  describe("ANSI_REGEX", () => {
    it("matches ANSI color codes", () => {
      expect("hello \x1b[31mworld\x1b[0m".match(ANSI_REGEX)).toEqual(["\x1b[31m", "\x1b[0m"])
    })

    it("matches codes with multiple parameters", () => {
      expect("\x1b[38;2;255;0;0m".match(ANSI_REGEX)).toEqual(["\x1b[38;2;255;0;0m"])
    })

    it("does not match plain text", () => {
      ANSI_REGEX.lastIndex = 0
      expect("hello world".match(ANSI_REGEX)).toBeNull()
    })
  })

  describe("ANSI_REGEX_START", () => {
    it("matches ANSI code at string start", () => {
      expect(ANSI_REGEX_START.test("\x1b[31mhello")).toBe(true)
    })

    it("does not match ANSI code mid-string", () => {
      expect(ANSI_REGEX_START.test("hello\x1b[31m")).toBe(false)
    })
  })

  describe("ANSI_REGEX_CAPTURE", () => {
    it("splits text preserving ANSI codes", () => {
      const parts = `${colors.red}hello${colors.reset}`.split(ANSI_REGEX_CAPTURE)
      expect(parts).toEqual(["", colors.red, "hello", colors.reset, ""])
    })

    it("splits text with multiple colors", () => {
      const parts = `${colors.red}a${colors.blue}b${colors.reset}`.split(ANSI_REGEX_CAPTURE)
      expect(parts).toEqual(["", colors.red, "a", colors.blue, "b", colors.reset, ""])
    })
  })
})

describe("stripAnsiColors", () => {
  it("removes all ANSI codes from text", () => {
    const styled = `${colors.red}hello${colors.reset} ${colors.blue}world${colors.reset}`
    expect(stripAnsiColors(styled)).toBe("hello world")
  })

  it("returns plain text unchanged", () => {
    expect(stripAnsiColors("hello world")).toBe("hello world")
  })

  it("handles empty string", () => {
    expect(stripAnsiColors("")).toBe("")
  })

  it("handles text with only ANSI codes", () => {
    expect(stripAnsiColors(`${colors.red}${colors.reset}`)).toBe("")
  })

  it("handles RGB color codes", () => {
    const styled = "\x1b[38;2;255;0;0mred text\x1b[0m"
    expect(stripAnsiColors(styled)).toBe("red text")
  })
})

describe("applyDimToStyledText", () => {
  let originalNoColor: string | undefined

  beforeEach(() => {
    originalNoColor = process.env.NO_COLOR
    delete process.env.NO_COLOR
  })

  afterEach(() => {
    if (originalNoColor === undefined) {
      delete process.env.NO_COLOR
    } else {
      process.env.NO_COLOR = originalNoColor
    }
  })

  it("adds dim modifier to color codes and wraps text segments with dim", () => {
    const input = `${colors.red}hello${colors.reset}`
    const result = applyDimToStyledText(input)

    expect(result).toBe("\x1b[2;31m\x1b[2mhello\x1b[22m\x1b[0m")
  })

  it("wraps plain text segments with dim", () => {
    const input = `${colors.red}colored${colors.reset} plain`
    const result = applyDimToStyledText(input)

    expect(result).toBe("\x1b[2;31m\x1b[2mcolored\x1b[22m\x1b[0m\x1b[2m plain\x1b[22m")
  })

  it("returns text unchanged when NO_COLOR is set", () => {
    process.env.NO_COLOR = "1"
    const input = `${colors.red}hello${colors.reset}`
    expect(applyDimToStyledText(input)).toBe(input)
  })

  it("handles text with no ANSI codes", () => {
    const result = applyDimToStyledText("plain text")

    expect(result).toBe("\x1b[2mplain text\x1b[22m")
  })

  it("handles empty string", () => {
    expect(applyDimToStyledText("")).toBe("")
  })

  it("handles multiple color codes", () => {
    const input = `${colors.red}red${colors.reset}${colors.blue}blue${colors.reset}`
    const result = applyDimToStyledText(input)

    expect(result).toBe("\x1b[2;31m\x1b[2mred\x1b[22m\x1b[0m\x1b[2;34m\x1b[2mblue\x1b[22m\x1b[0m")
  })
})

describe("TextFormatter", () => {
  describe("applyDimToStyledText", () => {
    let originalNoColor: string | undefined

    beforeEach(() => {
      originalNoColor = process.env.NO_COLOR
      delete process.env.NO_COLOR
    })

    afterEach(() => {
      if (originalNoColor === undefined) {
        delete process.env.NO_COLOR
      } else {
        process.env.NO_COLOR = originalNoColor
      }
    })

    it("converts color codes to dim versions", () => {
      const input = `${colors.red}hello${colors.reset}`
      const result = TextFormatter.applyDimToStyledText(input)

      expect(result).toBe("\x1b[2;31mhello\x1b[0m")
    })

    it("preserves reset codes", () => {
      const input = `${colors.red}hello${colors.reset}`
      const result = TextFormatter.applyDimToStyledText(input)

      expect(result).toBe("\x1b[2;31mhello\x1b[0m")
    })

    it("returns text unchanged when NO_COLOR is set", () => {
      process.env.NO_COLOR = "1"
      const input = `${colors.red}hello${colors.reset}`
      expect(TextFormatter.applyDimToStyledText(input)).toBe(input)
    })

    it("handles text with no ANSI codes", () => {
      expect(TextFormatter.applyDimToStyledText("plain text")).toBe("plain text")
    })
  })

  describe("highlightBackticks", () => {
    let originalNoColor: string | undefined
    let originalIsTTY: boolean | undefined

    beforeEach(() => {
      originalNoColor = process.env.NO_COLOR
      originalIsTTY = process.stdout.isTTY
      delete process.env.NO_COLOR
      process.stdout.isTTY = true
    })

    afterEach(() => {
      if (originalNoColor === undefined) {
        delete process.env.NO_COLOR
      } else {
        process.env.NO_COLOR = originalNoColor
      }

      process.stdout.isTTY = originalIsTTY!
    })

    it("wraps backtick content with bold white", () => {
      const result = TextFormatter.highlightBackticks("use `foo` here")

      expect(result).toBe(`use ${colors.bold}${colors.white}foo${colors.reset} here`)
    })

    it("handles multiple backtick pairs", () => {
      const result = TextFormatter.highlightBackticks("`a` and `b`")

      expect(result).toBe(`${colors.bold}${colors.white}a${colors.reset} and ${colors.bold}${colors.white}b${colors.reset}`)
    })

    it("returns text unchanged when NO_COLOR is set", () => {
      process.env.NO_COLOR = "1"
      expect(TextFormatter.highlightBackticks("use `foo` here")).toBe("use `foo` here")
    })

    it("returns text unchanged without a TTY", () => {
      process.stdout.isTTY = false
      expect(TextFormatter.highlightBackticks("use `foo` here")).toBe("use `foo` here")
    })

    it("returns text without backticks unchanged", () => {
      expect(TextFormatter.highlightBackticks("plain text")).toBe("plain text")
    })
  })
})

describe("colorize", () => {
  let originalNoColor: string | undefined

  beforeEach(() => {
    originalNoColor = process.env.NO_COLOR
    delete process.env.NO_COLOR
  })

  afterEach(() => {
    if (originalNoColor === undefined) {
      delete process.env.NO_COLOR
    } else {
      process.env.NO_COLOR = originalNoColor
    }
  })

  it("wraps text with foreground color and reset", () => {
    expect(colorize("hello", "red")).toBe(`${colors.red}hello${colors.reset}`)
  })

  it("supports hex colors", () => {
    expect(colorize("hello", "#ff0000")).toBe("\x1b[38;2;255;0;0mhello\x1b[0m")
  })

  it("supports background colors", () => {
    expect(colorize("hello", "red", "blue")).toBe(`${colors.blue}${colors.red}hello${colors.reset}`)
  })

  it("returns plain text when NO_COLOR is set", () => {
    process.env.NO_COLOR = "1"
    expect(colorize("hello", "red")).toBe("hello")
  })
})

describe("LineWrapper", () => {
  describe("wrapLine", () => {
    it("returns line as-is when shorter than maxWidth", () => {
      expect(LineWrapper.wrapLine("short", 80)).toEqual(["short"])
    })

    it("returns line as-is when maxWidth is zero", () => {
      expect(LineWrapper.wrapLine("hello", 0)).toEqual(["hello"])
    })

    it("wraps long plain text at whitespace", () => {
      expect(LineWrapper.wrapLine("hello world foo", 11)).toEqual(["hello ", "world foo"])
    })

    it("preserves ANSI codes when wrapping", () => {
      const styled = `${colors.red}hello world${colors.reset} ${colors.blue}and more text${colors.reset}`
      const result = LineWrapper.wrapLine(styled, 15)

      expect(result.length).toBeGreaterThan(1)
      expect(result[0]).toEqual(`${colors.red}hello world${colors.reset} `)
    })

    it("correctly calculates width ignoring ANSI codes", () => {
      const styled = `${colors.red}short${colors.reset}`
      expect(LineWrapper.wrapLine(styled, 80)).toEqual([styled])
    })
  })

  describe("truncateLine", () => {
    it("returns line as-is when shorter than maxWidth", () => {
      expect(LineWrapper.truncateLine("short", 80)).toBe("short")
    })

    it("returns line as-is when maxWidth is zero", () => {
      expect(LineWrapper.truncateLine("hello", 0)).toBe("hello")
    })

    it("truncates long lines with ellipsis", () => {
      const longLine = "a".repeat(100)
      const result = LineWrapper.truncateLine(longLine, 20)
      const stripped = stripAnsiColors(result)

      expect(stripped.length).toBeLessThanOrEqual(20)
      expect(stripped).toMatch(/a+…$/)
    })

    it("preserves ANSI codes in truncated output", () => {
      const styled = `${colors.red}${"a".repeat(100)}${colors.reset}`
      const result = LineWrapper.truncateLine(styled, 20)

      expect(result.startsWith(colors.red)).toBe(true)
      expect(stripAnsiColors(result).length).toBeLessThanOrEqual(20)
    })

    it("correctly calculates width ignoring ANSI codes", () => {
      const styled = `${colors.red}short${colors.reset}`
      expect(LineWrapper.truncateLine(styled, 80)).toBe(styled)
    })
  })

  describe("ANSI-aware extraction via wrapLine", () => {
    it("preserves color codes that span a wrap boundary", () => {
      const styled = `${colors.red}${"abcdefghij".repeat(3)}${colors.reset}`
      const result = LineWrapper.wrapLine(styled, 15)

      expect(result.length).toBeGreaterThan(1)
      expect(result[0].startsWith(colors.red)).toBe(true)
    })

    it("handles text with only ANSI codes and no visible content beyond width", () => {
      const styled = `${colors.red}${colors.blue}${colors.reset}short`
      const result = LineWrapper.wrapLine(styled, 80)

      expect(result).toHaveLength(1)
      expect(stripAnsiColors(result[0])).toBe("short")
    })
  })

  describe("ANSI-aware extraction via truncateLine", () => {
    it("preserves color in truncated portion", () => {
      const styled = `${colors.red}hello${colors.reset} ${colors.blue}${"x".repeat(100)}${colors.reset}`
      const result = LineWrapper.truncateLine(styled, 20)
      const stripped = stripAnsiColors(result)

      expect(result.startsWith(colors.red)).toBe(true)
      expect(stripped).toMatch(/^hello/)
      expect(stripped.length).toBeLessThanOrEqual(20)
    })

    it("handles adjacent ANSI codes at truncation point", () => {
      const styled = `${"a".repeat(15)}${colors.red}${colors.bold}${"b".repeat(100)}${colors.reset}`
      const result = LineWrapper.truncateLine(styled, 20)
      const stripped = stripAnsiColors(result)

      expect(stripped.length).toBeLessThanOrEqual(20)
      expect(stripped).toMatch(/^a+/)
    })

    it("handles RGB color codes in truncated content", () => {
      const styled = `${colorize("x".repeat(100), "#ff8000")}`
      const result = LineWrapper.truncateLine(styled, 20)
      const stripped = stripAnsiColors(result)

      expect(result.startsWith(ANSI_ESCAPE)).toBe(true)
      expect(stripped.length).toBeLessThanOrEqual(20)
    })
  })
})
