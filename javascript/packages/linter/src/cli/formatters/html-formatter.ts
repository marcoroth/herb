import { readFileSync } from "node:fs"
import { relative, resolve } from "node:path"

import { DIAGNOSTIC_SEVERITIES } from "@herb-tools/core"
import { Highlighter, escapeHTML, generateStylesheet, resolveTheme } from "@herb-tools/highlighter"

import { BaseFormatter } from "./base-formatter.js"
import { fileUrl } from "../file-url.js"
import { ruleDocumentationUrl } from "../../urls.js"
import { REPORT_STYLESHEET } from "./html-report-stylesheet.js"

import type { Diagnostic, DiagnosticSeverity } from "@herb-tools/core"
import type { CodeBlockNode, Document, HTMLSinkOptions } from "@herb-tools/highlighter"
import type { ProcessedFile } from "../file-processor.js"

const DARK_THEME = "onedark"
const LIGHT_THEME = "github-light"
const THEME_PAIR_LABEL = `${DARK_THEME}:${LIGHT_THEME}`

const FRAME_VERBS: Record<string, string> = {
  render: "rendered from",
  layout: "rendered into",
  declaration: "declared at",
}

const SEVERITY_LABELS: Record<DiagnosticSeverity, [string, string]> = {
  error: ["error", "errors"],
  warning: ["warning", "warnings"],
  info: ["info", "info"],
  hint: ["hint", "hints"],
}

export interface HTMLReportContext {
  filesChecked?: number
  ruleCount?: number
  toolVersion?: string
}

interface Stat {
  label: string
  value: string
}

export class HTMLFormatter extends BaseFormatter {
  private highlighter: Highlighter | null = null
  private context: HTMLReportContext
  private frameSources = new Map<string, string>()

  constructor(projectPath?: string, context: HTMLReportContext = {}) {
    super(projectPath)

    this.context = context
  }

  async format(allOffenses: ProcessedFile[]): Promise<void> {
    if (!this.highlighter) {
      this.highlighter = new Highlighter(DARK_THEME)
      await this.highlighter.initialize()
    }

    const body = allOffenses.length === 0
      ? `${this.masthead(allOffenses)}\n${this.cleanNotice()}`
      : `${this.masthead(allOffenses)}\n${this.ruleRail(allOffenses)}\n${this.fileSections(allOffenses)}`

    console.log(HTMLFormatter.document(body))
  }

  formatFile(_filename: string, _offenses: Diagnostic[]): void {
    throw new Error("formatFile is not implemented for HTMLFormatter")
  }

  /**
   * A complete report that carries a single message, for the runs that never
   * reach a lint result.
   */
  static messageDocument(message: string): string {
    const body = [
      `<header class="herb-report-masthead">`,
      `<h1 class="herb-report-title">Herb Linter report</h1>`,
      `</header>`,
      `<p class="herb-report-notice">${escapeHTML(message)}</p>`,
    ].join("\n")

    return HTMLFormatter.document(body)
  }

  private static document(body: string): string {
    const themeStylesheet = generateStylesheet(resolveTheme(DARK_THEME), THEME_PAIR_LABEL, {
      scheme: resolveTheme(LIGHT_THEME),
      label: LIGHT_THEME,
    })

    return [
      `<!doctype html>`,
      `<html lang="en">`,
      `<head>`,
      `<meta charset="utf-8">`,
      `<meta name="viewport" content="width=device-width, initial-scale=1">`,
      `<title>Herb Linter report</title>`,
      `<style>`,
      REPORT_STYLESHEET,
      `</style>`,
      `<style>`,
      themeStylesheet.trimEnd(),
      `</style>`,
      `</head>`,
      `<body class="herb-report-page">`,
      `<main class="herb-report-root">`,
      body,
      `</main>`,
      `</body>`,
      `</html>`,
    ].join("\n")
  }

