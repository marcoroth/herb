import { describe, test, expect, beforeAll } from "vitest"
import { Herb } from "@herb-tools/node-wasm"
import { Linter } from "../../src/linter.js"
import { HTMLValidateElementsAttributesRule } from "../../src/rules/html-validate-elements-attributes.js"

describe("html-validate-elements-attributes", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  describe("element validation", () => {
    test("passes for valid HTML elements", () => {
      const html = `
        <div></div>
        <span></span>
        <p></p>
        <a></a>
        <img />
        <input />
        <form></form>
        <button></button>
      `

      const linter = new Linter(Herb, [HTMLValidateElementsAttributesRule])
      const lintResult = linter.lint(html)

      expect(lintResult.errors).toBe(0)
      expect(lintResult.warnings).toBe(0)
      expect(lintResult.offenses).toHaveLength(0)
    })

    test("passes for valid SVG elements", () => {
      const html = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512">
          <path d="M400 64h-48L200 64 48 64C21.49 64 0 85.49 0 112v288c0 26.51 21.49 48 48 48h352c26.51 0 48-21.49 48-48V112c0-26.51-21.49-48-48-48z"/>
          <circle cx="50" cy="50" r="40" fill="red"/>
          <rect x="10" y="10" width="100" height="100"/>
          <g transform="translate(10, 10)">
            <text x="20" y="20">Hello</text>
          </g>
        </svg>
      `

      const linter = new Linter(Herb, [HTMLValidateElementsAttributesRule])
      const lintResult = linter.lint(html)

      expect(lintResult.errors).toBe(0)
      expect(lintResult.warnings).toBe(0)
      expect(lintResult.offenses).toHaveLength(0)
    })

    test("passes for SVG elements with fill and stroke attributes", () => {
      const html = `
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12"/>
        </svg>
      `

      const linter = new Linter(Herb, [HTMLValidateElementsAttributesRule])
      const lintResult = linter.lint(html)

      expect(lintResult.errors).toBe(0)
      expect(lintResult.warnings).toBe(0)
      expect(lintResult.offenses).toHaveLength(0)
    })

    test("passes for SVG path with fill-rule and clip-rule attributes", () => {
      const html = `
        <svg viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" clip-rule="evenodd" d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 011.06.02z"/>
        </svg>
      `

      const linter = new Linter(Herb, [HTMLValidateElementsAttributesRule])
      const lintResult = linter.lint(html)

      expect(lintResult.errors).toBe(0)
      expect(lintResult.warnings).toBe(0)
      expect(lintResult.offenses).toHaveLength(0)
    })

    test("passes for custom elements with hyphens", () => {
      const html = `
        <my-component></my-component>
        <custom-button></custom-button>
        <x-widget />
      `

      const linter = new Linter(Herb, [HTMLValidateElementsAttributesRule])
      const lintResult = linter.lint(html)

      expect(lintResult.errors).toBe(0)
      expect(lintResult.warnings).toBe(0)
      expect(lintResult.offenses).toHaveLength(0)
    })

    test("fails for unknown HTML elements", () => {
      const html = `<invalidtag></invalidtag>`

      const linter = new Linter(Herb, [HTMLValidateElementsAttributesRule])
      const lintResult = linter.lint(html)

      expect(lintResult.errors).toBe(1)
      expect(lintResult.warnings).toBe(0)
      expect(lintResult.offenses).toHaveLength(1)
      expect(lintResult.offenses[0].message).toBe(
        "Unknown HTML element `<invalidtag>`. This element is not part of the HTML specification."
      )
    })

    test("fails for multiple unknown elements", () => {
      const html = `
        <foo></foo>
        <bar />
        <baz></baz>
      `

      const linter = new Linter(Herb, [HTMLValidateElementsAttributesRule])
      const lintResult = linter.lint(html)

      expect(lintResult.errors).toBe(3)
      expect(lintResult.warnings).toBe(0)
      expect(lintResult.offenses).toHaveLength(3)
    })
  })

  describe("attribute validation", () => {
    test("passes for valid global attributes", () => {
      const html = `
        <div id="test" class="container" style="color: red;" title="Tooltip">
          <span lang="en" dir="ltr" tabindex="0"></span>
          <p hidden draggable="true" contenteditable="true"></p>
        </div>
      `

      const linter = new Linter(Herb, [HTMLValidateElementsAttributesRule])
      const lintResult = linter.lint(html)

      expect(lintResult.errors).toBe(0)
      expect(lintResult.warnings).toBe(0)
      expect(lintResult.offenses).toHaveLength(0)
    })

    test("passes for data-* attributes", () => {
      const html = `
        <div data-id="123" data-user-name="john" data-value="test"></div>
      `

      const linter = new Linter(Herb, [HTMLValidateElementsAttributesRule])
      const lintResult = linter.lint(html)

      expect(lintResult.errors).toBe(0)
      expect(lintResult.warnings).toBe(0)
      expect(lintResult.offenses).toHaveLength(0)
    })

    test("passes for aria-* attributes", () => {
      const html = `
        <div aria-label="Menu" aria-hidden="true" aria-expanded="false"></div>
      `

      const linter = new Linter(Herb, [HTMLValidateElementsAttributesRule])
      const lintResult = linter.lint(html)

      expect(lintResult.errors).toBe(0)
      expect(lintResult.warnings).toBe(0)
      expect(lintResult.offenses).toHaveLength(0)
    })

    test("passes for event handler attributes", () => {
      const html = `
        <button onclick="handleClick()" onmouseover="handleHover()"></button>
        <input onchange="handleChange()" onfocus="handleFocus()" />
      `

      const linter = new Linter(Herb, [HTMLValidateElementsAttributesRule])
      const lintResult = linter.lint(html)

      expect(lintResult.errors).toBe(0)
      expect(lintResult.warnings).toBe(0)
      expect(lintResult.offenses).toHaveLength(0)
    })

    test("passes for valid element-specific attributes", () => {
      const html = `
        <a href="/home" target="_blank" rel="noopener">Link</a>
        <img src="/image.jpg" alt="Description" width="100" height="100" />
        <input type="text" name="username" placeholder="Enter name" required />
        <form action="/submit" method="post" enctype="multipart/form-data"></form>
        <button type="submit" name="submit" disabled>Submit</button>
      `

      const linter = new Linter(Herb, [HTMLValidateElementsAttributesRule])
      const lintResult = linter.lint(html)

      expect(lintResult.errors).toBe(0)
      expect(lintResult.warnings).toBe(0)
      expect(lintResult.offenses).toHaveLength(0)
    })

    test("fails for invalid attributes on elements", () => {
      const html = `<div href="/link">Content</div>`

      const linter = new Linter(Herb, [HTMLValidateElementsAttributesRule])
      const lintResult = linter.lint(html)

      expect(lintResult.errors).toBe(1)
      expect(lintResult.warnings).toBe(0)
      expect(lintResult.offenses).toHaveLength(1)
      expect(lintResult.offenses[0].message).toBe(
        "Invalid attribute `href` for `<div>` element. This attribute is not valid for this HTML element."
      )
    })

    test("fails for multiple invalid attributes", () => {
      const html = `
        <span type="text" placeholder="test"></span>
        <p src="/image.jpg"></p>
      `

      const linter = new Linter(Herb, [HTMLValidateElementsAttributesRule])
      const lintResult = linter.lint(html)

      expect(lintResult.errors).toBe(3)
      expect(lintResult.warnings).toBe(0)
      expect(lintResult.offenses).toHaveLength(3)
    })

    test("passes for input with type-specific attributes", () => {
      const html = `
        <input type="number" min="0" max="100" step="5" />
        <input type="email" pattern="[a-z0-9._%+-]+@[a-z0-9.-]+\\.[a-z]{2,}$" />
        <input type="file" accept="image/*" multiple />
        <input type="checkbox" checked />
      `

      const linter = new Linter(Herb, [HTMLValidateElementsAttributesRule])
      const lintResult = linter.lint(html)

      expect(lintResult.errors).toBe(0)
      expect(lintResult.warnings).toBe(0)
      expect(lintResult.offenses).toHaveLength(0)
    })

    test("passes for video and audio elements with media attributes", () => {
      const html = `
        <video src="/video.mp4" controls autoplay muted poster="/poster.jpg"></video>
        <audio src="/audio.mp3" controls loop preload="auto"></audio>
      `

      const linter = new Linter(Herb, [HTMLValidateElementsAttributesRule])
      const lintResult = linter.lint(html)

      expect(lintResult.errors).toBe(0)
      expect(lintResult.warnings).toBe(0)
      expect(lintResult.offenses).toHaveLength(0)
    })
  })

  describe("ERB handling", () => {
    test("skips VALUE validation for attributes with ERB output tags", () => {
      const html = `
        <input type="text" value="<%= user.name %>">
        <a href="<%= link_path %>">Link</a>
        <div class="<%= css_class %>">Content</div>
      `

      const linter = new Linter(Herb, [HTMLValidateElementsAttributesRule])
      const lintResult = linter.lint(html)

      expect(lintResult.errors).toBe(0)
      expect(lintResult.warnings).toBe(0)
      expect(lintResult.offenses).toHaveLength(0)
    })

    test("skips VALUE validation for attributes with ERB control flow", () => {
      const html = `
        <input type="<% if admin %>email<% else %>text<% end %>">
        <div class="<% unless mobile %>desktop<% end %>">Content</div>
        <a href="<% case type when 'admin' then admin_path else user_path end %>">Link</a>
      `

      const linter = new Linter(Herb, [HTMLValidateElementsAttributesRule])
      const lintResult = linter.lint(html)

      expect(lintResult.errors).toBe(0)
      expect(lintResult.warnings).toBe(0)
      expect(lintResult.offenses).toHaveLength(0)
    })

    test("skips validation for attributes with ERB iterations", () => {
      const html = `
        <div data-items="<% @items.each do |item| %><%= item.name %><% end %>">
        <select name="<% for option in options %><%= option %><% end %>">
      `

      const linter = new Linter(Herb, [HTMLValidateElementsAttributesRule])
      const lintResult = linter.lint(html)

      expect(lintResult.errors).toBe(0)
      expect(lintResult.warnings).toBe(0)
      expect(lintResult.offenses).toHaveLength(0)
    })

    test("skips validation for attributes with mixed ERB and static content", () => {
      const html = `
        <input type="text" value="Hello <%= user.name %>!">
        <div class="prefix-<%= dynamic_class %>-suffix">Content</div>
        <a href="/users/<%= user.id %>/profile">Profile</a>
      `

      const linter = new Linter(Herb, [HTMLValidateElementsAttributesRule])
      const lintResult = linter.lint(html)

      expect(lintResult.errors).toBe(0)
      expect(lintResult.warnings).toBe(0)
      expect(lintResult.offenses).toHaveLength(0)
    })

    test("skips validation for complex ERB expressions", () => {
      const html = `
        <input type="<%= current_user&.admin? ? 'admin' : 'user' %>">
        <div class="<%= ['base', ('active' if active), modifier_class].compact.join(' ') %>">
        <a href="<%= url_for([@namespace, @resource]) %>">Link</a>
      `

      const linter = new Linter(Herb, [HTMLValidateElementsAttributesRule])
      const lintResult = linter.lint(html)

      expect(lintResult.errors).toBe(0)
      expect(lintResult.warnings).toBe(0)
      expect(lintResult.offenses).toHaveLength(0)
    })

    test("validates static attributes normally even when other attributes have ERB", () => {
      const html = `
        <input type="invalid-type" value="<%= user.name %>">
      `

      const linter = new Linter(Herb, [HTMLValidateElementsAttributesRule])
      const lintResult = linter.lint(html)

      expect(lintResult.errors).toBe(1)
      expect(lintResult.warnings).toBe(0)
      expect(lintResult.offenses).toHaveLength(1)
      expect(lintResult.offenses[0].message).toBe(
        'Invalid value "invalid-type" for `type` on `<input>`. Must be one of: `button`, `checkbox`, `color`, `date`, `datetime-local`, `email`, `file`, `hidden`, `image`, `month`, `number`, `password`, `radio`, `range`, `reset`, `search`, `submit`, `tel`, `text`, `time`, `url`, `week`.'
      )
    })

    test("validates attributes without ERB normally", () => {
      const html = `
        <div invalid-attr="static-value">Content</div>
        <input type="invalid-type" value="static">
        <a href="not a valid url">Link</a>
      `

      const linter = new Linter(Herb, [HTMLValidateElementsAttributesRule])
      const lintResult = linter.lint(html)

      expect(lintResult.errors).toBe(3)
      expect(lintResult.warnings).toBe(0)
      expect(lintResult.offenses).toHaveLength(3)
    })

    test("handles ERB with special characters and quotes", () => {
      const html = `
        <input type="text" value='<%= "Hello #{user.name}!" %>'>
        <div class="<%= 'class-' + modifier.gsub('_', '-') %>">Content</div>
        <a href="<%= path_with_params(id: @user.id, format: 'json') %>">API</a>
      `

      const linter = new Linter(Herb, [HTMLValidateElementsAttributesRule])
      const lintResult = linter.lint(html)

      expect(lintResult.errors).toBe(0)
      expect(lintResult.warnings).toBe(0)
      expect(lintResult.offenses).toHaveLength(0)
    })

    test("handles ERB with HTML-like content in strings", () => {
      const html = `
        <input type="text" value="<%= '<div>HTML in ERB</div>' %>">
        <div title="<%= 'Tooltip with <strong>HTML</strong>' %>">Content</div>
      `

      const linter = new Linter(Herb, [HTMLValidateElementsAttributesRule])
      const lintResult = linter.lint(html)

      expect(lintResult.errors).toBe(0)
      expect(lintResult.warnings).toBe(0)
      expect(lintResult.offenses).toHaveLength(0)
    })

    test("validates boolean attributes correctly when they contain ERB", () => {
      const html = `
        <input type="checkbox" checked="<%= user.admin? %>">
        <button disabled="<%= processing? %>">Submit</button>
      `

      const linter = new Linter(Herb, [HTMLValidateElementsAttributesRule])
      const lintResult = linter.lint(html)

      expect(lintResult.errors).toBe(0)
      expect(lintResult.warnings).toBe(0)
      expect(lintResult.offenses).toHaveLength(0)
    })

    test("still validates invalid attribute NAMES even when values contain ERB", () => {
      const html = `
        <div invalid-attr="<%= some_value %>">Content</div>
        <span unknown-attribute="<%= dynamic_value %>">Text</span>
      `

      const linter = new Linter(Herb, [HTMLValidateElementsAttributesRule])
      const lintResult = linter.lint(html)

      expect(lintResult.errors).toBe(2)
      expect(lintResult.warnings).toBe(0)
      expect(lintResult.offenses).toHaveLength(2)
      expect(lintResult.offenses[0].message).toBe(
        "Invalid attribute `invalid-attr` for `<div>` element. This attribute is not valid for this HTML element."
      )
      expect(lintResult.offenses[1].message).toBe(
        "Invalid attribute `unknown-attribute` for `<span>` element. This attribute is not valid for this HTML element."
      )
    })
  })

  describe("custom elements", () => {
    test("skips attribute validation for custom elements", () => {
      const html = `
        <my-component any-attr="value" another="test"></my-component>
        <custom-widget invalid="should-pass" random="attribute"></custom-widget>
      `

      const linter = new Linter(Herb, [HTMLValidateElementsAttributesRule])
      const lintResult = linter.lint(html)

      expect(lintResult.errors).toBe(0)
      expect(lintResult.warnings).toBe(0)
      expect(lintResult.offenses).toHaveLength(0)
    })

    test("validates global attribute values on custom elements but allows custom attributes", () => {
      const html = `
        <my-button
          custom-attr="anything"
          framework-specific="whatever"
          class="valid-class"
          id="valid-id"
          tabindex="0">
          Button
        </my-button>
      `

      const linter = new Linter(Herb, [HTMLValidateElementsAttributesRule])
      const lintResult = linter.lint(html)

      expect(lintResult.errors).toBe(0)
      expect(lintResult.warnings).toBe(0)
      expect(lintResult.offenses).toHaveLength(0)
    })

    test("allows custom attributes on custom elements", () => {
      const html = `<my-button framework-attr="value" any-name="test">Button</my-button>`

      const linter = new Linter(Herb, [HTMLValidateElementsAttributesRule])
      const lintResult = linter.lint(html)

      expect(lintResult.errors).toBe(0)
      expect(lintResult.warnings).toBe(0)
      expect(lintResult.offenses).toHaveLength(0)
    })

    test("skips value validation for ERB attributes on custom elements", () => {
      const html = `<my-button class="<%= dynamic_class %>">Button</my-button>`

      const linter = new Linter(Herb, [HTMLValidateElementsAttributesRule])
      const lintResult = linter.lint(html)

      expect(lintResult.errors).toBe(0)
      expect(lintResult.warnings).toBe(0)
      expect(lintResult.offenses).toHaveLength(0)
    })
  })

  describe("case sensitivity", () => {
    test("handles mixed case element names", () => {
      const html = `
        <DIV id="test"></DIV>
        <SPAN class="text"></SPAN>
      `

      const linter = new Linter(Herb, [HTMLValidateElementsAttributesRule])
      const lintResult = linter.lint(html)

      expect(lintResult.errors).toBe(0)
      expect(lintResult.warnings).toBe(0)
      expect(lintResult.offenses).toHaveLength(0)
    })

    test("handles mixed case attribute names", () => {
      const html = `
        <div ID="test" CLASS="container" STYLE="color: red;"></div>
      `

      const linter = new Linter(Herb, [HTMLValidateElementsAttributesRule])
      const lintResult = linter.lint(html)

      expect(lintResult.errors).toBe(0)
      expect(lintResult.warnings).toBe(0)
      expect(lintResult.offenses).toHaveLength(0)
    })
  })

  describe("special elements", () => {
    test("validates style element with type attribute", () => {
      const html = `
        <head>
          <style type="text/css">
            body { margin: 0; }
          </style>
          <style media="screen" nonce="abc123" title="Main Styles">
            .container { width: 100%; }
          </style>
        </head>
      `

      const linter = new Linter(Herb, [HTMLValidateElementsAttributesRule])
      const lintResult = linter.lint(html)

      expect(lintResult.errors).toBe(0)
      expect(lintResult.warnings).toBe(0)
      expect(lintResult.offenses).toHaveLength(0)
    })

    test("validates meta element attributes", () => {
      const html = `
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta property="og:title" content="Page Title" />
      `

      const linter = new Linter(Herb, [HTMLValidateElementsAttributesRule])
      const lintResult = linter.lint(html)

      expect(lintResult.errors).toBe(0)
      expect(lintResult.warnings).toBe(0)
      expect(lintResult.offenses).toHaveLength(0)
    })

    test("validates link element attributes", () => {
      const html = `
        <link rel="stylesheet" href="/styles.css" type="text/css" />
        <link rel="icon" href="/favicon.ico" sizes="16x16" />
      `

      const linter = new Linter(Herb, [HTMLValidateElementsAttributesRule])
      const lintResult = linter.lint(html)

      expect(lintResult.errors).toBe(0)
      expect(lintResult.warnings).toBe(0)
      expect(lintResult.offenses).toHaveLength(0)
    })

    test("validates apple-touch-icon link elements", () => {
      const html = `
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
        <link rel="apple-touch-icon" sizes="144x144" href="/apple-icon-144x144.png">
        <link rel="apple-touch-icon" sizes="152x152" href="/apple-icon-152x152.png">
      `

      const linter = new Linter(Herb, [HTMLValidateElementsAttributesRule])
      const lintResult = linter.lint(html)

      expect(lintResult.errors).toBe(0)
      expect(lintResult.warnings).toBe(0)
      expect(lintResult.offenses).toHaveLength(0)
    })

    test("validates script element attributes", () => {
      const html = `
        <script src="/app.js" type="module" async defer></script>
        <script integrity="sha384-..." crossorigin="anonymous"></script>
      `

      const linter = new Linter(Herb, [HTMLValidateElementsAttributesRule])
      const lintResult = linter.lint(html)

      expect(lintResult.errors).toBe(0)
      expect(lintResult.warnings).toBe(0)
      expect(lintResult.offenses).toHaveLength(0)
    })

    test("validates table element attributes", () => {
      const html = `
        <table border="1">
          <tr>
            <th colspan="2" rowspan="1" scope="col">Header</th>
            <td colspan="1" rowspan="2">Cell</td>
          </tr>
        </table>
      `

      const linter = new Linter(Herb, [HTMLValidateElementsAttributesRule])
      const lintResult = linter.lint(html)

      expect(lintResult.errors).toBe(0)
      expect(lintResult.warnings).toBe(0)
      expect(lintResult.offenses).toHaveLength(0)
    })
  })

  describe("documentation bad examples", () => {
    test("fails for unknown HTML element", () => {
      const html = `<invalidtag>Content</invalidtag>`

      const linter = new Linter(Herb, [HTMLValidateElementsAttributesRule])
      const lintResult = linter.lint(html)

      expect(lintResult.errors).toBe(1)
      expect(lintResult.warnings).toBe(0)
      expect(lintResult.offenses).toHaveLength(1)
      expect(lintResult.offenses[0].message).toBe("Unknown HTML element `<invalidtag>`. This element is not part of the HTML specification.")
    })

    test("fails for invalid href attribute on div", () => {
      const html = `<div href="/link">Not a link</div>`

      const linter = new Linter(Herb, [HTMLValidateElementsAttributesRule])
      const lintResult = linter.lint(html)

      expect(lintResult.errors).toBe(1)
      expect(lintResult.warnings).toBe(0)
      expect(lintResult.offenses).toHaveLength(1)
      expect(lintResult.offenses[0].message).toBe("Invalid attribute `href` for `<div>` element. This attribute is not valid for this HTML element.")
    })

    test("fails for invalid placeholder attribute on span", () => {
      const html = `<span placeholder="Enter text"></span>`

      const linter = new Linter(Herb, [HTMLValidateElementsAttributesRule])
      const lintResult = linter.lint(html)

      expect(lintResult.errors).toBe(1)
      expect(lintResult.warnings).toBe(0)
      expect(lintResult.offenses).toHaveLength(1)
      expect(lintResult.offenses[0].message).toBe("Invalid attribute `placeholder` for `<span>` element. This attribute is not valid for this HTML element.")
    })

    test("fails for invalid input type value", () => {
      const html = `<input type="invalid-type">`

      const linter = new Linter(Herb, [HTMLValidateElementsAttributesRule])
      const lintResult = linter.lint(html)

      expect(lintResult.errors).toBe(1)
      expect(lintResult.warnings).toBe(0)
      expect(lintResult.offenses).toHaveLength(1)
      expect(lintResult.offenses[0].message).toBe('Invalid value "invalid-type" for `type` on `<input>`. Must be one of: `button`, `checkbox`, `color`, `date`, `datetime-local`, `email`, `file`, `hidden`, `image`, `month`, `number`, `password`, `radio`, `range`, `reset`, `search`, `submit`, `tel`, `text`, `time`, `url`, `week`.')
    })

    test("fails for boolean attribute with invalid value", () => {
      const html = `<input required="false">`

      const linter = new Linter(Herb, [HTMLValidateElementsAttributesRule])
      const lintResult = linter.lint(html)

      expect(lintResult.errors).toBe(1)
      expect(lintResult.warnings).toBe(0)
      expect(lintResult.offenses).toHaveLength(1)
      expect(lintResult.offenses[0].message).toBe("Boolean attribute `required` on `<input>` should not have a value. Use `required` or omit the attribute.")
    })

    test("fails for invalid URL in href attribute", () => {
      const html = `<a href="not a valid url">Link</a>`

      const linter = new Linter(Herb, [HTMLValidateElementsAttributesRule])
      const lintResult = linter.lint(html)

      expect(lintResult.errors).toBe(1)
      expect(lintResult.warnings).toBe(0)
      expect(lintResult.offenses).toHaveLength(1)
      expect(lintResult.offenses[0].message).toBe('Invalid URL for `href` on `<a>`. "not a valid url" is not a valid URL.')
    })

    test("fails for non-numeric tabindex value", () => {
      const html = `<input tabindex="not-a-number">`

      const linter = new Linter(Herb, [HTMLValidateElementsAttributesRule])
      const lintResult = linter.lint(html)

      expect(lintResult.errors).toBe(1)
      expect(lintResult.warnings).toBe(0)
      expect(lintResult.offenses).toHaveLength(1)
      expect(lintResult.offenses[0].message).toBe('Invalid number for `tabindex` on `<input>`. Expected a number, got "not-a-number".')
    })

    test("fails for tabindex value out of range", () => {
      const html = `<input tabindex="-5">`

      const linter = new Linter(Herb, [HTMLValidateElementsAttributesRule])
      const lintResult = linter.lint(html)

      expect(lintResult.errors).toBe(1)
      expect(lintResult.warnings).toBe(0)
      expect(lintResult.offenses).toHaveLength(1)
      expect(lintResult.offenses[0].message).toBe("Value for `tabindex` on `<input>` must be at least `-1`, got `-5`.")
    })

    test("fails for invalid CSS class name", () => {
      const html = `<div class="123invalid">Content</div>`

      const linter = new Linter(Herb, [HTMLValidateElementsAttributesRule])
      const lintResult = linter.lint(html)

      expect(lintResult.errors).toBe(1)
      expect(lintResult.warnings).toBe(0)
      expect(lintResult.offenses).toHaveLength(1)
      expect(lintResult.offenses[0].message).toBe('Invalid CSS class name "123invalid" in `class` on `<div>`. Class names must be valid CSS identifiers.')
    })

    test("fails for invalid ID reference in for attribute", () => {
      const html = `<label for="123invalid">Label</label>`

      const linter = new Linter(Herb, [HTMLValidateElementsAttributesRule])
      const lintResult = linter.lint(html)

      expect(lintResult.errors).toBe(1)
      expect(lintResult.warnings).toBe(0)
      expect(lintResult.offenses).toHaveLength(1)
      expect(lintResult.offenses[0].message).toBe('Invalid ID reference for `for` on `<label>`. "123invalid" is not a valid element ID.')
    })

    test("fails for invalid form method value", () => {
      const html = `<form method="invalid">`

      const linter = new Linter(Herb, [HTMLValidateElementsAttributesRule])
      const lintResult = linter.lint(html)

      expect(lintResult.errors).toBe(1)
      expect(lintResult.warnings).toBe(0)
      expect(lintResult.offenses).toHaveLength(1)
      expect(lintResult.offenses[0].message).toBe('Invalid value "invalid" for `method` on `<form>`. Must be one of: `get`, `post`, `dialog`.')
    })

    test("fails for invalid button type value", () => {
      const html = `<button type="invalid">Button</button>`

      const linter = new Linter(Herb, [HTMLValidateElementsAttributesRule])
      const lintResult = linter.lint(html)

      expect(lintResult.errors).toBe(1)
      expect(lintResult.warnings).toBe(0)
      expect(lintResult.offenses).toHaveLength(1)
      expect(lintResult.offenses[0].message).toBe('Invalid value "invalid" for `type` on `<button>`. Must be one of: `button`, `submit`, `reset`.')
    })

    test("fails for invalid attribute name even with ERB value", () => {
      const html = `<div some-attr="<%= dynamic_value %>">Content</div>`

      const linter = new Linter(Herb, [HTMLValidateElementsAttributesRule])
      const lintResult = linter.lint(html)

      expect(lintResult.errors).toBe(1)
      expect(lintResult.warnings).toBe(0)
      expect(lintResult.offenses).toHaveLength(1)
      expect(lintResult.offenses[0].message).toBe("Invalid attribute `some-attr` for `<div>` element. This attribute is not valid for this HTML element.")
    })
  })

  describe("attribute value validation", () => {
    test("validates boolean attributes", () => {
      const html = `
        <input type="text" required>
        <input type="checkbox" checked>
        <button disabled>Submit</button>
      `

      const linter = new Linter(Herb, [HTMLValidateElementsAttributesRule])
      const lintResult = linter.lint(html)

      expect(lintResult.errors).toBe(0)
      expect(lintResult.warnings).toBe(0)
      expect(lintResult.offenses).toHaveLength(0)
    })

    test("fails for boolean attributes with invalid values", () => {
      const html = `<input required="false">`

      const linter = new Linter(Herb, [HTMLValidateElementsAttributesRule])
      const lintResult = linter.lint(html)

      expect(lintResult.errors).toBe(1)
      expect(lintResult.offenses[0].message).toBe(
        "Boolean attribute `required` on `<input>` should not have a value. Use `required` or omit the attribute."
      )
    })

    test("validates enum attributes", () => {
      const html = `
        <input type="email" autocomplete="email">
        <a target="_blank" href="/link">Link</a>
        <form method="post" enctype="multipart/form-data">
          <button type="submit">Submit</button>
        </form>
      `

      const linter = new Linter(Herb, [HTMLValidateElementsAttributesRule])
      const lintResult = linter.lint(html)

      expect(lintResult.errors).toBe(0)
      expect(lintResult.warnings).toBe(0)
      expect(lintResult.offenses).toHaveLength(0)
    })

    test("validates form with method='dialog' inside dialog element", () => {
      const html = `
        <dialog>
          <form method="dialog">
            <button type="submit" value="cancel">Cancel</button>
            <button type="submit" value="confirm">Confirm</button>
          </form>
        </dialog>
      `

      const linter = new Linter(Herb, [HTMLValidateElementsAttributesRule])
      const lintResult = linter.lint(html)

      expect(lintResult.errors).toBe(0)
      expect(lintResult.warnings).toBe(0)
      expect(lintResult.offenses).toHaveLength(0)
    })

    test("fails for invalid enum values", () => {
      const html = `<input type="invalid-type">`

      const linter = new Linter(Herb, [HTMLValidateElementsAttributesRule])
      const lintResult = linter.lint(html)

      expect(lintResult.errors).toBe(1)
      expect(lintResult.offenses[0].message).toBe(
        'Invalid value "invalid-type" for `type` on `<input>`. Must be one of: `button`, `checkbox`, `color`, `date`, `datetime-local`, `email`, `file`, `hidden`, `image`, `month`, `number`, `password`, `radio`, `range`, `reset`, `search`, `submit`, `tel`, `text`, `time`, `url`, `week`.'
      )
    })

    test("validates number attributes", () => {
      const html = `
        <input type="number" min="0" max="100" step="5">
        <img width="300" height="200" src="/image.jpg" alt="Image">
        <meter value="0.6" max="1.0">60%</meter>
      `

      const linter = new Linter(Herb, [HTMLValidateElementsAttributesRule])
      const lintResult = linter.lint(html)

      expect(lintResult.errors).toBe(0)
      expect(lintResult.warnings).toBe(0)
      expect(lintResult.offenses).toHaveLength(0)
    })

    test("fails for invalid number values", () => {
      const html = `<input tabindex="not-a-number">`

      const linter = new Linter(Herb, [HTMLValidateElementsAttributesRule])
      const lintResult = linter.lint(html)

      expect(lintResult.errors).toBe(1)
      expect(lintResult.offenses[0].message).toBe(
        'Invalid number for `tabindex` on `<input>`. Expected a number, got "not-a-number".'
      )
    })

    test("fails for numbers out of range", () => {
      const html = `<input tabindex="-5">`

      const linter = new Linter(Herb, [HTMLValidateElementsAttributesRule])
      const lintResult = linter.lint(html)

      expect(lintResult.errors).toBe(1)
      expect(lintResult.offenses[0].message).toBe(
        "Value for `tabindex` on `<input>` must be at least `-1`, got `-5`."
      )
    })

    test("validates URL attributes", () => {
      const html = `
        <a href="https://example.com">Absolute URL</a>
        <a href="/relative">Relative URL</a>
        <a href="#fragment">Fragment</a>
        <a href="mailto:test@example.com">Email</a>
        <img src="./image.png" alt="Image">
        <link href="../styles.css" rel="stylesheet">
      `

      const linter = new Linter(Herb, [HTMLValidateElementsAttributesRule])
      const lintResult = linter.lint(html)

      expect(lintResult.errors).toBe(0)
      expect(lintResult.warnings).toBe(0)
      expect(lintResult.offenses).toHaveLength(0)
    })

    test("validates simple relative paths in URLs", () => {
      const html = `
        <img src="photo.png" alt="Photo">
        <img src="images/photo.png" alt="Photo">
        <link href="styles.css" rel="stylesheet">
        <script src="app.js"></script>
        <a href="page.html">Page</a>
      `

      const linter = new Linter(Herb, [HTMLValidateElementsAttributesRule])
      const lintResult = linter.lint(html)

      expect(lintResult.errors).toBe(0)
      expect(lintResult.warnings).toBe(0)
      expect(lintResult.offenses).toHaveLength(0)
    })

    test("validates edge case href values from HTML spec", () => {
      const html = `
        <a href="#">Top of page</a>
        <a href="#section">Section link</a>
        <a href=".">Current directory</a>
        <a href="?">Query only</a>
        <a href="?search=term">Query with params</a>
        <a href="//example.com">Protocol-relative</a>
        <a href="data:text/plain,hello%20world">Data URL</a>
        <a href="javascript:void(0)">JavaScript URL</a>
        <a href="mailto:">Email prompt</a>
        <a href="tel:+1234567890">Phone number</a>
        <a href="sms:+1234567890">SMS</a>
        <a href="video.mp4#t=10,20">Media fragment</a>
      `

      const linter = new Linter(Herb, [HTMLValidateElementsAttributesRule])
      const lintResult = linter.lint(html)

      expect(lintResult.errors).toBe(0)
      expect(lintResult.warnings).toBe(0)
      expect(lintResult.offenses).toHaveLength(0)
    })

    test("warns for empty href attribute", () => {
      const html = `<a href="">Empty link</a>`

      const linter = new Linter(Herb, [HTMLValidateElementsAttributesRule])
      const lintResult = linter.lint(html)

      expect(lintResult.errors).toBe(0)
      expect(lintResult.warnings).toBe(1)
      expect(lintResult.offenses).toHaveLength(1)
      expect(lintResult.offenses[0].severity).toBe("warning")
      expect(lintResult.offenses[0].message).toBe(
        'Empty `href` attribute on `<a>`. This will reload the current page. Consider using `href="#"` for a placeholder or provide a valid URL.'
      )
    })

    test("fails for invalid URLs", () => {
      const html = `<a href="not a valid url">Link</a>`

      const linter = new Linter(Herb, [HTMLValidateElementsAttributesRule])
      const lintResult = linter.lint(html)

      expect(lintResult.errors).toBe(1)
      expect(lintResult.offenses[0].message).toBe(
        'Invalid URL for `href` on `<a>`. "not a valid url" is not a valid URL.'
      )
    })

    test("validates ID references", () => {
      const html = `<label for="username">Username</label>`

      const linter = new Linter(Herb, [HTMLValidateElementsAttributesRule])
      const lintResult = linter.lint(html)

      expect(lintResult.errors).toBe(0)
      expect(lintResult.warnings).toBe(0)
      expect(lintResult.offenses).toHaveLength(0)
    })

    test("fails for invalid ID references", () => {
      const html = `<label for="123invalid">Label</label>`

      const linter = new Linter(Herb, [HTMLValidateElementsAttributesRule])
      const lintResult = linter.lint(html)

      expect(lintResult.errors).toBe(1)
      expect(lintResult.offenses[0].message).toBe(
        'Invalid ID reference for `for` on `<label>`. "123invalid" is not a valid element ID.'
      )
    })

    test("validates class lists", () => {
      const html = `<div class="container header-main nav-item">Content</div>`

      const linter = new Linter(Herb, [HTMLValidateElementsAttributesRule])
      const lintResult = linter.lint(html)

      expect(lintResult.errors).toBe(0)
      expect(lintResult.warnings).toBe(0)
      expect(lintResult.offenses).toHaveLength(0)
    })

    test("validates Tailwind arbitrary values", () => {
      const html = `<div class="h-[300px] w-[50rem] bg-[#ff0000] text-[14px]">Content</div>`

      const linter = new Linter(Herb, [HTMLValidateElementsAttributesRule])
      const lintResult = linter.lint(html)

      expect(lintResult.errors).toBe(0)
      expect(lintResult.warnings).toBe(0)
      expect(lintResult.offenses).toHaveLength(0)
    })

    test("validates mixed standard and Tailwind classes", () => {
      const html = `<div class="bg-gray-300 rounded-lg animate-pulse h-[300px]">Content</div>`

      const linter = new Linter(Herb, [HTMLValidateElementsAttributesRule])
      const lintResult = linter.lint(html)

      expect(lintResult.errors).toBe(0)
      expect(lintResult.warnings).toBe(0)
      expect(lintResult.offenses).toHaveLength(0)
    })

    test("validates Tailwind responsive modifiers", () => {
      const html = `<div class="grid grid-cols-1 lg:grid-cols-2 md:grid-cols-3 sm:hidden">Content</div>`

      const linter = new Linter(Herb, [HTMLValidateElementsAttributesRule])
      const lintResult = linter.lint(html)

      expect(lintResult.errors).toBe(0)
      expect(lintResult.warnings).toBe(0)
      expect(lintResult.offenses).toHaveLength(0)
    })

    test("validates Tailwind state modifiers", () => {
      const html = `<div class="hover:bg-blue-500 focus:ring-2 active:scale-95 disabled:opacity-50">Content</div>`

      const linter = new Linter(Herb, [HTMLValidateElementsAttributesRule])
      const lintResult = linter.lint(html)

      expect(lintResult.errors).toBe(0)
      expect(lintResult.warnings).toBe(0)
      expect(lintResult.offenses).toHaveLength(0)
    })

    test("validates Tailwind modifiers with arbitrary values", () => {
      const html = `<div class="lg:h-[400px] hover:bg-[#123456] md:text-[18px]">Content</div>`

      const linter = new Linter(Herb, [HTMLValidateElementsAttributesRule])
      const lintResult = linter.lint(html)

      expect(lintResult.errors).toBe(0)
      expect(lintResult.warnings).toBe(0)
      expect(lintResult.offenses).toHaveLength(0)
    })

    test("validates Tailwind opacity modifiers", () => {
      const html = `<div class="bg-black/70 text-white/90 border-gray-300/50">Content</div>`

      const linter = new Linter(Herb, [HTMLValidateElementsAttributesRule])
      const lintResult = linter.lint(html)

      expect(lintResult.errors).toBe(0)
      expect(lintResult.warnings).toBe(0)
      expect(lintResult.offenses).toHaveLength(0)
    })

    test("validates Tailwind responsive modifiers with opacity", () => {
      const html = `<div class="lg:bg-blue-500/80 hover:text-red-600/75">Content</div>`

      const linter = new Linter(Herb, [HTMLValidateElementsAttributesRule])
      const lintResult = linter.lint(html)

      expect(lintResult.errors).toBe(0)
      expect(lintResult.warnings).toBe(0)
      expect(lintResult.offenses).toHaveLength(0)
    })

    test("validates complex Tailwind class combinations", () => {
      const html = `<div class="absolute inset-0 text-white bg-black/70 flex flex-col gap-3 justify-center items-center text-xl rounded-xl p-6 overflow-y-scroll">Content</div>`

      const linter = new Linter(Herb, [HTMLValidateElementsAttributesRule])
      const lintResult = linter.lint(html)

      expect(lintResult.errors).toBe(0)
      expect(lintResult.warnings).toBe(0)
      expect(lintResult.offenses).toHaveLength(0)
    })

    test("validates Tailwind chained modifiers", () => {
      const html = `<div class="md:group-hover:hidden lg:peer-focus:block sm:dark:bg-blue-500">Content</div>`

      const linter = new Linter(Herb, [HTMLValidateElementsAttributesRule])
      const lintResult = linter.lint(html)

      expect(lintResult.errors).toBe(0)
      expect(lintResult.warnings).toBe(0)
      expect(lintResult.offenses).toHaveLength(0)
    })

    test("validates Tailwind triple modifiers", () => {
      const html = `<div class="lg:hover:group-focus:scale-110 md:dark:peer-invalid:text-red-500">Content</div>`

      const linter = new Linter(Herb, [HTMLValidateElementsAttributesRule])
      const lintResult = linter.lint(html)

      expect(lintResult.errors).toBe(0)
      expect(lintResult.warnings).toBe(0)
      expect(lintResult.offenses).toHaveLength(0)
    })

    test("validates real-world chained modifier example", () => {
      const html = `<div class="absolute hidden md:block bottom-0 left-0 w-full h-64 bg-gradient-to-t from-base-100 to-transparent pointer-events-none md:group-hover:hidden">Content</div>`

      const linter = new Linter(Herb, [HTMLValidateElementsAttributesRule])
      const lintResult = linter.lint(html)

      expect(lintResult.errors).toBe(0)
      expect(lintResult.warnings).toBe(0)
      expect(lintResult.offenses).toHaveLength(0)
    })

    test("validates Tailwind negative values", () => {
      const html = `<div class="-m-4 -mt-2 -mb-0.5 -ml-1.5 -space-x-2">Content</div>`

      const linter = new Linter(Herb, [HTMLValidateElementsAttributesRule])
      const lintResult = linter.lint(html)

      expect(lintResult.errors).toBe(0)
      expect(lintResult.warnings).toBe(0)
      expect(lintResult.offenses).toHaveLength(0)
    })

    test("validates Tailwind decimal values", () => {
      const html = `<div class="mt-0.5 px-1.5 py-2.5 text-lg leading-4.5">Content</div>`

      const linter = new Linter(Herb, [HTMLValidateElementsAttributesRule])
      const lintResult = linter.lint(html)

      expect(lintResult.errors).toBe(0)
      expect(lintResult.warnings).toBe(0)
      expect(lintResult.offenses).toHaveLength(0)
    })

    test("validates Tailwind responsive negative decimals", () => {
      const html = `<div class="lg:-mb-0.5 md:-mt-1.5 sm:-space-y-2.5">Content</div>`

      const linter = new Linter(Herb, [HTMLValidateElementsAttributesRule])
      const lintResult = linter.lint(html)

      expect(lintResult.errors).toBe(0)
      expect(lintResult.warnings).toBe(0)
      expect(lintResult.offenses).toHaveLength(0)
    })

    test("validates real-world negative decimal example", () => {
      const html = `<div class="flex items-center justify-center mt-auto -mb-0.5 text-gray-400">Content</div>`

      const linter = new Linter(Herb, [HTMLValidateElementsAttributesRule])
      const lintResult = linter.lint(html)

      expect(lintResult.errors).toBe(0)
      expect(lintResult.warnings).toBe(0)
      expect(lintResult.offenses).toHaveLength(0)
    })

    test("validates Tailwind arbitrary group selectors", () => {
      const html = `<div class="group-[.scheduled]:flex group-[.active]:hidden peer-[.selected]:block">Content</div>`

      const linter = new Linter(Herb, [HTMLValidateElementsAttributesRule])
      const lintResult = linter.lint(html)

      expect(lintResult.errors).toBe(0)
      expect(lintResult.warnings).toBe(0)
      expect(lintResult.offenses).toHaveLength(0)
    })

    test("validates Tailwind arbitrary selectors with responsive", () => {
      const html = `<div class="lg:group-[.open]:block md:peer-[&:hover]:visible">Content</div>`

      const linter = new Linter(Herb, [HTMLValidateElementsAttributesRule])
      const lintResult = linter.lint(html)

      expect(lintResult.errors).toBe(0)
      expect(lintResult.warnings).toBe(0)
      expect(lintResult.offenses).toHaveLength(0)
    })

    test("validates complex arbitrary selectors", () => {
      const html = `<div class="group-[.is-published]:text-green-500 peer-[.is-invalid]:text-red-500 group-[&:nth-child(3)]:hidden">Content</div>`

      const linter = new Linter(Herb, [HTMLValidateElementsAttributesRule])
      const lintResult = linter.lint(html)

      expect(lintResult.errors).toBe(0)
      expect(lintResult.warnings).toBe(0)
      expect(lintResult.offenses).toHaveLength(0)
    })

    test("validates real-world arbitrary selector example", () => {
      const html = `<div class="absolute inset-0 bg-black/50 justify-center items-center rounded hidden group-[.scheduled]:flex group-[.active]:hidden">Content</div>`

      const linter = new Linter(Herb, [HTMLValidateElementsAttributesRule])
      const lintResult = linter.lint(html)

      expect(lintResult.errors).toBe(0)
      expect(lintResult.warnings).toBe(0)
      expect(lintResult.offenses).toHaveLength(0)
    })

    test("validates Tailwind complex arbitrary selectors", () => {
      const html = `<div class="md:[&>:nth-child(4)]:hidden lg:[&>:nth-child(4)]:block">Content</div>`

      const linter = new Linter(Herb, [HTMLValidateElementsAttributesRule])
      const lintResult = linter.lint(html)

      expect(lintResult.errors).toBe(0)
      expect(lintResult.warnings).toBe(0)
      expect(lintResult.offenses).toHaveLength(0)
    })

    test("validates Tailwind arbitrary parent selectors", () => {
      const html = `<div class="[&>*]:text-gray-500 [&>h2]:text-xl [&_p]:mb-4">Content</div>`

      const linter = new Linter(Herb, [HTMLValidateElementsAttributesRule])
      const lintResult = linter.lint(html)

      expect(lintResult.errors).toBe(0)
      expect(lintResult.warnings).toBe(0)
      expect(lintResult.offenses).toHaveLength(0)
    })

    test("validates complex nth-child selectors", () => {
      const html = `<div class="[&>:nth-child(odd)]:bg-gray-100 [&>:nth-child(even)]:bg-white [&>:last-child]:mb-0">Content</div>`

      const linter = new Linter(Herb, [HTMLValidateElementsAttributesRule])
      const lintResult = linter.lint(html)

      expect(lintResult.errors).toBe(0)
      expect(lintResult.warnings).toBe(0)
      expect(lintResult.offenses).toHaveLength(0)
    })

    test("validates real-world complex grid example", () => {
      const html = `<div class="grid min-w-full grid-cols-1 gap-8 sm:grid-cols-2 md:grid-cols-3 md:[&>:nth-child(4)]:hidden lg:grid-cols-4 lg:[&>:nth-child(4)]:block">Content</div>`

      const linter = new Linter(Herb, [HTMLValidateElementsAttributesRule])
      const lintResult = linter.lint(html)

      expect(lintResult.errors).toBe(0)
      expect(lintResult.warnings).toBe(0)
      expect(lintResult.offenses).toHaveLength(0)
    })

    test("validates Tailwind important modifiers", () => {
      const html = `<div class="!text-red-500 !bg-blue-200 !p-4">Content</div>`

      const linter = new Linter(Herb, [HTMLValidateElementsAttributesRule])
      const lintResult = linter.lint(html)

      expect(lintResult.errors).toBe(0)
      expect(lintResult.warnings).toBe(0)
      expect(lintResult.offenses).toHaveLength(0)
    })

    test("validates Tailwind important with negatives and decimals", () => {
      const html = `<div class="!-mt-4 !mb-0.5 !-space-y-2">Content</div>`

      const linter = new Linter(Herb, [HTMLValidateElementsAttributesRule])
      const lintResult = linter.lint(html)

      expect(lintResult.errors).toBe(0)
      expect(lintResult.warnings).toBe(0)
      expect(lintResult.offenses).toHaveLength(0)
    })

    test("validates Tailwind important with responsive modifiers", () => {
      const html = `<div class="lg:!hidden md:!block sm:!text-center">Content</div>`

      const linter = new Linter(Herb, [HTMLValidateElementsAttributesRule])
      const lintResult = linter.lint(html)

      expect(lintResult.errors).toBe(0)
      expect(lintResult.warnings).toBe(0)
      expect(lintResult.offenses).toHaveLength(0)
    })

    test("validates Tailwind important with arbitrary values and opacity", () => {
      const html = `<div class="!bg-[#ff0000] !text-black/50 !h-[300px]">Content</div>`

      const linter = new Linter(Herb, [HTMLValidateElementsAttributesRule])
      const lintResult = linter.lint(html)

      expect(lintResult.errors).toBe(0)
      expect(lintResult.warnings).toBe(0)
      expect(lintResult.offenses).toHaveLength(0)
    })

    test("validates real-world important modifier example", () => {
      const html = `<div class="tab-content !rounded-s-xl rounded-xl bg-base-200/50 p-6 mt-6 overflow-hidden">Content</div>`

      const linter = new Linter(Herb, [HTMLValidateElementsAttributesRule])
      const lintResult = linter.lint(html)

      expect(lintResult.errors).toBe(0)
      expect(lintResult.warnings).toBe(0)
      expect(lintResult.offenses).toHaveLength(0)
    })

    test("fails for invalid class names", () => {
      const html = `<div class="valid-class 123invalid">Content</div>`

      const linter = new Linter(Herb, [HTMLValidateElementsAttributesRule])
      const lintResult = linter.lint(html)

      expect(lintResult.errors).toBe(1)
      expect(lintResult.offenses[0].message).toBe(
        'Invalid CSS class name "123invalid" in `class` on `<div>`. Class names must be valid CSS identifiers.'
      )
    })

    test("validates space-separated attributes", () => {
      const html = `<a rel="noopener noreferrer" href="/link">Link</a>`

      const linter = new Linter(Herb, [HTMLValidateElementsAttributesRule])
      const lintResult = linter.lint(html)

      expect(lintResult.errors).toBe(0)
      expect(lintResult.warnings).toBe(0)
      expect(lintResult.offenses).toHaveLength(0)
    })

    test("fails for invalid space-separated values", () => {
      const html = `<a rel="invalid-value noopener" href="/link">Link</a>`

      const linter = new Linter(Herb, [HTMLValidateElementsAttributesRule])
      const lintResult = linter.lint(html)

      expect(lintResult.errors).toBe(1)
      expect(lintResult.offenses[0].message).toContain(
        'Invalid value "invalid-value" in `rel` on `<a>`'
      )
    })
  })
})
