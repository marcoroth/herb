import panelStyles from './panel.css'

import { injectStyle } from '../styles.js'
import { loadRuntimeHighlighting } from './highlighting.js'
import { buildRenderStack, diagnosticKey, normalizeDiagnostic, trimOrigin, readRuntimeReport } from './report.js'

import { MAX_RUNTIME_DIAGNOSTICS, RUNTIME_SEVERITIES } from './report.js'

import type { RuntimeHighlighting } from './highlighting.js'
import type { NormalizedDiagnostic, NormalizedRuntimeReport, RenderStackFrame, RenderTreeNode, RuntimeDiagnostic, RuntimeSeverity } from './report.js'

export type BadgeTone = RuntimeSeverity | 'metric'

export interface RuntimeReportHandle {
  dismiss(): void
}

export interface RuntimePanelOptions {
  autoInit?: boolean
  onOpenFile?: (file: string, line: number, column: number) => void
  onOpen?: () => void
}

interface PanelEntry {
  key: string
  diagnostic: NormalizedDiagnostic
  count: number
}

interface PanelState {
  dismissed: boolean
  open: boolean
  expanded: boolean
  origin: string
}

const ALL_ORIGINS = '*'
const STATE_KEY = 'herb-dev-tools-runtime-panel'
const ROOT_CLASS = 'herb-dev-tools-runtime-root'
const LINKABLE_SCHEMES = ['http:', 'https:', 'file:']

const VIA_LABELS: Record<string, string> = {
  layout: 'layout',
  template: 'template',
  partial: 'partial',
  component: 'component',
}

const BADGE_GLYPHS: Record<BadgeTone, string> = {
  error: '⛔',
  warning: '⚠️',
  info: 'ℹ️',
  hint: 'ℹ️',
  metric: '📊',
}