  private masthead(allOffenses: ProcessedFile[]): string {
    const files = new Set(allOffenses.map(({ filename }) => filename))
    const checked = this.context.filesChecked
    const clean = checked === undefined ? undefined : Math.max(0, checked - files.size)

    const counts = new Map<DiagnosticSeverity, number>()

    for (const { offense } of allOffenses) {
      counts.set(offense.severity, (counts.get(offense.severity) ?? 0) + 1)
    }

    const correctable = allOffenses.filter(({ autocorrectable }) => autocorrectable).length
    const unsafeCorrectable = allOffenses.filter(({ unsafeAutocorrectable }) => unsafeAutocorrectable).length

    const stats: Stat[] = [
      { label: allOffenses.length === 1 ? "offense" : "offenses", value: String(allOffenses.length) },
      { label: files.size === 1 ? "file with offenses" : "files with offenses", value: String(files.size) },
    ]

    if (clean !== undefined) {
      stats.push({ label: clean === 1 ? "clean file" : "clean files", value: String(clean) })
    }

    for (const severity of DIAGNOSTIC_SEVERITIES) {
      const count = counts.get(severity) ?? 0

      if (count === 0) continue

      stats.push({ label: SEVERITY_LABELS[severity][count === 1 ? 0 : 1], value: String(count) })
    }

    if (correctable > 0) {
      stats.push({ label: "autocorrectable", value: String(correctable) })
    }

    if (unsafeCorrectable > 0) {
      stats.push({ label: "correctable with --fix-unsafely", value: String(unsafeCorrectable) })
    }

    if (this.context.ruleCount !== undefined) {
      stats.push({ label: this.context.ruleCount === 1 ? "rule enabled" : "rules enabled", value: String(this.context.ruleCount) })
    }

    const items = stats.map(stat => [
      `<li class="herb-report-stat">`,
      `<span class="herb-report-stat-value">${escapeHTML(stat.value)}</span>`,
      `<span class="herb-report-stat-label">${escapeHTML(stat.label)}</span>`,
      `</li>`,
    ].join(""))

    const subtitle = this.projectPath
      ? `<p class="herb-report-project">${escapeHTML(this.projectPath)}</p>`
      : ""

    const version = this.context.toolVersion
      ? `<p class="herb-report-version">Herb ${escapeHTML(this.context.toolVersion)}</p>`
      : ""

    return [
      `<header class="herb-report-masthead">`,
      `<h1 class="herb-report-title">Herb Linter report</h1>`,
      subtitle,
      version,
      `<ul class="herb-report-stats">`,
      items.join("\n"),
      `</ul>`,
      `</header>`,
    ].filter(part => part !== "").join("\n")
  }

  private cleanNotice(): string {
    return `<p class="herb-report-notice">No offenses were found.</p>`
  }

