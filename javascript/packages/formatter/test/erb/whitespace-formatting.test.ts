import { describe, test, expect, beforeAll } from "vitest"
import { Herb } from "@herb-tools/node-wasm"
import { Formatter } from "../../src"
import { createExpectFormattedToMatch } from "../helpers"

import dedent from "dedent"

let formatter: Formatter
let expectFormattedToMatch: ReturnType<typeof createExpectFormattedToMatch>

describe("ERB whitespace formatting", () => {
  beforeAll(async () => {
    await Herb.load()

    formatter = new Formatter(Herb, {
      indentWidth: 2,
      maxLineLength: 80
    })

    expectFormattedToMatch = createExpectFormattedToMatch(formatter)
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
      expectFormattedToMatch(`<p>Lorem $<%= value %> ipsum dolor sit amet.</p>`)
    })

    test("preserves euro symbol after ERB tag without adding space", () => {
      expectFormattedToMatch(`<p>Lorem <%= value %>€ ipsum dolor sit amet.</p>`)
    })

    test("preserves hash symbol before ERB tag without adding space", () => {
      expectFormattedToMatch(`<p>Lorem #<%= value %> ipsum dolor sit amet.</p>`)
    })

    test("keeps hyphen attached between adjacent ERB tags", () => {
      expectFormattedToMatch(`<p>Lorem <%= value %>-<%= value %> ipsum dolor sit amet.</p>`)
    })

    test("keeps period attached between adjacent ERB tags", () => {
      expectFormattedToMatch(`<p>Lorem <%= value %>.<%= value %> ipsum dolor sit amet.</p>`)
    })

    test("preserves punctuation sequence around ERB tags without spaces", () => {
      expectFormattedToMatch(`<p>Lorem .<%= value %>.<%= value %>. ipsum dolor sit amet.</p>`)
    })

    test("preserves punctuation sequence around ERB tags with spaces", () => {
      expectFormattedToMatch(`<p>Lorem . <%= value %> . <%= value %> . ipsum dolor sit amet.</p>`)
    })

    test("keeps adjacent ERB tags together without adding space", () => {
      expectFormattedToMatch(`<p>Lorem <%= one %><%= two %> ipsum dolor sit amet.</p>`)
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
      expectFormattedToMatch(`<p>Hello <span>World</span>. Hello</p>`)
    })

    test("preserves period spacing after inline element", () => {
      expectFormattedToMatch(`<p>Hello <span>World</span> . Hello</p>`)
    })
  })

  describe("edge cases and special characters", () => {
    test("preserves exclamation mark after ERB tag", () => {
      expectFormattedToMatch(`<p>Hello <%= name %>!</p>`)
    })

    test("preserves question mark after ERB tag", () => {
      expectFormattedToMatch(`<p>Are you <%= adjective %>?</p>`)
    })

    test("preserves colon after ERB tag", () => {
      expectFormattedToMatch(`<p>Result: <%= value %></p>`)
    })

    test("preserves semicolon after ERB tag", () => {
      expectFormattedToMatch(`<p>First <%= value %>; then <%= value2 %>.</p>`)
    })

    test("preserves multiple punctuation marks (ellipsis)", () => {
      expectFormattedToMatch(`<p>Loading<%= dots %>...</p>`)
    })

    test("preserves multiple exclamation marks", () => {
      expectFormattedToMatch(`<p>Alert<%= message %>!!!</p>`)
    })

    test("preserves quotes around ERB tag", () => {
      expectFormattedToMatch(`<p>He said "<%= quote %>".</p>`)
    })

    test("preserves single quotes around ERB tag", () => {
      expectFormattedToMatch(`<p>Word: '<%= word %>'</p>`)
    })

    test("preserves parentheses around ERB tag", () => {
      expectFormattedToMatch(`<p>Details (<%= info %>)</p>`)
    })

    test("preserves brackets around ERB tag", () => {
      expectFormattedToMatch(`<p>Index [<%= index %>]</p>`)
    })

    test("preserves slash between ERB tags (fraction)", () => {
      expectFormattedToMatch(`<p><%= numerator %>/<%= denominator %></p>`)
    })

    test("preserves slash after ERB tag (file path)", () => {
      expectFormattedToMatch(`<p><%= dir %>/<%= file %></p>`)
    })

    test("preserves backslash after ERB tag", () => {
      expectFormattedToMatch(`<p><%= path %>\\<%= file %></p>`)
    })

    test("preserves at-sign before ERB tag (mention)", () => {
      expectFormattedToMatch(`<p>@<%= username %> said hello</p>`)
    })

    test("preserves hashtag with ERB tag", () => {
      expectFormattedToMatch(`<p>#<%= tag %> is trending</p>`)
    })

    test("preserves percent sign after ERB tag", () => {
      expectFormattedToMatch(`<p><%= value %>%</p>`)
    })

    test("preserves ampersand between ERB tags", () => {
      expectFormattedToMatch(`<p><%= first %>&<%= second %></p>`)
    })

    test("preserves plus sign between ERB tags (concatenation)", () => {
      expectFormattedToMatch(`<p><%= a %>+<%= b %></p>`)
    })

    test("preserves asterisk between ERB tags (multiplication)", () => {
      expectFormattedToMatch(`<p><%= width %>*<%= height %></p>`)
    })

    test("preserves equals sign between ERB tags", () => {
      expectFormattedToMatch(`<p><%= key %>=<%= value %></p>`)
    })

    test("preserves caret after ERB tag", () => {
      expectFormattedToMatch(`<p><%= base %>^<%= exponent %></p>`)
    })

    test("preserves tilde before ERB tag", () => {
      expectFormattedToMatch(`<p>~<%= approximate %></p>`)
    })

    test("preserves pipe between ERB tags", () => {
      expectFormattedToMatch(`<p><%= option1 %>|<%= option2 %></p>`)
    })

    test("preserves underscore between ERB tags", () => {
      expectFormattedToMatch(`<p><%= first %>_<%= last %></p>`)
    })

    test("preserves numbers after ERB tag", () => {
      expectFormattedToMatch(`<p><%= value %>123</p>`)
    })

    test("preserves numbers before ERB tag", () => {
      expectFormattedToMatch(`<p>Version 123<%= suffix %></p>`)
    })

    test("preserves decimal point in price format", () => {
      expectFormattedToMatch(`<p>$<%= dollars %>.<%= cents %></p>`)
    })

    test("preserves colon in time format", () => {
      expectFormattedToMatch(`<p><%= hours %>:<%= minutes %></p>`)
    })

    test("preserves x in dimensions format", () => {
      expectFormattedToMatch(`<p><%= width %>x<%= height %></p>`)
    })

    test("preserves file extension with ERB tag", () => {
      expectFormattedToMatch(`<p><%= filename %>.html</p>`)
    })

    test("preserves multiple file extensions", () => {
      expectFormattedToMatch(`<p><%= filename %>.html.erb</p>`)
    })

    test("preserves em dash between ERB tags", () => {
      expectFormattedToMatch(`<p><%= start %>—<%= end %></p>`)
    })

    test("preserves en dash between ERB tags", () => {
      expectFormattedToMatch(`<p><%= start %>–<%= end %></p>`)
    })

    test("handles ERB comment with apostrophe", () => {
      expectFormattedToMatch(`<p>Hello <%# user's name %><%= name %></p>`)
    })

    test("preserves possessive with multiple ERB tags", () => {
      expectFormattedToMatch(`<p><%= first_name %> <%= last_name %>'s profile</p>`)
    })

    test("preserves multiple apostrophes in sequence", () => {
      expectFormattedToMatch(`<p><%= name %>'s friend's house</p>`)
    })

    test("preserves abbreviation with ERB tag", () => {
      expectFormattedToMatch(`<p>Dr.<%= name %></p>`)
    })

    test("preserves trailing abbreviation", () => {
      expectFormattedToMatch(`<p><%= name %> Ph.D.</p>`)
    })

    test("preserves complex punctuation sequence", () => {
      expectFormattedToMatch(`<p>"<%= title %>"—<%= author %>'s masterpiece!</p>`)
    })

    test("preserves comma and space between ERB tags", () => {
      expectFormattedToMatch(`<p><%= city %>, <%= state %></p>`)
    })

    test("handles mixed punctuation and text", () => {
      expectFormattedToMatch(`<p><%= value %>: <%= description %> (<%= note %>).</p>`)
    })

    test("preserves angle brackets (comparison operators)", () => {
      expectFormattedToMatch(`<p><%= a %>&lt;<%= b %></p>`)
    })

    test("preserves greater than with ERB tags", () => {
      expectFormattedToMatch(`<p><%= a %>&gt;<%= b %></p>`)
    })

    test("handles nested quotes and apostrophes", () => {
      expectFormattedToMatch(`<p>"<%= name %>'s quote"</p>`)
    })

    test("preserves contractions before ERB tag", () => {
      expectFormattedToMatch(`<p>can't <%= verb %></p>`)
    })

    test("preserves contractions after ERB tag", () => {
      expectFormattedToMatch(`<p><%= subject %> can't <%= verb %></p>`)
    })

    test("handles backticks around ERB tag (code)", () => {
      expectFormattedToMatch(`<p>Use \`<%= code %>\` here</p>`)
    })

    test("preserves currency symbol before decimal ERB tag", () => {
      expectFormattedToMatch(`<p>$<%= price %>.99</p>`)
    })

    test("preserves comma in large numbers", () => {
      expectFormattedToMatch(`<p><%= thousands %>,<%= hundreds %></p>`)
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
    })

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
