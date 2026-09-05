import panelStyles from './panel.css'

import { escapeHTML } from '@herb-tools/core'
import { injectStyle } from '../styles.js'
import { loadRuntimeHighlighting, CONTEXT_LINES, FOCUSED_CONTEXT_LINES } from './highlighting.js'
import { buildRenderStack, diagnosticKey, normalizeDiagnostic, trimOrigin, readRuntimeReport, UNKNOWN_TEMPLATE } from './report.js'
import { flashElement } from '../slots/flash.js'

import { MAX_RUNTIME_DIAGNOSTICS, RUNTIME_SEVERITIES } from './report.js'

import type { RuntimeHighlighting } from './highlighting.js'
import type { NormalizedDiagnostic, NormalizedRuntimeReport, OverlayMode, RuntimeMeta, RenderStackFrame, RenderTreeNode, RuntimeDiagnostic, RuntimeSeverity } from './report.js'

export type BadgeTone = RuntimeSeverity | 'metric'

const WRAPPING_OBSERVATION = 80
const MAX_LABEL_READINGS = 3
const ALL_ORIGINS = '*'
const ALL_SEVERITIES = '*'
const ALL_METRICS = '*'
const MIN_PANEL_WIDTH = 440
const MIN_PANEL_HEIGHT = 180
const VIEWPORT_MARGIN = 24
const RESIZE_EDGES = ['left', 'bottom', 'corner'] as const
const SOURCE_ATTRIBUTE = 'data-herb-source'
const STATE_KEY = 'herb-dev-tools-runtime-panel'
const MUTED_KEY = 'herb-dev-tools-muted-metrics'
const ROOT_CLASS = 'herb-dev-tools-runtime-root'
const LINKABLE_SCHEMES = ['http:', 'https:', 'file:']
const MARKDOWN_CONTEXT_LINES = 3

declare const __HERB_DEV_TOOLS_VERSION__: string

const VIA_LABELS: Record<string, string> = {
  layout: 'layout',
  template: 'view',
  partial: 'partial',
  component: 'component',
}

const SEVERITY_FILTERS: Array<{ value: string, label: string, matches: (diagnostic: NormalizedDiagnostic) => boolean }> = [
  { value: 'error', label: 'Errors', matches: diagnostic => diagnostic.kind === 'diagnostic' && diagnostic.severity === 'error' },
  { value: 'warning', label: 'Warnings', matches: diagnostic => diagnostic.kind === 'diagnostic' && diagnostic.severity === 'warning' },
  { value: 'notice', label: 'Notices', matches: diagnostic => diagnostic.kind === 'diagnostic' && (diagnostic.severity === 'info' || diagnostic.severity === 'hint') },
  { value: 'metric', label: 'Metrics', matches: diagnostic => isReading(diagnostic) },
]

export interface RuntimeReportHandle {
  dismiss(): void
}

export interface RuntimePanelOptions {
  autoInit?: boolean
  onOpenFile?: (file: string, line: number, column: number) => void
  onOpen?: () => void
  onRender?: () => void
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
  choosing: boolean
  width: number | null
  height: number | null
}

type ResizeEdge = typeof RESIZE_EDGES[number]

function clamp(value: number, low: number, high: number): number {
  return Math.min(Math.max(value, low), Math.max(low, high))
}

function readingLabel(diagnostic: NormalizedDiagnostic): string {
  if (diagnostic.kind === 'value' && diagnostic.tag !== null) {
    return diagnostic.tag
  }

  return diagnostic.value ?? diagnostic.kind
}

function spaced(entries: string[]): string[] {
  if (!entries.some(entry => entry.length > WRAPPING_OBSERVATION)) {
    return entries
  }

  return entries.flatMap((entry, index) => index === 0 ? [entry] : ['', entry])
}

function isReading(diagnostic: NormalizedDiagnostic): boolean {
  return diagnostic.kind !== 'diagnostic'
}

function metricKey(diagnostic: NormalizedDiagnostic): string | null {
  return isReading(diagnostic) ? diagnostic.code : null
}

function asMuted(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : []
}

function asSize(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.round(value) : null
}

function matchesSeverity(diagnostic: NormalizedDiagnostic, severity: string): boolean {
  if (severity === ALL_SEVERITIES) {
    return true
  }

  return SEVERITY_FILTERS.find(filter => filter.value === severity)?.matches(diagnostic) ?? true
}

function devToolsVersion(): string | null {
  return typeof __HERB_DEV_TOOLS_VERSION__ === 'string' ? __HERB_DEV_TOOLS_VERSION__ : null
}

function cornerIcon(paths: string[]): string {
  return [
    `<svg class="herb-dev-tools-icon" viewBox="0 0 16 16" width="13" height="13" aria-hidden="true"`,
    ` fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">`,
    paths.map(path => `<path d="${path}"/>`).join(''),
    `</svg>`,
  ].join('')
}

const CHECK_ICON = [
  `<svg class="herb-dev-tools-icon" viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"`,
  ` fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">`,
  `<path d="M3 8.5 6.5 12 13 4.5"/>`,
  `</svg>`,
].join('')

const CHEVRON_ICON = [
  `<svg class="herb-dev-tools-icon" viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"`,
  ` fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">`,
  `<path d="M4 6.5 8 10.5 12 6.5"/>`,
  `</svg>`,
].join('')

const COPY_ICON = [
  `<svg class="herb-dev-tools-icon" viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"`,
  ` fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">`,
  `<rect x="5.5" y="5.5" width="8" height="9" rx="1.5"/>`,
  `<path d="M10.5 5.5v-2a1.5 1.5 0 0 0-1.5-1.5H4a1.5 1.5 0 0 0-1.5 1.5v7A1.5 1.5 0 0 0 4 12h1.5"/>`,
  `</svg>`,
].join('')

const TARGET_ICON = [
  `<svg class="herb-dev-tools-icon" viewBox="0 0 16 16" width="11" height="11" aria-hidden="true"`,
  ` fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">`,
  `<circle cx="8" cy="8" r="4.2"/><path d="M8 1.2v2"/><path d="M8 12.8v2"/><path d="M1.2 8h2"/><path d="M12.8 8h2"/>`,
  `</svg>`,
].join('')

const SLIDERS_ICON = [
  `<svg class="herb-dev-tools-icon" viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"`,
  ` fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">`,
  `<path d="M2.5 5h11"/><path d="M2.5 11h11"/>`,
  `<circle cx="6" cy="5" r="1.8" fill="currentColor" stroke="none"/>`,
  `<circle cx="10.5" cy="11" r="1.8" fill="currentColor" stroke="none"/>`,
  `</svg>`,
].join('')

const TRASH_ICON = [
  `<svg class="herb-dev-tools-icon" viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"`,
  ` fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">`,
  `<path d="M2.8 4.3h10.4"/><path d="M6.2 4.3V2.9h3.6v1.4"/>`,
  `<path d="M4.4 4.3 5 13.1h6l.6-8.8"/>`,
  `</svg>`,
].join('')

