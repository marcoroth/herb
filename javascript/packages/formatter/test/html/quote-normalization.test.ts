import { describe, test, expect, beforeAll } from "vitest"
import { Herb } from "@herb-tools/node-wasm"
import { Formatter } from "../../src"
import dedent from "dedent"

let formatter: Formatter

describe("Quote normalization", () => {
  beforeAll(async () => {
    await Herb.load()

    formatter = new Formatter(Herb, {
      indentWidth: 2,
      maxLineLength: 80
    })
  })

  test("preserves single quotes in simple attributes", () => {
    const source = "<div id='post'>Post</div>"

    const result = formatter.format(source)

    expect(result).toBe(dedent`
      <div id="post">
        Post
      </div>
    `)
  })

  test("preserves single quotes when value contains double quotes", () => {
    const source = `<div title='She said "Hello"'>Text</div>`

    const result = formatter.format(source)

    expect(result).toBe(dedent`
      <div title='She said "Hello"'>
        Text
      </div>
    `)
  })

  test("updates mixed quote styles", () => {
    const source = `<input type='text' name="user[email]" data-test='value "with" quotes' />`

    const result = formatter.format(source)

    expect(result).toBe(`<input type="text" name="user[email]" data-test='value "with" quotes' />`)
  })

  test("preserves double quotes", () => {
    const source = '<div id="post">Post</div>'

    const result = formatter.format(source)

    expect(result).toBe(dedent`
      <div id="post">
        Post
      </div>
    `)
  })

  test("should convert single quotes to double quotes when safe", () => {
    const source = "<div id='post' class='container'>Post</div>"

    const result = formatter.format(source)

    expect(result).toBe(dedent`
      <div id="post" class="container">
        Post
      </div>
    `)
  })

  test("should keep single quotes when value contains double quotes", () => {
    const source = `<div title='She said "Hello"' data-msg='The "best" option'>Text</div>`

    const result = formatter.format(source)

    expect(result).toBe(dedent`
      <div title='She said "Hello"' data-msg='The "best" option'>
        Text
      </div>
    `)
  })

  test("should handle mixed scenarios correctly", () => {
    const source = dedent`
      <div id='simple'
           title='Contains "quotes"'
           class='another-simple'
           data-json='{"key": "value"}'
           name="already-double">
        Content
      </div>
    `

    const result = formatter.format(source)

    expect(result).toBe(dedent`
      <div
        id="simple"
        title='Contains "quotes"'
        class="another-simple"
        data-json='{"key": "value"}'
        name="already-double"
      >
        Content
      </div>
    `)
  })

  test("should handle ERB expressions in attributes", () => {
    const source = `<div id='<%= item.id %>' class='item-<%= index %>'>Item</div>`

    const result = formatter.format(source)

    expect(result).toBe(dedent`
      <div id="<%= item.id %>" class="item-<%= index %>">
        Item
      </div>
    `)
  })

  test("should handle apostrophes in attribute values", () => {
    const source = `<div title="It's working" data-msg='Don't worry'>Text</div>`

    const result = formatter.format(source)

    expect(result).toBe(dedent`
      <div title="It's working" data-msg='Don't worry'>Text</div>
    `)
  })

  describe("Edge cases", () => {
    test("handles attributes without quotes", () => {
      const source = `<input type=text value=hello disabled>`

      const result = formatter.format(source)

      expect(result).toBe(dedent`
        <input type="text" value="hello" disabled>
      `)
    })

    test("handles empty attribute values with single quotes", () => {
      const source = `<div data-value=''>Empty</div>`

      const result = formatter.format(source)

      expect(result).toBe(dedent`
        <div data-value="">
          Empty
        </div>
      `)
    })

    test("handles empty attribute values with double quotes", () => {
      const source = `<div data-value="">Empty</div>`

      const result = formatter.format(source)

      expect(result).toBe(dedent`
        <div data-value="">
          Empty
        </div>
      `)
    })

    test("handles boolean attributes", () => {
      const source = `<input type='checkbox' checked disabled readonly />`

      const result = formatter.format(source)

      expect(result).toBe(dedent`
        <input
          type="checkbox"
          checked
          disabled
          readonly
        />
      `)
    })

    test("handles data attributes with complex JSON", () => {
      const source = `<div data-config='{"items": ["one", "two"], "enabled": true}'>Config</div>`

      const result = formatter.format(source)

      expect(result).toBe(dedent`
        <div data-config='{"items": ["one", "two"], "enabled": true}'>
          Config
        </div>
      `)
    })

    test("handles escaped quotes in attribute values", () => {
      const source = `<div title='It\\'s "complicated"' data-msg="She said \\"Hello\\"">Text</div>`

      const result = formatter.format(source)

      expect(result).toBe(`<div title='It\\'s "complicated"' data-msg="She said \\"Hello\\"">Text</div>`)
    })

    test("handles URLs with query parameters", () => {
      const source = `<a href='https://example.com?param="value"&other=true'>Link</a>`

      const result = formatter.format(source)

      expect(result).toBe(`<a href='https://example.com?param="value"&other=true'>Link</a>`)
    })

    test("handles inline styles with quotes", () => {
      const source = `<div style='font-family: "Arial", sans-serif'>Styled</div>`

      const result = formatter.format(source)

      expect(result).toBe(dedent`
        <div style='font-family: "Arial", sans-serif'>
          Styled
        </div>
      `)
    })

    test("handles multiple ERB expressions", () => {
      const source = `<div class='<%= "active" if active? %> <%= "highlight" if highlighted? %>'>Content</div>`

      const result = formatter.format(source)

      expect(result).toBe(dedent`
        <div class='<%= "active" if active? %> <%= "highlight" if highlighted? %>'>
          Content
        </div>
      `)
    })

    test("handles HTML entities in attribute values", () => {
      const source = `<div title='&quot;Quoted&quot; &amp; Special'>Entity test</div>`

      const result = formatter.format(source)

      expect(result).toBe(dedent`
        <div title="&quot;Quoted&quot; &amp; Special">
          Entity test
        </div>
      `)
    })

    test("handles mixed newlines in attribute values", () => {
      const source = `<textarea placeholder='Line 1\nLine 2'>Text</textarea>`

      const result = formatter.format(source)

      expect(result).toBe(dedent`
        <textarea placeholder="Line 1\nLine 2">
          Text
        </textarea>
      `)
    })

    test("handles self-closing tags with mixed quotes", () => {
      const source = `<img src='image.jpg' alt="My Image" data-caption='The "best" photo' />`

      const result = formatter.format(source)

      expect(result).toBe(`<img src="image.jpg" alt="My Image" data-caption='The "best" photo' />`)
    })

    test("handles void elements with quotes", () => {
      const source = `<input type='text' value='hello'><br>`

      const result = formatter.format(source)

      expect(result).toBe(`<input type="text" value="hello">\n\n<br>`)
    })

    test("handles ARIA attributes with quotes", () => {
      const source = `<div role='button' aria-label='Click "here" to continue'>Button</div>`

      const result = formatter.format(source)

      expect(result).toBe(dedent`
        <div role="button" aria-label='Click "here" to continue'>
          Button
        </div>
      `)
    })

    test("handles custom data attributes with special characters", () => {
      const source = `<div data-tooltip='Use "Ctrl+S" to save' data-shortcut='cmd+s'>Save</div>`

      const result = formatter.format(source)

      expect(result).toBe(dedent`
        <div data-tooltip='Use "Ctrl+S" to save' data-shortcut="cmd+s">
          Save
        </div>
      `)
    })
  })

  describe("Consistency checks", () => {
    test("maintains consistent quoting across similar attributes", () => {
      const source = `<form action='/submit' method='post' enctype='multipart/form-data'>Form</form>`

      const result = formatter.format(source)

      expect(result).toBe(dedent`
        <form action="/submit" method="post" enctype="multipart/form-data">
          Form
        </form>
      `)
    })

    test("handles adjacent elements with different quote styles", () => {
      const source = dedent`
        <span class='first'>One</span>
        <span class="second">Two</span>
        <span class='third'>Three</span>
      `

      const result = formatter.format(source)

      expect(result).toBe(dedent`
        <span class="first">One</span>

        <span class="second">Two</span>

        <span class="third">Three</span>
      `)
    })
  })
})
