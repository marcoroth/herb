import { describe, test, expect, beforeAll } from "vitest"
import { Herb } from "@herb-tools/node-wasm"
import { Formatter } from "../../src"
import dedent from "dedent"

let formatter: Formatter

describe("Attribute formatting", () => {
  beforeAll(async () => {
    await Herb.load()

    formatter = new Formatter(Herb, {
      indentWidth: 2,
      maxLineLength: 80
    })
  })

  describe("Class attribute formatting", () => {
    test("keeps short class lists inline", () => {
      const source = `<div class="container flex items-center">Content</div>`

      const result = formatter.format(source)

      expect(result).toBe(dedent`
        <div class="container flex items-center">Content</div>
      `)
    })

    test("breaks long class lists into multiple lines", () => {
      const source = `<div class="very-long-class-name another-very-long-class-name yet-another-extremely-long-class-name final-extremely-long-class-name">Content</div>`

      const result = formatter.format(source)

      expect(result).toBe(dedent`
        <div
          class="
            very-long-class-name another-very-long-class-name
            yet-another-extremely-long-class-name final-extremely-long-class-name
          "
        >
          Content
        </div>
      `)
    })

    test("collapses multiline class attributes when they're short", () => {
      const source = dedent`
        <div class="container
        flex items-center">Content</div>
      `

      const result = formatter.format(source)

      expect(result).toBe(dedent`
        <div class="container flex items-center">Content</div>
      `)
    })

    test("preserves multiline structure for long class attributes", () => {
      const source = dedent`
        <div class="text-gray-700 bg-transparent hover:bg-gray-50 active:bg-gray-100 focus:bg-gray-50 focus:ring-gray-300 focus:ring-2
        disabled:text-gray-300 disabled:bg-transparent disabled:border-gray-300 disabled:cursor-not-allowed">Content</div>
      `

      const result = formatter.format(source)

      expect(result).toBe(dedent`
        <div
          class="
            text-gray-700 bg-transparent hover:bg-gray-50 active:bg-gray-100 focus:bg-gray-50 focus:ring-gray-300 focus:ring-2
            disabled:text-gray-300 disabled:bg-transparent disabled:border-gray-300 disabled:cursor-not-allowed
          "
        >
          Content
        </div>
      `)
    })

    test("handles class attributes with ERB expressions", () => {
      const source = `<div class="base-class <%= 'active' if active? %> <%= user_class %>">Content</div>`

      const result = formatter.format(source)

      expect(result).toBe(dedent`
        <div class="base-class <%= 'active' if active? %> <%= user_class %>">
          Content
        </div>
      `)
    })
  })

  describe("Single class attribute rule with ERB", () => {
    test("keeps single short class with ERB expressions inline", () => {
      const source = `<div class="btn <%= active? ? 'active' : 'inactive' %>">Content</div>`

      const result = formatter.format(source)

      expect(result).toBe(dedent`
        <div class="btn <%= active? ? 'active' : 'inactive' %>">Content</div>
      `)
    })

    test("keeps single class with ERB if block inline when short", () => {
      const source = `<div class="<% if user.admin? %>admin<% else %>user<% end %>">Content</div>`

      const result = formatter.format(source)

      expect(result).toBe(dedent`
        <div class="<% if user.admin? %> admin <% else %> user <% end %>">Content</div>
      `)
    })

    test("keeps single class with ERB inline even when long (ERB prevents multiline)", () => {
      const source = `<div class="very-long-base-class <%= user.premium? ? 'premium-styling with-extra-classes' : 'basic-styling with-standard-classes' %> additional-long-classes">Content</div>`

      const result = formatter.format(source)

      expect(result).toBe(dedent`
        <div class="very-long-base-class <%= user.premium? ? 'premium-styling with-extra-classes' : 'basic-styling with-standard-classes' %> additional-long-classes">
          Content
        </div>
      `)
    })

    test("keeps single class with long ERB if block inline (ERB prevents multiline)", () => {
      const source = `<div class="<% if user.premium? && user.active? %>premium-user-styling with-special-effects and-animations<% elsif user.active? %>active-user-basic-styling with-standard-effects<% else %>inactive-user-minimal-styling<% end %>">Content</div>`

      const result = formatter.format(source)

      expect(result).toBe(dedent`
        <div class="<% if user.premium? && user.active? %> premium-user-styling with-special-effects and-animations <% elsif user.active? %> active-user-basic-styling with-standard-effects <% else %> inactive-user-minimal-styling <% end %>">
          Content
        </div>
      `)
    })

    test("keeps single class inline even with mixed ERB and text when short", () => {
      const source = `<div class="base <%= type %> secondary">Content</div>`

      const result = formatter.format(source)

      expect(result).toBe(dedent`
        <div class="base <%= type %> secondary">Content</div>
      `)
    })

    test("keeps single class with multiple ERB expressions inline (ERB prevents multiline)", () => {
      const source = `<div class="<%= base_class %> very-long-additional-class <%= modifier_class %> another-very-long-class <%= final_class %>">Content</div>`

      const result = formatter.format(source)

      expect(result).toBe(dedent`
        <div class="<%= base_class %> very-long-additional-class <%= modifier_class %> another-very-long-class <%= final_class %>">
          Content
        </div>
      `)
    })

    test("single class rule only applies when element has exactly one attribute", () => {
      const source = `<div class="short-class <%= type %>" id="test">Content</div>`

      const result = formatter.format(source)

      expect(result).toBe(dedent`
        <div class="short-class <%= type %>" id="test">Content</div>
      `)
    })

    test("formats single long class without ERB as multiline", () => {
      const source = `<div class="very-very-long-class-name another-very-long-class-name yet-another-extremely-long-class-name final-extremely-long-class-name">Content</div>`

      const result = formatter.format(source)

      expect(result).toBe(dedent`
        <div
          class="
            very-very-long-class-name another-very-long-class-name
            yet-another-extremely-long-class-name final-extremely-long-class-name
          "
        >
          Content
        </div>
      `)
    })

    test("single class rule does not apply to other attributes", () => {
      const source = `<div data-controller="short-controller">Content</div>`

      const result = formatter.format(source)

      expect(result).toBe(dedent`
        <div data-controller="short-controller">Content</div>
      `)
    })
  })

  describe("Image srcset and sizes formatting", () => {
    test("collapses multiline srcset to single line", () => {
      const source = dedent`
        <img srcset="image-480w.jpg 480w,
                     image-800w.jpg 800w,
                     image-1200w.jpg 1200w" alt="Image">
      `

      const result = formatter.format(source)

      expect(result).toBe(dedent`
        <img
          srcset="image-480w.jpg 480w, image-800w.jpg 800w, image-1200w.jpg 1200w"
          alt="Image"
        >
      `)
    })

    test("collapses multiline sizes to single line", () => {
      const source = dedent`
        <img sizes="(max-width: 600px) 480px,
                    (max-width: 1000px) 800px,
                    1200px" src="image.jpg" alt="Image">
      `

      const result = formatter.format(source)

      expect(result).toBe(dedent`
        <img
          sizes="(max-width: 600px) 480px, (max-width: 1000px) 800px, 1200px"
          src="image.jpg"
          alt="Image"
        >
      `)
    })

    test("handles both srcset and sizes together", () => {
      const source = dedent`
        <img src="image.jpg"
             srcset="image-480w.jpg 480w,
                     image-800w.jpg 800w"
             sizes="(max-width: 600px) 480px,
                    800px"
             alt="Responsive Image">
      `

      const result = formatter.format(source)

      expect(result).toBe(dedent`
        <img
          src="image.jpg"
          srcset="image-480w.jpg 480w, image-800w.jpg 800w"
          sizes="(max-width: 600px) 480px, 800px"
          alt="Responsive Image"
        >
      `)
    })

    test("srcset/sizes only format on img tags, not others", () => {
      const source = `<source srcset="image-480w.webp 480w, image-800w.webp 800w" sizes="(max-width: 600px) 480px, 800px">`

      const result = formatter.format(source)

      expect(result).toBe(dedent`
        <source
          srcset="image-480w.webp 480w, image-800w.webp 800w"
          sizes="(max-width: 600px) 480px, 800px"
        >
      `)
    })
  })

  describe("Non-formattable attributes", () => {
    test("preserves style attributes as-is", () => {
      const source = dedent`
        <div style="background: linear-gradient(45deg,
                    red 0%,
                    blue 100%);
                    padding: 20px;">Content</div>
      `

      const result = formatter.format(source)

      expect(result).toBe(dedent`
        <div
          style="background: linear-gradient(45deg,
                    red 0%,
                    blue 100%);
                    padding: 20px;"
        >
          Content
        </div>
      `)
    })

    test("preserves data attributes as-is", () => {
      const source = `<div data-config='{"key": "value", "nested": {"prop": "data"}}'>Content</div>`

      const result = formatter.format(source)

      expect(result).toBe(dedent`
        <div data-config='{"key": "value", "nested": {"prop": "data"}}'>Content</div>
      `)
    })

    test("preserves aria attributes as-is (except formattable ones)", () => {
      const source = `<div aria-label="This is a long aria label that might wrap but should be preserved as-is">Content</div>`

      const result = formatter.format(source)

      expect(result).toBe(dedent`
        <div
          aria-label="This is a long aria label that might wrap but should be preserved as-is"
        >
          Content
        </div>
      `)
    })

    test("preserves href URLs as-is", () => {
      const source = `<a href="https://example.com/very/long/path/with/many/segments?param1=value1&param2=value2&param3=value3">Link</a>`

      const result = formatter.format(source)

      expect(result).toBe(dedent`
        <a
          href="https://example.com/very/long/path/with/many/segments?param1=value1&param2=value2&param3=value3"
        >
          Link
        </a>
      `)
    })
  })

  describe("Mixed attribute scenarios", () => {
    test("handles mix of formattable and non-formattable attributes", () => {
      const source = dedent`
        <img src="image.jpg"
             class="responsive-image border-2 border-gray-300 rounded-lg shadow-md hover:shadow-lg transition-shadow duration-300"
             srcset="image-480w.jpg 480w,
                     image-800w.jpg 800w,
                     image-1200w.jpg 1200w"
             alt="A beautiful responsive image with custom styling"
             data-lazy="true"
             style="max-width: 100%;
                    height: auto;">
      `

      const result = formatter.format(source)

      expect(result).toBe(dedent`
        <img
          src="image.jpg"
          class="
            responsive-image border-2 border-gray-300 rounded-lg shadow-md
            hover:shadow-lg transition-shadow duration-300
          "
          srcset="image-480w.jpg 480w, image-800w.jpg 800w, image-1200w.jpg 1200w"
          alt="A beautiful responsive image with custom styling"
          data-lazy="true"
          style="max-width: 100%;
                    height: auto;"
        >
      `)
    })

    test("handles escaped newlines vs actual newlines correctly", () => {
      const source = `<div class='Line 1\\nLine 2' data-content='Actual\\nNewline'>Content</div>`

      const result = formatter.format(source)

      expect(result).toBe(`<div class="Line 1\\nLine 2" data-content="Actual\\nNewline">Content</div>`)
    })

    test("handles actual newlines in class vs data attributes differently", () => {
      const source = dedent`
        <div class='short
        class' data-content='preserve
        this
        structure'>Content</div>
      `

      const result = formatter.format(source)

      expect(result).toBe(dedent`
        <div class="short class" data-content="preserve
        this
        structure">Content</div>
      `)
    })
  })

  describe("Dynamic attribute names", () => {
    test("formats elements with simple ERB in attribute names", () => {
      const source = `<div data-<%= key %>="value">Content</div>`

      const result = formatter.format(source)

      expect(result).toBe(dedent`
        <div data-<%= key %>="value">Content</div>
      `)
    })

    test("formats elements with complex ERB in attribute names", () => {
      const source = `<div data-<%= key %>-something-<%= suffix %>="value">Content</div>`

      const result = formatter.format(source)

      expect(result).toBe(dedent`
        <div data-<%= key %>-something-<%= suffix %>="value">Content</div>
      `)
    })

    test("handles multiple dynamic attributes", () => {
      const source = `<div data-<%= prefix %>-key="value1" <%= attribute_name %>="value2" class="static">Content</div>`

      const result = formatter.format(source)

      expect(result).toBe(dedent`
        <div
          data-<%= prefix %>-key="value1"
          <%= attribute_name %>="value2"
          class="static"
        >
          Content
        </div>
      `)
    })

    test("breaks dynamic attributes onto multiple lines when long", () => {
      const source = `<div data-<%= very_long_prefix %>-something-<%= another_long_suffix %>="a very long value that might cause line breaking" class="container fluid responsive grid">Content</div>`

      const result = formatter.format(source)

      expect(result).toBe(dedent`
        <div
          data-<%= very_long_prefix %>-something-<%= another_long_suffix %>="a very long value that might cause line breaking"
          class="container fluid responsive grid"
        >
          Content
        </div>
      `)
    })

    test("handles dynamic attribute names with dynamic values", () => {
      const source = `<div data-<%= key %>="<%= value %>" <%= attr %>="<%= content %>">Content</div>`

      const result = formatter.format(source)

      expect(result).toBe(dedent`
        <div data-<%= key %>="<%= value %>" <%= attr %>="<%= content %>">Content</div>
      `)
    })

    test("formats dynamic class attributes", () => {
      const source = `<div class-<%= modifier %>="active selected" data-config="value">Content</div>`

      const result = formatter.format(source)

      expect(result).toBe(dedent`
        <div class-<%= modifier %>="active selected" data-config="value">Content</div>
      `)
    })

    test("handles mixed static and dynamic attributes with line breaking", () => {
      const source = `<input type="text" name="user[email]" data-<%= validation_key %>="required email" class="form-input border-gray-300 rounded-md shadow-sm focus:border-indigo-500 focus:ring focus:ring-indigo-200" placeholder="Enter your email address">`

      const result = formatter.format(source)

      expect(result).toBe(dedent`
        <input
          type="text"
          name="user[email]"
          data-<%= validation_key %>="required email"
          class="
            form-input border-gray-300 rounded-md shadow-sm focus:border-indigo-500
            focus:ring focus:ring-indigo-200
          "
          placeholder="Enter your email address"
        >
      `)
    })
  })

  describe("Quote handling with formatted attributes", () => {
    test("maintains proper quote selection for formatted class attributes", () => {
      const source = `<div class='container "special" formatting'>Content</div>`

      const result = formatter.format(source)

      expect(result).toBe(dedent`
        <div class='container "special" formatting'>Content</div>
      `)
    })

    test("maintains proper quote selection for formatted srcset", () => {
      const source = `<img srcset='image-480w.jpg 480w, "special".jpg 800w' src="image.jpg" alt="Image">`

      const result = formatter.format(source)

      expect(result).toBe(dedent`
        <img
          srcset='image-480w.jpg 480w, "special".jpg 800w'
          src="image.jpg"
          alt="Image"
        >
      `)
    })
  })
})