const FOLD_ICON = [
  `<svg class="herb-dev-tools-icon" viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"`,
  ` fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">`,
  `<path d="M4 2 8 5.2 12 2"/><path d="M2.5 8h11"/><path d="M4 14 8 10.8 12 14"/>`,
  `</svg>`,
].join('')

const UNFOLD_ICON = [
  `<svg class="herb-dev-tools-icon" viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"`,
  ` fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">`,
  `<path d="M4 5.2 8 2 12 5.2"/><path d="M2.5 8h11"/><path d="M4 10.8 8 14 12 10.8"/>`,
  `</svg>`,
].join('')

const EXPAND_ICON = cornerIcon(['M6 2H2v4', 'M10 2h4v4', 'M6 14H2v-4', 'M10 14h4v-4'])

const BADGE_GLYPHS: Record<BadgeTone, string> = {
  error: '⛔',
  warning: '⚠️',
  info: 'ℹ️',
  hint: 'ℹ️',
  metric: '📊',
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

function fence(language: string, body: string): string[] {
  return ['```' + language, body, '```']
}

function excerptWindow(source: string, line: number, context: number, mark: number | null = null): string[] {
  const lines = source.split('\n')
  const first = Math.max(1, line - context)
  const last = Math.min(lines.length, line + context)

  if (last < first) {
    return []
  }

  const width = String(last).length

  return lines.slice(first - 1, last).map((text, index) => {
    const number = first + index
    const marker = number === mark ? '>' : ' '

    return `${marker} ${String(number).padStart(width, ' ')} | ${text}`
  })
}

async function copyInto(element: HTMLElement, text: string, label: string) {
  const original = element.innerHTML

  try {
    await navigator.clipboard.writeText(text)

    element.innerHTML = CHECK_ICON
    element.setAttribute('data-herb-dev-tools-tip', 'Copied')
  } catch {
    element.setAttribute('data-herb-dev-tools-tip', 'Copy failed')
  }

  window.setTimeout(() => {
    element.innerHTML = original
    element.setAttribute('data-herb-dev-tools-tip', label)
  }, 1600)
}

async function copyCommand(element: HTMLElement) {
  const command = element.getAttribute('data-herb-dev-tools-command')

  if (command === null) {
    return
  }

  await copyInto(element, command, 'Copy this command')
}

function fixCommand(diagnostic: NormalizedDiagnostic, unsafe: boolean): string {
  const flag = unsafe ? '--fix-unsafely' : '--fix'
  const parts = ['npx @herb-tools/linter']

  if (diagnostic.template !== UNKNOWN_TEMPLATE) {
    parts.push(diagnostic.template)
  }

  parts.push(flag)

  if (diagnostic.code !== null) {
    parts.push(`--only ${diagnostic.code}`)
  }

  return parts.join(' ')
}

function sentenceCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function tip(text: string, label: string = text): string {
  return ` aria-label="${escapeHTML(label)}" data-herb-dev-tools-tip="${escapeHTML(text)}"`
}

function hideButtonHTML(): string {
  const label = 'Hide the panel for the rest of this browser session'

  return `<button type="button" class="herb-dev-tools-hide" data-herb-dev-tools-action="dismiss"${tip(label)}>Hide for this session</button>`
}

function closeButtonHTML(action: string, label: string): string {
  return `<button type="button" class="herb-dev-tools-close" data-herb-dev-tools-action="${action}"${tip(label)}>×</button>`
}

function heroPairHTML(key: string, value: string): string {
  return [
    `<span class="herb-dev-tools-hero-pair">`,
    `<span class="herb-dev-tools-hero-key">${escapeHTML(key)}</span>`,
    `<span class="herb-dev-tools-hero-value">${escapeHTML(value)}</span>`,
    `</span>`,
  ].join('')
}

function visitorLabel(visitor: string): string {
  const unwrapped = visitor.replace(/^#</, '').replace(/>$/, '')

  return unwrapped.replace(/^(?:[A-Za-z_][A-Za-z0-9_]*::)+/, '')
}

function provenanceListHTML(key: string, items: string[]): string {
  const chips = items.map(item => `<code class="herb-dev-tools-provenance-item">${escapeHTML(item)}</code>`).join('')

  return [
    `<div class="herb-dev-tools-provenance-block">`,
    `<span class="herb-dev-tools-provenance-key">${escapeHTML(key)}</span>`,
    `<span class="herb-dev-tools-provenance-items">${chips}</span>`,
    `</div>`,
  ].join('')
}

function provenanceRowHTML(key: string, value: string): string {
  return [
    `<div class="herb-dev-tools-provenance-row">`,
    `<span class="herb-dev-tools-provenance-key">${escapeHTML(key)}</span>`,
    `<span class="herb-dev-tools-provenance-value">${value}</span>`,
    `</div>`,
  ].join('')
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
  private collapsed = new Set<string>()
  private fixViews = new Map<string, 'diff' | 'file'>()
  private openFixes = new Set<string>()
  private entries: PanelEntry[] = []
  private renderTree: RenderTreeNode[] = []
  private sources: Record<string, string> = {}
  private meta: RuntimeMeta = {}
  private lastCount = 0
  private bumped = false
  private primed = false
  private onOpenFile: ((file: string, line: number, column: number) => void) | null = null
  private onRender: (() => void) | null = null
  private onOpen: (() => void) | null = null
  private mutes: string[] = []
  private state: PanelState = { dismissed: false, open: false, expanded: false, origin: ALL_ORIGINS, severity: ALL_SEVERITIES, choosing: false, width: null, height: null }
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
    this.onRender = options.onRender ?? null
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

  public clearTemplate(template: string, options: { except?: string[] } = {}) {
    const spared = options.except ?? []

    this.entries = this.entries.filter(entry => entry.diagnostic.template !== template || spared.includes(entry.diagnostic.origin))

    this.cleared = this.entries.length === 0

    this.render()
  }

  public clear(origin?: string) {
    if (origin === undefined) {
      this.entries = []
      this.collapsed.clear()
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
    return this.shown
      .filter(entry => entry.diagnostic.kind === 'diagnostic')
      .reduce((total, entry) => total + entry.count, 0)
  }

  public get metricCount(): number {
    return this.shown
      .filter(entry => isReading(entry.diagnostic))
      .reduce((total, entry) => total + entry.count, 0)
  }

  private get shown(): PanelEntry[] {
    if (this.mutes.length === 0) {
      return this.entries
    }

    return this.entries.filter(entry => !this.muted(entry.diagnostic))
  }

  private muted(diagnostic: NormalizedDiagnostic): boolean {
    if (!isReading(diagnostic)) {
      return false
    }

    if (this.mutes.includes(ALL_METRICS)) {
      return true
    }

    const key = metricKey(diagnostic)

    return key !== null && this.mutes.includes(key)
  }

  public get badgeCount(): number {
    return this.badgeSeverity === null ? this.metricCount : this.diagnosticCount
  }

  public get badgeSeverity(): RuntimeSeverity | null {
    return severityOf(this.shown)
  }

  private get headerTone(): BadgeTone {
    const scope = this.overlayFocused ? this.visibleEntries() : this.shown

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
    this.state.expanded = false
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

  private async copyFixed(element: HTMLElement) {
    const key = element.getAttribute('data-herb-dev-tools-fix-key')

    if (key === null) {
      return
    }

    const entry = this.entries.find(candidate => diagnosticKey(candidate.diagnostic) === key)
    const source = entry?.diagnostic.fix?.source

    if (source === undefined) {
      return
    }

    await copyInto(element, source, 'Copy the fixed template')
  }

  private showFixView(key: string | null, view: string | null) {
    if (key === null || (view !== 'diff' && view !== 'file')) {
      return
    }

    if (this.fixViews.get(key) === view) {
      return
    }

    this.fixViews.set(key, view)
    this.render()
  }

  private get visibleTemplates(): string[] {
    return [...new Set(this.visibleEntries().map(entry => entry.diagnostic.template))]
  }

  private get allGroupsCollapsed(): boolean {
    const templates = this.visibleTemplates

    return templates.length > 0 && templates.every(template => this.collapsed.has(template))
  }

  private toggleAllGroups() {
    const templates = this.visibleTemplates

    if (this.allGroupsCollapsed) {
      for (const template of templates) {
        this.collapsed.delete(template)
      }
    } else {
      for (const template of templates) {
        this.collapsed.add(template)
      }
    }

    this.render()
  }

  private collapseAllButtonHTML(): string {
    if (this.visibleTemplates.length < 2) {
      return ''
    }

    const collapsed = this.allGroupsCollapsed
    const label = collapsed ? 'Expand all' : 'Collapse all'
    const description = collapsed ? 'Show the diagnostics for every file' : 'Hide the diagnostics for every file'

    return [
      `<button type="button" class="herb-dev-tools-collapse-all herb-dev-tools-action-icon" data-herb-dev-tools-action="collapse-all"`,
      `${tip(description, label)}>${collapsed ? UNFOLD_ICON : FOLD_ICON}</button>`,
    ].join('')
  }

  private toggleGroup(template: string | null) {
    if (template === null) {
      return
    }

    if (this.collapsed.has(template)) {
      this.collapsed.delete(template)
    } else {
      this.collapsed.add(template)
    }

    this.render()
  }

  public reportedFor(template: string): { count: number, tone: BadgeTone } | null {
    const matching = this.entries.filter(entry => entry.diagnostic.template === template)

    if (matching.length === 0) {
      return null
    }

    const count = matching.reduce((total, entry) => total + entry.count, 0)

    return { count, tone: severityOf(matching) ?? 'metric' }
  }

  public measuredFor(template: string): string | null {
    const readings = this.shown.filter(entry => isReading(entry.diagnostic) && entry.diagnostic.template === template)

    if (readings.length === 0) {
      return null
    }

    const counted = new Map<string, number>()

    for (const entry of readings) {
      const value = entry.diagnostic.value

      if (value === null) continue

      counted.set(value, (counted.get(value) ?? 0) + entry.count)
    }

    const parts = Array.from(counted).slice(0, MAX_LABEL_READINGS).map(([value, count]) => count === 1 ? value : `${value} ×${count}`)

    return parts.length === 0 ? null : parts.join(' · ')
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
    this.loadMutes()
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
    this.meta = report.meta

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
        choosing: parsed?.choosing === true,
        width: asSize(parsed?.width),
        height: asSize(parsed?.height),
      }
    } catch (_error) {
      this.state = { dismissed: false, open: false, expanded: false, origin: ALL_ORIGINS, severity: ALL_SEVERITIES, choosing: false, width: null, height: null }
    }
  }

  private saveState() {
    try {
      sessionStorage.setItem(STATE_KEY, JSON.stringify(this.state))
    } catch (_error) {
      return
    }
  }

  private loadMutes() {
    try {
      this.mutes = asMuted(JSON.parse(localStorage.getItem(MUTED_KEY) ?? '[]'))
    } catch (_error) {
      this.mutes = []
    }
  }

  private saveMutes() {
    try {
      localStorage.setItem(MUTED_KEY, JSON.stringify(this.mutes))
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
    return this.shown.filter(entry => {
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

    const scroller = this.root.querySelector<HTMLElement>('.herb-dev-tools-body')
    const scrollTop = scroller === null ? null : scroller.scrollTop

    this.root.innerHTML = this.rootHTML()

    if (scrollTop !== null && scrollTop > 0) {
      const restored = this.root.querySelector<HTMLElement>('.herb-dev-tools-body')

      if (restored !== null) {
        restored.scrollTop = scrollTop
      }
    }

    this.bindHandlers()
    this.bindResizeHandles()

    this.onRender?.()

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

  private pathHTML(label: string, file: string, line: number, column: number, className: string, source: string | null = null): string {
    const text = escapeHTML(label)
    const stamped = source === null ? '' : ` data-herb-dev-tools-source="${escapeHTML(source)}"`

    if (this.onOpenFile === null) {
      return `<span class="${className}"${stamped}>${text}</span>`
    }

    return [
      `<button type="button" class="${className} herb-dev-tools-path" data-herb-dev-tools-action="open"`,
      ` data-herb-dev-tools-file="${escapeHTML(file)}" data-herb-dev-tools-line="${line}" data-herb-dev-tools-column="${column}"${stamped}`,
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
        this.heroEntry === null ? '' : ' herb-dev-tools-overlay-hero',
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
      `<section class="herb-dev-tools-panel${openClass}${expandedClass}${overlayClass}" aria-label="Herb Diagnostics"${modal}${this.sizeStyle()}>`,
      this.resizeHandlesHTML(),
      this.headerHTML(),
      this.filtersHTML(),
      `<div class="herb-dev-tools-body">${this.bodyHTML()}${this.provenanceHTML()}</div>`,
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

    root.querySelectorAll<HTMLDetailsElement>('details[data-herb-dev-tools-fix-key]').forEach((details) => {
      details.addEventListener('toggle', () => {
        const key = details.getAttribute('data-herb-dev-tools-fix-key')

        if (key === null) {
          return
        }

        if (details.open) {
          this.openFixes.add(key)
        } else {
          this.openFixes.delete(key)
        }
      })
    })

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
    const metrics = this.countBy(scope, entry => isReading(entry.diagnostic))
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
      `<span class="herb-dev-tools-title">Herb Diagnostics</span>`,
      ...this.headerControlsHTML(overlay),
      `</header>`,
    ].join('')
  }

  private connectionHTML(): string {
    if (this.overlay !== 'blocking') {
      return ''
    }

    const label = 'Whether this page is connected to the Herb dev server, which recompiles the template and clears this screen once it builds'

    return [
      `<span class="herb-dev-tools-connection"${tip(label, 'Herb dev server connection')}>`,
      `<span class="herb-dev-tools-connection-dot" data-herb-dev-server-dot></span>`,
      `<span class="herb-dev-tools-connection-status" data-herb-dev-server-status>Dev Server</span>`,
      `</span>`,
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
      : closeButtonHTML('dismiss-overlay', label)

    return [
      `<header class="herb-dev-tools-header">`,
      marker,
      `<span class="herb-dev-tools-title">${escapeHTML(this.overlayHeadline(entries))}</span>`,
      this.overlayLocationHTML(entries),
      this.connectionHTML(),
      `<div class="herb-dev-tools-window-controls">`,
      this.copyButtonHTML(),
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
    if (entries.length > 0 && entries.every(entry => entry.diagnostic.phase === 'compile')) {
      const templates = new Set(entries.map(entry => entry.diagnostic.template))

      return templates.size === 1 ? 'This template could not be compiled' : 'These templates could not be compiled'
    }

    const origins = new Set(entries.map(entry => entry.diagnostic.origin))

    return origins.size === 1 ? [...origins][0] : 'Herb Diagnostics'
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
      `${tip(label)}>${EXPAND_ICON}</button>`,
    ].join('')
  }

  private overlayScopeButtonHTML(): string {
    if (this.overlay === null || !this.overlayShowAll) {
      return ''
    }

    const shown = this.overlayEntries(this.overlay).length
    const label = shown === 1 ? 'Back to the error' : 'Back to the errors'

    return `<button type="button" class="herb-dev-tools-scope" data-herb-dev-tools-action="overlay-scope">${label}</button>`
  }

  private overlayMoreButtonHTML(): string {
    if (this.overlay === null || this.overlayShowAll) {
      return ''
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
      `<div class="herb-dev-tools-more">`,
      `<button type="button" class="herb-dev-tools-scope" data-herb-dev-tools-action="overlay-scope"`,
      `${tip(description)}>${label}</button>`,
      `</div>`,
    ].join('')
  }

  private headerControlsHTML(overlay: OverlayMode | null): string[] {
    if (overlay === 'blocking') {
      return [
        `<div class="herb-dev-tools-window-controls">`,
        this.overlayScopeButtonHTML(),
        `</div>`,
      ]
    }

    if (overlay === 'dismissible') {
      const label = 'Dismiss this overlay and keep the panel docked'

      return [
        `<div class="herb-dev-tools-window-controls">`,
        this.overlayScopeButtonHTML(),
        closeButtonHTML('dismiss-overlay', label),
        `</div>`,
      ]
    }

    return [
      hideButtonHTML(),
      `<div class="herb-dev-tools-window-controls">`,
      this.copyButtonHTML(),
      this.expandButtonHTML(),
      closeButtonHTML('close', 'Close the panel'),
      `</div>`,
    ]
  }

  private get visibleCount(): number {
    return this.visibleEntries().reduce((total, entry) => total + entry.count, 0)
  }

  private clearButtonHTML(): string {
    const count = this.count

    if (count === 0) {
      return ''
    }

    const entries = `${count} ${count === 1 ? 'entry' : 'entries'}`
    const description = `Clear all ${entries} and empty the panel`

    return [
      `<button type="button" class="herb-dev-tools-clear herb-dev-tools-action-icon" data-herb-dev-tools-action="clear"`,
      tip(`${description}. Reload the page to read its report again`, description),
      `>${TRASH_ICON}</button>`,
    ].join('')
  }

  private filtersHTML(): string {
    if (this.overlayFocused) {
      return ''
    }

    if (this.entries.length === 0) {
      return ''
    }

    return `${this.originFiltersHTML()}${this.severityFiltersHTML()}${this.metricMutesHTML()}`
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

    const actions = `${this.metricsToggleHTML()}${this.collapseAllButtonHTML()}${this.clearButtonHTML()}`
    const trailing = actions === '' ? '' : `<div class="herb-dev-tools-filters-actions">${actions}</div>`

    return `<div class="herb-dev-tools-filters">${buttons.join('')}${trailing}</div>`
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

  private metricMutesHTML(): string {
    const reported = this.entries.filter(entry => isReading(entry.diagnostic))

    if (reported.length === 0 || !this.state.choosing) {
      return ''
    }

    const metrics = new Map<string, number>()

    for (const entry of reported) {
      const key = metricKey(entry.diagnostic)

      if (key === null) {
        continue
      }

      metrics.set(key, (metrics.get(key) ?? 0) + entry.count)
    }

    const off = this.mutes.includes(ALL_METRICS)
    const total = this.countOf(reported)
    const buttons = [this.muteButtonHTML(ALL_METRICS, 'All metrics', total, off)]

    if (!off) {
      for (const [key, count] of metrics) {
        buttons.push(this.muteButtonHTML(key, key, count, this.mutes.includes(key)))
      }
    }

    return `<div class="herb-dev-tools-filters herb-dev-tools-mutes">${buttons.join('')}</div>`
  }

  private metricsToggleHTML(): string {
    if (!this.entries.some(entry => isReading(entry.diagnostic))) {
      return ''
    }

    const off = this.mutedCount
    const label = off === 0 ? 'Choose which metrics are shown' : `Choose which metrics are shown, ${off} off`
    const description = this.state.choosing ? 'Stop choosing which metrics are shown' : label
    const counted = off === 0 ? '' : `<span class="herb-dev-tools-muted-count">${off}</span>`

    return [
      `<button type="button" class="herb-dev-tools-collapse-all herb-dev-tools-action-icon herb-dev-tools-metrics-toggle${this.state.choosing ? ' herb-dev-tools-metrics-toggle-open' : ''}"`,
      ` data-herb-dev-tools-action="choose-metrics"`,
      `${tip(description, label)} aria-expanded="${this.state.choosing}">${SLIDERS_ICON}${counted}</button>`,
    ].join('')
  }

  private get mutedCount(): number {
    if (this.mutes.includes(ALL_METRICS)) {
      const keys = new Set<string>()

      for (const entry of this.entries) {
        const key = metricKey(entry.diagnostic)

        if (key !== null) {
          keys.add(key)
        }
      }

      return Math.max(keys.size, 1)
    }

    return this.mutes.length
  }

  private toggleChoosing() {
    this.state.choosing = !this.state.choosing

    this.saveState()
    this.render()
  }

  private muteButtonHTML(key: string, label: string, count: number, muted: boolean): string {
    const description = muted ? `Show ${label.toLowerCase()} again` : `Stop showing ${label.toLowerCase()} here`

    return [
      `<button type="button" class="herb-dev-tools-mute${muted ? ' herb-dev-tools-mute-off' : ''}"`,
      ` data-herb-dev-tools-action="mute" data-herb-dev-tools-metric="${escapeHTML(key)}"`,
      `${tip(description)} aria-pressed="${!muted}">${escapeHTML(label)} (${count})</button>`,
    ].join('')
  }

  private toggleMute(key: string | null) {
    if (key === null) {
      return
    }

    this.mutes = this.mutes.includes(key)
      ? this.mutes.filter(muted => muted !== key)
      : [...this.mutes, key]

    this.saveMutes()
    this.render()
  }

  private get heroEntry(): PanelEntry | null {
    if (!this.overlayFocused) {
      return null
    }

    const entries = this.visibleEntries()

    return entries.length === 1 ? entries[0] : null
  }

  private heroChipsHTML(diagnostic: NormalizedDiagnostic): string {
    const pairs: string[] = []
    const version = this.meta.herb_version

    if (version !== undefined) {
      pairs.push(heroPairHTML('Herb', version))
    }

    if (diagnostic.phase !== null) {
      pairs.push(heroPairHTML('Phase', diagnostic.phase))
    }

    const group = pairs.length === 0 ? '' : `<div class="herb-dev-tools-hero-group">${pairs.join('')}</div>`

    const mode = diagnostic.overlay === null
      ? ''
      : `<span class="herb-dev-tools-hero-chip herb-dev-tools-hero-chip-soft">${escapeHTML(sentenceCase(diagnostic.overlay))}</span>`

    const marker = isReading(diagnostic)
      ? `<span class="herb-dev-tools-hero-chip herb-dev-tools-hero-chip-solid">${escapeHTML(readingLabel(diagnostic))}</span>`
      : `<span class="herb-dev-tools-hero-chip herb-dev-tools-hero-chip-solid">${escapeHTML(sentenceCase(diagnostic.severity ?? 'error'))}</span>`

    const chips = `${marker}${mode}${group}`

    return chips.length === 0 ? '' : `<div class="herb-dev-tools-hero-chips">${chips}</div>`
  }

  private markdownExcerpt(diagnostic: NormalizedDiagnostic): string[] {
    const source = this.sources[diagnostic.template]
    const start = diagnostic.location?.start

    if (source === undefined || start === undefined) {
      return []
    }

    const body = excerptWindow(source, start.line, MARKDOWN_CONTEXT_LINES, start.line)

    return body.length === 0 ? [] : ['', ...fence('erb', body.join('\n'))]
  }

  private markdownFix(diagnostic: NormalizedDiagnostic): string[] {
    const fix = diagnostic.fix

    if (fix === null) {
      return []
    }

    const unsafe = fix.kind === 'unsafe'
    const lead = unsafe ? 'Not applied, and this fix is unsafe. Applying it:' : 'Not applied. Applying it:'
    const window = excerptWindow(fix.source, diagnostic.location?.start.line ?? 1, MARKDOWN_CONTEXT_LINES)
    const after = window.length === 0 ? [] : ['', 'The template would become:', '', ...fence('erb', window.join('\n'))]

    return [
      '',
      `### Fix (${fix.kind})`,
      '',
      lead,
      '',
      ...fence('bash', fixCommand(diagnostic, unsafe)),
      ...after,
    ]
  }

  private markdownFor(entry: PanelEntry): string[] {
    const diagnostic = entry.diagnostic
    const start = diagnostic.location?.start
    const location = start === undefined ? diagnostic.template : `${diagnostic.template}:${start.line}:${start.column}`
    const facts: string[] = [`- Origin: ${diagnostic.origin}`]

    if (diagnostic.severity !== null) {
      facts.push(`- Severity: ${diagnostic.severity}`)
    }

    if (diagnostic.phase !== null) {
      facts.push(`- Phase: ${diagnostic.phase}`)
    }

    if (entry.count > 1) {
      facts.push(`- Reported: ${entry.count} times`)
    }

    const suggestion = diagnostic.suggestion === null ? [] : ['', `> ${diagnostic.suggestion}`]
    const frames = buildRenderStack(this.renderTree, diagnostic).map((frame) => {
      const role = frame.via === null ? '' : ` (${VIA_LABELS[frame.via] ?? frame.via})`

      return `- \`${frameLabel(frame)}\`${role}`
    })

    const stack = frames.length === 0 ? [] : ['', '### Render stack', '', ...frames]
    const backtrace = diagnostic.backtrace.length === 0 ? [] : ['', '### Backtrace', '', ...diagnostic.backtrace.map((frame) => `- \`${frame}\``)]

    return [
      `## ${diagnostic.code ?? diagnostic.origin}`,
      '',
      `\`${location}\``,
      '',
      diagnostic.message,
      ...suggestion,
      '',
      ...facts,
      ...this.markdownExcerpt(diagnostic),
      ...stack,
      ...backtrace,
      ...this.markdownFix(diagnostic),
    ]
  }

  public markdown(): string {
    const entries = this.visibleEntries()
    const sections = entries.map(entry => this.markdownFor(entry).join('\n'))
    const { herb_version: version, parser_options: options, visitors } = this.meta
    const provenance: string[] = []

    if (version !== undefined) {
      provenance.push(`- Compiled by Herb::Engine ${version}`)
    }

    if (options !== undefined) {
      const pairs = Object.entries(options).map(([key, value]) => `\`${key}: ${value}\``).join(', ')

      if (pairs.length > 0) {
        provenance.push(`- Parser options: ${pairs}`)
      }
    }

    if (visitors !== undefined && visitors.length > 0) {
      provenance.push(`- Visitors: ${visitors.map(visitor => `\`${visitorLabel(visitor)}\``).join(', ')}`)
    }

    const devTools = devToolsVersion()

    if (devTools !== null) {
      provenance.push(`- Herb Dev Tools ${devTools}`)
    }

    const footer = provenance.length === 0 ? [] : [['---', '', ...provenance].join('\n')]

    return [...sections, ...footer].join('\n\n').replace(/\n{3,}/g, '\n\n') + '\n'
  }

  private async copyMarkdown(element: HTMLElement) {
    const label = element.querySelector('.herb-dev-tools-copy-label')
    const icon = element.querySelector('.herb-dev-tools-icon')
    const original = icon === null ? null : icon.outerHTML
    const restore = element.getAttribute('data-herb-dev-tools-tip')

    const settle = (text: string) => {
      if (label !== null) {
        label.textContent = text
      }

      if (restore !== null) {
        element.setAttribute('data-herb-dev-tools-tip', text)
      }

      window.setTimeout(() => {
        if (label !== null) {
          label.textContent = 'Copy as Markdown'
        }

        const current = element.querySelector('.herb-dev-tools-icon')

        if (current !== null && original !== null) {
          current.outerHTML = original
        }

        if (restore !== null) {
          element.setAttribute('data-herb-dev-tools-tip', restore)
        }
      }, 1600)
    }

    try {
      await navigator.clipboard.writeText(this.markdown())

      if (icon !== null) {
        icon.outerHTML = CHECK_ICON
      }

      settle('Copied')
    } catch {
      settle('Copy failed')
    }
  }

  private expandButtonHTML(): string {
    if (this.state.expanded) {
      return ''
    }

    const label = 'Expand the panel to fill the window'

    return [
      `<button type="button" class="herb-dev-tools-expand" data-herb-dev-tools-action="expand"`,
      ` aria-expanded="false"${tip(label)}>`,
      EXPAND_ICON,
      `</button>`,
    ].join('')
  }

  private copyButtonHTML(): string {
    if (this.visibleEntries().length === 0) {
      return ''
    }

    if (this.overlayFocused) {
      return [
        `<button type="button" class="herb-dev-tools-copy" data-herb-dev-tools-action="copy-markdown">`,
        COPY_ICON,
        `<span class="herb-dev-tools-copy-label">Copy as Markdown</span>`,
        `</button>`,
      ].join('')
    }

    return [
      `<button type="button" class="herb-dev-tools-copy herb-dev-tools-copy-compact"`,
      ` data-herb-dev-tools-action="copy-markdown"${tip('Copy this page as Markdown')}>`,
      COPY_ICON,
      `</button>`,
    ].join('')
  }

  private heroHTML(): string {
    const entry = this.heroEntry

    if (entry === null) {
      return ''
    }

    const diagnostic = entry.diagnostic
    const start = diagnostic.location?.start
    const title = diagnostic.code ?? diagnostic.origin

    const location = start === undefined
      ? diagnostic.template
      : `${diagnostic.template}:${start.line}:${start.column}`

    const path = diagnostic.template === UNKNOWN_TEMPLATE
      ? `<span class="herb-dev-tools-hero-path">${escapeHTML(location)}</span>`
      : this.pathHTML(location, diagnostic.template, start?.line ?? 1, start?.column ?? 1, 'herb-dev-tools-hero-path')

    return [
      `<header class="herb-dev-tools-hero">`,
      `<h1 class="herb-dev-tools-hero-title">${escapeHTML(title)}</h1>`,
      path,
      `<p class="herb-dev-tools-hero-message">${inlineCodeHTML(diagnostic.message)}</p>`,
      this.heroChipsHTML(diagnostic),
      `</header>`,
    ].join('')
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
      const collapsed = this.collapsed.has(template)
      const label = collapsed ? `Show the diagnostics for ${template}` : `Hide the diagnostics for ${template}`

      sections.push([
        `<section class="herb-dev-tools-group${collapsed ? ' herb-dev-tools-group-collapsed' : ''}">`,
        `<h2 class="herb-dev-tools-group-title" data-herb-dev-tools-action="collapse-group"`,
        ` data-herb-dev-tools-template="${escapeHTML(template)}">`,
        `<button type="button" class="herb-dev-tools-group-toggle" data-herb-dev-tools-action="collapse-group"`,
        ` data-herb-dev-tools-template="${escapeHTML(template)}" aria-expanded="${!collapsed}"`,
        ` aria-label="${escapeHTML(label)}">${CHEVRON_ICON}</button>`,
        `<span class="herb-dev-tools-group-icon" aria-hidden="true"></span>`,
        this.pathHTML(template, template, this.firstLineFor(groupEntries), 1, 'herb-dev-tools-group-path'),
        `<span class="herb-dev-tools-group-count">${groupEntries.length}</span>`,
        `</h2>`,
        this.groupBodyHTML(groupEntries),
        `</section>`,
      ].join(''))
    }

    return `${this.heroHTML()}${sections.join('')}${this.overlayMoreButtonHTML()}`
  }

  private provenanceHTML(): string {
    if (!this.overlayFocused) {
      return ''
    }

    const { herb_version: version, visitors, parser_options: options } = this.meta
    const parts: string[] = []

    if (version !== undefined) {
      parts.push(provenanceRowHTML('Compiled by Herb::Engine', escapeHTML(version)))
    }

    if (options !== undefined) {
      const pairs = Object.entries(options).map(([key, value]) => `${key}: ${value}`)

      if (pairs.length > 0) {
        parts.push(provenanceListHTML('Parser options', pairs))
      }
    }

    if (visitors !== undefined && visitors.length > 0) {
      parts.push(provenanceListHTML('Visitors', visitors.map(visitorLabel)))
    }

    const devTools = devToolsVersion()

    if (devTools !== null) {
      parts.push(provenanceRowHTML('Herb Dev Tools', escapeHTML(devTools)))
    }

    if (parts.length === 0) {
      return ''
    }

    return `<footer class="herb-dev-tools-provenance">${parts.join('')}</footer>`
  }

  private groupBodyHTML(entries: PanelEntry[]): string {
    return entries.map(entry => this.cardHTML(entry)).join('')
  }

  private cardHTML(entry: PanelEntry): string {
    const diagnostic = entry.diagnostic
    const isMetric = isReading(diagnostic)
    const url = safeUrl(diagnostic.docsUrl)
    const codeTone = isMetric ? 'metric' : (diagnostic.severity ?? 'error')
    const codeLabel = diagnostic.code ?? (isMetric ? null : sentenceCase(diagnostic.severity ?? 'error'))
    const code = codeLabel === null
      ? ''
      : `<span class="herb-dev-tools-code herb-dev-tools-code-${escapeHTML(codeTone)}">${escapeHTML(codeLabel)}</span>`

    const marker = isMetric
      ? `<span class="herb-dev-tools-metric"${diagnostic.value === null ? '' : ` title="${escapeHTML(diagnostic.value)}"`}>${escapeHTML(readingLabel(diagnostic))}</span>`
      : ''

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
    const suggestion = diagnostic.suggestion === null
      ? ''
      : [
        `<div class="herb-dev-tools-hint">`,
        `<p class="herb-dev-tools-hint-title">Suggestion</p>`,
        `<p class="herb-dev-tools-suggestion">${inlineCodeHTML(diagnostic.suggestion)}</p>`,
        `</div>`,
      ].join('')
    const element = this.elementHTML(entry)

    return [
      `<article class="herb-dev-tools-card" data-herb-dev-tools-entry="${this.entries.indexOf(entry)}" data-herb-dev-tools-origin="${escapeHTML(diagnostic.origin)}" data-herb-dev-tools-kind="${escapeHTML(diagnostic.kind)}">`,
      `<div class="herb-dev-tools-card-head">${marker}${code}${docs}<span class="herb-dev-tools-origin">${escapeHTML(diagnostic.origin)}</span>${repeat}${feature}</div>`,
      `<p class="herb-dev-tools-message">${inlineCodeHTML(diagnostic.message)}</p>`,
      element,
      suggestion,
      this.excerptHTML(diagnostic),
      this.observationsHTML(diagnostic),
      this.stackHTML(diagnostic),
      this.backtraceHTML(diagnostic),
      this.fixHTML(diagnostic),
      `</article>`,
    ].join('')
  }

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

    const hidden = hiddenBy(element)

    if (hidden !== null) {
      const label = hidden.culprit === null
        ? 'This element is on the page but nothing is rendered for it, so there is nothing to scroll to'
        : `This element is on the page but nothing is rendered for it, because ${describeElement(hidden.culprit)} has ${hidden.reason}`

      return [
        `<span class="herb-dev-tools-element herb-dev-tools-element-hidden" title="${escapeHTML(label)}">`,
        `<span class="herb-dev-tools-element-glyph" aria-hidden="true">○</span>`,
        `<code>${described}</code>`,
        `<span class="herb-dev-tools-element-note">not visible (${escapeHTML(hidden.reason)})</span>`,
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

    const key = diagnosticKey(diagnostic)
    const view = this.fixViews.get(key) ?? 'diff'
    const open = this.openFixes.has(key)

    const rendered = view === 'file'
      ? this.highlighting.file(fix.source)
      : this.highlighting.diff(diagnostic.template, source, fix)

    if (rendered === null) {
      return ''
    }

    const unsafe = fix.kind === 'unsafe'
    const note = unsafe ? 'not applied, unsafe' : 'not applied, safe'
    const command = fixCommand(diagnostic, unsafe)
    const copy = 'Copy this command'

    const tab = (value: 'diff' | 'file', label: string, description: string) => [
      `<button type="button" class="herb-dev-tools-fix-tab${view === value ? ' herb-dev-tools-fix-tab-active' : ''}"`,
      ` data-herb-dev-tools-action="fix-view" data-herb-dev-tools-fix-view="${value}"`,
      ` data-herb-dev-tools-fix-key="${escapeHTML(key)}"`,
      ` aria-pressed="${view === value}"${tip(description, label)}>${label}</button>`,
    ].join('')

    const copyFixed = view === 'file'
      ? [
        `<button type="button" class="herb-dev-tools-fix-copy" data-herb-dev-tools-action="copy-fixed"`,
        ` data-herb-dev-tools-fix-key="${escapeHTML(key)}"${tip('Copy the fixed template')}>`,
        COPY_ICON,
        `</button>`,
      ].join('')
      : ''

    const tabs = [
      `<div class="herb-dev-tools-fix-tabs">`,
      tab('diff', 'Diff', 'Show only the lines the fix changes'),
      tab('file', 'Fixed file', 'Show the whole template as the fix would leave it'),
      `</div>`,
    ].join('')

    return [
      `<div class="herb-dev-tools-autofix">`,
      `<p class="herb-dev-tools-autofix-title">Autofix<span class="herb-dev-tools-autofix-note">${escapeHTML(note)}</span></p>`,
      `<details class="herb-dev-tools-fix" data-herb-dev-tools-fix="${escapeHTML(fix.kind)}"`,
      ` data-herb-dev-tools-fix-key="${escapeHTML(key)}"${open ? ' open' : ''}>`,
      `<summary class="herb-dev-tools-fix-summary">Preview the change</summary>`,
      tabs,
      `<div class="herb-dev-tools-fix-diff">${copyFixed}${ansiHTML(rendered, 'herb-dev-tools-ansi')}</div>`,
      `</details>`,
      `<p class="herb-dev-tools-command-lead">Run this to fix it:</p>`,
      `<div class="herb-dev-tools-command">`,
      `<code class="herb-dev-tools-fix-command">${escapeHTML(command)}</code>`,
      `<button type="button" class="herb-dev-tools-command-copy" data-herb-dev-tools-action="copy-command"`,
      ` data-herb-dev-tools-command="${escapeHTML(command)}"${tip(copy)}>`,
      COPY_ICON,
      `</button>`,
      `</div>`,
      `</div>`,
    ].join('')
  }

  private observationsHTML(diagnostic: NormalizedDiagnostic): string {
    const keys = Object.keys(diagnostic.observations)

    if (keys.length === 0) {
      return ''
    }

    const sections = keys.map((key) => {
      const observed = diagnostic.observations[key]
      const lines = spaced(observed.map(entry => this.observation(entry))).map(escapeHTML).join('\n')
      const counted = observed.length === 1 ? key : `${key} (${observed.length})`

      return [
        `<p class="herb-dev-tools-observed-key">${escapeHTML(counted)}</p>`,
        `<pre class="herb-dev-tools-observed-list"><code>${lines}</code></pre>`,
      ].join('')
    })

    const total = keys.reduce((count, key) => count + diagnostic.observations[key].length, 0)
    const summary = total === 1 ? 'What was observed' : `What was observed (${total})`

    return [
      `<details class="herb-dev-tools-observed">`,
      `<summary>${escapeHTML(summary)}</summary>`,
      sections.join(''),
      `</details>`,
    ].join('')
  }

  private observation(entry: unknown): string {
    if (entry === null || typeof entry !== 'object') {
      return String(entry)
    }

    return Object.entries(entry as Record<string, unknown>).map(([key, value]) => `${key}: ${value}`).join('  ')
  }

  private stackHTML(diagnostic: NormalizedDiagnostic): string {
    const frames = buildRenderStack(this.renderTree, diagnostic)

    if (frames.length === 0) {
      return ''
    }

    const items = frames.map((frame, index) => {
      const via = frame.via === null
        ? ''
        : [
          `<span class="herb-dev-tools-frame-via herb-dev-tools-frame-via-${escapeHTML(frame.via)}">`,
          escapeHTML(VIA_LABELS[frame.via] ?? frame.via),
          `</span>`,
        ].join('')

      const path = this.pathHTML(frameLabel(frame), frame.template, frame.line ?? 1, frame.column ?? 1, 'herb-dev-tools-frame-target', frame.template)
      const highlight = index === 0 ? this.highlightButtonHTML(frame.template, frame.line) : ''

      return `<li class="herb-dev-tools-frame">${via}${path}${highlight}</li>`
    })

    return [
      `<div class="herb-dev-tools-stack">`,
      `<p class="herb-dev-tools-stack-title">Render stack<span class="herb-dev-tools-stack-order">innermost first</span></p>`,
      `<ol class="herb-dev-tools-frames">${items.join('')}</ol>`,
      `</div>`,
    ].join('')
  }

  private highlightButtonHTML(template: string, line: number | null): string {
    const found = nearestStamped(template, line).length

    if (found === 0) {
      return ''
    }

    const description = found === 1
      ? 'Show what this rendered on the page'
      : `Show all ${found} of these on the page`

    return [
      `<button type="button" class="herb-dev-tools-highlight" data-herb-dev-tools-action="highlight"`,
      ` data-herb-dev-tools-source="${escapeHTML(template)}" data-herb-dev-tools-at="${line ?? ''}"`,
      `${tip(description)}>${TARGET_ICON}`,
      found === 1 ? '' : `<span class="herb-dev-tools-highlight-count">${found}</span>`,
      `</button>`,
    ].join('')
  }

  private highlightFrom(trigger: HTMLElement) {
    const targets = this.targetsOf(trigger)

    if (targets.length === 0) return

    this.stepOutOfTheWay()

    targets[0].scrollIntoView({ block: 'center', behavior: 'smooth' })
    targets.forEach(target => flashElement(target))
  }

  private targetsOf(trigger: HTMLElement): Element[] {
    const template = trigger.getAttribute('data-herb-dev-tools-source')

    if (template === null) return []

    const line = Number(trigger.getAttribute('data-herb-dev-tools-at'))

    return nearestStamped(template, Number.isFinite(line) && line > 0 ? line : null)
      .filter(node => node.isConnected && hiddenBy(node) === null)
  }

  private backtraceHTML(diagnostic: NormalizedDiagnostic): string {
    if (diagnostic.backtrace.length === 0) {
      return ''
    }

    const items = diagnostic.backtrace.map((frame) => {
      const parsed = /^(.+?):(\d+)(?::in .*)?$/.exec(frame)

      if (!parsed) {
        return `<li class="herb-dev-tools-frame">${escapeHTML(frame)}</li>`
      }

      return `<li class="herb-dev-tools-frame">${this.pathHTML(frame, parsed[1], Number(parsed[2]), 1, 'herb-dev-tools-frame-target')}</li>`
    })

    return [
      `<div class="herb-dev-tools-stack">`,
      `<p class="herb-dev-tools-stack-title">Backtrace<span class="herb-dev-tools-stack-order">innermost first</span></p>`,
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

    root.querySelectorAll<HTMLElement>('[data-herb-dev-tools-action], [data-herb-dev-tools-source]').forEach((element) => {
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
        } else if (action === 'collapse') {
          this.collapse()
        } else if (action === 'expand') {
          this.expand()
        } else if (action === 'dismiss-overlay') {
          this.dismissOverlay()
        } else if (action === 'overlay-scope') {
          this.toggleOverlayScope()
        } else if (action === 'copy-markdown') {
          void this.copyMarkdown(element)
        } else if (action === 'copy-command') {
          void copyCommand(element)
        } else if (action === 'copy-fixed') {
          void this.copyFixed(element)
        } else if (action === 'collapse-group') {
          this.toggleGroup(element.getAttribute('data-herb-dev-tools-template'))
        } else if (action === 'collapse-all') {
          this.toggleAllGroups()
        } else if (action === 'fix-view') {
          this.showFixView(element.getAttribute('data-herb-dev-tools-fix-key'), element.getAttribute('data-herb-dev-tools-fix-view'))
        } else if (action === 'feature') {
          this.featureFrom(element)
        } else if (action === 'dismiss') {
          this.dismiss()
        } else if (action === 'clear') {
          this.clear()
          this.close()
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
        } else if (action === 'choose-metrics') {
          this.toggleChoosing()
        } else if (action === 'mute') {
          this.toggleMute(element.getAttribute('data-herb-dev-tools-metric'))
        } else if (action === 'open') {
          this.openFrom(element)
        } else if (action === 'highlight') {
          this.highlightFrom(element)
        } else if (action === 'locate') {
          this.locateFrom(element)
        }
      })

      const action = element.getAttribute('data-herb-dev-tools-action')

      if (action === 'locate' || element.hasAttribute('data-herb-dev-tools-source')) {
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

    if (!target || !target.isConnected || hiddenBy(target) !== null) return

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

  private outlines: HTMLElement[] = []

  private outlineFrom(trigger: HTMLElement, on: boolean) {
    this.outlines.forEach(box => box.remove())
    this.outlines = []

    if (!on) return

    const element = this.entryFor(trigger)?.diagnostic.element
    const targets = trigger.getAttribute('data-herb-dev-tools-source') === null
      ? (element ? [element] : [])
      : this.targetsOf(trigger)

    const showing = targets.filter(target => target.isConnected && hiddenBy(target) === null)

    if (showing.length === 0) return

    if (trigger.hasAttribute('data-herb-dev-tools-at')) {
      showing.forEach(target => this.outlines.push(this.outlineOver(target.getBoundingClientRect())))

      return
    }

    this.outlines.push(this.outlineOver(spanning(showing)))
  }

  private outlineOver(rect: Bounds): HTMLElement {
    const box = document.createElement('div')

    box.className = 'herb-slot-flash herb-element-outline'
    box.style.cssText = `position:absolute;z-index:2147483000;pointer-events:none;top:${rect.top + window.scrollY}px;left:${rect.left + window.scrollX}px;width:${rect.width}px;height:${rect.height}px;outline:2px solid #f59e0b;outline-offset:2px;background:rgba(245,158,11,0.12)`

    document.body.appendChild(box)

    return box
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

interface Bounds {
  top: number
  left: number
  width: number
  height: number
}

function spanning(elements: Element[]): Bounds {
  const rects = elements.map(element => element.getBoundingClientRect())
  const top = Math.min(...rects.map(rect => rect.top))
  const left = Math.min(...rects.map(rect => rect.left))

  return {
    top,
    left,
    width: Math.max(...rects.map(rect => rect.right)) - left,
    height: Math.max(...rects.map(rect => rect.bottom)) - top,
  }
}

function stampedNodes(template: string): Element[] {
  const stamped = Array.from(document.querySelectorAll(`[${SOURCE_ATTRIBUTE}]`))

  return stamped.filter(node => node.getAttribute(SOURCE_ATTRIBUTE)?.startsWith(`${template}:`) === true)
}

function stampedAt(node: Element, template: string): [number, number] | null {
  const value = node.getAttribute(SOURCE_ATTRIBUTE)

  if (value === null || !value.startsWith(`${template}:`)) return null

  const [line, column] = value.slice(template.length + 1).split(':').map(Number)

  return Number.isFinite(line) && Number.isFinite(column) ? [line, column] : null
}

function nearestStamped(template: string, line: number | null): Element[] {
  const nodes = stampedNodes(template)

  if (line === null || nodes.length === 0) return nodes

  const positions = nodes.map(node => stampedAt(node, template)).filter((at): at is [number, number] => at !== null)
  const above = positions.filter(([stampLine]) => stampLine <= line)

  if (above.length === 0) return nodes

  const best = above.reduce((carried, at) => (at[0] > carried[0] || (at[0] === carried[0] && at[1] > carried[1])) ? at : carried)

  return nodes.filter(node => {
    const at = stampedAt(node, template)

    return at !== null && at[0] === best[0] && at[1] === best[1]
  })
}

function hiddenBy(element: Element): { reason: string, culprit: Element | null } | null {
  let current: Element | null = element

  while (current !== null) {
    const style = getComputedStyle(current)

    if (style.display === 'none') {
      return { reason: 'display: none', culprit: current === element ? null : current }
    }

    if (style.getPropertyValue('content-visibility') === 'hidden') {
      return { reason: 'content-visibility: hidden', culprit: current === element ? null : current }
    }

    if (style.opacity === '0') {
      return { reason: 'opacity: 0', culprit: current === element ? null : current }
    }

    current = current.parentElement
  }

  const style = getComputedStyle(element)

  if (style.visibility === 'hidden' || style.visibility === 'collapse') {
    return { reason: `visibility: ${style.visibility}`, culprit: null }
  }

  if (style.display === 'contents') {
    return { reason: 'display: contents', culprit: null }
  }

  return null
}

const IDENTIFYING_ATTRIBUTES = ['src', 'href', 'alt', 'name', 'type', 'value', 'title', 'role', 'class']
const GENERATED_ATTRIBUTES = ['data-herb-debug-', 'data-herb-source', 'data-herb-scope-', 'data-herb-style-scoped', 'data-herb-slot', 'data-herb-region', 'data-herb-manifests', 'data-herb-dependencies']

function isGenerated(name: string): boolean {
  return GENERATED_ATTRIBUTES.some(generated => name.startsWith(generated))
}

function identifyingAttribute(element: Element): Attr | null {
  const attributes = [...element.attributes].filter(attribute =>
    !isGenerated(attribute.name) && attribute.name !== 'style' && attribute.name !== 'id'
  )

  for (const name of IDENTIFYING_ATTRIBUTES) {
    const found = attributes.find(attribute => attribute.name === name)

    if (found) return found
  }

  return attributes[0] ?? null
}

function describeElement(element: Element): string {
  const tag = element.tagName.toLowerCase()
  const id = element.id ? `#${element.id}` : ''
  const attribute = identifyingAttribute(element)
  const detail = attribute ? ` ${attribute.name}="${attribute.value.length > 40 ? `${attribute.value.slice(0, 40)}…` : attribute.value}"` : ''

  return `<${tag}${id}${detail}>`
}
