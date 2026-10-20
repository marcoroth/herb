import { describe, test, expect, beforeEach } from "vitest"

import { Slots } from "../src/slots/slots"

const FILE = "app/views/charts/show.html.erb"
const VERSION = "4c3b2a19"

const SVG_NAMESPACE = "http://www.w3.org/2000/svg"
const MATHML_NAMESPACE = "http://www.w3.org/1998/Math/MathML"
const HTML_NAMESPACE = "http://www.w3.org/1999/xhtml"

const CIRCLE_STATICS =
  `<!--herb-branch:0:item--><!--herb-item:0:--><circle herb-key="" data-herb-slot="1:attribute:herb-key" cx="10" cy="10" r="4"></circle><!--/herb-item:0-->`

const GRADIENT_STATICS =
  `<!--herb-branch:0:item--><!--herb-item:0:--><linearGradient herb-key="" data-herb-slot="1:attribute:herb-key" gradientUnits="userSpaceOnUse"></linearGradient><!--/herb-item:0-->`

const FOREIGN_STATICS =
  `<!--herb-branch:0:item--><!--herb-item:0:--><foreignObject herb-key="" data-herb-slot="1:attribute:herb-key"><div>label</div></foreignObject><!--/herb-item:0-->`

const MATH_STATICS =
  `<!--herb-branch:0:item--><!--herb-item:0:--><mi herb-key="" data-herb-slot="1:attribute:herb-key">x</mi><!--/herb-item:0-->`

const BRANCH_STATICS = `<!--herb-branch:0:0--><rect width="10" height="10"></rect>`

function page(container: string): string {
  return `<!--herb-region:${FILE}:${VERSION}:0-->` + container + `<!--/herb-region:${FILE}-->`
}

function applyItems(slots: Slots, statics: string, keys: string[]) {
  return slots.apply({
    template: FILE,
    version: VERSION,
    occurrence: 0,
    slots: {
      0: {
        items: Object.fromEntries(keys.map((key) => [key, { 1: key }])),
        order: keys,
        statics,
      },
    },
  })
}

function namespaces(selector: string): (string | null)[] {
  return [...document.querySelectorAll(selector)].map((element) => element.namespaceURI)
}

let slots: Slots

describe("collection rows built from payload statics", () => {
  beforeEach(() => {
    slots = new Slots()
  })

  test("are created in the SVG namespace inside an svg element", () => {
    document.body.innerHTML = page(`<svg viewBox="0 0 100 20"><!--herb-slot:0:collection--><!--/herb-slot:0--></svg>`)
    slots.scan(document.body)

    const report = applyItems(slots, CIRCLE_STATICS, ["1", "2"])

    expect(report.deferred).toEqual([])
    expect(namespaces("circle")).toEqual([SVG_NAMESPACE, SVG_NAMESPACE])
    expect(document.querySelector("circle")).toBeInstanceOf(SVGElement)
  })

  test("keep the camel-cased names SVG uses for elements and attributes", () => {
    document.body.innerHTML = page(`<svg><defs><!--herb-slot:0:collection--><!--/herb-slot:0--></defs></svg>`)
    slots.scan(document.body)

    applyItems(slots, GRADIENT_STATICS, ["a"])

    const gradient = document.querySelector("defs")?.firstElementChild

    expect(gradient?.namespaceURI).toBe(SVG_NAMESPACE)
    expect(gradient?.localName).toBe("linearGradient")
    expect(gradient?.getAttribute("gradientUnits")).toBe("userSpaceOnUse")
  })

  test("put HTML content inside a foreignObject back in the HTML namespace", () => {
    document.body.innerHTML = page(`<svg><!--herb-slot:0:collection--><!--/herb-slot:0--></svg>`)
    slots.scan(document.body)

    applyItems(slots, FOREIGN_STATICS, ["a"])

    expect(document.querySelector("svg")?.firstElementChild?.namespaceURI).toBe(SVG_NAMESPACE)
    expect(namespaces("div")).toEqual([HTML_NAMESPACE])
  })

  test("are created in the MathML namespace inside a math element", () => {
    document.body.innerHTML = page(`<math><mrow><!--herb-slot:0:collection--><!--/herb-slot:0--></mrow></math>`)
    slots.scan(document.body)

    applyItems(slots, MATH_STATICS, ["a", "b"])

    expect(namespaces("mi")).toEqual([MATHML_NAMESPACE, MATHML_NAMESPACE])
  })

  test("stay in the HTML namespace inside an HTML element", () => {
    document.body.innerHTML = page(`<ul><!--herb-slot:0:collection--><!--/herb-slot:0--></ul>`)
    slots.scan(document.body)

    applyItems(slots, `<!--herb-branch:0:item--><!--herb-item:0:--><li herb-key="" data-herb-slot="1:attribute:herb-key"></li><!--/herb-item:0-->`, ["a"])

    expect(namespaces("li")).toEqual([HTML_NAMESPACE])
  })

  test("are tracked as items after the namespace is fixed", () => {
    document.body.innerHTML = page(`<svg><!--herb-slot:0:collection--><!--/herb-slot:0--></svg>`)
    slots.scan(document.body)

    applyItems(slots, CIRCLE_STATICS, ["1", "2"])
    applyItems(slots, CIRCLE_STATICS, ["2"])

    expect([...document.querySelectorAll("circle")].map((circle) => circle.getAttribute("herb-key"))).toEqual(["2"])
  })
})

describe("a conditional branch built from payload statics", () => {
  test("is created in the SVG namespace inside an svg element", () => {
    document.body.innerHTML = page(`<svg><!--herb-slot:0:conditional--><!--/herb-slot:0--></svg>`)

    slots = new Slots()
    slots.scan(document.body)

    const report = slots.apply({
      template: FILE,
      version: VERSION,
      occurrence: 0,
      slots: { 0: { branch: 0, statics: BRANCH_STATICS } },
    })

    expect(report.deferred).toEqual([])
    expect(namespaces("rect")).toEqual([SVG_NAMESPACE])
  })
})
