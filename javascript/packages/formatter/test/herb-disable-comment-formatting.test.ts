import { describe, test, expect, beforeAll } from "vitest"
import { Herb } from "@herb-tools/node-wasm"
import { Formatter } from "../src"
import { createExpectFormattedToMatch } from "./helpers"
import dedent from "dedent"

let formatter: Formatter
let expectFormattedToMatch: ReturnType<typeof createExpectFormattedToMatch>

describe("herb:disable comment formatting", () => {
  beforeAll(async () => {
    await Herb.load()

    formatter = new Formatter(Herb, {
      indentWidth: 2,
      maxLineLength: 80,
    })
    expectFormattedToMatch = createExpectFormattedToMatch(formatter)
  })

  test("should keep herb:disable comment inline after opening tag", () => {
    const source = dedent`
      <DIV> <%# herb:disable html-tag-name-lowercase %>
        Dolores id occaecati ipsam. Eius blanditiis odio quas. Corrupti officia quasi sunt neque soluta veritatis. Sint esse nihil alias quia qui. Aut omnis quia ut dolores reiciendis. Numquam voluptate esse voluptas.
      </DIV> <%# herb:disable html-tag-name-lowercase %>
    `

    const result = formatter.format(source)

    expect(result).toBe(dedent`
      <DIV> <%# herb:disable html-tag-name-lowercase %>
        Dolores id occaecati ipsam. Eius blanditiis odio quas. Corrupti officia quasi
        sunt neque soluta veritatis. Sint esse nihil alias quia qui. Aut omnis quia ut
        dolores reiciendis. Numquam voluptate esse voluptas.
      </DIV> <%# herb:disable html-tag-name-lowercase %>
    `)
  })

  test("should keep herb:disable comment inline after opening tag nested in other element", () => {
    const source = dedent`
      <div>
        <DIV> <%# herb:disable html-tag-name-lowercase %>
          Dolores id occaecati ipsam. Eius blanditiis odio quas. Corrupti officia quasi sunt neque soluta veritatis. Sint esse nihil alias quia qui. Aut omnis quia ut dolores reiciendis. Numquam voluptate esse voluptas.
        </DIV> <%# herb:disable html-tag-name-lowercase %>
      </div>
    `

    const result = formatter.format(source)

    expect(result).toBe(dedent`
      <div>
        <DIV> <%# herb:disable html-tag-name-lowercase %>
          Dolores id occaecati ipsam. Eius blanditiis odio quas. Corrupti officia
          quasi sunt neque soluta veritatis. Sint esse nihil alias quia qui. Aut omnis
          quia ut dolores reiciendis. Numquam voluptate esse voluptas.
        </DIV> <%# herb:disable html-tag-name-lowercase %>
      </div>
    `)
  })

  test("should keep herb:disable comment inline after closing tag", () => {
    expectFormattedToMatch(dedent`
      <DIV>
        Some content here that needs formatting.
      </DIV> <%# herb:disable html-tag-name-lowercase %>
    `)
  })

  test("element with short content inlines when herb:disable is removed", () => {
    const source = dedent`
      <DIV> <%# herb:disable html-tag-name-lowercase, some-super-long-rule-names-that-should-make-this-wrap-but-it-doesnt-because-its-a-herb-disable-comment %>
        Short text here that should not wrap.
      </DIV>
    `

    const result = formatter.format(source)

    expect(result).toBe(
      `<DIV>Short text here that should not wrap.</DIV> <%# herb:disable html-tag-name-lowercase, some-super-long-rule-names-that-should-make-this-wrap-but-it-doesnt-because-its-a-herb-disable-comment %>`
    )
  })

  test("should treat herb:disable as 'invisible' for text flow wrapping", () => {
    const source = dedent`
      <p> <%# herb:disable some-rule %>
        Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.
      </p>
    `

    const result = formatter.format(source)

    expect(result).toBe(dedent`
      <p> <%# herb:disable some-rule %>
        Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor
        incididunt ut labore et dolore magna aliqua.
      </p>
    `)
  })

  test("should handle herb:disable all comment", () => {
    const source = dedent`
      <SPAN> <%# herb:disable all %>
        Some content that needs wrapping because it is quite long and exceeds the line length limit.
      </SPAN>
    `

    const result = formatter.format(source)

    expect(result).toBe(dedent`
      <SPAN> <%# herb:disable all %>
        Some content that needs wrapping because it is quite long and exceeds the line
        length limit.
      </SPAN>
    `)
  })

  test("element with short content and multiple rules inlines", () => {
    const source = dedent`
      <DIV> <%# herb:disable rule-one, rule-two, rule-three %>
        Text content here.
      </DIV>
    `

    const result = formatter.format(source)

    expect(result).toBe(
      `<DIV>Text content here.</DIV> <%# herb:disable rule-one, rule-two, rule-three %>`
    )
  })

  test("should always add a space before herb:disable comment", () => {
    const source = dedent`
      <DIV><%# herb:disable html-tag-name-lowercase %>
        Content here.
      </DIV>
    `

    const result = formatter.format(source)

    expect(result).toBe(dedent`
      <DIV> <%# herb:disable html-tag-name-lowercase %>
        Content here.
      </DIV>
    `)
  })

  test("should not treat regular ERB comments as herb:disable", () => {
    const source = dedent`
      <div> <%# just a regular comment %>
        Some text that should wrap normally when it gets very long and exceeds the maximum line length limit.
      </div>
    `

    const result = formatter.format(source)

    expect(result).toBe(dedent`
      <div>
        <%# just a regular comment %>
        Some text that should wrap normally when it gets very long and exceeds the
        maximum line length limit.
      </div>
    `)
  })

  test("should handle herb:disable in inline elements", () => {
    const source = dedent`
      <p>
        Some text with <span> <%# herb:disable some-rule %>inline content</span> here.
      </p>
    `

    const result = formatter.format(source)

    expect(result).toBe(dedent`
      <p>
        Some text with <span>inline content</span> here. <%# herb:disable some-rule %>
      </p>
    `)
  })

  test("should handle multiple herb:disable comments (opening and middle)", () => {
    const source = dedent`
      <DIV> <%# herb:disable html-tag-name-lowercase %>
        Some content here.
        <%# herb:disable another-rule %>
        More content.
      </DIV>
    `

    const result = formatter.format(source)

    expect(result).toBe(
      `<DIV>Some content here.More content.</DIV> <%# herb:disable another-rule %> <%# herb:disable html-tag-name-lowercase %>`
    )
  })

  test("should handle empty elements with herb:disable", () => {
    const source = dedent`
      <div> <%# herb:disable some-rule %>
      </div>
    `

    const result = formatter.format(source)

    expect(result).toBe(
      `<div></div> <%# herb:disable some-rule %>`
    )
  })

  test("should handle herb:disable with ERB output tags", () => {
    const source = dedent`
      <div> <%# herb:disable some-rule %>
        <%= content %>
      </div>
    `

    const result = formatter.format(source)

    expect(result).toBe(
      `<div><%= content %></div> <%# herb:disable some-rule %>`
    )
  })

  test("should handle deeply nested herb:disable (3 levels)", () => {
    const source = dedent`
      <div>
        <section>
          <DIV> <%# herb:disable html-tag-name-lowercase %>
            Content here.
          </DIV>
        </section>
      </div>
    `

    const result = formatter.format(source)

    expect(result).toBe(dedent`
      <div>
        <section>
          <DIV>Content here.</DIV> <%# herb:disable html-tag-name-lowercase %>
        </section>
      </div>
    `)
  })

  test("element with short content and long rule list inlines", () => {
    const source = dedent`
      <DIV> <%# herb:disable rule-one, rule-two, rule-three, rule-four, rule-five, rule-six, rule-seven %>
        Content.
      </DIV>
    `

    const result = formatter.format(source)

    expect(result).toBe(
      `<DIV>Content.</DIV> <%# herb:disable rule-one, rule-two, rule-three, rule-four, rule-five, rule-six, rule-seven %>`
    )
  })

  test("should handle herb:disable between sibling elements", () => {
    const source = dedent`
      <div>
        <p>First paragraph</p>
        <%# herb:disable some-rule %>
        <p>Second paragraph</p>
      </div>
    `

    const result = formatter.format(source)

    expect(result).toBe(dedent`
      <div>
        <p>First paragraph</p> <%# herb:disable some-rule %>
        <p>Second paragraph</p>
      </div>
    `)
  })

  test("should handle consecutive herb:disable comments", () => {
    const source = dedent`
      <DIV> <%# herb:disable rule-one %>
      <%# herb:disable rule-two %>
        Content here.
      </DIV>
    `

    const result = formatter.format(source)

    expect(result).toBe(
      `<DIV>Content here.</DIV> <%# herb:disable rule-two %> <%# herb:disable rule-one %>`
    )
  })

  test("reproduces the exact issue from #738", () => {
    const source = dedent`
      <DIV> <%# herb:disable html-tag-name-lowercase %>
        Dolores id occaecati ipsam. Eius blanditiis odio quas. Corrupti officia quasi sunt neque soluta veritatis. Sint esse nihil alias quia qui. Aut omnis quia ut dolores reiciendis. Numquam voluptate esse voluptas.
      </DIV> <%# herb:disable html-tag-name-lowercase %>
    `

    const result = formatter.format(source)

    const expectedOutput = dedent`
      <DIV> <%# herb:disable html-tag-name-lowercase %>
        Dolores id occaecati ipsam. Eius blanditiis odio quas. Corrupti officia quasi
        sunt neque soluta veritatis. Sint esse nihil alias quia qui. Aut omnis quia ut
        dolores reiciendis. Numquam voluptate esse voluptas.
      </DIV> <%# herb:disable html-tag-name-lowercase %>
    `

    expect(result).toBe(expectedOutput)
  })

  test("handles erb if nodes", () => {
    expectFormattedToMatch(dedent`
      <%if valid?%> <%# herb:disable erb-require-whitespace-inside-tags %>
        <%=content%> <%# herb:disable erb-require-whitespace-inside-tags %>
      <%else%> <%# herb:disable erb-require-whitespace-inside-tags %>
        <%=other_content%> <%# herb:disable erb-require-whitespace-inside-tags %>
      <%end5> <%# herb:disable erb-require-whitespace-inside-tags %>
    `)
  })

  test("keeps herb:disable comment on same line as tag name in multiline opening tag", () => {
    expectFormattedToMatch(dedent`
      <a <%# herb:disable html-anchor-require-href %>
        class="btn btn-secondary no-donate-btn"
        aria-label="Close"
        data-dismiss="modal"
      >
        Close
      </a>
    `)
  })

  test("keeps herb:disable comment on the same line as the attribute it follows", () => {
    const source = dedent`
      <li>
        <div
          data-testid="blog-post"
          class="theme-<%= theme %> some-long-classes" <%# herb:disable erb-no-interpolated-class-names %>
        >
          content
        </div>
      </li>
    `

    const result = formatter.format(source)

    expect(result).toBe(dedent`
      <li>
        <div data-testid="blog-post" class="theme-<%= theme %> some-long-classes"> <%# herb:disable erb-no-interpolated-class-names %>
          content
        </div>
      </li>
    `)
  })

  test("keeps herb:disable comment stay the same line ", () => {
     expectFormattedToMatch(dedent`
      <li>
        <div
          data-testid="blog-post"
          class="theme-<%= theme %> some-long-classes that make sure this stay multiline" <%# herb:disable erb-no-interpolated-class-names %>
        >
          content
        </div>
      </li>
    `)
  })

  test("keeps herb:disable on tag name line when it appears before any attributes", () => {
    const source = dedent`
      <a <%# herb:disable html-anchor-require-href %>
        class="btn btn-secondary"
        aria-label="Close"
      >
        Close
      </a>
    `

    const result = formatter.format(source)

    expect(result).toBe(
      `<a class="btn btn-secondary" aria-label="Close"> Close </a> <%# herb:disable html-anchor-require-href %>`
    )
  })

  test("keeps herb:disable comment on the attribute line in a loop", () => {
    expectFormattedToMatch(dedent`
      <ol>
        <% posts.each do |post| %>
          <li <%# herb:disable another-long-disable-comment-name %>
            data-testid="blog-post some-long-value some-long-value" <%# herb:disable another-long-disable-comment-name %>
            class="theme-<%= post.org %>-light some-long-class-name" <%# herb:disable erb-no-interpolated-class-names %>
          > <%# herb:disable another-long-disable-comment-name %>
            content
          </li>
        <% end %>
      </ol>
    `)
  })

  test("keeps herb:disable on same line as ERB output inside if block", () => {
    expectFormattedToMatch(dedent`
      <% if content_for(:pre_main) %>
        <%= raw content_for(:pre_main) %> <%# herb:disable erb-no-unsafe-raw %>
      <% end %>
    `)
  })

  test("keeps herb:disable on same line as ERB output inside else block", () => {
    expectFormattedToMatch(dedent`
      <% if condition %>
        <%= safe_content %>
      <% else %>
        <%= raw fallback %> <%# herb:disable erb-no-unsafe-raw %>
      <% end %>
    `)
  })

  test("keeps herb:disable on same line as ERB output inside unless block", () => {
    expectFormattedToMatch(dedent`
      <% unless invalid? %>
        <%= raw content %> <%# herb:disable erb-no-unsafe-raw %>
      <% end %>
    `)
  })

  test("keeps herb:disable on same line as ERB output inside while block", () => {
    expectFormattedToMatch(dedent`
      <% while items.any? %>
        <%= raw items.pop %> <%# herb:disable erb-no-unsafe-raw %>
      <% end %>
    `)
  })

  test("keeps herb:disable on same line as ERB output inside until block", () => {
    expectFormattedToMatch(dedent`
      <% until done? %>
        <%= raw next_item %> <%# herb:disable erb-no-unsafe-raw %>
      <% end %>
    `)
  })

  test("keeps herb:disable on same line as ERB output inside for block", () => {
    expectFormattedToMatch(dedent`
      <% for item in items %>
        <%= raw item %> <%# herb:disable erb-no-unsafe-raw %>
      <% end %>
    `)
  })

  test("keeps herb:disable on same line as ERB output inside case/when block", () => {
    expectFormattedToMatch(dedent`
      <% case status %>
      <% when "active" %>
        <%= raw active_content %> <%# herb:disable erb-no-unsafe-raw %>
      <% when "inactive" %>
        <%= raw inactive_content %> <%# herb:disable erb-no-unsafe-raw %>
      <% end %>
    `)
  })

  test("keeps herb:disable on same line as ERB output inside begin/rescue block", () => {
    expectFormattedToMatch(dedent`
      <% begin %>
        <%= raw try_content %> <%# herb:disable erb-no-unsafe-raw %>
      <% rescue StandardError %>
        <%= raw rescue_content %> <%# herb:disable erb-no-unsafe-raw %>
      <% end %>
    `)
  })

  test("keeps herb:disable on same line as ERB output inside ensure block", () => {
    expectFormattedToMatch(dedent`
      <% begin %>
        <%= content %>
      <% ensure %>
        <%= raw cleanup %> <%# herb:disable erb-no-unsafe-raw %>
      <% end %>
    `)
  })

  test("keeps multiple herb:disable comments on their respective lines inside if block", () => {
    expectFormattedToMatch(dedent`
      <% if condition %>
        <%= raw first %> <%# herb:disable erb-no-unsafe-raw %>
        <%= raw second %> <%# herb:disable erb-no-unsafe-raw %>
      <% end %>
    `)
  })

  test("keeps herb:disable on respective lines across if/else branches", () => {
    expectFormattedToMatch(dedent`
      <% if condition %>
        <%= raw content_a %> <%# herb:disable erb-no-unsafe-raw %>
      <% else %>
        <%= raw content_b %> <%# herb:disable erb-no-unsafe-raw %>
      <% end %>
    `)
  })

  test("keeps herb:disable inside nested if blocks", () => {
    expectFormattedToMatch(dedent`
      <% if outer %>
        <% if inner %>
          <%= raw content %> <%# herb:disable erb-no-unsafe-raw %>
        <% end %>
      <% end %>
    `)
  })

  test("keeps herb:disable inside if block nested in each loop", () => {
    expectFormattedToMatch(dedent`
      <% items.each do |item| %>
        <% if item.special? %>
          <%= raw item.content %> <%# herb:disable erb-no-unsafe-raw %>
        <% end %>
      <% end %>
    `)
  })

  test("keeps herb:disable after ERB output followed by HTML in if block", () => {
    expectFormattedToMatch(dedent`
      <% if show? %>
        <%= raw header %> <%# herb:disable erb-no-unsafe-raw %>
        <div>content</div>
      <% end %>
    `)
  })

  test("keeps herb:disable after ERB output preceded by HTML in if block", () => {
    expectFormattedToMatch(dedent`
      <% if show? %>
        <div>content</div>
        <%= raw footer %> <%# herb:disable erb-no-unsafe-raw %>
      <% end %>
    `)
  })

  test("standalone herb:disable in ERB block attaches to last line", () => {
    const source = dedent`
      <% if condition %>
        <div>content</div>
        <%# herb:disable some-rule %>
        <%= output %>
      <% end %>
    `

    const result = formatter.format(source)

    expect(result).toBe(dedent`
      <% if condition %>
        <div>content</div>
        <%= output %>
      <% end %> <%# herb:disable some-rule %>
    `)
  })

  test("keeps herb:disable after HTML element inside ERB if block", () => {
    expectFormattedToMatch(dedent`
      <% if condition %>
        <div>content</div> <%# herb:disable some-rule %>
        <%= output %>
      <% end %>
    `)
  })

  test("keeps herb:disable on same line as ERB output at document root", () => {
    expectFormattedToMatch(dedent`
      <%= raw content %> <%# herb:disable erb-no-unsafe-raw %>
    `)
  })

  test("standalone herb:disable in empty if block attaches to last line", () => {
    const source = dedent`
      <% if condition %>
        <%# herb:disable some-rule %>
      <% end %>
    `

    const result = formatter.format(source)

    expect(result).toBe(dedent`
      <% if condition %>
      <% end %> <%# herb:disable some-rule %>
    `)
  })

  test("herb:disable on same line as ERB action stays on that line", () => {
    expectFormattedToMatch(dedent`
      <% if condition %>
        <% perform_action %> <%# herb:disable some-rule %>
        <%= output %>
      <% end %>
    `)
  })

  test("standalone herb:disable between ERB statements attaches to last line", () => {
    const source = dedent`
      <% if condition %>
        <% perform_action %>
        <%# herb:disable some-rule %>
        <%= output %>
      <% end %>
    `

    const result = formatter.format(source)

    expect(result).toBe(dedent`
      <% if condition %>
        <% perform_action %>
        <%= output %>
      <% end %> <%# herb:disable some-rule %>
    `)
  })

  test("keeps herb:disable after ERB action in if block (duplicate check)", () => {
    expectFormattedToMatch(dedent`
      <% if condition %>
        <% perform_action %> <%# herb:disable some-rule %>
        <%= output %>
      <% end %>
    `)
  })

  test("keeps herb:disable on pre element opening tag", () => {
    expectFormattedToMatch(dedent`
      <pre> <%# herb:disable some-rule %>
        preserved   content
      </pre>
    `)
  })

  test("keeps herb:disable on script element opening tag", () => {
    expectFormattedToMatch(dedent`
      <script> <%# herb:disable some-rule %>
        console.log("hello");
      </script>
    `)
  })

  test("keeps herb:disable on style element opening tag", () => {
    expectFormattedToMatch(dedent`
      <style> <%# herb:disable some-rule %>
        .foo { color: red; }
      </style>
    `)
  })

  test("keeps herb:disable on textarea element opening tag", () => {
    expectFormattedToMatch(dedent`
      <textarea> <%# herb:disable some-rule %>
        preserved content here
      </textarea>
    `)
  })

  test("keeps herb:disable on void img element", () => {
    expectFormattedToMatch(dedent`
      <img src="photo.jpg"> <%# herb:disable html-img-require-alt %>
    `)
  })

  test("keeps herb:disable on br element inside block element", () => {
    expectFormattedToMatch(dedent`
      <div>
        <br> <%# herb:disable some-rule %>
        <p>content</p>
      </div>
    `)
  })

  test("keeps herb:disable on hr element inside block element", () => {
    expectFormattedToMatch(dedent`
      <div>
        <hr> <%# herb:disable some-rule %>
        <p>content</p>
      </div>
    `)
  })

  test("keeps herb:disable in deeply nested ERB blocks", () => {
    expectFormattedToMatch(dedent`
      <% items.each do |item| %>
        <% if item.visible? %>
          <% item.tags.each do |tag| %>
            <%= raw tag.name %> <%# herb:disable erb-no-unsafe-raw %>
          <% end %>
        <% end %>
      <% end %>
    `)
  })

  test("is idempotent for herb:disable on multiline open tag", () => {
    expectFormattedToMatch(dedent`
      <div
        data-controller="tooltip"
        data-tooltip-content="hello world"
        class="some-long-class-name another-class"
      > <%# herb:disable some-rule %>
        content
      </div>
    `, { passes: 2 })
  })

  test("is idempotent for herb:disable on closing tag", () => {
    expectFormattedToMatch(dedent`
      <DIV>
        Some content here that needs formatting.
      </DIV> <%# herb:disable html-tag-name-lowercase %>
    `, { passes: 2 })
  })

  test("is idempotent for herb:disable on inline element", () => {
    expectFormattedToMatch(dedent`
      <p>
        Some text with <span>inline content</span> here. <%# herb:disable some-rule %>
      </p>
    `, { passes: 2 })
  })

  test("is idempotent for herb:disable on ERB output in if block", () => {
    expectFormattedToMatch(dedent`
      <% if content_for(:pre_main) %>
        <%= raw content_for(:pre_main) %> <%# herb:disable erb-no-unsafe-raw %>
      <% end %>
    `, { passes: 2 })
  })

  test("is idempotent for herb:disable on pre element", () => {
    expectFormattedToMatch(dedent`
      <pre> <%# herb:disable some-rule %>
        preserved   content
      </pre>
    `, { passes: 2 })
  })
})
