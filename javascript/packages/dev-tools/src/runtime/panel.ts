import panelStyles from './panel.css'

import { injectStyle } from '../styles.js'
import { loadRuntimeHighlighting, CONTEXT_LINES, FOCUSED_CONTEXT_LINES } from './highlighting.js'
import { buildRenderStack, diagnosticKey, normalizeDiagnostic, trimOrigin, readRuntimeReport, UNKNOWN_TEMPLATE } from './report.js'
import { flashElement } from '../slots/flash.js'

import { MAX_RUNTIME_DIAGNOSTICS, RUNTIME_SEVERITIES } from './report.js'

import type { RuntimeHighlighting } from './highlighting.js'
import type { NormalizedDiagnostic, NormalizedRuntimeReport, OverlayMode, RenderStackFrame, RenderTreeNode, RuntimeDiagnostic, RuntimeSeverity } from './report.js'

export type BadgeTone = RuntimeSeverity | 'metric'

export interface RuntimeReportHandle {
  dismiss(): void
}

export interface RuntimePanelOptions {
  autoInit?: boolean
  onOpenFile?: (file: string, line: number, column: number) => void
  onOpen?: () => void
}

interface OpenTarget {
  file: string
  line: number
  column: number
}

interface PanelEntry {
  key: string
  diagnostic: NormalizedDiagnostic
  count: number
  payload: boolean
}

interface PanelState {
  dismissed: boolean
  open: boolean
  expanded: boolean
  origin: string
  severity: string
  width: number | null
  height: number | null
}

const ALL_ORIGINS = '*'
const ALL_SEVERITIES = '*'

const MIN_PANEL_WIDTH = 440
const MIN_PANEL_HEIGHT = 180
const VIEWPORT_MARGIN = 24

const RESIZE_EDGES = ['left', 'bottom', 'corner'] as const

type ResizeEdge = typeof RESIZE_EDGES[number]

function clamp(value: number, low: number, high: number): number {
  return Math.min(Math.max(value, low), Math.max(low, high))
}

function asSize(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.round(value) : null
}

const SEVERITY_FILTERS: Array<{ value: string, label: string, matches: (diagnostic: NormalizedDiagnostic) => boolean }> = [
  { value: 'error', label: 'Errors', matches: diagnostic => diagnostic.kind === 'diagnostic' && diagnostic.severity === 'error' },
  { value: 'warning', label: 'Warnings', matches: diagnostic => diagnostic.kind === 'diagnostic' && diagnostic.severity === 'warning' },
  { value: 'notice', label: 'Notices', matches: diagnostic => diagnostic.kind === 'diagnostic' && (diagnostic.severity === 'info' || diagnostic.severity === 'hint') },
  { value: 'metric', label: 'Metrics', matches: diagnostic => diagnostic.kind === 'metric' },
]

function matchesSeverity(diagnostic: NormalizedDiagnostic, severity: string): boolean {
  if (severity === ALL_SEVERITIES) {
    return true
  }

  return SEVERITY_FILTERS.find(filter => filter.value === severity)?.matches(diagnostic) ?? true
}
const STATE_KEY = 'herb-dev-tools-runtime-panel'
const ROOT_CLASS = 'herb-dev-tools-runtime-root'
const LINKABLE_SCHEMES = ['http:', 'https:', 'file:']

const VIA_LABELS: Record<string, string> = {
  layout: 'layout',
  template: 'template',
  partial: 'partial',
  component: 'component',
}

function cornerIcon(paths: string[]): string {
  return [
    `<svg class="herb-dev-tools-icon" viewBox="0 0 16 16" width="13" height="13" aria-hidden="true"`,
    ` fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">`,
    paths.map(path => `<path d="${path}"/>`).join(''),
    `</svg>`,
  ].join('')
}

const EXPAND_ICON = cornerIcon(['M6 2H2v4', 'M10 2h4v4', 'M6 14H2v-4', 'M10 14h4v-4'])
const COLLAPSE_ICON = cornerIcon(['M2 6h4V2', 'M14 6h-4V2', 'M2 10h4v4', 'M14 10h-4v4'])

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

function templateUrl(template: string): string {
  return `file:///${template.replace(/^\/+/, '').split('/').map(encodeURIComponent).join('/')}`
}

function openTargetAttributes(target: OpenTarget | null): string {
  if (target === null) {
    return ''
  }

  return ` data-herb-dev-tools-file="${escapeHTML(target.file)}" data-herb-dev-tools-line="${target.line}" data-herb-dev-tools-column="${target.column}"`
}

