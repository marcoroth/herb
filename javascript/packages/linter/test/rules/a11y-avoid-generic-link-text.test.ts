import { describe, test } from "vitest"
import { A11yAvoidGenericLinkTextRule } from "../../src/rules/a11y-avoid-generic-link-text.js"
import { createLinterTest } from "../helpers/linter-test-helper.js"

const { expectNoOffenses, expectWarning, assertOffenses } = createLinterTest(A11yAvoidGenericLinkTextRule)

describe("a11y-avoid-generic-link-text", () => {
  test("passes for link with descriptive text", () => {
    expectNoOffenses('<a href="github.com/about">Learn more about GitHub</a>')
  })

  test("passes for link with aria-label", () => {
    expectNoOffenses('<a aria-label="Learn more about GitHub" href="github.com/about">Learn more</a>')
  })

  test("passes for link with dynamic aria-label", () => {
    expectNoOffenses('<a aria-label="<%= label_text %>" href="github.com/about">Learn more</a>')
  })

  test("passes for link with aria-labelledby", () => {
    expectNoOffenses('<a aria-labelledby="desc" href="github.com/about">Learn more</a>')
  })

  test("passes for link with ERB content", () => {
    expectNoOffenses('<a href="github.com/about"><%= link_text %></a>')
  })

  test("passes for link with no text", () => {
    expectNoOffenses('<a href="github.com/about"></a>')
  })

  test("passes for non-link element with banned text", () => {
    expectNoOffenses('<span>Click here</span>')
  })

  test("fails for link with 'Learn more'", () => {
    expectWarning('Avoid using generic link text such as "Learn more". Screen reader users often navigate by links, and generic text like "Read more", "Learn more", "Click here", "More", "Link", or "Here" is not meaningful out of context.')

    assertOffenses('<a href="github.com/about">Learn more</a>')
  })

  test("fails for link with 'Read more'", () => {
    expectWarning('Avoid using generic link text such as "Read more". Screen reader users often navigate by links, and generic text like "Read more", "Learn more", "Click here", "More", "Link", or "Here" is not meaningful out of context.')

    assertOffenses('<a href="github.com/about">Read more</a>')
  })

  test("fails for link with 'Click here'", () => {
    expectWarning('Avoid using generic link text such as "Click here". Screen reader users often navigate by links, and generic text like "Read more", "Learn more", "Click here", "More", "Link", or "Here" is not meaningful out of context.')

    assertOffenses('<a href="github.com/new">Click here</a>')
  })

  test("fails for link with 'More'", () => {
    expectWarning('Avoid using generic link text such as "More". Screen reader users often navigate by links, and generic text like "Read more", "Learn more", "Click here", "More", "Link", or "Here" is not meaningful out of context.')

    assertOffenses('<a href="github.com">More</a>')
  })

  test("fails for link with 'Link'", () => {
    expectWarning('Avoid using generic link text such as "Link". Screen reader users often navigate by links, and generic text like "Read more", "Learn more", "Click here", "More", "Link", or "Here" is not meaningful out of context.')

    assertOffenses('<a href="github.com">Link</a>')
  })

  test("fails for link with 'Here'", () => {
    expectWarning('Avoid using generic link text such as "Here". Screen reader users often navigate by links, and generic text like "Read more", "Learn more", "Click here", "More", "Link", or "Here" is not meaningful out of context.')

    assertOffenses('<a href="github.com">Here</a>')
  })

  test("fails for link with case-insensitive banned text", () => {
    expectWarning('Avoid using generic link text such as "CLICK HERE". Screen reader users often navigate by links, and generic text like "Read more", "Learn more", "Click here", "More", "Link", or "Here" is not meaningful out of context.')

    assertOffenses('<a href="github.com/new">CLICK HERE</a>')
  })

  test("fails for link with extra whitespace in banned text", () => {
    expectWarning('Avoid using generic link text such as "Learn more". Screen reader users often navigate by links, and generic text like "Read more", "Learn more", "Click here", "More", "Link", or "Here" is not meaningful out of context.')

    assertOffenses('<a href="github.com/about">  Learn more  </a>')
  })

  test("fails for link_to with generic text", () => {
    expectWarning('Avoid using generic link text such as "More". Screen reader users often navigate by links, and generic text like "Read more", "Learn more", "Click here", "More", "Link", or "Here" is not meaningful out of context.')

    assertOffenses('<%= link_to "More", root_path %>')
  })

  test("fails for link_to with 'Click here'", () => {
    expectWarning('Avoid using generic link text such as "Click here". Screen reader users often navigate by links, and generic text like "Read more", "Learn more", "Click here", "More", "Link", or "Here" is not meaningful out of context.')

    assertOffenses('<%= link_to "Click here", "#" %>')
  })

  test("passes for link_to with descriptive text", () => {
    expectNoOffenses('<%= link_to "Learn more about GitHub", root_path %>')
  })

  test("passes for link_to with aria-label string key", () => {
    expectNoOffenses('<%= link_to "More", root_path, "aria-label": "Learn more about GitHub" %>')
  })

  test("passes for link_to with aria hash label", () => {
    expectNoOffenses('<%= link_to "More", root_path, aria: { label: "Learn more about GitHub" } %>')
  })

  test("passes for link_to with dynamic aria-label", () => {
    expectNoOffenses('<%= link_to "More", root_path, aria: { label: label_text } %>')
  })

  test("fails for link_to block form with generic text", () => {
    expectWarning('Avoid using generic link text such as "Read more". Screen reader users often navigate by links, and generic text like "Read more", "Learn more", "Click here", "More", "Link", or "Here" is not meaningful out of context.')

    assertOffenses('<%= link_to root_path do %>Read more<% end %>')
  })

  test("passes for link_to block form with descriptive text", () => {
    expectNoOffenses('<%= link_to root_path do %>Read more about GitHub<% end %>')
  })
})
