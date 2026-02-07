import { describe, test, expect, beforeAll } from "vitest"
import { Herb } from "@herb-tools/node-wasm"
import { Formatter } from "../../src"

import dedent from "dedent"

let formatter: Formatter

describe("ERB whitespace formatting", () => {
  beforeAll(async () => {
    await Herb.load()

    formatter = new Formatter(Herb, {
      indentWidth: 2,
      maxLineLength: 80
    })
  })

  describe("regression tests for whitespace formatting fix", () => {
    test("formats the original problematic snippet correctly", () => {
      const source = dedent`
        <a href="/path"
          <% if disabled%>
            class="disabled"
          <%end%>
        >
          Text
        </a>
      `
      const result = formatter.format(source)

      expect(result).toBe(dedent`
        <a
          href="/path"
          <% if disabled %>
            class="disabled"
          <% end %>
        >
          Text
        </a>
      `)

      expect(result).toContain('<% if disabled %>')
      expect(result).toContain('<% end %>')

      expect(result).not.toContain('<% if disabled%>')
      expect(result).not.toContain('<%end%>')
    })

    test("preserves already properly spaced ERB tags", () => {
      const source = '<div <% if condition %> class="test" <% end %>></div>'
      const result = formatter.format(source)

      expect(result).toContain('<% if condition %>')
      expect(result).toContain('<% end %>')
    })

    test("formats standalone ERB content tags with proper spacing", () => {
      const source = '<%=content%>'
      const result = formatter.format(source)

      expect(result).toEqual('<%= content %>')
    })

    test("formats ERB tags within HTML text content", () => {
      const source = '<p>Hello <%=name%>, welcome!</p>'
      const result = formatter.format(source)

      expect(result).toEqual('<p>Hello <%= name %>, welcome!</p>')
    })

    test("verifies formatERBContent utility function behavior through working cases", () => {
      expect(formatter.format('<%=content%>')).toEqual('<%= content %>')
      expect(formatter.format('<%=  spaced  %>')).toEqual('<%= spaced %>')
      expect(formatter.format('<%   %>')).toEqual('<%%>')
    })

    test("handles ERB tags with only whitespace content", () => {
      const source = '<%   %>'
      const result = formatter.format(source)

      expect(result).toEqual('<%%>')
    })

    test("preserves ERB comment formatting", () => {
      const source = '<%# This is a comment %>'
      const result = formatter.format(source)

      expect(result).toEqual('<%# This is a comment %>')
    })

    test("handles complex ERB structures that get inlined", () => {
      const source = dedent`
        <div>
          <%users.each do |user|%>
            <span><%=user.name%></span>
          <%end%>
        </div>
      `
      const result = formatter.format(source)

      expect(result).toContain('<%= user.name %>')
      expect(result).toContain('<div>')
      expect(result).toContain('</div>')
      expect(result).toContain('<span>')
      expect(result).toContain('</span>')
    })

    test("does not add whitespace before apostrophe after ERB tag (issue #855)", () => {
      const source = dedent`
        <p>
          Lorem <%= letter.patient.first_name.titlecase %>'s ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.
        </p>
      `
      const result = formatter.format(source)

      expect(result).toEqual(dedent`
        <p>
          Lorem <%= letter.patient.first_name.titlecase %>'s ipsum dolor sit amet,
          consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et
          dolore magna aliqua.
        </p>
      `)
    })

    test("preserves dollar sign before ERB tag without adding space", () => {
      const source = `<p>Lorem $<%= value %> ipsum dolor sit amet.</p>`
      const result = formatter.format(source)
      expect(result).toEqual(source)
    })

    test("preserves euro symbol after ERB tag without adding space", () => {
      const source = `<p>Lorem <%= value %>€ ipsum dolor sit amet.</p>`
      const result = formatter.format(source)
      expect(result).toEqual(source)
    })

    test("preserves hash symbol before ERB tag without adding space", () => {
      const source = `<p>Lorem #<%= value %> ipsum dolor sit amet.</p>`
      const result = formatter.format(source)
      expect(result).toEqual(source)
    })

    test("keeps hyphen attached between adjacent ERB tags", () => {
      const source = `<p>Lorem <%= value %>-<%= value %> ipsum dolor sit amet.</p>`
      const result = formatter.format(source)
      expect(result).toEqual(source)
    })

    test("keeps period attached between adjacent ERB tags", () => {
      const source = `<p>Lorem <%= value %>.<%= value %> ipsum dolor sit amet.</p>`
      const result = formatter.format(source)
      expect(result).toEqual(source)
    })

    test("preserves punctuation sequence around ERB tags without spaces", () => {
      const source = `<p>Lorem .<%= value %>.<%= value %>. ipsum dolor sit amet.</p>`
      const result = formatter.format(source)
      expect(result).toEqual(source)
    })

    test("preserves punctuation sequence around ERB tags with spaces", () => {
      const source = `<p>Lorem . <%= value %> . <%= value %> . ipsum dolor sit amet.</p>`
      const result = formatter.format(source)
      expect(result).toEqual(source)
    })

    test("keeps adjacent ERB tags together without adding space", () => {
      const source = `<p>Lorem <%= one %><%= two %> ipsum dolor sit amet.</p>`
      const result = formatter.format(source)
      expect(result).toEqual(source)
    })

    test("formats standalone period after block element on new line", () => {
      const source = `<p>hello</p>.`
      const result = formatter.format(source)
      expect(result).toEqual(dedent`
        <p>hello</p>
        .
      `)
    })

    test("formats period after closing tag within parent block", () => {
      const source = dedent`
        <div>
          <p>hello</p>.
        </div>
      `
      const result = formatter.format(source)
      expect(result).toEqual(dedent`
        <div>
          <p>hello</p>
          .
        </div>
      `)
    })

    test("keeps period attached to inline element without space", () => {
      const source = `<p>Hello <span>World</span>. Hello</p>`
      const result = formatter.format(source)
      expect(result).toEqual(source)
    })

    test("preserves period spacing after inline element", () => {
      const source = `<p>Hello <span>World</span> . Hello</p>`
      const result = formatter.format(source)
      expect(result).toEqual(source)
    })
  })

  describe("edge cases and special characters", () => {
    test("preserves exclamation mark after ERB tag", () => {
      const source = `<p>Hello <%= name %>!</p>`
      const result = formatter.format(source)
      expect(result).toEqual(source)
    })

    test("preserves question mark after ERB tag", () => {
      const source = `<p>Are you <%= adjective %>?</p>`
      const result = formatter.format(source)
      expect(result).toEqual(source)
    })

    test("preserves colon after ERB tag", () => {
      const source = `<p>Result: <%= value %></p>`
      const result = formatter.format(source)
      expect(result).toEqual(source)
    })

    test("preserves semicolon after ERB tag", () => {
      const source = `<p>First <%= value %>; then <%= value2 %>.</p>`
      const result = formatter.format(source)
      expect(result).toEqual(source)
    })

    test("preserves multiple punctuation marks (ellipsis)", () => {
      const source = `<p>Loading<%= dots %>...</p>`
      const result = formatter.format(source)
      expect(result).toEqual(source)
    })

    test("preserves multiple exclamation marks", () => {
      const source = `<p>Alert<%= message %>!!!</p>`
      const result = formatter.format(source)
      expect(result).toEqual(source)
    })

    test("preserves quotes around ERB tag", () => {
      const source = `<p>He said "<%= quote %>".</p>`
      const result = formatter.format(source)
      expect(result).toEqual(source)
    })

    test("preserves single quotes around ERB tag", () => {
      const source = `<p>Word: '<%= word %>'</p>`
      const result = formatter.format(source)
      expect(result).toEqual(source)
    })

    test("preserves parentheses around ERB tag", () => {
      const source = `<p>Details (<%= info %>)</p>`
      const result = formatter.format(source)
      expect(result).toEqual(source)
    })

    test("preserves brackets around ERB tag", () => {
      const source = `<p>Index [<%= index %>]</p>`
      const result = formatter.format(source)
      expect(result).toEqual(source)
    })

    test("preserves slash between ERB tags (fraction)", () => {
      const source = `<p><%= numerator %>/<%= denominator %></p>`
      const result = formatter.format(source)
      expect(result).toEqual(source)
    })

    test("preserves slash after ERB tag (file path)", () => {
      const source = `<p><%= dir %>/<%= file %></p>`
      const result = formatter.format(source)
      expect(result).toEqual(source)
    })

    test("preserves backslash after ERB tag", () => {
      const source = `<p><%= path %>\\<%= file %></p>`
      const result = formatter.format(source)
      expect(result).toEqual(source)
    })

    test("preserves at-sign before ERB tag (mention)", () => {
      const source = `<p>@<%= username %> said hello</p>`
      const result = formatter.format(source)
      expect(result).toEqual(source)
    })

    test("preserves hashtag with ERB tag", () => {
      const source = `<p>#<%= tag %> is trending</p>`
      const result = formatter.format(source)
      expect(result).toEqual(source)
    })

    test("preserves percent sign after ERB tag", () => {
      const source = `<p><%= value %>%</p>`
      const result = formatter.format(source)
      expect(result).toEqual(source)
    })

    test("preserves ampersand between ERB tags", () => {
      const source = `<p><%= first %>&<%= second %></p>`
      const result = formatter.format(source)
      expect(result).toEqual(source)
    })

    test("preserves plus sign between ERB tags (concatenation)", () => {
      const source = `<p><%= a %>+<%= b %></p>`
      const result = formatter.format(source)
      expect(result).toEqual(source)
    })

    test("preserves asterisk between ERB tags (multiplication)", () => {
      const source = `<p><%= width %>*<%= height %></p>`
      const result = formatter.format(source)
      expect(result).toEqual(source)
    })

    test("preserves equals sign between ERB tags", () => {
      const source = `<p><%= key %>=<%= value %></p>`
      const result = formatter.format(source)
      expect(result).toEqual(source)
    })

    test("preserves caret after ERB tag", () => {
      const source = `<p><%= base %>^<%= exponent %></p>`
      const result = formatter.format(source)
      expect(result).toEqual(source)
    })

    test("preserves tilde before ERB tag", () => {
      const source = `<p>~<%= approximate %></p>`
      const result = formatter.format(source)
      expect(result).toEqual(source)
    })

    test("preserves pipe between ERB tags", () => {
      const source = `<p><%= option1 %>|<%= option2 %></p>`
      const result = formatter.format(source)
      expect(result).toEqual(source)
    })

    test("preserves underscore between ERB tags", () => {
      const source = `<p><%= first %>_<%= last %></p>`
      const result = formatter.format(source)
      expect(result).toEqual(source)
    })

    test("preserves numbers after ERB tag", () => {
      const source = `<p><%= value %>123</p>`
      const result = formatter.format(source)
      expect(result).toEqual(source)
    })

    test("preserves numbers before ERB tag", () => {
      const source = `<p>Version 123<%= suffix %></p>`
      const result = formatter.format(source)
      expect(result).toEqual(source)
    })

    test("preserves decimal point in price format", () => {
      const source = `<p>$<%= dollars %>.<%= cents %></p>`
      const result = formatter.format(source)
      expect(result).toEqual(source)
    })

    test("preserves colon in time format", () => {
      const source = `<p><%= hours %>:<%= minutes %></p>`
      const result = formatter.format(source)
      expect(result).toEqual(source)
    })

    test("preserves x in dimensions format", () => {
      const source = `<p><%= width %>x<%= height %></p>`
      const result = formatter.format(source)
      expect(result).toEqual(source)
    })

    test("preserves file extension with ERB tag", () => {
      const source = `<p><%= filename %>.html</p>`
      const result = formatter.format(source)
      expect(result).toEqual(source)
    })

    test("preserves multiple file extensions", () => {
      const source = `<p><%= filename %>.html.erb</p>`
      const result = formatter.format(source)
      expect(result).toEqual(source)
    })

    test("preserves em dash between ERB tags", () => {
      const source = `<p><%= start %>—<%= end %></p>`
      const result = formatter.format(source)
      expect(result).toEqual(source)
    })

    test("preserves en dash between ERB tags", () => {
      const source = `<p><%= start %>–<%= end %></p>`
      const result = formatter.format(source)
      expect(result).toEqual(source)
    })

    test("handles ERB comment with apostrophe", () => {
      const source = `<p>Hello <%# user's name %><%= name %></p>`
      const result = formatter.format(source)
      expect(result).toEqual(source)
    })

    test("preserves possessive with multiple ERB tags", () => {
      const source = `<p><%= first_name %> <%= last_name %>'s profile</p>`
      const result = formatter.format(source)
      expect(result).toEqual(source)
    })

    test("preserves multiple apostrophes in sequence", () => {
      const source = `<p><%= name %>'s friend's house</p>`
      const result = formatter.format(source)
      expect(result).toEqual(source)
    })

    test("preserves abbreviation with ERB tag", () => {
      const source = `<p>Dr.<%= name %></p>`
      const result = formatter.format(source)
      expect(result).toEqual(source)
    })

    test("preserves trailing abbreviation", () => {
      const source = `<p><%= name %> Ph.D.</p>`
      const result = formatter.format(source)
      expect(result).toEqual(source)
    })

    test("preserves complex punctuation sequence", () => {
      const source = `<p>"<%= title %>"—<%= author %>'s masterpiece!</p>`
      const result = formatter.format(source)
      expect(result).toEqual(source)
    })

    test("preserves comma and space between ERB tags", () => {
      const source = `<p><%= city %>, <%= state %></p>`
      const result = formatter.format(source)
      expect(result).toEqual(source)
    })

    test("handles mixed punctuation and text", () => {
      const source = `<p><%= value %>: <%= description %> (<%= note %>).</p>`
      const result = formatter.format(source)
      expect(result).toEqual(source)
    })

    test("preserves angle brackets (comparison operators)", () => {
      const source = `<p><%= a %>&lt;<%= b %></p>`
      const result = formatter.format(source)
      expect(result).toEqual(source)
    })

    test("preserves greater than with ERB tags", () => {
      const source = `<p><%= a %>&gt;<%= b %></p>`
      const result = formatter.format(source)
      expect(result).toEqual(source)
    })

    test("handles nested quotes and apostrophes", () => {
      const source = `<p>"<%= name %>'s quote"</p>`
      const result = formatter.format(source)
      expect(result).toEqual(source)
    })

    test("preserves contractions before ERB tag", () => {
      const source = `<p>can't <%= verb %></p>`
      const result = formatter.format(source)
      expect(result).toEqual(source)
    })

    test("preserves contractions after ERB tag", () => {
      const source = `<p><%= subject %> can't <%= verb %></p>`
      const result = formatter.format(source)
      expect(result).toEqual(source)
    })

    test("handles backticks around ERB tag (code)", () => {
      const source = `<p>Use \`<%= code %>\` here</p>`
      const result = formatter.format(source)
      expect(result).toEqual(source)
    })

    test("preserves currency symbol before decimal ERB tag", () => {
      const source = `<p>$<%= price %>.99</p>`
      const result = formatter.format(source)
      expect(result).toEqual(source)
    })

    test("preserves comma in large numbers", () => {
      const source = `<p><%= thousands %>,<%= hundreds %></p>`
      const result = formatter.format(source)
      expect(result).toEqual(source)
    })
  })

  describe("line breaking elements and text flow", () => {
    test("does not add line breaks after ERB tags following <br>", () => {
      const source = dedent`
        <p><strong>Ut enim ad minima veniam</strong><br>
         <%= foo %> sed quia consequuntur magni <%= bar %>. Lorem ipsum dolor sit amet...</p>
      `
      const result = formatter.format(source)

      expect(result).not.toContain(`<%= foo %>\n`)
      expect(result).not.toContain(`<%= bar %>\n .`)
    })

    test("keeps period attached to ERB tag in text flow", () => {
      const source = `<p><strong>Summary:</strong><br> Lorem ipsum <%= foo %> dolor <%= bar %>. Sit amet...</p>`
      const result = formatter.format(source)

      expect(result).not.toContain(`<%= bar %>\n.`)
    })

    test("does not separate ERB tags from surrounding text", () => {
      const source = `Failed to <%= model.ignored? ? "unignore" : "ignore" %> model`
      const result = formatter.format(source)

      expect(result).toBe(
        `Failed to <%= model.ignored? ? "unignore" : "ignore" %> model`,
      )
    })

    test("preserves apostrophe with ERB tag inline", () => {
      const source = `<p><%= user.name %>'s profile</p>`
      const result = formatter.format(source)

      expect(result).toBe(`<p><%= user.name %>'s profile</p>`)
    })

    test("preserves possessive apostrophe after ERB tag", () => {
      const source = `Waiting for <%= contractor.name.first_or_business %>'s signature.`
      const result = formatter.format(source)

      expect(result).toBe(
        `Waiting for <%= contractor.name.first_or_business %>'s signature.`,
      )
    })

    test("handles long text with ERB tags after <br>", () => {
      const source = dedent`
        <p><strong>Ut enim ad minima veniam</strong><br>
          <%= foo %> sed quia consequuntur magni <%= bar %>. Lorem ipsum dolor sit amet consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.</p>
      `
      const result = formatter.format(source)

      expect(result).not.toContain(`<%= foo %>\n  sed`)
      expect(result).not.toContain(`<%= bar %>\n  .`)
      expect(result).toContain(`<%= bar %>. Lorem`)
    })
  })

  describe("shared utility validation", () => {
    test("demonstrates consistent ERB content formatting where it applies", () => {
      const erbContentCases = [
        { input: '<%=user.id%>', expected: '<%= user.id %>' },
        { input: '<%= "Hello"%>', expected: '<%= "Hello" %>' },
        { input: '<%=content%>', expected: '<%= content %>' }
      ]

      erbContentCases.forEach(({ input, expected }) => {
        const result = formatter.format(input)

        expect(result).toEqual(expected)
      })
    }),

    test("documents current behavior for ERB logic tags", () => {
      const logicCases = ['<% if condition%>', '<%end%>']

      logicCases.forEach(testCase => {
        const result = formatter.format(testCase)

        expect(result).toContain('<%')
        expect(result).toContain('%>')
      })
    })
  })
})