function ansiHTML(ansi: string, className: string, target: OpenTarget | null = null): string {
  return `<herb-ansi class="${className}"${openTargetAttributes(target)}>${escapeHTML(ansi)}</herb-ansi>`
}

function strongerOverlay(existing: OverlayMode | null, incoming: OverlayMode | null): OverlayMode | null {
  if (existing === 'blocking' || incoming === 'blocking') {
    return 'blocking'
  }

  return existing ?? incoming
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
    overlay: strongerOverlay(existing.overlay, incoming.overlay),
    element: incoming.element?.isConnected ? incoming.element : existing.element,
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
  private state: PanelState = { dismissed: false, open: false, expanded: false, origin: ALL_ORIGINS, severity: ALL_SEVERITIES, width: null, height: null }
  private root: HTMLElement | null = null
  private highlighting: RuntimeHighlighting | null = null
  private hydrating = false
  private destroyed = false
  private escapeHandler: ((event: KeyboardEvent) => void) | null = null
  private styleElement: HTMLStyleElement | null = null
  private cleared = false
  private overlayDismissed = new Set<string>()
  private overlayShowAll = false
  private featuredKey: string | null = null
  private scrollLock: string | null = null

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
    this.lockScroll(false)

    document.body.style.userSelect = ''

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

    for (const raw of candidates) {
      const candidate = raw !== null && typeof raw === 'object' && (typeof raw.template !== 'string' || raw.template.length === 0)
        ? { ...raw, template: UNKNOWN_TEMPLATE }
        : raw

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

  public get badgeCount(): number {
    return this.badgeSeverity === null ? this.metricCount : this.diagnosticCount
  }

  public get badgeSeverity(): RuntimeSeverity | null {
    return severityOf(this.entries)
  }

  private get headerTone(): BadgeTone {
    const scope = this.overlayFocused ? this.visibleEntries() : this.entries

    return severityOf(scope) ?? 'metric'
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

  public get overlay(): OverlayMode | null {
    let mode: OverlayMode | null = null

    for (const entry of this.entries) {
      if (entry.diagnostic.overlay === 'blocking') {
        return 'blocking'
      }

      if (entry.diagnostic.overlay === 'dismissible' && !this.overlayDismissed.has(entry.key)) {
        mode = 'dismissible'
      }
    }

    return mode ?? (this.featuredEntry === null ? null : 'dismissible')
  }

  private get featuredEntry(): PanelEntry | null {
    if (this.featuredKey === null) {
      return null
    }

    return this.entries.find(entry => entry.key === this.featuredKey) ?? null
  }

  public get featured(): string | null {
    return this.featuredEntry === null ? null : this.featuredKey
  }

  public feature(key: string) {
    if (!this.entries.some(entry => entry.key === key)) {
      return
    }

    this.featuredKey = key
    this.overlayShowAll = false
    this.state.open = true

    this.onOpen?.()

    this.saveState()
    this.render()
  }

  public get overlayShowingAll(): boolean {
    return this.overlay !== null && this.overlayShowAll
  }

  public toggleOverlayScope() {
    if (this.overlay === null) {
      return
    }

    this.overlayShowAll = !this.overlayShowAll

    this.render()
  }

  public dismissOverlay() {
    if (this.overlay !== 'dismissible') {
      return
    }

    const featured = this.visibleEntries()
    const origins = new Set(featured.map(entry => entry.diagnostic.origin))

    this.featuredKey = null

    for (const entry of this.entries) {
      if (entry.diagnostic.overlay === 'dismissible') {
        this.overlayDismissed.add(entry.key)
      }
    }

    this.state.open = true
    this.state.expanded = false
    this.state.origin = origins.size === 1 ? [...origins][0] : ALL_ORIGINS
    this.state.severity = ALL_SEVERITIES

    this.onOpen?.()

    this.saveState()
    this.render()
    this.revealCard(featured[0]?.key)
  }

  private revealCard(key: string | undefined) {
    if (key === undefined || this.root === null) {
      return
    }

    const index = this.entries.findIndex(entry => entry.key === key)

    if (index === -1) {
      return
    }

    const card = this.root.querySelector(`.herb-dev-tools-card[data-herb-dev-tools-entry="${index}"]`)

    card?.scrollIntoView({ block: 'nearest' })
  }

  private featureFrom(trigger: HTMLElement) {
    const entry = this.entryFor(trigger)

    if (entry !== undefined) {
      this.feature(entry.key)
    }
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

    this.entries = this.entries.filter(entry => !entry.payload)
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
      this.add(diagnostic, true)
    }
  }

  private add(diagnostic: NormalizedDiagnostic, payload = false): string {
    const key = diagnosticKey(diagnostic)
    const existing = this.entries.find(entry => entry.key === key)

    if (diagnostic.overlay !== null) {
      this.overlayDismissed.delete(key)
    }

    if (existing !== undefined) {
      existing.count += 1
      existing.diagnostic = mergeDiagnostics(existing.diagnostic, diagnostic)

      return key
    }

    this.entries.push({ key, diagnostic, count: 1, payload })

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
        severity: typeof parsed?.severity === 'string' ? parsed.severity : ALL_SEVERITIES,
        width: asSize(parsed?.width),
        height: asSize(parsed?.height),
      }
    } catch (_error) {
      this.state = { dismissed: false, open: false, expanded: false, origin: ALL_ORIGINS, severity: ALL_SEVERITIES, width: null, height: null }
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
      if (event.key !== 'Escape') {
        return
      }

      if (this.overlay === 'dismissible') {
        this.dismissOverlay()

        return
      }

      this.close()
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
    return this.overlay !== null || (this.state.open && this.state.expanded)
  }

  private lockScroll(locked: boolean) {
    if (typeof document === 'undefined') {
      return
    }

    if (locked) {
      if (this.scrollLock !== null) {
        return
      }

      this.scrollLock = document.documentElement.style.overflow
      document.documentElement.style.overflow = 'hidden'

      return
    }

    if (this.scrollLock === null) {
      return
    }

    document.documentElement.style.overflow = this.scrollLock
    this.scrollLock = null
  }

  private pruneOverlayDismissals() {
    for (const key of this.overlayDismissed) {
      if (!this.entries.some(entry => entry.key === key)) {
        this.overlayDismissed.delete(key)
      }
    }

    if (this.featuredEntry === null) {
      this.featuredKey = null
    }
  }

  private overlayEntries(mode: OverlayMode): PanelEntry[] {
    if (mode === 'blocking') {
      return this.entries.filter(entry => entry.diagnostic.overlay === 'blocking')
    }

    const declared = this.entries.filter(
      entry => entry.diagnostic.overlay === 'dismissible' && !this.overlayDismissed.has(entry.key)
    )

    if (declared.length > 0) {
      return declared
    }

    const featured = this.featuredEntry

    return featured === null ? [] : [featured]
  }

  private get overlayFocused(): boolean {
    return this.overlay !== null && !this.overlayShowAll
  }

  private get overlayEdgeToEdge(): boolean {
    return this.overlay === 'blocking'
  }

  private matching(origin: string, severity: string): PanelEntry[] {
    return this.entries.filter(entry => {
      const sameOrigin = origin === ALL_ORIGINS || entry.diagnostic.origin === origin

      return sameOrigin && matchesSeverity(entry.diagnostic, severity)
    })
  }

  private visibleEntries(): PanelEntry[] {
    const overlay = this.overlay

    if (overlay !== null && !this.overlayShowAll) {
      return this.overlayEntries(overlay)
    }

    return this.matching(this.state.origin, this.state.severity)
  }

  private render() {
    if (this.destroyed) {
      return
    }

    if (this.state.origin !== ALL_ORIGINS && !this.entries.some(entry => entry.diagnostic.origin === this.state.origin)) {
      this.state.origin = ALL_ORIGINS

      this.saveState()
    }

    if (this.state.severity !== ALL_SEVERITIES && this.matching(ALL_ORIGINS, this.state.severity).length === 0) {
      this.state.severity = ALL_SEVERITIES

      this.saveState()
    }

    this.pruneOverlayDismissals()

    const currentCount = this.diagnosticCount

    this.bumped = this.primed && currentCount > this.lastCount
    this.lastCount = currentCount
    this.primed = true

    const overlay = this.overlay

    if (overlay === null) {
      this.overlayShowAll = false
    }

    const shouldShow = this.entries.length > 0 || (this.cleared && this.state.open)

    if (overlay === null && (!shouldShow || this.state.dismissed)) {
      this.unbindEscape()
      this.lockScroll(false)

      this.root?.remove()
      this.root = null

      return
    }

    this.lockScroll(overlay === 'blocking')

    if (this.showingExpanded && overlay !== 'blocking') {
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
    this.bindResizeHandles()

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
    const overlay = this.overlay
    const severity = this.badgeSeverity
    const tone = severity ?? 'metric'
    const badgeCount = this.badgeCount
    const openClass = this.state.open || overlay !== null ? ' herb-dev-tools-open' : ''
    const expandedClass = this.showingExpanded ? ' herb-dev-tools-expanded' : ''
    const overlayClass = overlay === null
      ? ''
      : [
        ` herb-dev-tools-overlay herb-dev-tools-overlay-${overlay}`,
        this.overlayShowAll ? '' : ` herb-dev-tools-overlay-focused herb-dev-tools-tone-${this.headerTone}`,
        this.overlayEdgeToEdge ? ' herb-dev-tools-overlay-fullscreen' : '',
      ].join('')
    const bumpClass = this.bumped ? ' herb-dev-tools-bump' : ''
    const summary = escapeHTML(this.summary())

    const backdrop = this.showingExpanded && !this.overlayEdgeToEdge
      ? [
        `<div class="herb-dev-tools-backdrop"`,
        overlay === 'blocking' ? '' : ` data-herb-dev-tools-action="${overlay === null ? 'collapse' : 'dismiss-overlay'}"`,
        ` aria-hidden="true"></div>`,
      ].join('')
      : ''

    const badge = overlay === null
      ? [
        `<button type="button" class="herb-dev-tools-badge herb-dev-tools-badge-${tone}${openClass}" data-herb-dev-tools-action="toggle" data-herb-dev-tools-tone="${tone}" title="${summary}" aria-label="${summary}" aria-expanded="${this.state.open}">`,
        `<span class="herb-dev-tools-badge-glyph" aria-hidden="true">${BADGE_GLYPHS[tone]}</span>`,
        `<span class="herb-dev-tools-badge-count${bumpClass}">${badgeCount}</span>`,
        `</button>`,
      ].join('')
      : ''

    const modal = overlay === null ? '' : ' role="dialog" aria-modal="true"'

    return [
      backdrop,
      badge,
      `<section class="herb-dev-tools-panel${openClass}${expandedClass}${overlayClass}" aria-label="Herb Runtime Diagnostics"${modal}${this.sizeStyle()}>`,
      this.resizeHandlesHTML(),
      this.headerHTML(),
      this.filtersHTML(),
      `<div class="herb-dev-tools-body">${this.bodyHTML()}</div>`,
      `</section>`,
    ].join('')
  }

  private get resizable(): boolean {
    return this.overlay === null && !this.state.expanded
  }

  private sizeStyle(): string {
    if (!this.resizable) {
      return ''
    }

    const parts: string[] = []

    if (this.state.width !== null) {
      parts.push(`width:${this.state.width}px`)
    }

    if (this.state.height !== null) {
      parts.push(`height:${this.state.height}px`, 'max-height:none')
    }

    return parts.length === 0 ? '' : ` style="${parts.join(';')}"`
  }

  private resizeHandlesHTML(): string {
    if (!this.resizable) {
      return ''
    }

    return RESIZE_EDGES.map(edge => [
      `<div class="herb-dev-tools-resize herb-dev-tools-resize-${edge}" data-herb-dev-tools-resize="${edge}"`,
      ` role="separator" aria-label="Resize the panel" title="Drag to resize"></div>`,
    ].join('')).join('')
  }

  private bindResizeHandles() {
    const root = this.root

    if (root === null) {
      return
    }

    const element = root.querySelector<HTMLElement>('.herb-dev-tools-panel')

    if (element === null) {
      return
    }

    root.querySelectorAll<HTMLElement>('[data-herb-dev-tools-resize]').forEach((handle) => {
      handle.addEventListener('pointerdown', (event) => {
        event.preventDefault()
        event.stopPropagation()

        const edge = handle.getAttribute('data-herb-dev-tools-resize') as ResizeEdge
        const box = element.getBoundingClientRect()
        const selection = document.body.style.userSelect

        handle.setPointerCapture(event.pointerId)

        document.body.style.userSelect = 'none'

        const move = (moved: PointerEvent) => {
          if (edge === 'left' || edge === 'corner') {
            const room = window.innerWidth - VIEWPORT_MARGIN
            const width = clamp(box.right - moved.clientX, Math.min(MIN_PANEL_WIDTH, room), room)

            element.style.width = `${Math.round(width)}px`
          }

          if (edge === 'bottom' || edge === 'corner') {
            const room = window.innerHeight - VIEWPORT_MARGIN
            const height = clamp(moved.clientY - box.top, Math.min(MIN_PANEL_HEIGHT, room), room)

            element.style.height = `${Math.round(height)}px`
            element.style.maxHeight = 'none'
          }
        }

        const release = () => {
          handle.removeEventListener('pointermove', move)
          handle.removeEventListener('pointerup', release)
          handle.removeEventListener('pointercancel', release)

          document.body.style.userSelect = selection

          const settled = element.getBoundingClientRect()

          if (edge === 'left' || edge === 'corner') {
            this.state.width = Math.round(settled.width)
          }

          if (edge === 'bottom' || edge === 'corner') {
            this.state.height = Math.round(settled.height)
          }

          this.saveState()
        }

        handle.addEventListener('pointermove', move)
        handle.addEventListener('pointerup', release)
        handle.addEventListener('pointercancel', release)
      })
    })
  }

  public resetSize() {
    this.state.width = null
    this.state.height = null

    this.saveState()
    this.render()
  }

  private summary(): string {
    const scope = this.overlayFocused ? this.visibleEntries() : this.entries
    const errors = this.countBy(scope, entry => entry.diagnostic.severity === 'error')
    const warnings = this.countBy(scope, entry => entry.diagnostic.severity === 'warning')
    const notices = this.countBy(scope, entry => entry.diagnostic.severity === 'info' || entry.diagnostic.severity === 'hint')
    const metrics = this.countBy(scope, entry => entry.diagnostic.kind === 'metric')
    const parts: string[] = []

    if (errors > 0) parts.push(`${errors} error${errors === 1 ? '' : 's'}`)
    if (warnings > 0) parts.push(`${warnings} warning${warnings === 1 ? '' : 's'}`)
    if (notices > 0) parts.push(`${notices} notice${notices === 1 ? '' : 's'}`)
    if (metrics > 0) parts.push(`${metrics} metric${metrics === 1 ? '' : 's'}`)

    return parts.length === 0 ? 'No runtime diagnostics' : parts.join(', ')
  }

  private countBy(entries: PanelEntry[], predicate: (entry: PanelEntry) => boolean): number {
    return entries.filter(predicate).reduce((total, entry) => total + entry.count, 0)
  }

  private headerHTML(): string {
    const overlay = this.overlay

    if (this.overlayFocused) {
      return this.focusedHeaderHTML(overlay!)
    }

    return [
      `<header class="herb-dev-tools-header">`,
      `<span class="herb-dev-tools-title">Herb Runtime Diagnostics</span>`,
      ...this.headerControlsHTML(overlay),
      `</header>`,
    ].join('')
  }

  private toneMarkerHTML(): string {
    const tone = this.headerTone

    if (tone === 'metric') {
      return ''
    }

    return `<span class="herb-dev-tools-dot herb-dev-tools-dot-${tone}" aria-hidden="true"></span>`
  }

  private focusedHeaderHTML(overlay: OverlayMode): string {
    const entries = this.visibleEntries()
    const marker = this.toneMarkerHTML()
    const label = 'Dismiss this overlay and keep the panel docked'

    const close = overlay === 'blocking'
      ? ''
      : `<button type="button" class="herb-dev-tools-close" data-herb-dev-tools-action="dismiss-overlay" aria-label="${label}" title="${label}">×</button>`

    return [
      `<header class="herb-dev-tools-header">`,
      marker,
      `<span class="herb-dev-tools-title">${escapeHTML(this.overlayHeadline(entries))}</span>`,
      this.overlayLocationHTML(entries),
      `<div class="herb-dev-tools-window-controls">`,
      this.overlayScopeButtonHTML(),
      close,
      `</div>`,
      `</header>`,
    ].join('')
  }

  private overlayLocationHTML(entries: PanelEntry[]): string {
    const location = this.overlayLocation(entries)

    if (location === null) {
      return `<span class="herb-dev-tools-summary">${escapeHTML(this.summary())}</span>`
    }

    const diagnostic = entries[0].diagnostic
    const start = diagnostic.location?.start

    if (diagnostic.template === UNKNOWN_TEMPLATE) {
      return `<span class="herb-dev-tools-summary">${escapeHTML(location)}</span>`
    }

    return this.pathHTML(
      location,
      diagnostic.template,
      start?.line ?? 1,
      start?.column ?? 1,
      'herb-dev-tools-summary',
    )
  }

  private overlayHeadline(entries: PanelEntry[]): string {
    const origins = new Set(entries.map(entry => entry.diagnostic.origin))

    return origins.size === 1 ? [...origins][0] : 'Herb Runtime Diagnostics'
  }

  private overlayLocation(entries: PanelEntry[]): string | null {
    if (entries.length !== 1) {
      return null
    }

    const diagnostic = entries[0].diagnostic
    const start = diagnostic.location?.start

    if (start === undefined) {
      return diagnostic.template
    }

    return `${diagnostic.template}:${start.line}:${start.column}`
  }

  private featureButtonHTML(entry: PanelEntry): string {
    if (this.overlayFocused || this.overlay === 'blocking') {
      return ''
    }

    const label = 'Show this on its own screen'

    return [
      `<button type="button" class="herb-dev-tools-feature" data-herb-dev-tools-action="feature"`,
      ` data-herb-dev-tools-entry="${this.entries.indexOf(entry)}"`,
      ` title="${label}" aria-label="${label}">${EXPAND_ICON}</button>`,
    ].join('')
  }

  private overlayScopeButtonHTML(): string {
    if (this.overlay === null) {
      return ''
    }

    if (this.overlayShowAll) {
      const shown = this.overlayEntries(this.overlay).length
      const label = shown === 1 ? 'Back to the error' : 'Back to the errors'

      return `<button type="button" class="herb-dev-tools-scope" data-herb-dev-tools-action="overlay-scope">${label}</button>`
    }

    const hidden = this.count - this.visibleCount

    if (hidden <= 0) {
      return ''
    }

    const label = 'Show other diagnostics'
    const description = hidden === 1
      ? 'Show the one other diagnostic this page reported'
      : `Show the other ${hidden} diagnostics this page reported`

    return [
      `<button type="button" class="herb-dev-tools-scope" data-herb-dev-tools-action="overlay-scope"`,
      ` title="${escapeHTML(description)}" aria-label="${escapeHTML(description)}">${label}</button>`,
    ].join('')
  }

  private headerControlsHTML(overlay: OverlayMode | null): string[] {
    if (overlay === 'blocking') {
      return [`<div class="herb-dev-tools-window-controls">`, this.overlayScopeButtonHTML(), `</div>`]
    }

    if (overlay === 'dismissible') {
      const label = 'Dismiss this overlay and keep the panel docked'

      return [
        `<div class="herb-dev-tools-window-controls">`,
        this.overlayScopeButtonHTML(),
        `<button type="button" class="herb-dev-tools-close" data-herb-dev-tools-action="dismiss-overlay" aria-label="${label}" title="${label}">×</button>`,
        `</div>`,
      ]
    }

    return [
      this.clearButtonHTML(),
      `<button type="button" class="herb-dev-tools-hide" data-herb-dev-tools-action="dismiss">Hide for this session</button>`,
      `<div class="herb-dev-tools-window-controls">`,
      this.expandButtonHTML(),
      `<button type="button" class="herb-dev-tools-close" data-herb-dev-tools-action="close" aria-label="Close panel">×</button>`,
      `</div>`,
    ]
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
    const icon = this.state.expanded ? COLLAPSE_ICON : EXPAND_ICON

    return [
      `<button type="button" class="herb-dev-tools-expand" data-herb-dev-tools-action="expand"`,
      ` aria-expanded="${this.state.expanded}" aria-label="${label}" title="${label}">`,
      icon,
      `</button>`,
    ].join('')
  }

  private filtersHTML(): string {
    if (this.overlayFocused) {
      return ''
    }

    if (this.entries.length === 0) {
      return ''
    }

    return `${this.originFiltersHTML()}${this.severityFiltersHTML()}`
  }

  private countOf(entries: PanelEntry[]): number {
    return entries.reduce((total, entry) => total + entry.count, 0)
  }

  private filterButtonHTML(attribute: string, value: string, label: string, count: number, active: boolean): string {
    return [
      `<button type="button" class="herb-dev-tools-filter${active ? ' herb-dev-tools-filter-active' : ''}"`,
      ` data-herb-dev-tools-action="filter" data-herb-dev-tools-${attribute}="${escapeHTML(value)}"`,
      ` aria-pressed="${active}">${escapeHTML(label)} (${count})</button>`,
    ].join('')
  }

  private originFiltersHTML(): string {
    const origins = new Map<string, number>()

    for (const entry of this.matching(ALL_ORIGINS, this.state.severity)) {
      origins.set(entry.diagnostic.origin, (origins.get(entry.diagnostic.origin) ?? 0) + entry.count)
    }

    if (origins.size === 0) {
      return ''
    }

    const buttons = [this.filterButtonHTML(
      'origin',
      ALL_ORIGINS,
      'All',
      this.countOf(this.matching(ALL_ORIGINS, this.state.severity)),
      this.state.origin === ALL_ORIGINS,
    )]

    for (const [origin, count] of origins) {
      buttons.push(this.filterButtonHTML('origin', origin, origin, count, this.state.origin === origin))
    }

    return `<div class="herb-dev-tools-filters">${buttons.join('')}</div>`
  }

  private severityFiltersHTML(): string {
    const available = SEVERITY_FILTERS
      .map(filter => ({ filter, count: this.countOf(this.matching(this.state.origin, filter.value)) }))
      .filter(candidate => candidate.count > 0)

    if (available.length < 2) {
      return ''
    }

    const buttons = [this.filterButtonHTML(
      'severity',
      ALL_SEVERITIES,
      'Any severity',
      this.countOf(this.matching(this.state.origin, ALL_SEVERITIES)),
      this.state.severity === ALL_SEVERITIES,
    )]

    for (const { filter, count } of available) {
      buttons.push(this.filterButtonHTML('severity', filter.value, filter.label, count, this.state.severity === filter.value))
    }

    return `<div class="herb-dev-tools-filters herb-dev-tools-filters-severity">${buttons.join('')}</div>`
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
    const feature = this.featureButtonHTML(entry)
    const suggestion = diagnostic.suggestion === null ? '' : `<p class="herb-dev-tools-suggestion">${inlineCodeHTML(diagnostic.suggestion)}</p>`
    const element = this.elementHTML(entry)

    return [
      `<article class="herb-dev-tools-card" data-herb-dev-tools-entry="${this.entries.indexOf(entry)}" data-herb-dev-tools-origin="${escapeHTML(diagnostic.origin)}" data-herb-dev-tools-kind="${escapeHTML(diagnostic.kind)}">`,
      `<div class="herb-dev-tools-card-head">${marker}${code}${docs}<span class="herb-dev-tools-origin">${escapeHTML(diagnostic.origin)}</span>${repeat}${feature}</div>`,
      `<p class="herb-dev-tools-message">${inlineCodeHTML(diagnostic.message)}</p>`,
      element,
      suggestion,
      this.excerptHTML(diagnostic),
      this.stackHTML(diagnostic),
      this.fixHTML(diagnostic),
      `</article>`,
    ].join('')
  }

  // A diagnostic that named an element says so whether or not the element is still there. Dropping
  // the chip when the node goes leaves the reader unable to tell a diagnostic about markup from one
  // that never named any, which is the more useful thing to know.
  private elementHTML(entry: PanelEntry): string {
    const element = entry.diagnostic.element

    if (element === null) {
      return ''
    }

    const described = escapeHTML(describeElement(element))

    if (!element.isConnected) {
      const label = 'This element was on the page when it was reported and is not any more'

      return [
        `<span class="herb-dev-tools-element herb-dev-tools-element-gone" title="${label}">`,
        `<span class="herb-dev-tools-element-glyph" aria-hidden="true">◌</span>`,
        `<code>${described}</code>`,
        `<span class="herb-dev-tools-element-note">no longer on the page</span>`,
        `</span>`,
      ].join('')
    }

    return [
      `<button type="button" class="herb-dev-tools-element" data-herb-dev-tools-action="locate"`,
      ` data-herb-dev-tools-entry="${this.entries.indexOf(entry)}" title="Scroll to this element and flash it">`,
      `<span class="herb-dev-tools-element-glyph" aria-hidden="true">◎</span>`,
      `<code>${described}</code>`,
      `</button>`,
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

    const target = this.onOpenFile === null || diagnostic.template === UNKNOWN_TEMPLATE
      ? null
      : { file: diagnostic.template, line: diagnostic.location.start.line, column: diagnostic.location.start.column }

    const rendered = this.highlighting.excerpt(source, diagnostic, {
      ...(target === null ? {} : { fileUrl: templateUrl(target.file) }),
      contextLines: this.overlayFocused ? FOCUSED_CONTEXT_LINES : CONTEXT_LINES,
    })

    if (rendered === null) {
      return ''
    }

    return `<div class="herb-dev-tools-excerpt">${ansiHTML(rendered, 'herb-dev-tools-ansi', target)}</div>`
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
        } else if (action === 'dismiss-overlay') {
          this.dismissOverlay()
        } else if (action === 'overlay-scope') {
          this.toggleOverlayScope()
        } else if (action === 'feature') {
          this.featureFrom(element)
        } else if (action === 'dismiss') {
          this.dismiss()
        } else if (action === 'clear') {
          this.clear(this.state.origin === ALL_ORIGINS ? undefined : this.state.origin)

          if (this.entries.length === 0) {
            this.close()
          }
        } else if (action === 'filter') {
          const origin = element.getAttribute('data-herb-dev-tools-origin')
          const severity = element.getAttribute('data-herb-dev-tools-severity')

          if (origin !== null) {
            this.state.origin = origin
          }

          if (severity !== null) {
            this.state.severity = severity
          }

          this.saveState()
          this.render()
        } else if (action === 'open') {
          this.openFrom(element)
        } else if (action === 'locate') {
          this.locateFrom(element)
        }
      })

      if (element.getAttribute('data-herb-dev-tools-action') === 'locate') {
        element.addEventListener('mouseenter', () => this.outlineFrom(element, true))
        element.addEventListener('mouseleave', () => this.outlineFrom(element, false))
      }
    })

    root.querySelectorAll<HTMLElement>('herb-ansi[data-herb-dev-tools-file]').forEach((element) => {
      element.addEventListener('click', (event) => {
        if (!event.composedPath().some((node) => node instanceof HTMLAnchorElement)) {
          return
        }

        event.preventDefault()
        event.stopPropagation()

        this.openFrom(element)
      })
    })
  }

  private entryFor(trigger: HTMLElement): PanelEntry | undefined {
    const index = Number(trigger.getAttribute('data-herb-dev-tools-entry'))

    return Number.isInteger(index) ? this.entries[index] : undefined
  }

  private locateFrom(trigger: HTMLElement) {
    const target = this.entryFor(trigger)?.diagnostic.element

    if (!target || !target.isConnected) return

    this.stepOutOfTheWay()

    target.scrollIntoView({ block: 'center', behavior: 'smooth' })
    flashElement(target)
  }

  private stepOutOfTheWay() {
    if (this.overlay === 'dismissible') {
      this.dismissOverlay()

      return
    }

    if (this.overlay === null && this.state.expanded) {
      this.collapse()
    }
  }

  private outline: HTMLElement | null = null

  private outlineFrom(trigger: HTMLElement, on: boolean) {
    this.outline?.remove()
    this.outline = null

    if (!on) return

    const target = this.entryFor(trigger)?.diagnostic.element

    if (!target || !target.isConnected) return

    const rect = target.getBoundingClientRect()
    const box = document.createElement('div')

    box.className = 'herb-slot-flash herb-element-outline'
    box.style.cssText = `position:absolute;z-index:2147483000;pointer-events:none;top:${rect.top + window.scrollY}px;left:${rect.left + window.scrollX}px;width:${rect.width}px;height:${rect.height}px;outline:2px solid #f59e0b;outline-offset:2px;background:rgba(245,158,11,0.12)`

    document.body.appendChild(box)
    this.outline = box
  }

  private openFrom(element: HTMLElement) {
    const file = element.getAttribute('data-herb-dev-tools-file')

    if (file === null || this.onOpenFile === null) {
      return
    }

    const line = Number(element.getAttribute('data-herb-dev-tools-line') ?? '1')
    const column = Number(element.getAttribute('data-herb-dev-tools-column') ?? '1')

    this.onOpenFile(file, Number.isFinite(line) ? line : 1, Number.isFinite(column) ? column : 1)
  }
}

function severityOf(entries: PanelEntry[]): RuntimeSeverity | null {
  for (const severity of RUNTIME_SEVERITIES) {
    const present = entries.some(
      entry => entry.diagnostic.kind === 'diagnostic' && entry.diagnostic.severity === severity
    )

    if (present) {
      return severity
    }
  }

  return null
}

function describeElement(element: Element): string {
  const tag = element.tagName.toLowerCase()
  const id = element.id ? `#${element.id}` : ''
  const herb = [...element.attributes].find(attribute => attribute.name.startsWith('data-herb-'))
  const detail = herb ? ` ${herb.name}="${herb.value.length > 40 ? `${herb.value.slice(0, 40)}…` : herb.value}"` : ''

  return `<${tag}${id}${detail}>`
}
