import { describe, it, expect, beforeAll } from 'vitest'
import { Formatter } from '../src/formatter.js'
import { TailwindClassSorter } from '@herb-tools/rewriter'
import { Herb } from '@herb-tools/node-wasm'
import dedent from 'dedent'

describe('Rewriter Integration', () => {
  beforeAll(async () => {
    await Herb.load()
  })

  it('should integrate TailwindClassSorter with formatter pipeline', () => {
    const source = '<div class="text-red-500 bg-blue-200 p-4 m-2">content</div>'

    const formatter = new Formatter(Herb, {
      indentWidth: 2,
      maxLineLength: 80,
      rewriters: {
        before: [new TailwindClassSorter({ enabled: true, verbose: false })]
      }
    })

    const formatted = formatter.format(source)

    expect(formatted).toBe('<div class="m-2 p-4 text-red-500 bg-blue-200">\n  content\n</div>')
  })

  it('should work without rewriters (backward compatibility)', () => {
    const source = '<div class="text-red-500 bg-blue-200 p-4 m-2">content</div>'

    const formatter = new Formatter(Herb, {
      indentWidth: 2,
      maxLineLength: 80
    })

    const formatted = formatter.format(source)

    expect(formatted).toBe('<div class="text-red-500 bg-blue-200 p-4 m-2">\n  content\n</div>')
  })

  it('should handle rewriter options per format call', () => {
    const source = '<div class="text-red-500 bg-blue-200 p-4 m-2">content</div>'

    const formatter = new Formatter(Herb)

    const formatted = formatter.format(source, {
      rewriters: {
        before: [new TailwindClassSorter({ enabled: true, verbose: false })]
      }
    })

    expect(formatted).toBe('<div class="m-2 p-4 text-red-500 bg-blue-200">\n  content\n</div>')
  })

  it('should handle disabled rewriters gracefully', () => {
    const source = '<div class="text-red-500 bg-blue-200 p-4 m-2">content</div>'

    const formatter = new Formatter(Herb, {
      rewriters: {
        before: [new TailwindClassSorter({ enabled: false })] // Disabled rewriter
      }
    })

    const formatted = formatter.format(source)

    expect(formatted).toBe('<div class="text-red-500 bg-blue-200 p-4 m-2">\n  content\n</div>')
  })

  it('should handle "after" rewriters in the pipeline', () => {
    const source = '<div class="text-red-500 bg-blue-200 p-4 m-2">content</div>'

    const formatter = new Formatter(Herb, {
      indentWidth: 2,
      maxLineLength: 80,
      rewriters: {
        after: [new TailwindClassSorter({ enabled: true, verbose: false })]
      }
    })

    const formatted = formatter.format(source)

    expect(formatted).toBe('<div class="m-2 p-4 text-red-500 bg-blue-200">\n  content\n</div>')
  })

  it('should handle both before and after rewriters', () => {
    const source = '<div class="text-red-500 bg-blue-200 p-4 m-2">content</div>'

    const formatter = new Formatter(Herb, {
      indentWidth: 2,
      maxLineLength: 80,
      rewriters: {
        before: [new TailwindClassSorter({ enabled: true, verbose: false })],
        after: [new TailwindClassSorter({ enabled: true, verbose: false })]
      }
    })

    const formatted = formatter.format(source)

    expect(formatted).toBe('<div class="m-2 p-4 text-red-500 bg-blue-200">\n  content\n</div>')
  })

  it('should handle complex multi-line HTML with rewriters', () => {
    const source = dedent`
      <div class="text-red-500 bg-blue-200 p-4 m-2">
        <span class="font-bold text-lg hover:text-blue-300">
          nested content
        </span>
        <p class="mt-4 mb-2">paragraph</p>
      </div>
    `

    const formatter = new Formatter(Herb, {
      indentWidth: 2,
      maxLineLength: 80,
      rewriters: {
        before: [new TailwindClassSorter({ enabled: true, verbose: false })]
      }
    })

    const formatted = formatter.format(source)

    const expected = dedent`
      <div class="m-2 p-4 text-red-500 bg-blue-200">
        <span class="font-bold text-lg hover:text-blue-300">nested content</span>
        <p class="mb-2 mt-4">
          paragraph
        </p>
      </div>
    `

    expect(formatted).toBe(expected)
  })
})
