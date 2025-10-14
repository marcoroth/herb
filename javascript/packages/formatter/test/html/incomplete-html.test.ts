import { describe, test, expect, beforeAll } from "vitest"
import { Herb } from "@herb-tools/node-wasm"
import { Formatter } from "../../src"

import dedent from "dedent"

let formatter: Formatter

describe("@herb-tools/formatter", () => {
  beforeAll(async () => {
    await Herb.load()

    formatter = new Formatter(Herb, {
      indentWidth: 2,
      maxLineLength: 80
    })
  })

  test("incomplete opening tag without closing bracket", () => {
    const source = dedent`<div`
    const result = formatter.format(source)
    expect(result).toEqual(`<div`)
  })

  test("self-closing tag without closing tag", () => {
    const source = dedent`<div>`
    const result = formatter.format(source)
    expect(result).toEqual(`<div>`)
  })

  test("incomplete closing tag without closing bracket", () => {
    const source = dedent`<div></div`
    const result = formatter.format(source)
    expect(result).toEqual(`<div></div`)
  })

  test("incomplete attribute name without equals or value", () => {
    const source = dedent`<div class`
    const result = formatter.format(source)
    expect(result).toEqual(`<div class`)
  })

  test("incomplete attribute with equals but no value", () => {
    const source = dedent`<div class=`
    const result = formatter.format(source)
    expect(result).toEqual(`<div class=`)
  })

  test("incomplete attribute with opening quote but no closing quote", () => {
    const source = dedent`<div class="`
    const result = formatter.format(source)
    expect(result).toEqual(`<div class="`)
  })

  test("incomplete attribute with empty quoted value but no closing bracket", () => {
    const source = dedent`<div class=""`
    const result = formatter.format(source)
    expect(result).toEqual(`<div class=""`)
  })

  test("incomplete nested elements with missing closing tags", () => {
    const source = dedent`<div><span`
    const result = formatter.format(source)
    expect(result).toEqual(`<div><span`)
  })

  test("incomplete comment opening", () => {
    const source = dedent`<!-`
    const result = formatter.format(source)
    expect(result).toEqual(`<!-`)
  })

  test("incomplete comment with single dash", () => {
    const source = dedent`<!-- comment`
    const result = formatter.format(source)
    expect(result).toEqual(`<!-- comment`)
  })

  test("incomplete comment with partial closing", () => {
    const source = dedent`<!-- comment -`
    const result = formatter.format(source)
    expect(result).toEqual(`<!-- comment -`)
  })

  test("incomplete doctype declaration", () => {
    const source = dedent`<!DOCTYPE`
    const result = formatter.format(source)
    expect(result).toEqual(`<!DOCTYPE`)
  })

  test("incomplete doctype with partial content", () => {
    const source = dedent`<!DOCTYPE html`
    const result = formatter.format(source)
    expect(result).toEqual(`<!DOCTYPE html`)
  })

  test("incomplete script tag opening", () => {
    const source = dedent`<script`
    const result = formatter.format(source)
    expect(result).toEqual(`<script`)
  })

  test("incomplete script tag with partial attributes", () => {
    const source = dedent`<script type="text/javascript`
    const result = formatter.format(source)
    expect(result).toEqual(`<script type="text/javascript`)
  })

  test("incomplete style tag opening", () => {
    const source = dedent`<style`
    const result = formatter.format(source)
    expect(result).toEqual(`<style`)
  })

  test("incomplete multiple attributes", () => {
    const source = dedent`<div class="container" id`
    const result = formatter.format(source)
    expect(result).toEqual(`<div class="container" id`)
  })

  test("incomplete attribute with single quote", () => {
    const source = dedent`<div class='`
    const result = formatter.format(source)
    expect(result).toEqual(`<div class='`)
  })

  test("incomplete self-closing tag", () => {
    const source = dedent`<img src="test.jpg" /`
    const result = formatter.format(source)
    expect(result).toEqual(`<img src="test.jpg" /`)
  })

  test("incomplete void element with attributes", () => {
    const source = dedent`<br class`
    const result = formatter.format(source)
    expect(result).toEqual(`<br class`)
  })

  test("incomplete tag name", () => {
    const source = dedent`<d`
    const result = formatter.format(source)
    expect(result).toEqual(`<d`)
  })

  test("incomplete HTML comment with missing second dash", () => {
    const source = dedent`<!- some comment`
    const result = formatter.format(source)
    expect(result).toEqual(`<!- some comment`)
  })

  test("incomplete HTML comment with only three dashes", () => {
    const source = dedent`<!--- some comment`
    const result = formatter.format(source)
    expect(result).toEqual(`<!--- some comment`)
  })

  test("incomplete HTML comment with missing closing dashes", () => {
    const source = dedent`<!-- some comment -`
    const result = formatter.format(source)
    expect(result).toEqual(`<!-- some comment -`)
  })

  test("incomplete HTML comment with missing final bracket", () => {
    const source = dedent`<!-- some comment --`
    const result = formatter.format(source)
    expect(result).toEqual(`<!-- some comment --`)
  })

  test("incomplete DOCTYPE with missing html", () => {
    const source = dedent`<!DOCTYPE`
    const result = formatter.format(source)
    expect(result).toEqual(`<!DOCTYPE`)
  })

  test("incomplete DOCTYPE with partial declaration", () => {
    const source = dedent`<!DOCTYPE html PUBLIC`
    const result = formatter.format(source)
    expect(result).toEqual(`<!DOCTYPE html PUBLIC`)
  })

  test("incomplete DOCTYPE with quoted dtd but no closing quote", () => {
    const source = dedent`<!DOCTYPE html PUBLIC "-//W3C//DTD HTML 4.01//EN"`
    const result = formatter.format(source)
    expect(result).toEqual(`<!DOCTYPE html PUBLIC "-//W3C//DTD HTML 4.01//EN"`)
  })

  test("incomplete DOCTYPE with missing closing bracket", () => {
    const source = dedent`<!DOCTYPE html`
    const result = formatter.format(source)
    expect(result).toEqual(`<!DOCTYPE html`)
  })

  test("incomplete foreign content script tag", () => {
    const source = dedent`<script>console.log(`
    const result = formatter.format(source)
    expect(result).toEqual(`<script>console.log(`)
  })

  test("incomplete foreign content style tag", () => {
    const source = dedent`<style>body { color:`
    const result = formatter.format(source)
    expect(result).toEqual(`<style>body { color:`)
  })

  test("incomplete mixed HTML and text", () => {
    const source = dedent`<div>Hello <span`
    const result = formatter.format(source)
    expect(result).toEqual(`<div>Hello <span`)
  })

  test("incomplete attribute with mixed quotes", () => {
    const source = dedent`<div class="container' id`
    const result = formatter.format(source)
    expect(result).toEqual(`<div class="container' id`)
  })

  test("incomplete tag with special characters", () => {
    const source = dedent`<div @click`
    const result = formatter.format(source)
    expect(result).toEqual(`<div @click`)
  })

  test("incomplete tag with colon attribute", () => {
    const source = dedent`<div v:if`
    const result = formatter.format(source)
    expect(result).toEqual(`<div v:if`)
  })

  test("incomplete CDATA section", () => {
    const source = dedent`<![CDATA[`
    const result = formatter.format(source)
    expect(result).toEqual(`<![CDATA[`)
  })

  test("incomplete XML processing instruction", () => {
    const source = dedent`<?xml version`
    const result = formatter.format(source)
    expect(result).toEqual(`<?xml version`)
  })

  test("incomplete entity reference", () => {
    const source = dedent`&lt`
    const result = formatter.format(source)
    expect(result).toEqual(`&lt`)
  })

  test("incomplete numeric entity", () => {
    const source = dedent`&#39`
    const result = formatter.format(source)
    expect(result).toEqual(`&#39`)
  })

  test("incomplete hex entity", () => {
    const source = dedent`&#x27`
    const result = formatter.format(source)
    expect(result).toEqual(`&#x27`)
  })

  test("incomplete void element with slash but no bracket", () => {
    const source = dedent`<img src="test.jpg" /`
    const result = formatter.format(source)
    expect(result).toEqual(`<img src="test.jpg" /`)
  })

  test("incomplete nested attributes", () => {
    const source = dedent`<div class="outer" data-info="{name:`
    const result = formatter.format(source)
    expect(result).toEqual(`<div class="outer" data-info="{name:`)
  })
})
