import { AnsiUp } from "ansi_up"

import { ANSI_ESCAPE } from "./ansi.js"
import { ANSI_PALETTE as ONEDARK_ANSI_PALETTE } from "../themes/onedark.json" with { type: "json" }

const URL_ALLOWLIST: Record<string, number> = { http: 1, https: 1, file: 1 }
const OSC_PATTERN = new RegExp(`${ANSI_ESCAPE}\\](\\d*);([^\\x07${ANSI_ESCAPE}]*)(?:${ANSI_ESCAPE}\\\\|\\x07)`, "g")
const HYPERLINK_CODE = "8"
const OPENING_SPAN = "<span"
const CLOSING_SPAN = "</span>"

export const ANSI_VARIABLE_PREFIX = "--herb-ansi-"

interface OpenTag {
  attributes: string
  end: number
}

export interface ANSIConverterOptions {
  links?: boolean
  linkResolver?: LinkResolver
}

export type LinkResolver = (url: string) => string | null

export const ANSI_PALETTE = ONEDARK_ANSI_PALETTE

export class ANSIConverter {
  private readonly links: boolean
  private readonly linkResolver: LinkResolver | null

  constructor(options: ANSIConverterOptions = {}) {
    this.links = options.links ?? true
    this.linkResolver = options.linkResolver ?? null
  }

  toHTML(text: string): string {
    const converter = this.createConverter()

    let output = ""
    let index = 0
    let url: string | null = null
    let group = ""

    const closeGroup = () => {
      if (group === "") return

      const merged = this.mergeAdjacentSpans(group)
      const target = url !== null && this.links ? this.resolveUrl(url) : null

      if (target !== null) {
        output += `<a href="${this.escapeHTML(target)}" rel="noopener noreferrer">${merged}</a>`
      } else {
        output += merged
      }

      group = ""
    }

    OSC_PATTERN.lastIndex = 0

    let match = OSC_PATTERN.exec(text)

    while (match !== null) {
      group += converter.ansi_to_html(text.slice(index, match.index))
      index = match.index + match[0].length

      if (match[1] === HYPERLINK_CODE) {
        closeGroup()

        const separator = match[2].indexOf(";")
        const target = separator === -1 ? "" : match[2].slice(separator + 1)

        url = target === "" ? null : target
      }

      match = OSC_PATTERN.exec(text)
    }

    group += converter.ansi_to_html(text.slice(index))
    closeGroup()

    return output
  }

  private createConverter(): AnsiUp {
    const converter = new AnsiUp()

    converter.escape_html = true
    converter.use_classes = false
    converter.url_allowlist = { ...URL_ALLOWLIST }
    converter.boldStyle = "font-weight:700"
    converter.faintStyle = `opacity:var(${ANSI_VARIABLE_PREFIX}dim-opacity, 0.65)`
    converter.italicStyle = "font-style:italic"
    converter.underlineStyle = "text-decoration:underline"

    const palette = (converter as unknown as { ansi_colors: { rgb: [number, number, number] }[][] }).ansi_colors

    Object.values(ANSI_PALETTE).forEach((hex, index) => {
      palette[index >> 3][index & 7].rgb = this.toRGB(hex)
    })

    return converter
  }

  private toRGB(hex: string): [number, number, number] {
    return [1, 3, 5].map(offset => parseInt(hex.slice(offset, offset + 2), 16)) as [number, number, number]
  }

  private escapeHTML(text: string): string {
    return text
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#x27;")
  }

  private resolveUrl(url: string): string | null {
    const resolved = this.linkResolver === null ? url : this.linkResolver(url)

    if (resolved === null || resolved === "") return null

    return this.isLinkableUrl(resolved) ? resolved : null
  }

  private isLinkableUrl(url: string): boolean {
    const separator = url.indexOf(":")

    if (separator <= 0) return false

    return URL_ALLOWLIST[url.slice(0, separator).toLowerCase()] === 1
  }

  private openTagAt(html: string, index: number): OpenTag | null {
    if (!html.startsWith(OPENING_SPAN, index)) return null

    const end = html.indexOf(">", index)

    if (end === -1) return null

    return { attributes: html.slice(index + OPENING_SPAN.length, end), end: end + 1 }
  }

  private mergeAdjacentSpans(html: string): string {
    let output = ""
    let index = 0
    let openAttributes: string | null = null

    while (index < html.length) {
      if (openAttributes !== null && html.startsWith(`${CLOSING_SPAN}${OPENING_SPAN}`, index)) {
        const tag = this.openTagAt(html, index + CLOSING_SPAN.length)

        if (tag !== null && tag.attributes === openAttributes) {
          index = tag.end

          continue
        }
      }

      if (html.startsWith(CLOSING_SPAN, index)) {
        openAttributes = null
        output += CLOSING_SPAN
        index += CLOSING_SPAN.length

        continue
      }

      const tag = this.openTagAt(html, index)

      if (tag !== null) {
        openAttributes = tag.attributes
        output += html.slice(index, tag.end)
        index = tag.end

        continue
      }

      output += html[index]
      index += 1
    }

    return output
  }
}

export type ANSIColorName = keyof typeof ANSI_PALETTE
