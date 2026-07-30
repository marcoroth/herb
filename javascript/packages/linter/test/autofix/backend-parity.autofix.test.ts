import { describe, test, beforeAll } from "vitest"
import { Herb } from "@herb-tools/node-wasm"

import { expectAutofix, expectUnsafeAutofix } from "../helpers/autofix-test-helper.js"

import { ERBNoExtraNewLineRule } from "../../src/rules/erb-no-extra-newline.js"
import { ERBRequireTrailingNewlineRule } from "../../src/rules/erb-require-trailing-newline.js"
import { SourceIndentationRule } from "../../src/rules/source-indentation.js"
import { HTMLTagNameLowercaseRule } from "../../src/rules/html-tag-name-lowercase.js"
import { HTMLAttributeEqualsSpacingRule } from "../../src/rules/html-attribute-equals-spacing.js"
import { HTMLAttributeDoubleQuotesRule } from "../../src/rules/html-attribute-double-quotes.js"
import { HTMLBooleanAttributesNoValueRule } from "../../src/rules/html-boolean-attributes-no-value.js"
import { ERBRightTrimRule } from "../../src/rules/erb-right-trim.js"
import { SVGTagNameCapitalizationRule } from "../../src/rules/svg-tag-name-capitalization.js"
import { ERBCommentSyntax } from "../../src/rules/erb-comment-syntax.js"
import { ERBRequireWhitespaceRule } from "../../src/rules/erb-require-whitespace-inside-tags.js"
import { ERBNoExtraWhitespaceRule } from "../../src/rules/erb-no-extra-whitespace-inside-tags.js"
import { HTMLAttributeValuesRequireQuotesRule } from "../../src/rules/html-attribute-values-require-quotes.js"
import { HTMLNoSelfClosingRule } from "../../src/rules/html-no-self-closing.js"
import { ERBStrictLocalsRequiredRule } from "../../src/rules/erb-strict-locals-required.js"
import { ActionViewStrictLocalsPartialOnlyRule } from "../../src/rules/actionview-strict-locals-partial-only.js"
import { HTMLNoUnescapedEntitiesRule } from "../../src/rules/html-no-unescaped-entities.js"
import { ERBNoTrailingWhitespaceRule } from "../../src/rules/erb-no-trailing-whitespace.js"
import { HTMLNoSpaceInTagRule } from "../../src/rules/html-no-space-in-tag.js"
import { ERBPreferDirectOutputRule } from "../../src/rules/erb-prefer-direct-output.js"
import { ActionViewStrictLocalsFirstLineRule } from "../../src/rules/actionview-strict-locals-first-line.js"
import { ActionViewNoUnnecessaryTagAttributesRule } from "../../src/rules/actionview-no-unnecessary-tag-attributes.js"
import { ERBNoDuplicateBranchElementsRule } from "../../src/rules/erb-no-duplicate-branch-elements.js"

