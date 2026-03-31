import { getAttributeName } from "@herb-tools/core"
import type { ParseResult, ParserOptions, HTMLAttributeNode } from "@herb-tools/core"

import { BaseRuleVisitor } from "./rule-utils.js"
import { ParserRule } from "../types.js"
import type { UnboundLintOffense, LintContext, FullRuleConfig } from "../types.js"

const HTML_EVENT_ATTRIBUTES = new Set([
  // Window Event Attributes
  "onafterprint",
  "onbeforeprint",
  "onbeforeunload",
  "onerror",
  "onhashchange",
  "onlanguagechange",
  "onload",
  "onmessage",
  "onmessageerror",
  "onoffline",
  "ononline",
  "onpagehide",
  "onpageshow",
  "onpopstate",
  "onrejectionhandled",
  "onresize",
  "onstorage",
  "onunhandledrejection",
  "onunload",

  // Form Event Attributes
  "onblur",
  "onchange",
  "onfocus",
  "onformdata",
  "oninput",
  "oninvalid",
  "onreset",
  "onsearch",
  "onselect",
  "onsubmit",

  // Keyboard Event Attributes
  "onkeydown",
  "onkeypress",
  "onkeyup",

  // Mouse Event Attributes
  "onauxclick",
  "onclick",
  "oncontextmenu",
  "ondblclick",
  "onmousedown",
  "onmouseenter",
  "onmouseleave",
  "onmousemove",
  "onmouseout",
  "onmouseover",
  "onmouseup",
  "onwheel",

  // Drag Event Attributes
  "ondrag",
  "ondragend",
  "ondragenter",
  "ondragleave",
  "ondragover",
  "ondragstart",
  "ondrop",

  // Clipboard Event Attributes
  "oncopy",
  "oncut",
  "onpaste",

  // Media Event Attributes
  "onabort",
  "oncanplay",
  "oncanplaythrough",
  "oncuechange",
  "ondurationchange",
  "onemptied",
  "onended",
  "onloadeddata",
  "onloadedmetadata",
  "onloadstart",
  "onpause",
  "onplay",
  "onplaying",
  "onprogress",
  "onratechange",
  "onseeked",
  "onseeking",
  "onstalled",
  "onsuspend",
  "ontimeupdate",
  "onvolumechange",
  "onwaiting",

  // Scroll Event Attributes
  "onscroll",
  "onscrollend",

  // Misc Event Attributes
  "onbeforematch",
  "onbeforetoggle",
  "oncancel",
  "onclose",
  "oncontextlost",
  "oncontextrestored",
  "onsecuritypolicyviolation",
  "onslotchange",
  "ontoggle",
])

class HTMLNoEventHandlersVisitor extends BaseRuleVisitor {
  visitHTMLAttributeNode(node: HTMLAttributeNode): void {
    const attributeName = getAttributeName(node)

    if (attributeName && HTML_EVENT_ATTRIBUTES.has(attributeName.toLowerCase())) {
      this.addOffense(
        `Avoid inline event handler \`${attributeName}\`. Use external JavaScript with \`addEventListener\` instead or an external library like Stimulus.`,
        node.location,
      )
    }

    super.visitHTMLAttributeNode(node)
  }
}

export class HTMLNoEventHandlersRule extends ParserRule {
  static ruleName = "html-no-event-handlers"
  static introducedIn = this.version("unreleased")

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: false,
      severity: "warning"
    }
  }

  get parserOptions(): Partial<ParserOptions> {
    return {
      action_view_helpers: true,
    }
  }

  check(result: ParseResult, context?: Partial<LintContext>): UnboundLintOffense[] {
    const visitor = new HTMLNoEventHandlersVisitor(this.ruleName, context)

    visitor.visit(result.value)

    return visitor.offenses
  }
}
