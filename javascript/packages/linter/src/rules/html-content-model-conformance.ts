import { BaseRuleVisitor } from "./rule-utils.js"

import { ParserRule } from "../types.js"
import type {
  UnboundLintOffense,
  LintContext,
  FullRuleConfig,
} from "../types.js"
import type {
  HTMLOpenTagNode,
  HTMLElementNode,
  ParseResult,
} from "@herb-tools/core"

type ContentCategory = "flow" | "phrasing"
type ContentModel =
  | ContentCategory
  | "transparent"
  | "nothing"
  | "text"
  | Array<string>
type Spec = {
  categories: Array<ContentCategory>
  contentModel: ContentModel
  computedContentModel?: (elementStack: string[]) => ContentModel
  link: string
}
type Specs = { [key: string]: Spec }

class ContentModelConformanceVisitor extends BaseRuleVisitor {
  private elementStack: string[] = []

  private isValidHTMLOpenTag(node: HTMLElementNode): boolean {
    return !!(node.open_tag && node.open_tag.type === "AST_HTML_OPEN_TAG_NODE")
  }

  private resolveTransparentContentModel(): ContentModel | null {
    let index = -1
    for (const tagName of this.elementStack.slice(0, -1).reverse()) {
      const spec = specs[tagName]
      const contentModel = spec?.computedContentModel
        ? spec.computedContentModel(this.elementStack.slice(0, index))
        : spec?.contentModel
      if (spec && contentModel !== "transparent") {
        return contentModel
      }
      index--
    }
    return null
  }

  private addOffenseMessage(
    tagName: string,
    parentTagName: string,
    openTag: HTMLOpenTagNode,
  ): void {
    this.addOffense(
      `Element \`<${tagName}>\` cannot be placed inside element \`<${parentTagName}>\`.`,
      openTag.tag_name!.location,
    )
  }

  private checkConformance(tagName: string, openTag: HTMLOpenTagNode) {
    const spec = specs[tagName]

    const parentTagName = this.elementStack.at(-1)
    if (spec && parentTagName && specs[parentTagName]) {
      const check = (spec: Spec, parentContentModel: ContentModel) => {
        switch (parentContentModel) {
          case "flow":
          case "phrasing":
            if (!spec.categories.includes(parentContentModel)) {
              this.addOffenseMessage(tagName, parentTagName, openTag)
            }
            break
          case "transparent":
            const transparentContentModel = this.resolveTransparentContentModel()
            if (transparentContentModel) {
              check(spec, transparentContentModel)
            }
            break
          case "nothing":
            // If a void element has elements, but unreachable because of parse error.
            break
          case "text":
            // unreachable
            break
          default:
            if (Array.isArray(parentContentModel)) {
              if (!parentContentModel.includes(tagName)) {
                this.addOffenseMessage(tagName, parentTagName, openTag)
              }
            } else {
              const _exhaustiveCheck: never = parentContentModel
              throw new Error(`$unreachable: ${_exhaustiveCheck}`)
            }
        }
      }

      const parentSpec = specs[parentTagName]
      const parentContentModel = parentSpec.computedContentModel
        ? parentSpec.computedContentModel(this.elementStack.slice(0, -1))
        : parentSpec.contentModel
      check(spec, parentContentModel)
    }
  }

  visitHTMLElementNode(node: HTMLElementNode): void {
    if (!this.isValidHTMLOpenTag(node)) {
      super.visitHTMLElementNode(node)

      return
    }

    const openTag = node.open_tag as HTMLOpenTagNode
    const tagName = openTag.tag_name?.value.toLowerCase()

    if (!tagName) {
      super.visitHTMLElementNode(node)

      return
    }

    this.checkConformance(tagName, openTag)

    this.elementStack.push(tagName)
    super.visitHTMLElementNode(node)
    this.elementStack.pop()
  }
}

