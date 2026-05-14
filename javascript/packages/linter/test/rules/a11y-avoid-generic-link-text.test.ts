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
})