export function escapeHTML(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function inlineCodeHTML(text: string): string {
  return escapeHTML(text).replace(/`([^`]+)`/g, '<code class="herb-dev-tools-inline-code">$1</code>')
}

export function safeUrl(url: string | null): string | null {
  if (url === null) {
    return null
  }

  const trimmed = url.trim()
  const separator = trimmed.indexOf(':')

  if (separator <= 0) {
    return null
  }

  const scheme = trimmed.slice(0, separator + 1).toLowerCase()

  return LINKABLE_SCHEMES.includes(scheme) ? trimmed : null
}

function frameLabel(frame: RenderStackFrame): string {
  if (frame.line === null) {
    return frame.template
  }

  return `${frame.template}:${frame.line}:${frame.column ?? 1}`
}

function ansiHTML(ansi: string, className: string): string {
  return `<herb-ansi class="${className}">${escapeHTML(ansi)}</herb-ansi>`
}

function mergeDiagnostics(existing: NormalizedDiagnostic, incoming: NormalizedDiagnostic): NormalizedDiagnostic {
  return {
    ...existing,
    node: existing.node ?? incoming.node,
    code: existing.code ?? incoming.code,
    severity: existing.severity ?? incoming.severity,
    location: existing.location ?? incoming.location,
    suggestion: existing.suggestion ?? incoming.suggestion,
    docsUrl: existing.docsUrl ?? incoming.docsUrl,
    value: existing.value ?? incoming.value,
    fix: existing.fix ?? incoming.fix,
  }
}

export class RuntimePanel {
  private entries: PanelEntry[] = []
  private renderTree: RenderTreeNode[] = []
  private sources: Record<string, string> = {}
  private lastCount = 0
  private bumped = false
  private primed = false
  private onOpenFile: ((file: string, line: number, column: number) => void) | null = null
  private onOpen: (() => void) | null = null
  private state: PanelState = { dismissed: false, open: false, expanded: false, origin: ALL_ORIGINS }
  private root: HTMLElement | null = null
  private highlighting: RuntimeHighlighting | null = null
  private hydrating = false
  private destroyed = false
  private escapeHandler: ((event: KeyboardEvent) => void) | null = null
  private styleElement: HTMLStyleElement | null = null
  private cleared = false

  constructor(options: RuntimePanelOptions = {}) {
    this.onOpenFile = options.onOpenFile ?? null
    this.onOpen = options.onOpen ?? null
    this.styleElement = injectStyle('runtime-panel', panelStyles)

    if (options.autoInit !== false) {
      this.init()
    }
  }

  public destroy() {
    if (this.destroyed) {
      return
    }

    this.destroyed = true

    this.unbindEscape()

    this.root?.remove()
    this.root = null
    this.highlighting = null

    this.styleElement?.remove()
    this.styleElement = null
  }

  public report(input: RuntimeDiagnostic | RuntimeDiagnostic[]): RuntimeReportHandle {
    const candidates = Array.isArray(input) ? input : [input]
    const keys: string[] = []

    this.cleared = false

    for (const candidate of candidates) {
      if (typeof candidate?.template === 'string' && typeof candidate?.source === 'string') {
        this.sources[candidate.template] = candidate.source
      }

      const diagnostic = normalizeDiagnostic(candidate, this.sources)

      if (diagnostic === null) {
        continue
      }

      keys.push(this.add(diagnostic))
    }

    this.render()

    return {
      dismiss: () => {
        for (const key of keys) {
          this.remove(key)
        }

        this.render()
      },
    }
  }

  public clear(origin?: string) {
    if (origin === undefined) {
      this.entries = []
    } else {
      const wanted = trimOrigin(origin)

      this.entries = this.entries.filter(entry => entry.diagnostic.origin !== wanted)
    }

    this.cleared = this.entries.length === 0

    this.render()
  }

  public get count(): number {
    return this.entries.reduce((total, entry) => total + entry.count, 0)
  }

  public get diagnosticCount(): number {
    return this.entries
      .filter(entry => entry.diagnostic.kind === 'diagnostic')
      .reduce((total, entry) => total + entry.count, 0)
  }

  public get metricCount(): number {
    return this.entries
      .filter(entry => entry.diagnostic.kind === 'metric')
      .reduce((total, entry) => total + entry.count, 0)
  }

  public get badgeSeverity(): RuntimeSeverity | null {
    for (const severity of RUNTIME_SEVERITIES) {
      const present = this.entries.some(
        entry => entry.diagnostic.kind === 'diagnostic' && entry.diagnostic.severity === severity
      )

      if (present) {
        return severity
      }
    }

    return null
  }

  public get element(): HTMLElement | null {
    return this.root
  }

  public open() {
    this.state.open = true
    this.state.dismissed = false

    this.onOpen?.()

    this.saveState()
    this.render()
  }

  public close() {
    this.state.open = false
    this.cleared = false

    this.saveState()
    this.render()
  }

  public get expanded(): boolean {
    return this.state.expanded
  }

  public expand() {
    this.state.expanded = true

    this.saveState()
    this.render()
  }

  public collapse() {
    this.state.expanded = false

    this.saveState()
    this.render()
  }

  public toggleExpanded() {
    if (this.state.expanded) {
      this.collapse()
    } else {
      this.expand()
    }
  }

  public get dismissed(): boolean {
    return this.state.dismissed
  }

  public dismiss() {
    this.state.dismissed = true
    this.state.open = false
    this.cleared = false

    this.saveState()
    this.render()
  }

  public show(options: { open?: boolean } = {}) {
    this.state.dismissed = false

    if (options.open === true) {
      this.state.open = true

      this.onOpen?.()
    }

    this.saveState()
    this.render()
  }

  public refresh() {
    if (this.destroyed) {
      return
    }

    const report = readRuntimeReport(document)

    if (report === null) {
      this.render()

      return
    }

    this.entries = []
    this.cleared = false

    this.applyPayload(report)
    this.render()
  }

  private init() {
    this.loadState()
    this.loadPayload()

    this.render()
  }

  private loadPayload() {
    const report = readRuntimeReport(document)

    if (report === null) {
      return
    }

    this.applyPayload(report)
  }

  private applyPayload(report: NormalizedRuntimeReport) {
    this.renderTree = report.renderTree
    this.sources = report.sources

    for (const diagnostic of report.diagnostics) {
      this.add(diagnostic)
    }
  }

  private add(diagnostic: NormalizedDiagnostic): string {
    const key = diagnosticKey(diagnostic)
    const existing = this.entries.find(entry => entry.key === key)

    if (existing !== undefined) {
      existing.count += 1
      existing.diagnostic = mergeDiagnostics(existing.diagnostic, diagnostic)

      return key
    }

    this.entries.push({ key, diagnostic, count: 1 })

    while (this.entries.length > MAX_RUNTIME_DIAGNOSTICS) {
      this.entries.shift()
    }

    return key
  }

  private remove(key: string) {
    const index = this.entries.findIndex(entry => entry.key === key)

    if (index === -1) {
      return
    }

    const entry = this.entries[index]

    entry.count -= 1

    if (entry.count <= 0) {
      this.entries.splice(index, 1)
    }
  }

  private loadState() {
    try {
      const stored = sessionStorage.getItem(STATE_KEY)

      if (stored === null) {
        return
      }

      const parsed = JSON.parse(stored)

      this.state = {
        dismissed: parsed?.dismissed === true,
        open: parsed?.open === true,
        expanded: parsed?.expanded === true,
        origin: typeof parsed?.origin === 'string' ? parsed.origin : ALL_ORIGINS,
      }
    } catch (_error) {
      this.state = { dismissed: false, open: false, expanded: false, origin: ALL_ORIGINS }
    }
  }

  private saveState() {
    try {
      sessionStorage.setItem(STATE_KEY, JSON.stringify(this.state))
    } catch (_error) {
      return
    }
  }

  private bindEscape() {
    if (this.escapeHandler !== null) {
      return
    }

    this.escapeHandler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        this.collapse()
      }
    }

    document.addEventListener('keydown', this.escapeHandler)
  }

  private unbindEscape() {
    if (this.escapeHandler === null) {
      return
    }

    document.removeEventListener('keydown', this.escapeHandler)

    this.escapeHandler = null
  }

  private get showingExpanded(): boolean {
    return this.state.open && this.state.expanded
  }

  private visibleEntries(): PanelEntry[] {
    if (this.state.origin === ALL_ORIGINS) {
      return this.entries
    }

    return this.entries.filter(entry => entry.diagnostic.origin === this.state.origin)
  }

  private render() {
    if (this.destroyed) {
      return
    }

    if (this.state.origin !== ALL_ORIGINS && !this.entries.some(entry => entry.diagnostic.origin === this.state.origin)) {
      this.state.origin = ALL_ORIGINS

      this.saveState()
    }

    const currentCount = this.diagnosticCount

    this.bumped = this.primed && currentCount > this.lastCount
    this.lastCount = currentCount
    this.primed = true

    const shouldShow = this.entries.length > 0 || (this.cleared && this.state.open)

    if (!shouldShow || this.state.dismissed) {
      this.unbindEscape()

      this.root?.remove()
      this.root = null

      return
    }

    if (this.showingExpanded) {
      this.bindEscape()
    } else {
      this.unbindEscape()
    }

    const slot = document.querySelector('[data-herb-dev-tools-badge-slot]')
    const host = slot ?? document.body

    if (this.root === null || !this.root.isConnected || this.root.parentElement !== host) {
      this.root?.remove()

      this.root = document.createElement('div')
      this.root.className = slot ? `${ROOT_CLASS} herb-dev-tools-attached` : ROOT_CLASS

      host.appendChild(this.root)
    } else {
      this.root.className = slot ? `${ROOT_CLASS} herb-dev-tools-attached` : ROOT_CLASS
    }

    this.root.innerHTML = this.rootHTML()

    this.bindHandlers()

    void this.hydrateHighlighting()
  }

  private firstLineFor(entries: PanelEntry[]): number {
    for (const entry of entries) {
      const line = entry.diagnostic.location?.start.line

      if (typeof line === 'number') {
        return line
      }
    }

    return 1
  }

  private pathHTML(label: string, file: string, line: number, column: number, className: string): string {
    const text = escapeHTML(label)

    if (this.onOpenFile === null) {
      return `<span class="${className}">${text}</span>`
    }

    return [
      `<button type="button" class="${className} herb-dev-tools-path" data-herb-dev-tools-action="open"`,
      ` data-herb-dev-tools-file="${escapeHTML(file)}" data-herb-dev-tools-line="${line}" data-herb-dev-tools-column="${column}"`,
      ` title="Open ${text} in editor">${text}</button>`,
    ].join('')
  }

  private rootHTML(): string {
    const severity = this.badgeSeverity
    const tone = severity ?? 'metric'
    const badgeCount = severity === null ? this.metricCount : this.diagnosticCount
    const openClass = this.state.open ? ' herb-dev-tools-open' : ''
    const expandedClass = this.showingExpanded ? ' herb-dev-tools-expanded' : ''
    const bumpClass = this.bumped ? ' herb-dev-tools-bump' : ''
    const summary = escapeHTML(this.summary())

    const backdrop = this.showingExpanded
      ? `<div class="herb-dev-tools-backdrop" data-herb-dev-tools-action="collapse" aria-hidden="true"></div>`
      : ''

    return [
      backdrop,
      `<button type="button" class="herb-dev-tools-badge herb-dev-tools-badge-${tone}${openClass}" data-herb-dev-tools-action="toggle" data-herb-dev-tools-tone="${tone}" title="${summary}" aria-label="${summary}" aria-expanded="${this.state.open}">`,
      `<span class="herb-dev-tools-badge-glyph" aria-hidden="true">${BADGE_GLYPHS[tone]}</span>`,
      `<span class="herb-dev-tools-badge-count${bumpClass}">${badgeCount}</span>`,
      `</button>`,
      `<section class="herb-dev-tools-panel${openClass}${expandedClass}" aria-label="Herb Runtime Diagnostics">`,
      this.headerHTML(),
      this.filtersHTML(),
      `<div class="herb-dev-tools-body">${this.bodyHTML()}</div>`,
      `</section>`,
    ].join('')
  }

  private summary(): string {
    const errors = this.countBy(entry => entry.diagnostic.severity === 'error')
    const warnings = this.countBy(entry => entry.diagnostic.severity === 'warning')
    const notices = this.countBy(entry => entry.diagnostic.severity === 'info' || entry.diagnostic.severity === 'hint')
    const metrics = this.countBy(entry => entry.diagnostic.kind === 'metric')
    const parts: string[] = []

    if (errors > 0) parts.push(`${errors} error${errors === 1 ? '' : 's'}`)
    if (warnings > 0) parts.push(`${warnings} warning${warnings === 1 ? '' : 's'}`)
    if (notices > 0) parts.push(`${notices} notice${notices === 1 ? '' : 's'}`)
    if (metrics > 0) parts.push(`${metrics} metric${metrics === 1 ? '' : 's'}`)

    return parts.length === 0 ? 'No runtime diagnostics' : parts.join(', ')
  }

  private countBy(predicate: (entry: PanelEntry) => boolean): number {
    return this.entries.filter(predicate).reduce((total, entry) => total + entry.count, 0)
  }

  private headerHTML(): string {
    return [
      `<header class="herb-dev-tools-header">`,
      `<span class="herb-dev-tools-title">Herb Runtime Diagnostics</span>`,
      `<span class="herb-dev-tools-summary">${escapeHTML(this.summary())}</span>`,
      this.clearButtonHTML(),
      `<button type="button" class="herb-dev-tools-hide" data-herb-dev-tools-action="dismiss">Hide for this session</button>`,
      `<div class="herb-dev-tools-window-controls">`,
      this.expandButtonHTML(),
      `<button type="button" class="herb-dev-tools-close" data-herb-dev-tools-action="close" aria-label="Close panel">×</button>`,
      `</div>`,
      `</header>`,
    ].join('')
  }

  private get visibleCount(): number {
    return this.visibleEntries().reduce((total, entry) => total + entry.count, 0)
  }

  private clearButtonHTML(): string {
    const count = this.visibleCount

    if (count === 0) {
      return ''
    }

    const scoped = this.state.origin !== ALL_ORIGINS
    const label = scoped ? `Clear ${this.state.origin}` : 'Clear all'
    const entries = `${count} ${count === 1 ? 'entry' : 'entries'}`

    const description = scoped
      ? `Clear the ${entries} from ${this.state.origin}`
      : `Clear all ${entries} and empty the panel`

    return [
      `<button type="button" class="herb-dev-tools-clear" data-herb-dev-tools-action="clear"`,
      ` aria-label="${escapeHTML(description)}"`,
      ` title="${escapeHTML(description)}. Reload the page to read its report again.">`,
      `${escapeHTML(label)}</button>`,
    ].join('')
  }

  private expandButtonHTML(): string {
    const label = this.state.expanded ? 'Collapse panel back to the corner' : 'Expand panel to fill the window'
    const glyph = this.state.expanded ? '⤡' : '⤢'

    return [
      `<button type="button" class="herb-dev-tools-expand" data-herb-dev-tools-action="expand"`,
      ` aria-expanded="${this.state.expanded}" aria-label="${label}" title="${label}">`,
      `<span aria-hidden="true">${glyph}</span>`,
      `</button>`,
    ].join('')
  }

  private filtersHTML(): string {
    const origins = new Map<string, number>()

    for (const entry of this.entries) {
      origins.set(entry.diagnostic.origin, (origins.get(entry.diagnostic.origin) ?? 0) + entry.count)
    }

    if (origins.size === 0) {
      return ''
    }

    const buttons = [`<button type="button" class="herb-dev-tools-filter${this.state.origin === ALL_ORIGINS ? ' herb-dev-tools-filter-active' : ''}" data-herb-dev-tools-action="filter" data-herb-dev-tools-origin="${ALL_ORIGINS}">All (${this.count})</button>`]

    for (const [origin, count] of origins) {
      const active = this.state.origin === origin ? ' herb-dev-tools-filter-active' : ''

      buttons.push(`<button type="button" class="herb-dev-tools-filter${active}" data-herb-dev-tools-action="filter" data-herb-dev-tools-origin="${escapeHTML(origin)}">${escapeHTML(origin)} (${count})</button>`)
    }

    return `<div class="herb-dev-tools-filters">${buttons.join('')}</div>`
  }

  private bodyHTML(): string {
    const entries = this.visibleEntries()

    if (entries.length === 0) {
      const message = this.cleared
        ? 'Cleared. Reload the page to read its report again, and send anything reported from JavaScript again.'
        : this.entries.length === 0
          ? 'Nothing to report. Every template on this page rendered cleanly.'
          : 'No entries from this origin.'

      return `<p class="herb-dev-tools-empty">${escapeHTML(message)}</p>`
    }

    const groups = new Map<string, PanelEntry[]>()

    for (const entry of entries) {
      const template = entry.diagnostic.template

      if (!groups.has(template)) {
        groups.set(template, [])
      }

      groups.get(template)!.push(entry)
    }

    const sections: string[] = []

    for (const [template, groupEntries] of groups) {
      sections.push([
        `<section class="herb-dev-tools-group">`,
        `<h2 class="herb-dev-tools-group-title">${this.pathHTML(template, template, this.firstLineFor(groupEntries), 1, 'herb-dev-tools-group-path')}<span class="herb-dev-tools-group-count">${groupEntries.length}</span></h2>`,
        groupEntries.map(entry => this.cardHTML(entry)).join(''),
        `</section>`,
      ].join(''))
    }

    return sections.join('')
  }

  private cardHTML(entry: PanelEntry): string {
    const diagnostic = entry.diagnostic
    const isMetric = diagnostic.kind === 'metric'
    const marker = isMetric
      ? `<span class="herb-dev-tools-metric">${escapeHTML(diagnostic.value ?? 'metric')}</span>`
      : `<span class="herb-dev-tools-dot herb-dev-tools-dot-${escapeHTML(diagnostic.severity ?? 'error')}" aria-hidden="true"></span>`

    const url = safeUrl(diagnostic.docsUrl)
    const code = diagnostic.code === null ? '' : `<span class="herb-dev-tools-code">${escapeHTML(diagnostic.code)}</span>`

    const docs = url === null
      ? ''
      : [
        `<a class="herb-dev-tools-docs" href="${escapeHTML(url)}" target="_blank" rel="noopener noreferrer"`,
        ` title="Open the documentation for ${escapeHTML(diagnostic.code ?? 'this rule')}">`,
        `<span class="herb-dev-tools-docs-text">Docs</span>`,
        `<span class="herb-dev-tools-docs-glyph" aria-hidden="true">↗</span>`,
        `</a>`,
      ].join('')

    const repeat = entry.count > 1 ? `<span class="herb-dev-tools-repeat" title="Reported ${entry.count} times">×${entry.count}</span>` : ''
    const suggestion = diagnostic.suggestion === null ? '' : `<p class="herb-dev-tools-suggestion">${inlineCodeHTML(diagnostic.suggestion)}</p>`

    return [
      `<article class="herb-dev-tools-card" data-herb-dev-tools-origin="${escapeHTML(diagnostic.origin)}" data-herb-dev-tools-kind="${escapeHTML(diagnostic.kind)}">`,
      `<div class="herb-dev-tools-card-head">${marker}${code}${docs}<span class="herb-dev-tools-origin">${escapeHTML(diagnostic.origin)}</span>${repeat}</div>`,
      `<p class="herb-dev-tools-message">${inlineCodeHTML(diagnostic.message)}</p>`,
      suggestion,
      this.excerptHTML(diagnostic),
      this.stackHTML(diagnostic),
      this.fixHTML(diagnostic),
      `</article>`,
    ].join('')
  }

  private excerptHTML(diagnostic: NormalizedDiagnostic): string {
    const source = this.sources[diagnostic.template]

    if (source === undefined || diagnostic.location === null) {
      return ''
    }

    if (this.highlighting === null) {
      return `<div class="herb-dev-tools-excerpt" data-herb-dev-tools-excerpt-pending></div>`
    }

    const rendered = this.highlighting.excerpt(source, diagnostic)

    if (rendered === null) {
      return ''
    }

    return `<div class="herb-dev-tools-excerpt">${ansiHTML(rendered, 'herb-dev-tools-ansi')}</div>`
  }

  private fixHTML(diagnostic: NormalizedDiagnostic): string {
    const fix = diagnostic.fix

    if (fix === null) {
      return ''
    }

    const source = this.sources[diagnostic.template]

    if (source === undefined) {
      return ''
    }

    if (this.highlighting === null) {
      return `<div class="herb-dev-tools-fix-pending" data-herb-dev-tools-fix-pending hidden></div>`
    }

    const rendered = this.highlighting.diff(diagnostic.template, source, fix)

    if (rendered === null) {
      return ''
    }

    const unsafe = fix.kind === 'unsafe'
    const lead = unsafe ? 'Not applied. This fix is unsafe. Running' : 'Not applied. Running'
    const command = unsafe ? 'herb lint --fix-unsafely' : 'herb lint --fix'

    return [
      `<details class="herb-dev-tools-fix" data-herb-dev-tools-fix="${escapeHTML(fix.kind)}">`,
      `<summary class="herb-dev-tools-fix-summary">${escapeHTML(lead)} <code class="herb-dev-tools-fix-command">${escapeHTML(command)}</code> would change this template to</summary>`,
      `<div class="herb-dev-tools-fix-diff">${ansiHTML(rendered, 'herb-dev-tools-ansi')}</div>`,
      `</details>`,
    ].join('')
  }

  private stackHTML(diagnostic: NormalizedDiagnostic): string {
    const frames = buildRenderStack(this.renderTree, diagnostic)

    if (frames.length === 0) {
      return ''
    }

    const items = frames.map((frame) => {
      const via = frame.via === null ? '' : `<span class="herb-dev-tools-frame-via">${escapeHTML(VIA_LABELS[frame.via] ?? frame.via)}</span>`

      return `<li class="herb-dev-tools-frame">${via}${this.pathHTML(frameLabel(frame), frame.template, frame.line ?? 1, frame.column ?? 1, 'herb-dev-tools-frame-target')}</li>`
    })

    return [
      `<div class="herb-dev-tools-stack">`,
      `<p class="herb-dev-tools-stack-title">Render stack<span class="herb-dev-tools-stack-order">innermost first</span></p>`,
      `<ol class="herb-dev-tools-frames">${items.join('')}</ol>`,
      `</div>`,
    ].join('')
  }

  private async hydrateHighlighting() {
    if (this.hydrating || this.destroyed) {
      return
    }

    if (!this.root || this.root.querySelector('[data-herb-dev-tools-excerpt-pending], [data-herb-dev-tools-fix-pending]') === null) {
      return
    }

    this.hydrating = true

    const highlighting = await loadRuntimeHighlighting()

    this.hydrating = false

    if (highlighting === null || this.destroyed || this.highlighting === highlighting) {
      return
    }

    this.highlighting = highlighting

    this.render()
  }

  private bindHandlers() {
    const root = this.root

    if (root === null) {
      return
    }

    root.querySelectorAll<HTMLElement>('[data-herb-dev-tools-action]').forEach((element) => {
      element.addEventListener('click', (event) => {
        event.preventDefault()
        event.stopPropagation()

        const action = element.getAttribute('data-herb-dev-tools-action')

        if (action === 'toggle') {
          if (this.state.open) {
            this.close()
          } else {
            this.open()
          }
        } else if (action === 'close') {
          this.close()
        } else if (action === 'expand') {
          this.toggleExpanded()
        } else if (action === 'collapse') {
          this.collapse()
        } else if (action === 'dismiss') {
          this.dismiss()
        } else if (action === 'clear') {
          this.clear(this.state.origin === ALL_ORIGINS ? undefined : this.state.origin)
        } else if (action === 'filter') {
          this.state.origin = element.getAttribute('data-herb-dev-tools-origin') ?? ALL_ORIGINS

          this.saveState()
          this.render()
        } else if (action === 'open') {
          const file = element.getAttribute('data-herb-dev-tools-file')

          if (file !== null && this.onOpenFile !== null) {
            const line = Number(element.getAttribute('data-herb-dev-tools-line') ?? '1')
            const column = Number(element.getAttribute('data-herb-dev-tools-column') ?? '1')

            this.onOpenFile(file, Number.isFinite(line) ? line : 1, Number.isFinite(column) ? column : 1)
          }
        }
      })
    })
  }
}