  private ruleRail(allOffenses: ProcessedFile[]): string {
    const counts = new Map<string, number>()

    for (const { offense } of allOffenses) {
      const rule = offense.code

      if (!rule) continue

      counts.set(rule, (counts.get(rule) ?? 0) + 1)
    }

    if (counts.size === 0) return ""

    const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))

    const items = sorted.map(([rule, count]) => [
      `<li class="herb-report-rule">`,
      `<a class="herb-report-rule-name" href="${escapeHTML(ruleDocumentationUrl(rule))}" rel="noopener noreferrer">${escapeHTML(rule)}</a>`,
      `<span class="herb-report-rule-count">${count}</span>`,
      `</li>`,
    ].join(""))

    return [
      `<section class="herb-report-rail">`,
      `<h2 class="herb-report-rail-title">Rules with offenses</h2>`,
      `<ul class="herb-report-rule-list">`,
      items.join("\n"),
      `</ul>`,
      `</section>`,
    ].join("\n")
  }

  private fileSections(allOffenses: ProcessedFile[]): string {
    const grouped = new Map<string, ProcessedFile[]>()

    for (const processed of allOffenses) {
      const existing = grouped.get(processed.filename)

      if (existing) {
        existing.push(processed)
      } else {
        grouped.set(processed.filename, [processed])
      }
    }

    const sections: string[] = []

    for (const [filename, offenses] of grouped) {
      const path = this.displayPath(filename)
      const count = `${offenses.length} ${offenses.length === 1 ? "offense" : "offenses"}`

      sections.push([
        `<details class="herb-report-file" open>`,
        `<summary class="herb-report-file-summary">`,
        `<span class="herb-report-file-name">${escapeHTML(path)}</span>`,
        `<span class="herb-report-file-count">${escapeHTML(count)}</span>`,
        `</summary>`,
        offenses.map(processed => this.card(processed)).join("\n"),
        `</details>`,
      ].join("\n"))
    }

    return sections.join("\n")
  }

  private card(processed: ProcessedFile): string {
    const { offense } = processed
    const rule = offense.code ?? "unknown"

    const parts = [
      `<article class="herb-report-card">`,
      `<header class="herb-report-card-header">`,
      `<span class="herb-report-dot herb-report-dot-${escapeHTML(offense.severity)}"></span>`,
      `<span class="herb-report-card-rule">${escapeHTML(rule)}</span>`,
      `</header>`,
      `<div class="herb-report-excerpt">`,
      this.excerpt(processed),
      `</div>`,
    ]

    const rail = this.callChain(processed)

    if (rail) parts.push(rail)

    const diff = this.fixDiff(processed)

    if (diff) parts.push(diff)

    parts.push(`</article>`)

    return parts.filter(part => part !== "").join("\n")
  }

  private excerpt(processed: ProcessedFile): string {
    const { filename, offense } = processed
    const content = this.contentFor(processed)
    const path = this.displayPath(filename)

    if (!content) {
      return `<p class="herb-report-missing">The source of ${escapeHTML(path)} was not available when this report was written.</p>`
    }

    const document = this.highlighter!.buildDocument(path, content, {
      diagnostics: [offense],
      splitDiagnostics: true,
      contextLines: 2,
      codeUrlBuilder: code => ruleDocumentationUrl(code),
      fileUrlBuilder: () => fileUrl(this.absolutePath(filename)),
    })

    return this.highlighter!.renderHTML(document, this.sinkOptions())
  }

  private callChain(processed: ProcessedFile): string {
    const { renderedFrom, otherCallSites, offendingCallSites, unknownCallSites } = processed

    if (!renderedFrom) return this.unknownCallSitesNotice(unknownCallSites)
    if (renderedFrom.frames.length === 0) return this.unknownCallSitesNotice(unknownCallSites)

    const header = this.callSiteSplit(offendingCallSites)
    const offendingTags = header ? offendingCallSites?.tags ?? [] : []

    const frames: string[] = []

    for (const frame of [...renderedFrom.frames].reverse()) {
      if (!frame.location) continue

      const source = this.sourceOf(frame.file)

      if (source === undefined) continue

      const fragment = this.focusFragment(frame.file, source, frame.location.line)

      if (fragment === undefined) continue

      const offends = frame.ancestors.some(tag => offendingTags.includes(tag))
      const verb = FRAME_VERBS[frame.via] ?? FRAME_VERBS.render
      const label = `${frame.file}:${frame.location.line}:${frame.location.column}`
      const target = escapeHTML(fileUrl(this.absolutePath(frame.file)))
      const marker = offends ? `<span class="herb-report-frame-marker">offending call site</span>` : ""

      frames.push([
        `<li class="herb-report-frame${offends ? " herb-report-frame-offending" : ""}">`,
        `<details class="herb-report-frame-body"${offends ? " open" : ""}>`,
        `<summary class="herb-report-frame-heading">`,
        `<span class="herb-report-frame-index">${frames.length + 2}</span>`,
        `<span class="herb-report-frame-verb">${escapeHTML(verb)}</span>`,
        `<span class="herb-report-frame-target">${escapeHTML(label)}</span>`,
        this.breadcrumb(frame.ancestors, offendingTags),
        marker,
        `</summary>`,
        `<div class="herb-report-frame-excerpt">${fragment}</div>`,
        `<p class="herb-report-frame-open"><a href="${target}" rel="noopener noreferrer">Open ${escapeHTML(frame.file)}</a></p>`,
        `</details>`,
        `</li>`,
      ].filter(part => part !== "").join("\n"))
    }

    if (frames.length === 0) return ""

    const others = renderedFrom.occurrences - 1

    const footer = others > 0
      ? `<p class="herb-report-chain-footer">and ${others} other call ${others === 1 ? "site" : "sites"} nesting it the same way</p>`
      : ""

    const location = `${this.displayPath(processed.filename)}:${processed.offense.location.start.line}:${processed.offense.location.start.column}`

    const terminalHeading = [
      `<span class="herb-report-frame-index">1</span>`,
      `<span class="herb-report-frame-verb">reported in</span>`,
      `<span class="herb-report-frame-target">${escapeHTML(location)}</span>`,
      `<span class="herb-report-frame-marker">this file</span>`,
    ].join("\n")

    const terminalFragment = this.focusFragment(
      processed.filename,
      this.contentFor(processed),
      processed.offense.location.start.line,
    )

    const terminal = terminalFragment === undefined
      ? [
        `<li class="herb-report-frame herb-report-frame-terminal">`,
        `<p class="herb-report-frame-heading">`,
        terminalHeading,
        `</p>`,
        `</li>`,
      ].join("\n")
      : [
        `<li class="herb-report-frame herb-report-frame-terminal">`,
        `<details class="herb-report-frame-body">`,
        `<summary class="herb-report-frame-heading">`,
        terminalHeading,
        `</summary>`,
        `<div class="herb-report-frame-excerpt">${terminalFragment}</div>`,
        `</details>`,
        `</li>`,
      ].join("\n")

    return [
      `<section class="herb-report-chain">`,
      `<p class="herb-report-chain-title">Render stack<span class="herb-report-chain-order">innermost first</span></p>`,
      header,
      `<ol class="herb-report-frames">`,
      terminal,
      frames.join("\n"),
      `</ol>`,
      this.otherCallSitesList(otherCallSites, offendingTags),
      footer,
      `</section>`,
    ].filter(part => part !== "").join("\n")
  }

  /**
   * The call sites the reported chain leaves out, collapsed because they
   * explain the file rather than the offense.
   *
   * A `mixed` verdict can leave more than one offending call site behind, so
   * each entry is judged on its own ancestors rather than taken to be clean.
   */
  private otherCallSitesList(chains: ProcessedFile["otherCallSites"], offendingTags: string[]): string {
    if (!chains || chains.length === 0) return ""

    const entries: string[] = []

    for (const chain of chains) {
      const frame = chain.frames.at(-1)

      if (!frame) continue

      const offends = chain.frames.some(candidate => candidate.ancestors.some(tag => offendingTags.includes(tag)))
      const path = this.displayPath(frame.file)
      const label = frame.location ? `${path}:${frame.location.line}:${frame.location.column}` : path
      const marker = offends ? `<span class="herb-report-frame-marker">offending call site</span>` : ""

      const repeats = chain.occurrences > 1
        ? `<span class="herb-report-other-repeat">${chain.occurrences} call sites nest it this way</span>`
        : ""

      entries.push([
        `<li class="herb-report-other${offends ? " herb-report-other-offending" : ""}">`,
        `<span class="herb-report-other-target">${escapeHTML(label)}</span>`,
        this.breadcrumb(chain.tags, offendingTags),
        marker,
        repeats,
        `</li>`,
      ].filter(part => part !== "").join(""))
    }

    if (entries.length === 0) return ""

    const summary = entries.length === 1
      ? `Also rendered from 1 other call site`
      : `Also rendered from ${entries.length} other call sites`

    return [
      `<details class="herb-report-others">`,
      `<summary class="herb-report-others-summary">${escapeHTML(summary)}</summary>`,
      `<ul class="herb-report-other-list">`,
      entries.join("\n"),
      `</ul>`,
      `</details>`,
    ].join("\n")
  }

  private breadcrumb(ancestors: string[], offendingTags: string[]): string {
    if (ancestors.length === 0) return ""

    const tags = ancestors.map(tag => {
      const offends = offendingTags.length > 0 && offendingTags.includes(tag)
      const className = offends ? "herb-report-tag herb-report-tag-offending" : "herb-report-tag"

      return `<span class="${className}">${escapeHTML(`<${tag}>`)}</span>`
    })

    return `<span class="herb-report-breadcrumb">${tags.join(`<span class="herb-report-tag-separator">›</span>`)}</span>`
  }

  private callSiteSplit(callSites?: ProcessedFile["offendingCallSites"]): string {
    if (!callSites) return ""
    if (callSites.offending === 0 || callSites.offending >= callSites.total) return ""

    const noun = callSites.total === 1 ? "call site" : "call sites"

    return [
      `<p class="herb-report-chain-verdict">`,
      `invalid on <span class="herb-report-verdict-offending">${callSites.offending}</span>`,
      ` of <span class="herb-report-verdict-total">${callSites.total}</span> ${noun}`,
      `</p>`,
    ].join("")
  }

  private unknownCallSitesNotice(unknownCallSites?: ProcessedFile["unknownCallSites"]): string {
    if (!unknownCallSites) return ""

    const { callers, unresolvedRenders, skippedFiles } = unknownCallSites

    const reason = () => {
      if (callers > 0) return "not every call site could be traced back to a document"
      if (unresolvedRenders > 0) return `${unresolvedRenders} render call${unresolvedRenders === 1 ? "" : "s"} in this project could not be resolved`
      if (skippedFiles > 0) return `${skippedFiles} file${skippedFiles === 1 ? "" : "s"} were left out of the call site index`

      return "no file in this project renders it"
    }

    return `<p class="herb-report-chain-unknown">${escapeHTML(`call sites unknown, ${reason()}`)}</p>`
  }

  private fixDiff(processed: ProcessedFile): string {
    const { filename, fixedContent, unsafeAutocorrectable } = processed

    if (!fixedContent) return ""

    const content = this.contentFor(processed)

    if (!content) return ""

    const path = this.displayPath(filename)
    const document = this.highlighter!.buildDiff(path, content, fixedContent, { contextLines: 1 })

    if (document.nodes.length === 0) return ""

    const rendered = this.highlighter!.renderHTML(document, { ...this.sinkOptions(), diffLayout: "unified" })
    const flag = unsafeAutocorrectable ? "--fix-unsafely" : "--fix"

    return [
      `<details class="herb-report-fix">`,
      `<summary class="herb-report-fix-summary">Not applied. Running <code class="herb-report-flag">${escapeHTML(flag)}</code> would correct this to</summary>`,
      `<div class="herb-report-fix-diff">`,
      rendered,
      `</div>`,
      `</details>`,
    ].join("\n")
  }

  /**
   * A single syntax-highlighted line with its line number and no file header,
   * for the frames of the render chain rail.
   */
  private focusFragment(path: string, source: string, line: number): string | undefined {
    const document = this.highlighter!.buildDocument(path, source, { focusLine: line, contextLines: 0 })
    const block = document.nodes.find(node => node.type === "CodeBlock") as CodeBlockNode | undefined

    if (!block) return undefined
    if (block.lines.length === 0) return undefined

    const listing: Document = {
      version: 1,
      nodes: [{ ...block, kind: "AnnotatedListing" }],
    }

    return this.highlighter!.renderHTML(listing, this.sinkOptions())
  }

  private sinkOptions(): HTMLSinkOptions {
    return {
      themeLabel: THEME_PAIR_LABEL,
      showLineNumbers: true,
      markers: "spans",
      messageStyle: "inline",
      lineNumberStyle: "element",
    }
  }

  private absolutePath(filename: string): string {
    return this.projectPath ? resolve(this.projectPath, filename) : resolve(filename)
  }

  private displayPath(filename: string): string {
    if (!this.projectPath) return filename

    const relativePath = relative(this.projectPath, filename)

    return relativePath && !relativePath.startsWith("..") ? relativePath : filename
  }

  private sourceOf(filename: string): string | undefined {
    const cached = this.frameSources.get(filename)

    if (cached !== undefined) return cached || undefined

    try {
      const source = readFileSync(this.absolutePath(filename), "utf-8")

      this.frameSources.set(filename, source)

      return source
    } catch {
      this.frameSources.set(filename, "")

      return undefined
    }
  }
}