export class HTMLContentModelConformanceRule extends ParserRule {
  name = "html-content-model-conformance"

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: false,
      severity: "error",
    }
  }

  check(
    result: ParseResult,
    context?: Partial<LintContext>,
  ): UnboundLintOffense[] {
    const visitor = new ContentModelConformanceVisitor(this.name, context)
    visitor.visit(result.value)
    return visitor.offenses
  }
}

// 3.2.5.2.9: https://html.spec.whatwg.org/multipage/dom.html#script-supporting-elements-2
const scriptSupportingElements = ["script", "template"]

// 3.2.5.2.10: https://html.spec.whatwg.org/multipage/dom.html#select-element-inner-content-elements
const selectElementInnerContentElements = ["option", "optgroup", "hr"]
  .concat(scriptSupportingElements)
  .concat(["noscript", "div"])

// 3.2.5.2.11: https://html.spec.whatwg.org/multipage/dom.html#optgroup-element-inner-content-elements-2
const optgroupElementInnerContentElements = ["option"]
  .concat(scriptSupportingElements)
  .concat(["noscript", "div"])

const specs = {
  body: {
    categories: [],
    contentModel: "flow",
    link: "https://html.spec.whatwg.org/multipage/sections.html#the-body-element",
  },
  article: {
    categories: ["flow"],
    contentModel: "flow",
    link: "https://html.spec.whatwg.org/multipage/sections.html#the-article-element",
  },
  section: {
    categories: ["flow"],
    contentModel: "flow",
    link: "https://html.spec.whatwg.org/multipage/sections.html#the-section-element",
  },
  nav: {
    categories: ["flow"],
    contentModel: "flow",
    link: "https://html.spec.whatwg.org/multipage/sections.html#the-nav-element",
  },
  aside: {
    categories: ["flow"],
    contentModel: "flow",
    link: "https://html.spec.whatwg.org/multipage/sections.html#the-aside-element",
  },
  h1: {
    categories: ["flow"],
    contentModel: "phrasing",
    link: "https://html.spec.whatwg.org/multipage/sections.html#the-h1,-h2,-h3,-h4,-h5,-and-h6-elements",
  },
  h2: {
    categories: ["flow"],
    contentModel: "phrasing",
    link: "https://html.spec.whatwg.org/multipage/sections.html#the-h1,-h2,-h3,-h4,-h5,-and-h6-elements",
  },
  h3: {
    categories: ["flow"],
    contentModel: "phrasing",
    link: "https://html.spec.whatwg.org/multipage/sections.html#the-h1,-h2,-h3,-h4,-h5,-and-h6-elements",
  },
  h4: {
    categories: ["flow"],
    contentModel: "phrasing",
    link: "https://html.spec.whatwg.org/multipage/sections.html#the-h1,-h2,-h3,-h4,-h5,-and-h6-elements",
  },
  h5: {
    categories: ["flow"],
    contentModel: "phrasing",
    link: "https://html.spec.whatwg.org/multipage/sections.html#the-h1,-h2,-h3,-h4,-h5,-and-h6-elements",
  },
  h6: {
    categories: ["flow"],
    contentModel: "phrasing",
    link: "https://html.spec.whatwg.org/multipage/sections.html#the-h1,-h2,-h3,-h4,-h5,-and-h6-elements",
  },
  hgroup: {
    categories: ["flow"],
    // Zero or more p elements, followed by one h1, h2, h3, h4, h5, or h6 element, followed by zero or more p elements, optionally intermixed with script-supporting elements.
    contentModel: ["p", "h1", "h2", "h3", "h4", "h5", "h6"].concat(
      scriptSupportingElements,
    ),
    link: "https://html.spec.whatwg.org/multipage/sections.html#the-hgroup-element",
  },
  header: {
    categories: ["flow"],
    // Flow content, but with no header or footer element descendants.
    contentModel: "flow",
    link: "https://html.spec.whatwg.org/multipage/sections.html#the-header-element",
  },
  footer: {
    categories: ["flow"],
    // Flow content, but with no header or footer element descendants.
    contentModel: "flow",
    link: "https://html.spec.whatwg.org/multipage/sections.html#the-footer-element",
  },
  address: {
    categories: ["flow"],
    // Flow content, but with no heading content descendants, no sectioning content descendants, and no header, footer, or address element descendants.
    contentModel: "flow",
    link: "https://html.spec.whatwg.org/multipage/sections.html#the-address-element",
  },
  p: {
    categories: ["flow"],
    contentModel: "phrasing",
    link: "https://html.spec.whatwg.org/multipage/grouping-content.html#the-p-element",
  },
  hr: {
    categories: ["flow"],
    contentModel: "nothing",
    link: "https://html.spec.whatwg.org/multipage/grouping-content.html#the-hr-element",
  },
  pre: {
    categories: ["flow"],
    contentModel: "phrasing",
    link: "https://html.spec.whatwg.org/multipage/grouping-content.html#the-pre-element",
  },
  blockquote: {
    categories: ["flow"],
    contentModel: "flow",
    link: "https://html.spec.whatwg.org/multipage/grouping-content.html#the-blockquote-element",
  },
  ol: {
    categories: ["flow"],
    // Zero or more li and script-supporting elements.
    contentModel: ["li"].concat(scriptSupportingElements),
    link: "https://html.spec.whatwg.org/multipage/grouping-content.html#the-ol-element",
  },
  ul: {
    categories: ["flow"],
    // Zero or more li and script-supporting elements.
    contentModel: ["li"].concat(scriptSupportingElements),
    link: "https://html.spec.whatwg.org/multipage/grouping-content.html#the-ul-element",
  },
  menu: {
    categories: ["flow"],
    // Zero or more li and script-supporting elements.
    contentModel: ["li"].concat(scriptSupportingElements),
    link: "https://html.spec.whatwg.org/multipage/grouping-content.html#the-menu-element",
  },
  li: {
    categories: [],
    contentModel: "flow",
    link: "https://html.spec.whatwg.org/multipage/grouping-content.html#the-li-element",
  },
  dl: {
    categories: ["flow"],
    // Either: Zero or more groups each consisting of one or more dt elements followed by one or more dd elements, optionally intermixed with script-supporting elements.
    // Or: One or more div elements, optionally intermixed with script-supporting elements.
    contentModel: ["dt", "dd"].concat(scriptSupportingElements).concat(["div"]),
    link: "https://html.spec.whatwg.org/multipage/grouping-content.html#the-dl-element",
  },
  dt: {
    categories: [],
    // Flow content, but with no header, footer, sectioning content, or heading content descendants.
    contentModel: "flow",
    link: "https://html.spec.whatwg.org/multipage/grouping-content.html#the-dt-element",
  },
  dd: {
    categories: [],
    contentModel: "flow",
    link: "https://html.spec.whatwg.org/multipage/grouping-content.html#the-dd-element",
  },
  figure: {
    categories: ["flow"],
    // Either: one figcaption element followed by flow content.
    // Or: flow contenut followed by one figcaption element.
    // Or: flow content.
    get contentModel() {
      return flowElements.concat(["figcaption"])
    },
    link: "https://html.spec.whatwg.org/multipage/grouping-content.html#the-figure-element",
  },
  figcaption: {
    categories: [],
    contentModel: "flow",
    link: "https://html.spec.whatwg.org/multipage/grouping-content.html#the-figcaption-element",
  },
  main: {
    categories: ["flow"],
    contentModel: "flow",
    link: "https://html.spec.whatwg.org/multipage/grouping-content.html#the-main-element",
  },
  search: {
    categories: ["flow"],
    contentModel: "flow",
    link: "https://html.spec.whatwg.org/multipage/grouping-content.html#the-search-element",
  },
  div: {
    categories: ["flow"],
    contentModel: "flow",
    computedContentModel(elementStack) {
      // If the element is a child of a dl element: One or more dt elements followed by one or more dd elements, optionally intermixed with script-supporting elements.
      if (elementStack.at(-1) === "dl") {
        return ["dt", "dd"].concat(scriptSupportingElements)
      }
      // Otherwise, if the element is a descendant of an option element: Zero or more option element inner content elements.
      if (elementStack.includes("option")) {
        return optionElementInnerContentElements
      }
      // Otherwise, if the element is a descendant of an optgroup element: Zero or more optgroup element inner content elements.
      if (elementStack.includes("optgroup")) {
        return optgroupElementInnerContentElements
      }
      // Otherwise, if the element is a descendant of a select element: Zero or more select element inner content elements.
      if (elementStack.includes("select")) {
        return selectElementInnerContentElements
      }
      // Otherwise: flow content.
      return this.contentModel
    },
    link: "https://html.spec.whatwg.org/multipage/grouping-content.html#the-div-element",
  },
  a: {
    categories: ["flow", "phrasing"],
    // Transparent, but there must be no interactive content descendant, a element descendant, or descendant with the tabindex attribute specified.
    contentModel: "transparent",
    link: "https://html.spec.whatwg.org/multipage/text-level-semantics.html#the-a-element",
  },
  em: {
    categories: ["flow", "phrasing"],
    contentModel: "phrasing",
    link: "https://html.spec.whatwg.org/multipage/text-level-semantics.html#the-em-element",
  },
  strong: {
    categories: ["flow", "phrasing"],
    contentModel: "phrasing",
    link: "https://html.spec.whatwg.org/multipage/text-level-semantics.html#the-strong-element",
  },
  small: {
    categories: ["flow", "phrasing"],
    contentModel: "phrasing",
    link: "https://html.spec.whatwg.org/multipage/text-level-semantics.html#the-small-element",
  },
  s: {
    categories: ["flow", "phrasing"],
    contentModel: "phrasing",
    link: "https://html.spec.whatwg.org/multipage/text-level-semantics.html#the-s-element",
  },
  cite: {
    categories: ["flow", "phrasing"],
    contentModel: "phrasing",
    link: "https://html.spec.whatwg.org/multipage/text-level-semantics.html#the-cite-element",
  },
  q: {
    categories: ["flow", "phrasing"],
    contentModel: "phrasing",
    link: "https://html.spec.whatwg.org/multipage/text-level-semantics.html#the-q-element",
  },
  dfn: {
    categories: ["flow", "phrasing"],
    // Phrasing content, but there must be no dfn element descendants.
    contentModel: "phrasing",
    link: "https://html.spec.whatwg.org/multipage/text-level-semantics.html#the-dfn-element",
  },
  abbr: {
    categories: ["flow", "phrasing"],
    contentModel: "phrasing",
    link: "https://html.spec.whatwg.org/multipage/text-level-semantics.html#the-abbr-element",
  },
  ruby: {
    categories: ["flow", "phrasing"],
    // 1. One or the other of the following:
    //   - Phrasing content, but with no ruby elements and with no ruby element descendants
    //   - A single ruby element that itself has no ruby element descendants
    // 2. One or the other of the following:
    //   - One or more rt elements
    //   - An rp element followed by one or more rt elements, each of which is itself followed by an rp element
    get contentModel() {
      return phrasingElements.concat(["rt", "rp"])
    },
    link: "https://html.spec.whatwg.org/multipage/text-level-semantics.html#the-ruby-element",
  },
  rt: {
    categories: [],
    contentModel: "phrasing",
    link: "https://html.spec.whatwg.org/multipage/text-level-semantics.html#the-rt-element",
  },
  rp: {
    categories: [],
    contentModel: "text",
    link: "https://html.spec.whatwg.org/multipage/text-level-semantics.html#the-rp-element",
  },
  data: {
    categories: ["flow", "phrasing"],
    contentModel: "phrasing",
    link: "https://html.spec.whatwg.org/multipage/text-level-semantics.html#the-data-element",
  },
  time: {
    categories: ["flow", "phrasing"],
    // If the element has a datetime attribute: Phrasing content. Otherwise: Text, but must match requirements described in prose below.
    contentModel: "phrasing",
    link: "https://html.spec.whatwg.org/multipage/text-level-semantics.html#the-time-element",
  },
  code: {
    categories: ["flow", "phrasing"],
    contentModel: "phrasing",
    link: "https://html.spec.whatwg.org/multipage/text-level-semantics.html#the-code-element",
  },
  var: {
    categories: ["flow", "phrasing"],
    contentModel: "phrasing",
    link: "https://html.spec.whatwg.org/multipage/text-level-semantics.html#the-var-element",
  },
  samp: {
    categories: ["flow", "phrasing"],
    contentModel: "phrasing",
    link: "https://html.spec.whatwg.org/multipage/text-level-semantics.html#the-samp-element",
  },
  kbd: {
    categories: ["flow", "phrasing"],
    contentModel: "phrasing",
    link: "https://html.spec.whatwg.org/multipage/text-level-semantics.html#the-kbd-element",
  },
  sub: {
    categories: ["flow", "phrasing"],
    contentModel: "phrasing",
    link: "https://html.spec.whatwg.org/multipage/text-level-semantics.html#the-sub-and-sup-elements",
  },
  sup: {
    categories: ["flow", "phrasing"],
    contentModel: "phrasing",
    link: "https://html.spec.whatwg.org/multipage/text-level-semantics.html#the-sub-and-sup-elements",
  },
  i: {
    categories: ["flow", "phrasing"],
    contentModel: "phrasing",
    link: "https://html.spec.whatwg.org/multipage/text-level-semantics.html#the-i-element",
  },
  b: {
    categories: ["flow", "phrasing"],
    contentModel: "phrasing",
    link: "https://html.spec.whatwg.org/multipage/text-level-semantics.html#the-b-element",
  },
  u: {
    categories: ["flow", "phrasing"],
    contentModel: "phrasing",
    link: "https://html.spec.whatwg.org/multipage/text-level-semantics.html#the-u-element",
  },
  mark: {
    categories: ["flow", "phrasing"],
    contentModel: "phrasing",
    link: "https://html.spec.whatwg.org/multipage/text-level-semantics.html#the-mark-element",
  },
  bdi: {
    categories: ["flow", "phrasing"],
    contentModel: "phrasing",
    link: "https://html.spec.whatwg.org/multipage/text-level-semantics.html#the-bdi-element",
  },
  bdo: {
    categories: ["flow", "phrasing"],
    contentModel: "phrasing",
    link: "https://html.spec.whatwg.org/multipage/text-level-semantics.html#the-bdo-element",
  },
  span: {
    categories: ["flow", "phrasing"],
    contentModel: "phrasing",
    computedContentModel(elementStack) {
      // If the element is a descendant of an option element: Zero or more option element inner content elements, except div elements.
      if (elementStack.includes("option")) {
        return optionElementInnerContentElements.filter((e) => e !== "div")
      }
      // Otherwise: Phrasing content.
      return this.contentModel
    },
    link: "https://html.spec.whatwg.org/multipage/text-level-semantics.html#the-span-element",
  },
  br: {
    categories: ["flow", "phrasing"],
    contentModel: "nothing",
    link: "https://html.spec.whatwg.org/multipage/text-level-semantics.html#the-br-element",
  },
  wbr: {
    categories: ["flow", "phrasing"],
    contentModel: "nothing",
    link: "https://html.spec.whatwg.org/multipage/text-level-semantics.html#the-wbr-element",
  },
  ins: {
    categories: ["flow", "phrasing"],
    contentModel: "transparent",
    link: "https://html.spec.whatwg.org/multipage/edits.html#the-ins-element",
  },
  del: {
    categories: ["flow", "phrasing"],
    contentModel: "transparent",
    link: "https://html.spec.whatwg.org/multipage/edits.html#the-del-element",
  },
  picture: {
    categories: ["flow", "phrasing"],
    // "Zero or more source elements, followed by one img element, optionally intermixed with script-supporting elements.
    contentModel: ["source", "img"].concat(scriptSupportingElements),
    link: "https://html.spec.whatwg.org/multipage/embedded-content.html#the-picture-element",
  },
  source: {
    categories: [],
    contentModel: "nothing",
    link: "https://html.spec.whatwg.org/multipage/embedded-content.html#the-source-element",
  },
  img: {
    categories: ["flow", "phrasing"],
    contentModel: "nothing",
    link: "https://html.spec.whatwg.org/multipage/embedded-content.html#the-img-element",
  },
  iframe: {
    categories: ["flow", "phrasing"],
    contentModel: "nothing",
    link: "https://html.spec.whatwg.org/multipage/iframe-embed-object.html#the-iframe-element",
  },
  embed: {
    categories: ["flow", "phrasing"],
    contentModel: "nothing",
    link: "https://html.spec.whatwg.org/multipage/iframe-embed-object.html#the-embed-element",
  },
  object: {
    categories: ["flow", "phrasing"],
    contentModel: "transparent",
    link: "https://html.spec.whatwg.org/multipage/iframe-embed-object.html#the-object-element",
  },
  video: {
    categories: ["flow", "phrasing"],
    // If the element has a src attribute: zero or more track elements, then transparent, but with no media element descendants.
    // If the element does not have a src attribute: zero or more source elements, then zero or more track elements, then transparent, but with no media element descendants.
    contentModel: ["track", "source"],
    link: "https://html.spec.whatwg.org/multipage/media.html#the-video-element",
  },
  audio: {
    categories: ["flow", "phrasing"],
    // If the element has a src attribute: zero or more track elements, then transparent, but with no media element descendants.
    // If the element does not have a src attribute: zero or more source elements, then zero or more track elements, then transparent, but with no media element descendants.
    contentModel: ["track", "source"],
    link: "https://html.spec.whatwg.org/multipage/media.html#the-audio-element",
  },
  track: {
    categories: [],
    contentModel: "nothing",
    link: "https://html.spec.whatwg.org/multipage/media.html#the-track-element",
  },
  map: {
    categories: ["flow", "phrasing"],
    contentModel: "transparent",
    link: "https://html.spec.whatwg.org/multipage/image-maps.html#the-map-element",
  },
  area: {
    categories: ["flow", "phrasing"],
    contentModel: "nothing",
    link: "https://html.spec.whatwg.org/multipage/image-maps.html#the-area-element",
  },
  table: {
    categories: ["flow"],
    // In this order: optionally a caption element, followed by zero or more colgroup elements, followed optionally by a thead element,
    // followed by either zero or more tbody elements or one or more tr elements, followed optionally by a tfoot element,
    // optionally intermixed with one or more script-supporting elements.
    contentModel: [
      "caption",
      "colgroup",
      "thead",
      "tbody",
      "tr",
      "tfoot",
    ].concat(scriptSupportingElements),
    link: "https://html.spec.whatwg.org/multipage/tables.html#the-table-element",
  },
  caption: {
    categories: [],
    // Flow content, but with no descendant table elements.
    contentModel: "flow",
    link: "https://html.spec.whatwg.org/multipage/tables.html#the-caption-element",
  },
  colgroup: {
    categories: [],
    // If the span attribute is present: Nothing. If the span attribute is absent: Zero or more col and template elements.
    contentModel: ["col", "template"],
    link: "https://html.spec.whatwg.org/multipage/tables.html#the-colgroup-element",
  },
  col: {
    categories: [],
    contentModel: "nothing",
    link: "https://html.spec.whatwg.org/multipage/tables.html#the-col-element",
  },
  tbody: {
    categories: [],
    // Zero or more tr and script-supporting elements.
    contentModel: ["tr"].concat(scriptSupportingElements),
    link: "https://html.spec.whatwg.org/multipage/tables.html#the-tbody-element",
  },
  thead: {
    categories: [],
    // Zero or more tr and script-supporting elements.
    contentModel: ["tr"].concat(scriptSupportingElements),
    link: "https://html.spec.whatwg.org/multipage/tables.html#the-thead-element",
  },
  tfoot: {
    categories: [],
    // Zero or more tr and script-supporting elements.
    contentModel: ["tr"].concat(scriptSupportingElements),
    link: "https://html.spec.whatwg.org/multipage/tables.html#the-tfoot-element",
  },
  tr: {
    categories: [],
    // Zero or more td, th, and script-supporting elements.
    contentModel: ["td", "th"].concat(scriptSupportingElements),
    link: "https://html.spec.whatwg.org/multipage/tables.html#the-tr-element",
  },
  td: {
    categories: [],
    contentModel: "flow",
    link: "https://html.spec.whatwg.org/multipage/tables.html#the-td-element",
  },
  th: {
    categories: [],
    // Flow content, but with no header, footer, sectioning content, or heading content descendants.
    contentModel: "flow",
    link: "https://html.spec.whatwg.org/multipage/tables.html#the-th-element",
  },
  form: {
    categories: ["flow"],
    // Flow content, but with no form element descendants.
    contentModel: "flow",
    link: "https://html.spec.whatwg.org/multipage/forms.html#the-form-element",
  },
  label: {
    categories: ["flow", "phrasing"],
    // Phrasing content, but with no descendant labelable elements unless it is the element's labeled control, and no descendant label elements.
    contentModel: "phrasing",
    link: "https://html.spec.whatwg.org/multipage/forms.html#the-label-element",
  },
  input: {
    categories: ["flow", "phrasing"],
    contentModel: "nothing",
    link: "https://html.spec.whatwg.org/multipage/input.html#the-input-element",
  },
  button: {
    categories: ["flow", "phrasing"],
    // Phrasing content, but there must be no interactive content descendant and no descendant with the tabindex attribute specified.
    // If the element is the first child of a select element, then it may also have zero or one descendant selectedcontent element." ],
    contentModel: "phrasing",
    link: "https://html.spec.whatwg.org/multipage/form-elements.html#the-button-element",
  },
  select: {
    categories: ["flow", "phrasing"],
    // Zero or one button elements if the select is a drop-down box, followed by zero or more select element inner content elements.
    contentModel: ["button"].concat(selectElementInnerContentElements),
    link: "https://html.spec.whatwg.org/multipage/form-elements.html#the-select-element",
  },
  datalist: {
    categories: ["flow", "phrasing"],
    // Either: phrasing content.
    // Or: Zero or more option and script-supporting elements.
    get contentModel() {
      return phrasingElements.concat(scriptSupportingElements)
    },
    link: "https://html.spec.whatwg.org/multipage/form-elements.html#the-datalist-element",
  },
  optgroup: {
    categories: [],
    // Zero or one legend element followed by zero or more optgroup element inner content elements.
    contentModel: ["legend"].concat(optgroupElementInnerContentElements),
    link: "https://html.spec.whatwg.org/multipage/form-elements.html#the-optgroup-element",
  },
  option: {
    categories: [],
    // If the element has a label attribute and a value attribute: Nothing.
    // If the element has a label attribute but no value attribute: Text.
    // If the element has no label attribute and is not a descendant of a datalist element: Zero or more option element inner content elements.
    // If the element has no label attribute and is a descendant of a datalist element: Text.
    get contentModel() {
      return optionElementInnerContentElements
    },
    link: "https://html.spec.whatwg.org/multipage/form-elements.html#the-option-element",
  },
  textarea: {
    categories: ["flow", "phrasing"],
    contentModel: "text",
    link: "https://html.spec.whatwg.org/multipage/form-elements.html#the-textarea-element",
  },
  output: {
    categories: ["flow", "phrasing"],
    contentModel: "phrasing",
    link: "https://html.spec.whatwg.org/multipage/form-elements.html#the-output-element",
  },
  progress: {
    categories: ["flow", "phrasing"],
    // Phrasing content, but there must be no progress element descendants." ],
    contentModel: "phrasing",
    link: "https://html.spec.whatwg.org/multipage/form-elements.html#the-progress-element",
  },
  meter: {
    categories: ["flow", "phrasing"],
    // (node) => [ "Phrasing content, but there must be no meter element descendants." ],
    contentModel: "phrasing",
    link: "https://html.spec.whatwg.org/multipage/form-elements.html#the-meter-element",
  },
  fieldset: {
    categories: ["flow"],
    // (node) => [ "Optionally, a legend element, followed by flow content." ],
    get contentModel() {
      return ["legend"].concat(flowElements)
    },
    link: "https://html.spec.whatwg.org/multipage/form-elements.html#the-fieldset-element",
  },
  legend: {
    categories: [],
    // If the element is a child of an optgroup element: Phrasing content, but there must be no interactive content and no descendant with the tabindex attribute.
    // Otherwise: Phrasing content, optionally intermixed with heading content.
    contentModel: "phrasing",
    link: "https://html.spec.whatwg.org/multipage/form-elements.html#the-legend-element",
  },
  selectedcontent: {
    categories: ["phrasing"],
    contentModel: "nothing",
    link: "https://html.spec.whatwg.org/multipage/form-elements.html#the-selectedcontent-element",
  },
  details: {
    categories: ["flow"],
    // (node) => [ "One summary element followed by flow content." ],
    get contentModel() {
      return ["summary"].concat(flowElements)
    },
    link: "https://html.spec.whatwg.org/multipage/interactive-elements.html#the-details-element",
  },
  summary: {
    categories: [],
    // Phrasing content, optionally intermixed with heading content.
    contentModel: "phrasing",
    link: "https://html.spec.whatwg.org/multipage/interactive-elements.html#the-summary-element",
  },
  dialog: {
    categories: ["flow"],
    contentModel: "flow",
    link: "https://html.spec.whatwg.org/multipage/interactive-elements.html#the-dialog-element",
  },
  script: {
    categories: ["flow", "phrasing"],
    // If there is no src attribute, depends on the value of the type attribute, but must match script content restrictions.
    // If there is a src attribute, the element must be either empty or contain only script documentation that also matches script content restrictions.
    contentModel: "text",
    link: "https://html.spec.whatwg.org/multipage/scripting.html#the-script-element",
  },
  /* noscript: {
    categories: ["flow", "phrasing"],
    // When scripting is disabled, in a head element: in any order, zero or more link elements, zero or more style elements, and zero or more meta elements.
    // When scripting is disabled, not in a head element: transparent, but there must be no noscript element descendants.
    // Otherwise: text that conforms to the requirements given in the prose.
    contentModel: ,
    link: "https://html.spec.whatwg.org/multipage/scripting.html#the-noscript-element"
  }, */
  /* template: {
    categories: ["flow", "phrasing"],
    // Nothing (for clarification, see example).
    contentModel: "nothing",
    link: "https://html.spec.whatwg.org/multipage/scripting.html#the-template-element"
  }, */
  slot: {
    categories: ["flow", "phrasing"],
    contentModel: "transparent",
    link: "https://html.spec.whatwg.org/multipage/scripting.html#the-slot-element",
  },
  canvas: {
    categories: ["flow", "phrasing"],
    // Transparent, but with no interactive content descendants except for a elements, img elements with usemap attributes,
    // button elements, input elements whose type attribute are in the Checkbox or Radio Button states, input elements that are buttons,
    // and select elements with a multiple attribute or a display size greater than 1.
    contentModel: "transparent",
    link: "https://html.spec.whatwg.org/multipage/canvas.html#the-canvas-element",
  },
} as Specs

const flowElements = Object.entries(specs)
  .map(([tag, spec]) => spec.categories.includes("flow") && tag)
  .filter(Boolean) as Array<string>
const phrasingElements = Object.entries(specs)
  .map(([tag, spec]) => spec.categories.includes("phrasing") && tag)
  .filter(Boolean) as Array<string>

// 3.2.5.2.12: https://html.spec.whatwg.org/multipage/dom.html#option-element-inner-content-elements-2
const optionElementInnerContentElements = ["div"]
  .concat(phrasingElements)
  .filter((t) => !["datalist", "object"].includes(t))