describe("autofix backend parity", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  test("erb-no-extra-newline", () => {
    expectAutofix(ERBNoExtraNewLineRule, "<p>a</p>\n\n\n\n\n<p>b</p>\n", "<p>a</p>\n\n\n<p>b</p>\n")
  })

  test("erb-require-trailing-newline", () => {
    expectAutofix(ERBRequireTrailingNewlineRule, "<p>a</p>", "<p>a</p>\n", { fileName: "test.html.erb" })
  })

  test("html-tag-name-lowercase", () => {
    expectAutofix(HTMLTagNameLowercaseRule, "<DIV>Hello</DIV>", "<div>Hello</div>")
    expectAutofix(HTMLTagNameLowercaseRule, "<Div><Span>Text</Span></Div>", "<div><span>Text</span></div>")
  })

  test("html-attribute-equals-spacing", () => {
    expectAutofix(HTMLAttributeEqualsSpacingRule, `<div class = "x"></div>`, `<div class="x"></div>`)
  })

  test("html-attribute-double-quotes", () => {
    expectAutofix(HTMLAttributeDoubleQuotesRule, `<div class='x'></div>`, `<div class="x"></div>`)
  })

  test("html-boolean-attributes-no-value", () => {
    expectAutofix(HTMLBooleanAttributesNoValueRule, `<input disabled="disabled">`, `<input disabled>`)
  })

  test("erb-right-trim", () => {
    expectAutofix(ERBRightTrimRule, `<%= x =%>`, `<%= x -%>`)
  })

  test("svg-tag-name-capitalization", () => {
    expectAutofix(SVGTagNameCapitalizationRule, `<svg><lineargradient></lineargradient></svg>`, `<svg><linearGradient></linearGradient></svg>`)
  })

  test("erb-comment-syntax", () => {
    expectAutofix(ERBCommentSyntax, `<% # comment %>`, `<%# comment %>`)
  })

  test("erb-require-whitespace-inside-tags", () => {
    expectAutofix(ERBRequireWhitespaceRule, `<%=x %>`, `<%= x %>`)
    expectAutofix(ERBRequireWhitespaceRule, `<%= x%>`, `<%= x %>`)
  })

  test("erb-no-extra-whitespace-inside-tags", () => {
    expectAutofix(ERBNoExtraWhitespaceRule, `<%=  x %>`, `<%= x %>`)
    expectAutofix(ERBNoExtraWhitespaceRule, `<%= x  %>`, `<%= x %>`)
  })

  test("html-attribute-values-require-quotes", () => {
    expectAutofix(HTMLAttributeValuesRequireQuotesRule, `<div class=foo></div>`, `<div class="foo"></div>`)
  })

  test("html-no-self-closing", () => {
    expectAutofix(HTMLNoSelfClosingRule, `<div />`, `<div></div>`)
    expectAutofix(HTMLNoSelfClosingRule, `<br />`, `<br>`)
    expectAutofix(HTMLNoSelfClosingRule, `<img src="a.png" />`, `<img src="a.png">`)
  })

  test("erb-strict-locals-required", () => {
    expectUnsafeAutofix(ERBStrictLocalsRequiredRule, `<div>a</div>\n`, `<%# locals: () %>\n\n<div>a</div>\n`, { fileName: "_partial.html.erb" })
  })

  test("actionview-strict-locals-partial-only", () => {
    expectUnsafeAutofix(ActionViewStrictLocalsPartialOnlyRule, `<%# locals: (a:) %>\n\n<div>a</div>\n`, `<div>a</div>\n`, { fileName: "page.html.erb" })
  })

  test("html-no-unescaped-entities", () => {
    expectUnsafeAutofix(HTMLNoUnescapedEntitiesRule, `<p>a & b</p>`, `<p>a &amp; b</p>`)
    expectUnsafeAutofix(HTMLNoUnescapedEntitiesRule, `<p>a &amp; b</p>`, `<p>a &amp; b</p>`)
  })

  test("erb-no-trailing-whitespace", () => {
    expectAutofix(ERBNoTrailingWhitespaceRule, `<div>a</div>   \n`, `<div>a</div>\n`)
    expectAutofix(ERBNoTrailingWhitespaceRule, `<div>\n  <p>a</p>   \n</div>\n`, `<div>\n  <p>a</p>\n</div>\n`)
    expectAutofix(ERBNoTrailingWhitespaceRule, `<div>   \n   \n</div>\n`, `<div>\n\n</div>\n`)
  })

  test("html-no-space-in-tag", () => {
    expectAutofix(HTMLNoSpaceInTagRule, `<div >a</div>`, `<div>a</div>`)
    expectAutofix(HTMLNoSpaceInTagRule, `<div  class='x'>a</div>`, `<div class='x'>a</div>`)
    expectAutofix(HTMLNoSpaceInTagRule, `<br/>`, `<br />`)
  })

  test("erb-prefer-direct-output", () => {
    expectAutofix(ERBPreferDirectOutputRule, `<%= "hello" %>`, `hello`)
    expectAutofix(ERBPreferDirectOutputRule, `<p><%= "Total: #{count}" %></p>`, `<p>Total: <%= count %></p>`)
  })

  test("actionview-strict-locals-first-line", () => {
    expectAutofix(ActionViewStrictLocalsFirstLineRule, `<%# locals: (a:) %>\n<div>x</div>\n`, `<%# locals: (a:) %>\n\n<div>x</div>\n`, { fileName: "_partial.html.erb" })
  })

  test("actionview-no-unnecessary-tag-attributes", () => {
    expectAutofix(ActionViewNoUnnecessaryTagAttributesRule, `<div <%= tag.attributes(class: "x") %>></div>`, `<%= tag.div(class: "x") %>`)
  })

  test("erb-no-duplicate-branch-elements", () => {
    expectAutofix(
      ERBNoDuplicateBranchElementsRule,
      `<% if condition %>\n  <div>Hello</div>\n<% else %>\n  <div>World</div>\n<% end %>`,
      `<div>\n  <% if condition %>\n    Hello\n  <% else %>\n    World\n  <% end %>\n</div>`,
    )
  })

  test("source-indentation", () => {
    expectAutofix(SourceIndentationRule, "<div>\n\t<p>a</p>\n</div>\n", "<div>\n  <p>a</p>\n</div>\n")
  })
})
