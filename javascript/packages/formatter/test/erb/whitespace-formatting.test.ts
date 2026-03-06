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

      const expected = dedent`
        <a
          href="/path"
          <% if disabled %>
            class="disabled"
          <% end %>
        >
          Text
        </a>
      `

      expect(result).toBe(expected)
      expectFormattedToMatch(expected)
    })

    test("preserves already properly spaced ERB tags", () => {
      expectFormattedToMatch('<div <% if condition %> class="test" <% end %>></div>')
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
      expectFormattedToMatch('<%# This is a comment %>')
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

      expect(result).toBe(dedent`
        <div>
          <% users.each do |user| %>
            <span><%= user.name %></span>
          <% end %>
        </div>
      `)
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

  describe("line breaking elements and text flow", () => {
    test("does not add line breaks after ERB tags following <br>", () => {
      const source = dedent`
        <p><strong>Ut enim ad minima veniam</strong><br>
         <%= foo %> sed quia consequuntur magni <%= bar %>. Lorem ipsum dolor sit amet...</p>
      `
      const result = formatter.format(source)

      expect(result).toBe(dedent`
        <p>
          <strong>Ut enim ad minima veniam</strong><br>
          <%= foo %> sed quia consequuntur magni <%= bar %>. Lorem ipsum dolor sit
          amet...
        </p>
      `)
    })

    test("keeps period attached to ERB tag in text flow", () => {
      const source = `<p><strong>Summary:</strong><br> Lorem ipsum <%= foo %> dolor <%= bar %>. Sit amet...</p>`
      const result = formatter.format(source)

      expect(result).toBe(dedent`
        <p>
          <strong>Summary:</strong><br>
          Lorem ipsum <%= foo %> dolor <%= bar %>. Sit amet...
        </p>
      `)
    })

    test("issue 903: does not separate ERB tags from surrounding text", () => {
      expectFormattedToMatch(`Failed to <%= model.ignored? ? "unignore" : "ignore" %> model`)
    })

    test("issue 903: preserves apostrophe with ERB tag inline", () => {
      expectFormattedToMatch(`<p><%= user.name %>'s profile</p>`)
    })

    test("issue 903: preserves possessive apostrophe after ERB tag", () => {
      expectFormattedToMatch(`Waiting for <%= contractor.name.first_or_business %>'s signature.`)
    })

    test("issue 903: multiple ERB tags in text flow after <br>", () => {
      const source = dedent`
        <p><strong>Summary:</strong><br>
          Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua, <%= foo %> quis nostrud exercitation ullamco laboris. Duis aute irure dolor in reprehenderit <%= bar %> that <%= baz %> sed quia non numquam eius modi tempora.</p>
      `
      const result = formatter.format(source)

      expect(result).toBe(dedent`
        <p>
          <strong>Summary:</strong><br>
          Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor
          incididunt ut labore et dolore magna aliqua, <%= foo %> quis nostrud
          exercitation ullamco laboris. Duis aute irure dolor in reprehenderit
          <%= bar %> that <%= baz %> sed quia non numquam eius modi tempora.
        </p>
      `)
    })

    test("issue 903: full example with two paragraphs containing <br> and ERB", () => {
      const source = dedent`
        <p><strong>Ut enim ad minima veniam</strong><br>
          <%= foo %> sed quia consequuntur magni <%= bar %>. Lorem ipsum dolor sit amet consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.</p>

        <p><strong>Summary:</strong><br>
          Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua, <%= foo %> quis nostrud exercitation ullamco laboris. Duis aute irure dolor in reprehenderit <%= bar %> that <%= baz %> sed quia non numquam eius modi tempora.</p>
      `
      const result = formatter.format(source)

      expect(result).toBe(dedent`
        <p>
          <strong>Ut enim ad minima veniam</strong><br>
          <%= foo %> sed quia consequuntur magni <%= bar %>. Lorem ipsum dolor sit amet
          consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et
          dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation
          ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor
          in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla
          pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui
          officia deserunt mollit anim id est laborum.
        </p>

        <p>
          <strong>Summary:</strong><br>
          Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor
          incididunt ut labore et dolore magna aliqua, <%= foo %> quis nostrud
          exercitation ullamco laboris. Duis aute irure dolor in reprehenderit
          <%= bar %> that <%= baz %> sed quia non numquam eius modi tempora.
        </p>
      `)
    })

    test("handles long text with ERB tags after <br>", () => {
      const source = dedent`
        <p><strong>Ut enim ad minima veniam</strong><br>
          <%= foo %> sed quia consequuntur magni <%= bar %>. Lorem ipsum dolor sit amet consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.</p>
      `
      const result = formatter.format(source)

      expect(result).toBe(dedent`
        <p>
          <strong>Ut enim ad minima veniam</strong><br>
          <%= foo %> sed quia consequuntur magni <%= bar %>. Lorem ipsum dolor sit amet
          consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et
          dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation
          ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor
          in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla
          pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui
          officia deserunt mollit anim id est laborum.
        </p>
      `)
    })
  })

  describe("issue 931: punctuation after ERB link_to tags", () => {
    test("issue 931: keeps commas and periods attached to ERB link_to tags (@adrianthedev)", () => {
      const formatter120 = new Formatter(Herb, { indentWidth: 2, maxLineLength: 120 })

      const source = dedent`
        <div class="py-6 min-h-24">
          <div class="px-6 space-y-4">
            <h3>What a nice new tool</h3>

            Go to <%= link_to "new comment", app.new_resources_comment_path %>, <%= link_to 'the first user', app.resources_user_path(1) %>, or <%= link_to 'hey on main app', main_app.hey_path %>.

            <p>
              You can edit this file here <code class="p-1 rounded-sm bg-gray-500 text-white text-sm">app/views/app/tools/custom_tool.html.erb</code>.
            </p>
          </div>
        </div>
      `
      const result = formatter120.format(source)

      expect(result).toBe(dedent`
        <div class="py-6 min-h-24">
          <div class="px-6 space-y-4">
            <h3>What a nice new tool</h3>

            Go to <%= link_to "new comment", app.new_resources_comment_path %>,
            <%= link_to 'the first user', app.resources_user_path(1) %>, or <%= link_to 'hey on main app', main_app.hey_path %>.

            <p>
              You can edit this file here
              <code class="p-1 rounded-sm bg-gray-500 text-white text-sm">app/views/app/tools/custom_tool.html.erb</code>.
            </p>
          </div>
        </div>
      `)
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
      expect(formatter.format('<% if condition%>')).toBe('<% if condition%>')
      expect(formatter.format('<%end%>')).toBe('<%end%>')
    })
  })
})
