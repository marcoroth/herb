import dedent from 'dedent'
import { describe, it, expect, beforeAll } from 'vitest'
import { sortTailwindClasses, containsTailwindClasses, TailwindClassSorter } from '@herb-tools/rewriter'
import { Formatter } from '../src/formatter.js'
import { Herb } from '@herb-tools/node-wasm'

describe('Tailwind CSS Sorting', () => {
  beforeAll(async () => {
    await Herb.load()
  })

  describe('containsTailwindClasses', () => {
    it('should detect Tailwind classes', () => {
      expect(containsTailwindClasses('bg-red-500')).toBe(true)
      expect(containsTailwindClasses('text-blue-300')).toBe(true)
      expect(containsTailwindClasses('p-4 m-2')).toBe(true)
      expect(containsTailwindClasses('hover:bg-blue-300')).toBe(true)
      expect(containsTailwindClasses('lg:text-xl')).toBe(true)
      expect(containsTailwindClasses('flex items-center')).toBe(true)
    })

    it('should not detect non-Tailwind classes', () => {
      expect(containsTailwindClasses('custom-class')).toBe(false)
      expect(containsTailwindClasses('my-component')).toBe(false)
      expect(containsTailwindClasses('')).toBe(false)
    })
  })

  describe('sortTailwindClasses', () => {
    it('should return original string when dependencies are not available', async () => {
      const input = 'text-red-500 bg-blue-200 p-4 m-2'
      const result = sortTailwindClasses(input)

      expect(result).toBe('m-2 p-4 text-red-500 bg-blue-200')
    })

    it('should handle empty strings', async () => {
      expect(sortTailwindClasses('')).toBe('')
      expect(sortTailwindClasses('   ')).toBe('   ')
    })

    it('should handle null/undefined input', async () => {
      expect(sortTailwindClasses(null as any)).toBe('')
      expect(sortTailwindClasses(undefined as any)).toBe('')
    })
  })

  describe('Formatter integration with ERB in class attributes', () => {
    it('should sort static Tailwind classes without ERB', () => {
      const source = '<div class="text-red-500 bg-blue-200 p-4 m-2">content</div>'

      const formatter = new Formatter(Herb, {
        indentWidth: 2,
        maxLineLength: 120,
        rewriters: {
          before: [new TailwindClassSorter({ enabled: true, verbose: false })]
        }
      })

      const formatted = formatter.format(source)

      expect(formatted).toBe(dedent`
        <div class="m-2 p-4 text-red-500 bg-blue-200">
          content
        </div>
      `)
    })

    it('should preserve ERB output tags and put sorted static classes first', () => {
      const source = '<div class="text-red-500 <%= dynamic_class %> bg-blue-200 p-4 m-2">content</div>'

      const formatter = new Formatter(Herb, {
        indentWidth: 2,
        maxLineLength: 200,
        rewriters: {
          before: [new TailwindClassSorter({ enabled: true, verbose: false })]
        }
      })

      const formatted = formatter.format(source)

      expect(formatted).toBe(dedent`
        <div class="m-2 p-4 text-red-500 bg-blue-200 <%= dynamic_class %>">
          content
        </div>
      `)
    })

    it('should preserve pure ERB class attributes without modification', () => {
      const source = '<div class="<%= dynamic_classes %>">content</div>'

      const formatter = new Formatter(Herb, {
        indentWidth: 2,
        maxLineLength: 120,
        rewriters: {
          before: [new TailwindClassSorter({ enabled: true, verbose: false })]
        }
      })

      const formatted = formatter.format(source)

      expect(formatted).toBe('<div class="<%= dynamic_classes %>">\n  content\n</div>')
    })

    it('should work when TailwindClassSorter is disabled', () => {
      const source = '<div class="text-red-500 bg-blue-200 p-4 m-2">content</div>'

      const formatter = new Formatter(Herb, {
        indentWidth: 2,
        maxLineLength: 120
        // No rewriters
      })

      const formatted = formatter.format(source)

      expect(formatted).toBe(dedent`
        <div class="text-red-500 bg-blue-200 p-4 m-2">
          content
        </div>
      `)
    })

    it('should handle ERB in self-closing tags', () => {
      const source = '<input class="<%= input_classes %>" type="text" />'

      const formatter = new Formatter(Herb, {
        indentWidth: 2,
        maxLineLength: 120,
        rewriters: {
          before: [new TailwindClassSorter({ enabled: true, verbose: false })]
        }
      })

      const formatted = formatter.format(source)

      expect(formatted).toBe('<input class="<%= input_classes %>" type="text" />')
    })

    it('should handle ERB inline if/elsif/else conditionals', () => {
      const source = '<div class="<% if user.admin? %> admin-class <% elsif user.member? %> member-class <% else %> guest-class <% end %>">content</div>'

      const formatter = new Formatter(Herb, {
        indentWidth: 2,
        maxLineLength: 200,
        rewriters: {
          before: [new TailwindClassSorter({ enabled: true, verbose: false })]
        }
      })

      const formatted = formatter.format(source)

      expect(formatted).toBe(dedent`
        <div class="<% if user.admin? %> admin-class <% elsif user.member? %> member-class <% else %> guest-class <% end %>">
          content
        </div>
      `)
    })

    it('should handle ERB inline if/else conditionals', () => {
      const source = '<div class="<% if active? %> active <% else %> inactive <% end %>">content</div>'

      const formatter = new Formatter(Herb, {
        indentWidth: 2,
        maxLineLength: 120,
        rewriters: {
          before: [new TailwindClassSorter({ enabled: true, verbose: false })]
        }
      })

      const formatted = formatter.format(source)

      expect(formatted).toBe(dedent`
        <div class="<% if active? %> active <% else %> inactive <% end %>">
          content
        </div>
      `)
    })

    it('should handle ERB single if conditionals', () => {
      const source = '<div class="<% if admin? %> admin-privileges <% end %>">content</div>'

      const formatter = new Formatter(Herb, {
        indentWidth: 2,
        maxLineLength: 120,
        rewriters: {
          before: [new TailwindClassSorter({ enabled: true, verbose: false })]
        }
      })

      const formatted = formatter.format(source)

      expect(formatted).toBe(dedent`
        <div class="<% if admin? %> admin-privileges <% end %>">
          content
        </div>
      `)
    })

    it('should handle ERB inline conditionals mixed with static classes', () => {
      const source = '<div class="base-class p-4 <% if error? %> text-red-500 <% else %> text-green-500 <% end %> m-2 bg-white">content</div>'

      const formatter = new Formatter(Herb, {
        indentWidth: 2,
        maxLineLength: 200,
        rewriters: {
          before: [new TailwindClassSorter({ enabled: true, verbose: false })]
        }
      })

      const formatted = formatter.format(source)

      expect(formatted).toBe('<div class="m-2 p-4 bg-white base-class <% if error? %> text-red-500 <% else %> text-green-500 <% end %>">\n  content\n</div>')
    })

    it('should handle ERB with Ruby modifier if statements', () => {
      const source = '<div class="<%= "active" if current_page?(path) %>">content</div>'

      const formatter = new Formatter(Herb, {
        indentWidth: 2,
        maxLineLength: 120,
        rewriters: {
          before: [new TailwindClassSorter({ enabled: true, verbose: false })]
        }
      })

      const formatted = formatter.format(source)

      expect(formatted).toBe('<div class="<%= "active" if current_page?(path) %>">\n  content\n</div>')
    })

    it('should handle ERB with Ruby modifier unless statements', () => {
      const source = '<div class="<%= "hidden" unless visible? %>">content</div>'

      const formatter = new Formatter(Herb, {
        indentWidth: 2,
        maxLineLength: 120,
        rewriters: {
          before: [new TailwindClassSorter({ enabled: true, verbose: false })]
        }
      })

      const formatted = formatter.format(source)

      expect(formatted).toBe('<div class="<%= "hidden" unless visible? %>">\n  content\n</div>')
    })

    it('should handle ERB if/else/end in separate tags (current limitation: ERB control flow stripped)', () => {
      const source = '<div class="base-class <% if admin? %>admin-style<% else %>user-style<% end %> p-4 m-2">content</div>'

      const formatter = new Formatter(Herb, {
        indentWidth: 2,
        maxLineLength: 200,
        rewriters: {
          before: [new TailwindClassSorter({ enabled: true, verbose: false })]
        }
      })

      const formatted = formatter.format(source)

      expect(formatted).toBe('<div class="m-2 p-4 base-class <% if admin? %> admin-style <% else %> user-style <% end %>">\n  content\n</div>')
    })

    it('should handle ERB if/elsif/else/end in separate tags (current limitation: ERB control flow stripped)', () => {
      const source = '<div class="text-base <% if user.admin? %>text-red-500<% elsif user.member? %>text-blue-500<% else %>text-gray-500<% end %> p-4 m-2">content</div>'

      const formatter = new Formatter(Herb, {
        indentWidth: 2,
        maxLineLength: 250,
        rewriters: {
          before: [new TailwindClassSorter({ enabled: true, verbose: false })]
        }
      })

      const formatted = formatter.format(source)

      expect(formatted).toBe('<div class="m-2 p-4 text-base <% if user.admin? %> text-red-500 <% elsif user.member? %> text-blue-500 <% else %> text-gray-500 <% end %>">\n  content\n</div>')
    })

    it('should handle ERB single if/end in separate tags (current limitation: ERB control flow stripped)', () => {
      const source = '<div class="base p-4 <% if show_border? %>border border-gray-300<% end %> m-2 bg-white">content</div>'

      const formatter = new Formatter(Herb, {
        indentWidth: 2,
        maxLineLength: 200,
        rewriters: {
          before: [new TailwindClassSorter({ enabled: true, verbose: false })]
        }
      })

      const formatted = formatter.format(source)

      expect(formatted).toBe('<div class="m-2 p-4 bg-white base <% if show_border? %> border border-gray-300 <% end %>">\n  content\n</div>')
    })

    it('should handle ERB unless/end in separate tags (current limitation: ERB control flow stripped)', () => {
      const source = '<div class="block <% unless hidden? %>opacity-100<% end %> p-4 m-2">content</div>'

      const formatter = new Formatter(Herb, {
        indentWidth: 2,
        maxLineLength: 200,
        rewriters: {
          before: [new TailwindClassSorter({ enabled: true, verbose: false })]
        }
      })

      const formatted = formatter.format(source)

      expect(formatted).toBe('<div class="block m-2 p-4 <% unless hidden? %> opacity-100 <% end %>">\n  content\n</div>')
    })

    it('should handle nested ERB conditionals in separate tags (current limitation: ERB control flow stripped)', () => {
      const source = '<div class="base <% if user.present? %><% if user.admin? %>admin-red<% else %>user-blue<% end %><% end %> p-4 m-2">content</div>'

      const formatter = new Formatter(Herb, {
        indentWidth: 2,
        maxLineLength: 250,
        rewriters: {
          before: [new TailwindClassSorter({ enabled: true, verbose: false })]
        }
      })

      const formatted = formatter.format(source)

      expect(formatted).toBe(dedent`
        <div class="m-2 p-4 base <% if user.present? %><% if user.admin? %> admin-red <% else %> user-blue <% end %><% end %>">
          content
        </div>
      `)
    })

    it('should handle empty class attribute with ERB', () => {
      const source = `<div class="<%= '' %>">content</div>`

      const formatter = new Formatter(Herb, {
        indentWidth: 2,
        maxLineLength: 80,
        rewriters: {
          before: [new TailwindClassSorter({ enabled: true, verbose: false })]
        }
      })

      const formatted = formatter.format(source)

      expect(formatted).toBe(dedent`
        <div class="<%= '' %>">
          content
        </div>
      `)
    })

    it('should handle ERB control flow wrapping as atomic units', () => {
      const source = dedent`
        <div class="m-2 p-4 text-yellow-100 base-class <% if error? %> text-red-500 <% else %> text-green-500 <% end %>">
          content
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

      expect(formatted).toBe(dedent`
        <div
          class="
            m-2 p-4 text-yellow-100 base-class
            <% if error? %> text-red-500 <% else %> text-green-500 <% end %>
          "
        >
          content
        </div>

      `)
    })

    // TODO: we probably want the ERBIfBlock with it's conditionals to be split up into multiple lines if one of the conditions exceeds the maxLineLength
    it('should format long ERB control flow with internal line breaks', () => {
      const source = dedent`
        <div class="m-2 p-4 text-yellow-100 base-class <% if error? %> text-red-500 so-long-that-each-condtions-needs-to-be-wrapped <% else %> text-green-500 another-long-class-that-should-cause-it-to-wrap <% end %>">
          content
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

      expect(formatted).toBe(dedent`
        <div
          class="
            m-2 p-4 text-yellow-100 base-class
            <% if error? %> text-red-500 so-long-that-each-condtions-needs-to-be-wrapped <% else %> text-green-500 another-long-class-that-should-cause-it-to-wrap <% end %>
          "
        >
          content
        </div>
      `)
    })

    // TODO: we probably want the ERBIfBlock with it's conditionals to be split up into multiple lines if one of the conditions exceeds the maxLineLength
    it('should format long ERB control flow with internal line breaks and classes after', () => {
      const source = dedent`
        <div class="m-2 p-4 <% if error? %> text-red-500 so-long-that-each-condtions-needs-to-be-wrapped <% else %> text-green-500 another-long-class-that-should-cause-it-to-wrap <% end %> text-yellow-100 base-class ">
          content
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

      expect(formatted).toBe(dedent`
        <div
          class="
            m-2 p-4
            <% if error? %> text-red-500 so-long-that-each-condtions-needs-to-be-wrapped <% else %> text-green-500 another-long-class-that-should-cause-it-to-wrap <% end %>
            text-yellow-100 base-class
          "
        >
          content
        </div>
      `)
    })

    it('should format ERB control flow on separate lines when mixed with static classes', () => {
      const source = dedent`
        <div
          class="
            m-2 p-4
            <% if error? %>
            text-red-500 so-long-that-each-condtions-needs-to-wrap
            <% else %>
            text-green-500 another-long-class
            <% end %>
            text-yellow-100 base-class
          "
        >
          content
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

      expect(formatted).toBe(dedent`
        <div
          class="
            m-2 p-4
            <% if error? %>
              text-red-500 so-long-that-each-condtions-needs-to-wrap
            <% else %>
              text-green-500 another-long-class
            <% end %>
            text-yellow-100 base-class
          "
        >
          content
        </div>
      `)
    })

    it.skip('should format tailwind classing also within conditionals', () => {
      const source = dedent`
        <div
          class="
            text-white px-4 sm:px-8 py-2 sm:py-3 bg-sky-700 hover:bg-sky-800
            <% if error? %>
            text-white px-4 sm:px-8 py-2 sm:py-3 bg-sky-700 hover:bg-sky-800
            <% else %>
            text-white px-4 sm:px-8 py-2 sm:py-3 bg-sky-700 hover:bg-sky-800
            <% end %>
          "
        >
          content
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

      expect(formatted).toBe(dedent`
        <div
          class="
            bg-sky-700 px-4 py-2 text-white hover:bg-sky-800 sm:px-8 sm:py-3
            <% if error? %>
              bg-sky-700 px-4 py-2 text-white hover:bg-sky-800 sm:px-8 sm:py-3
            <% else %>
              bg-sky-700 px-4 py-2 text-white hover:bg-sky-800 sm:px-8 sm:py-3
            <% end %>
          "
        >
          content
        </div>
      `)
    })
  })
})
