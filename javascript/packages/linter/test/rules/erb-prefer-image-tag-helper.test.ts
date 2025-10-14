import dedent from "dedent"
import { describe, test } from "vitest"
import { ERBPreferImageTagHelperRule } from "../../src/rules/erb-prefer-image-tag-helper.js"
import { createLinterTest } from "../helpers/linter-test-helper.js"

const { expectNoOffenses, expectWarning, assertOffenses } = createLinterTest(ERBPreferImageTagHelperRule)

describe("erb-prefer-image-tag-helper", () => {
  test("passes for regular img tags without ERB", () => {
    expectNoOffenses('<img src="/logo.png" alt="Company logo">')
  })

  test("passes for image_tag helper usage", () => {
    expectNoOffenses('<%= image_tag "logo.png", alt: "Company logo", class: "logo" %>')
  })

  test("fails for img with image_path helper", () => {
    expectWarning('Prefer `image_tag` helper over manual `<img>` with dynamic ERB expressions. Use `<%= image_tag image_path("logo.png"), alt: "..." %>` instead.')

    assertOffenses('<img src="<%= image_path("logo.png") %>" alt="Logo">')
  })

  test("fails for img with asset_path helper", () => {
    expectWarning('Prefer `image_tag` helper over manual `<img>` with dynamic ERB expressions. Use `<%= image_tag asset_path("banner.jpg"), alt: "..." %>` instead.')

    assertOffenses('<img src="<%= asset_path("banner.jpg") %>" alt="Banner">')
  })

  test("handles self-closing img tags with image_path", () => {
    expectWarning('Prefer `image_tag` helper over manual `<img>` with dynamic ERB expressions. Use `<%= image_tag image_path("logo.png"), alt: "..." %>` instead.')

    assertOffenses('<img src="<%= image_path("logo.png") %>" alt="Logo" />')
  })

  test("ignores non-img tags with image_path", () => {
    expectNoOffenses('<div data-background="<%= image_path("bg.jpg") %>">Content</div>')
  })

  test("fails for img with Rails URL helpers", () => {
    expectWarning('Prefer `image_tag` helper over manual `<img>` with dynamic ERB expressions. Use `<%= image_tag "#{Rails.application.routes.url_helpers.root_url}/icon.png", alt: "..." %>` instead.')

    assertOffenses('<img src="<%= Rails.application.routes.url_helpers.root_url %>/icon.png" alt="Logo">')
  })

  test("fails for img with root_url helper", () => {
    expectWarning('Prefer `image_tag` helper over manual `<img>` with dynamic ERB expressions. Use `<%= image_tag "#{root_url}/banner.jpg", alt: "..." %>` instead.')

    assertOffenses('<img src="<%= root_url %>/banner.jpg" alt="Banner">')
  })

  test("fails for img with custom path helpers", () => {
    expectWarning('Prefer `image_tag` helper over manual `<img>` with dynamic ERB expressions. Use `<%= image_tag "#{admin_path}/icon.png", alt: "..." %>` instead.')

    assertOffenses('<img src="<%= admin_path %>/icon.png" alt="Admin icon">')
  })

  test("fails for img with dynamic user avatar URL", () => {
    expectWarning('Prefer `image_tag` helper over manual `<img>` with dynamic ERB expressions. Use `<%= image_tag user.avatar.url, alt: "..." %>` instead.')

    assertOffenses('<img src="<%= user.avatar.url %>" alt="User avatar">')
  })

  test("fails for img with dynamic product image", () => {
    expectWarning('Prefer `image_tag` helper over manual `<img>` with dynamic ERB expressions. Use `<%= image_tag product.image, alt: "..." %>` instead.')

    assertOffenses('<img src="<%= product.image %>" alt="Product image">')
  })

  test("fails for img with any ERB expression", () => {
    expectWarning('Prefer `image_tag` helper over manual `<img>` with dynamic ERB expressions. Use `<%= image_tag @company.logo_path, alt: "..." %>` instead.')

    assertOffenses('<img src="<%= @company.logo_path %>" alt="Company logo">')
  })

  test("fails for img with multiple ERB expressions", () => {
    expectWarning('Prefer `image_tag` helper over manual `<img>` with dynamic ERB expressions. Use `<%= image_tag "#{base_url}#{image_path("logo.png")}", alt: "..." %>` instead.')

    assertOffenses('<img src="<%= base_url %><%= image_path("logo.png") %>" alt="Logo">')
  })

  test("fails for img with ERB expression containing string literal", () => {
    expectWarning('Prefer `image_tag` helper over manual `<img>` with dynamic ERB expressions. Use `<%= image_tag "#{root_path}#{"icon.png"}", alt: "..." %>` instead.')

    assertOffenses('<img src="<%= root_path %><%= "icon.png" %>" alt="Icon">')
  })

  test("fails for img with ERB expression containing string literal followed by another ERB tag", () => {
    expectWarning('Prefer `image_tag` helper over manual `<img>` with dynamic ERB expressions. Use `<%= image_tag "#{root_path}/assets/#{"icon.png"}", alt: "..." %>` instead.')

    assertOffenses('<img src="<%= root_path %>/assets/<%= "icon.png" %>" alt="Icon">')
  })

  test("shouldn't flag empty src attribute", () => {
    expectNoOffenses('<img src="" alt="Empty"><img src="    " alt="Empty">')
  })

  test("passes for img tags with static paths only", () => {
    expectNoOffenses(dedent`
      <div>
        <img src="/images/logo.png" alt="Logo">
        <img src="https://example.com/image.jpg" alt="External image">
        <img src="logo.png" alt="Relative path">
      </div>
    `)
  })

  test("passes for data URIs with embedded ERB content", () => {
    expectNoOffenses('<img src="data:image/png;base64,<%= base64_encoded_logo_image %>" alt="Logo">')
  })

  test("passes for mixed static and ERB content in src", () => {
    expectNoOffenses('<img src="https://example.com/<%= user.id %>/avatar.png" alt="User avatar">')
  })

  test("passes for data URI with SVG and embedded ERB", () => {
    expectNoOffenses('<img src="data:image/svg+xml,<svg><text><%= user_name %></text></svg>" alt="SVG">')
  })

  test("passes for data URI with PNG", () => {
    expectNoOffenses('<img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO2W2n8AAAAASUVORK5CYII=" alt="1x1 transparent image">')
  })

  test("passes for data URI with PNG with ERB", () => {
    expectNoOffenses('<img src="data:image/png;base64,<%= File.read("image.png").to_base64 %>" alt="1x1 transparent image">')
  })

  test("passes for img with only https URL", () => {
    expectNoOffenses('<img src="https://example.com/image.jpg" alt="External image">')
  })

  test("passes for img with only http URL", () => {
    expectNoOffenses('<img src="http://example.com/image.jpg" alt="External image">')
  })
})
