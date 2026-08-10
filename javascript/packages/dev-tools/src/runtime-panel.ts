import { DocumentBuilder, renderDocumentHTML } from '@herb-tools/highlighter';

import { HIGHLIGHTER_THEME, loadHighlighter, releaseHighlighterStyles, retainHighlighterStyles } from './highlighter-bridge.js';

import {
  MAX_RUNTIME_DIAGNOSTICS,
  buildRenderStack,
  diagnosticKey,
  normalizeDiagnostic,
  readRuntimeReport,
} from './runtime-report.js';

import type { SyntaxRenderer } from '@herb-tools/highlighter';
import type { Annotation, Document as HighlightDocument, HTMLSinkOptions, LineInfo, StyledRun } from '@herb-tools/highlighter';

import type {
  NormalizedDiagnostic,
  NormalizedFix,
  NormalizedRuntimeReport,
  RenderStackFrame,
  RenderTreeNode,
  RuntimeDiagnostic,
} from './runtime-report.js';

export interface RuntimeReportHandle {
  dismiss(): void;
}

export interface RuntimePanelOptions {
  autoInit?: boolean;
}

interface PanelEntry {
  key: string;
  diagnostic: NormalizedDiagnostic;
  count: number;
}

interface PanelState {
  dismissed: boolean;
  open: boolean;
  origin: string;
}

const ALL_ORIGINS = '*';
const CONTEXT_LINES = 2;
const DIFF_CONTEXT_LINES = 1;
const STATE_KEY = 'herb-dev-tools-runtime-panel';
const ROOT_CLASS = 'hdt-runtime-root';

const VIA_LABELS: Record<string, string> = {
  layout: 'layout',
  template: 'template',
  partial: 'partial',
  component: 'component',
};

function escapeHTML(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function safeUrl(url: string | null): string | null {
  if (url === null) {
    return null;
  }

  const trimmed = url.trim();
  const lower = trimmed.toLowerCase();

  if (lower.startsWith('http://') || lower.startsWith('https://')) {
    return trimmed;
  }

  return null;
}

function frameLabel(frame: RenderStackFrame): string {
  if (frame.line === null) {
    return frame.template;
  }

  return `${frame.template}:${frame.line}:${frame.column ?? 1}`;
}

function annotationsForLine(lineNumber: number, lineText: string, diagnostic: NormalizedDiagnostic): Annotation[] {
  const range = diagnostic.location;

  if (range === null || diagnostic.severity === null) {
    return [];
  }

  const end = range.end ?? range.start;
  const startColumn = lineNumber === range.start.line ? Math.max(0, range.start.column - 1) : 0;
  const rawEnd = lineNumber === end.line ? Math.max(0, end.column - 1) : lineText.length;
  const endColumn = Math.max(startColumn + 1, Math.min(rawEnd, Math.max(lineText.length, startColumn + 1)));

  return [{ start: startColumn, end: endColumn, severity: diagnostic.severity, message: null }];
}

export function buildExcerptDocument(source: string, runs: StyledRun[], diagnostic: NormalizedDiagnostic): HighlightDocument | null {
  const range = diagnostic.location;

  if (range === null) {
    return null;
  }

  const lineTexts = source.split('\n');
  const total = lineTexts.length;
  const end = range.end ?? range.start;
  const firstMarked = Math.max(1, Math.min(range.start.line, total));
  const lastMarked = Math.max(firstMarked, Math.min(end.line, total));
  const from = Math.max(1, firstMarked - CONTEXT_LINES);
  const to = Math.min(total, lastMarked + CONTEXT_LINES);
  const lines: LineInfo[] = [];

  for (let number = from; number <= to; number++) {
    const marked = number >= firstMarked && number <= lastMarked;
    const lineText = lineTexts[number - 1] ?? '';

    if (!marked) {
      lines.push({ number, emphasis: { kind: 'Dimmed' }, annotations: [] });

      continue;
    }

    if (diagnostic.severity === null) {
      lines.push({ number, emphasis: { kind: 'Focus' }, annotations: [] });

      continue;
    }

    lines.push({
      number,
      emphasis: { kind: 'Marked', severity: diagnostic.severity },
      annotations: annotationsForLine(number, lineText, diagnostic),
    });
  }

  if (lines.length === 0) {
    return null;
  }

  return {
    version: 1,
    nodes: [{ type: 'CodeBlock', kind: 'AnnotatedListing', firstLine: 1, runs, lines }],
  };
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
  };
}

export class RuntimePanel {
  private entries: PanelEntry[] = [];
  private renderTree: RenderTreeNode[] = [];
  private sources: Record<string, string> = {};
  private hasPayload = false;
  private lastCount = 0;
  private bumped = false;
  private primed = false;
  private state: PanelState = { dismissed: false, open: false, origin: ALL_ORIGINS };
  private root: HTMLElement | null = null;
  private renderer: SyntaxRenderer | null = null;
  private builder: DocumentBuilder | null = null;
  private hydrating = false;
  private destroyed = false;

  constructor(options: RuntimePanelOptions = {}) {
    if (options.autoInit !== false) {
      this.init();
    }
  }

  public destroy() {
    if (this.destroyed) {
      return;
    }

    this.destroyed = true;

    this.root?.remove();
    this.root = null;
    this.renderer = null;
    this.builder = null;

    releaseHighlighterStyles();
  }

  public report(input: RuntimeDiagnostic | RuntimeDiagnostic[]): RuntimeReportHandle {
    const candidates = Array.isArray(input) ? input : [input];
    const keys: string[] = [];

    for (const candidate of candidates) {
      const diagnostic = normalizeDiagnostic(candidate, this.sources);

      if (diagnostic === null) {
        continue;
      }

      keys.push(this.add(diagnostic));
    }

    this.render();

    return {
      dismiss: () => {
        for (const key of keys) {
          this.remove(key);
        }

        this.render();
      },
    };
  }

  public clear(origin?: string) {
    if (origin === undefined) {
      this.entries = [];
    } else {
      this.entries = this.entries.filter(entry => entry.diagnostic.origin !== origin);
    }

    this.render();
  }

  public get count(): number {
    return this.entries.reduce((total, entry) => total + entry.count, 0);
  }

  public get diagnosticCount(): number {
    return this.entries
      .filter(entry => entry.diagnostic.kind === 'diagnostic')
      .reduce((total, entry) => total + entry.count, 0);
  }

  public get element(): HTMLElement | null {
    return this.root;
  }

  public open() {
    this.state.open = true;
    this.state.dismissed = false;

    this.saveState();
    this.render();
  }

  public close() {
    this.state.open = false;

    this.saveState();
    this.render();
  }

  public dismiss() {
    this.state.dismissed = true;
    this.state.open = false;

    this.saveState();
    this.render();
  }

  public show(options: { open?: boolean } = {}) {
    this.state.dismissed = false;

    if (options.open === true) {
      this.state.open = true;
    }

    this.saveState();
    this.render();
  }

  public refresh() {
    if (this.destroyed) {
      return;
    }

    const report = readRuntimeReport(document);

    if (report === null) {
      this.render();

      return;
    }

    this.entries = [];

    this.applyPayload(report);
    this.render();
  }

  private init() {
    this.loadState();
    this.loadPayload();

    retainHighlighterStyles();

    this.render();
  }

  private loadPayload() {
    const report = readRuntimeReport(document);

    if (report === null) {
      return;
    }

    this.applyPayload(report);
  }

  private applyPayload(report: NormalizedRuntimeReport) {
    this.hasPayload = true;
    this.renderTree = report.renderTree;
    this.sources = report.sources;

    for (const diagnostic of report.diagnostics) {
      this.add(diagnostic);
    }
  }

  private add(diagnostic: NormalizedDiagnostic): string {
    const key = diagnosticKey(diagnostic);
    const existing = this.entries.find(entry => entry.key === key);

    if (existing !== undefined) {
      existing.count += 1;
      existing.diagnostic = mergeDiagnostics(existing.diagnostic, diagnostic);

      return key;
    }

    this.entries.push({ key, diagnostic, count: 1 });

    while (this.entries.length > MAX_RUNTIME_DIAGNOSTICS) {
      this.entries.shift();
    }

    return key;
  }

  private remove(key: string) {
    const index = this.entries.findIndex(entry => entry.key === key);

    if (index === -1) {
      return;
    }

    const entry = this.entries[index];

    entry.count -= 1;

    if (entry.count <= 0) {
      this.entries.splice(index, 1);
    }
  }

  private loadState() {
    try {
      const stored = sessionStorage.getItem(STATE_KEY);

      if (stored === null) {
        return;
      }

      const parsed = JSON.parse(stored);

      this.state = {
        dismissed: parsed?.dismissed === true,
        open: parsed?.open === true,
        origin: typeof parsed?.origin === 'string' ? parsed.origin : ALL_ORIGINS,
      };
    } catch (_error) {
      this.state = { dismissed: false, open: false, origin: ALL_ORIGINS };
    }
  }

  private saveState() {
    try {
      sessionStorage.setItem(STATE_KEY, JSON.stringify(this.state));
    } catch (_error) {
      return;
    }
  }

  private visibleEntries(): PanelEntry[] {
    if (this.state.origin === ALL_ORIGINS) {
      return this.entries;
    }

    return this.entries.filter(entry => entry.diagnostic.origin === this.state.origin);
  }

  private render() {
    if (this.destroyed) {
      return;
    }

    if (this.state.origin !== ALL_ORIGINS && !this.entries.some(entry => entry.diagnostic.origin === this.state.origin)) {
      this.state.origin = ALL_ORIGINS;

      this.saveState();
    }

    const currentCount = this.diagnosticCount;

    this.bumped = this.primed && currentCount > this.lastCount;
    this.lastCount = currentCount;
    this.primed = true;

    const shouldShow = this.entries.length > 0;

    if (!shouldShow || this.state.dismissed) {
      this.root?.remove();
      this.root = null;

      return;
    }

    const slot = document.querySelector('[data-hdt-badge-slot]');
    const host = slot ?? document.body;

    if (this.root === null || !this.root.isConnected || this.root.parentElement !== host) {
      this.root?.remove();

      this.root = document.createElement('div');
      this.root.className = slot ? `${ROOT_CLASS} hdt-attached` : ROOT_CLASS;

      host.appendChild(this.root);
    } else {
      this.root.className = slot ? `${ROOT_CLASS} hdt-attached` : ROOT_CLASS;
    }

    this.root.innerHTML = this.rootHTML();

    this.bindHandlers();

    void this.hydrateHighlighting();
  }

  private rootHTML(): string {
    const badgeCount = this.diagnosticCount;
    const openClass = this.state.open ? ' hdt-open' : '';
    const bumpClass = this.bumped ? ' hdt-bump' : '';

    return [
      `<button type="button" class="hdt-badge${openClass}" data-hdt-action="toggle" title="${escapeHTML(this.summary())}" aria-expanded="${this.state.open}">`,
      `<span class="hdt-badge-glyph" aria-hidden="true">⚠️</span>`,
      `<span class="hdt-badge-count${bumpClass}">${badgeCount}</span>`,
      `</button>`,
      `<section class="hdt-panel${openClass}" aria-label="Herb runtime diagnostics">`,
      this.headerHTML(),
      this.filtersHTML(),
      `<div class="hdt-body">${this.bodyHTML()}</div>`,
      `</section>`,
    ].join('');
  }

  private summary(): string {
    const errors = this.countBy(entry => entry.diagnostic.severity === 'error');
    const warnings = this.countBy(entry => entry.diagnostic.severity === 'warning');
    const notices = this.countBy(entry => entry.diagnostic.severity === 'info' || entry.diagnostic.severity === 'hint');
    const metrics = this.countBy(entry => entry.diagnostic.kind === 'metric');
    const parts: string[] = [];

    if (errors > 0) parts.push(`${errors} error${errors === 1 ? '' : 's'}`);
    if (warnings > 0) parts.push(`${warnings} warning${warnings === 1 ? '' : 's'}`);
    if (notices > 0) parts.push(`${notices} notice${notices === 1 ? '' : 's'}`);
    if (metrics > 0) parts.push(`${metrics} metric${metrics === 1 ? '' : 's'}`);

    return parts.length === 0 ? 'No runtime diagnostics' : parts.join(', ');
  }

  private countBy(predicate: (entry: PanelEntry) => boolean): number {
    return this.entries.filter(predicate).reduce((total, entry) => total + entry.count, 0);
  }

  private headerHTML(): string {
    return [
      `<header class="hdt-header">`,
      `<span class="hdt-title">Herb runtime diagnostics</span>`,
      `<span class="hdt-summary">${escapeHTML(this.summary())}</span>`,
      `<button type="button" class="hdt-hide" data-hdt-action="dismiss">Hide for this session</button>`,
      `<button type="button" class="hdt-close" data-hdt-action="close" aria-label="Close panel">×</button>`,
      `</header>`,
    ].join('');
  }

  private filtersHTML(): string {
    const origins = new Map<string, number>();

    for (const entry of this.entries) {
      origins.set(entry.diagnostic.origin, (origins.get(entry.diagnostic.origin) ?? 0) + entry.count);
    }

    if (origins.size === 0) {
      return '';
    }

    const buttons = [`<button type="button" class="hdt-filter${this.state.origin === ALL_ORIGINS ? ' hdt-filter-active' : ''}" data-hdt-action="filter" data-hdt-origin="${ALL_ORIGINS}">All (${this.count})</button>`];

    for (const [origin, count] of origins) {
      const active = this.state.origin === origin ? ' hdt-filter-active' : '';

      buttons.push(`<button type="button" class="hdt-filter${active}" data-hdt-action="filter" data-hdt-origin="${escapeHTML(origin)}">${escapeHTML(origin)} (${count})</button>`);
    }

    return `<div class="hdt-filters">${buttons.join('')}</div>`;
  }

  private bodyHTML(): string {
    const entries = this.visibleEntries();

    if (entries.length === 0) {
      const message = this.entries.length === 0
        ? 'Nothing to report. Every template on this page rendered cleanly.'
        : 'No entries from this origin.';

      return `<p class="hdt-empty">${escapeHTML(message)}</p>`;
    }

    const groups = new Map<string, PanelEntry[]>();

    for (const entry of entries) {
      const template = entry.diagnostic.template;

      if (!groups.has(template)) {
        groups.set(template, []);
      }

      groups.get(template)!.push(entry);
    }

    const sections: string[] = [];

    for (const [template, groupEntries] of groups) {
      sections.push([
        `<section class="hdt-group">`,
        `<h2 class="hdt-group-title">${escapeHTML(template)}<span class="hdt-group-count">${groupEntries.length}</span></h2>`,
        groupEntries.map(entry => this.cardHTML(entry)).join(''),
        `</section>`,
      ].join(''));
    }

    return sections.join('');
  }

  private cardHTML(entry: PanelEntry): string {
    const diagnostic = entry.diagnostic;
    const isMetric = diagnostic.kind === 'metric';
    const marker = isMetric
      ? `<span class="hdt-metric">${escapeHTML(diagnostic.value ?? 'metric')}</span>`
      : `<span class="hdt-dot hdt-dot-${escapeHTML(diagnostic.severity ?? 'error')}" aria-hidden="true"></span>`;

    const url = safeUrl(diagnostic.docsUrl);
    const code = diagnostic.code === null
      ? ''
      : url === null
        ? `<span class="hdt-code">${escapeHTML(diagnostic.code)}</span>`
        : `<a class="hdt-code" href="${escapeHTML(url)}" target="_blank" rel="noopener noreferrer">${escapeHTML(diagnostic.code)}</a>`;

    const repeat = entry.count > 1 ? `<span class="hdt-repeat" title="Reported ${entry.count} times">×${entry.count}</span>` : '';
    const suggestion = diagnostic.suggestion === null ? '' : `<p class="hdt-suggestion">${escapeHTML(diagnostic.suggestion)}</p>`;
    const excerpt = this.excerptHTML(diagnostic);

    return [
      `<article class="hdt-card" data-hdt-origin="${escapeHTML(diagnostic.origin)}" data-hdt-kind="${escapeHTML(diagnostic.kind)}">`,
      `<div class="hdt-card-head">${marker}${code}<span class="hdt-origin">${escapeHTML(diagnostic.origin)}</span>${repeat}</div>`,
      `<p class="hdt-message">${escapeHTML(diagnostic.message)}</p>`,
      suggestion,
      excerpt,
      this.stackHTML(diagnostic),
      this.fixHTML(diagnostic),
      `</article>`,
    ].join('');
  }

  private excerptHTML(diagnostic: NormalizedDiagnostic): string {
    const source = this.sources[diagnostic.template];

    if (source === undefined || diagnostic.location === null) {
      return '';
    }

    const rendered = this.renderExcerpt(source, diagnostic);

    if (rendered === null) {
      return `<div class="hdt-excerpt" data-hdt-excerpt-pending></div>`;
    }

    return `<div class="hdt-excerpt">${rendered}</div>`;
  }

  private renderExcerpt(source: string, diagnostic: NormalizedDiagnostic): string | null {
    const renderer = this.renderer;

    if (renderer === null || !this.highlightingReady()) {
      return null;
    }

    try {
      const document = buildExcerptDocument(source, renderer.highlightRuns(source), diagnostic);

      if (document === null) {
        return null;
      }

      return renderDocumentHTML(document, this.sinkOptions());
    } catch (_error) {
      return null;
    }
  }

  private sinkOptions(): HTMLSinkOptions {
    return {
      themeLabel: HIGHLIGHTER_THEME,
      showLineNumbers: true,
      markers: 'spans',
      lineNumberStyle: 'element',
    };
  }

  private fixHTML(diagnostic: NormalizedDiagnostic): string {
    const fix = diagnostic.fix;

    if (fix === null) {
      return '';
    }

    const source = this.sources[diagnostic.template];

    if (source === undefined) {
      return '';
    }

    if (!this.highlightingReady()) {
      return `<div class="hdt-fix-pending" data-hdt-fix-pending hidden></div>`;
    }

    const rendered = this.renderFix(source, fix);

    if (rendered === null) {
      return '';
    }

    const unsafe = fix.kind === 'unsafe';
    const lead = unsafe ? 'Not applied. This fix is unsafe. Running' : 'Not applied. Running';
    const command = unsafe ? 'herb lint --fix-unsafely' : 'herb lint --fix';

    return [
      `<details class="hdt-fix" data-hdt-fix="${escapeHTML(fix.kind)}">`,
      `<summary class="hdt-fix-summary">${escapeHTML(lead)} <code class="hdt-fix-command">${escapeHTML(command)}</code> would change this template to</summary>`,
      `<div class="hdt-fix-diff">${rendered}</div>`,
      `</details>`,
    ].join('');
  }

  private renderFix(source: string, fix: NormalizedFix): string | null {
    const builder = this.builder;

    if (builder === null) {
      return null;
    }

    try {
      const document = builder.buildDiff('', source, fix.source, { contextLines: DIFF_CONTEXT_LINES });

      if (document.nodes.length === 0) {
        return null;
      }

      return renderDocumentHTML(document, { ...this.sinkOptions(), diffLayout: 'unified' });
    } catch (_error) {
      return null;
    }
  }

  private highlightingReady(): boolean {
    return this.renderer !== null && this.renderer.initialized;
  }

  private stackHTML(diagnostic: NormalizedDiagnostic): string {
    const frames = buildRenderStack(this.renderTree, diagnostic);

    if (frames.length === 0) {
      return '';
    }

    const items = frames.map(frame => {
      const via = frame.via === null ? '' : `<span class="hdt-frame-via">${escapeHTML(VIA_LABELS[frame.via] ?? frame.via)}</span>`;

      return `<li class="hdt-frame">${via}<span class="hdt-frame-target">${escapeHTML(frameLabel(frame))}</span></li>`;
    });

    return [
      `<div class="hdt-stack">`,
      `<p class="hdt-stack-title">Render stack<span class="hdt-stack-order">innermost first</span></p>`,
      `<ol class="hdt-frames">${items.join('')}</ol>`,
      `</div>`,
    ].join('');
  }

  private async hydrateHighlighting() {
    if (this.hydrating || this.destroyed) {
      return;
    }

    if (!this.root || this.root.querySelector('[data-hdt-excerpt-pending], [data-hdt-fix-pending]') === null) {
      return;
    }

    this.hydrating = true;

    const renderer = await loadHighlighter();

    this.hydrating = false;

    if (renderer === null || this.destroyed || this.renderer === renderer) {
      return;
    }

    this.renderer = renderer;
    this.builder = new DocumentBuilder(renderer);

    this.render();
  }

  private bindHandlers() {
    const root = this.root;

    if (root === null) {
      return;
    }

    root.querySelectorAll<HTMLElement>('[data-hdt-action]').forEach((element) => {
      element.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();

        const action = element.getAttribute('data-hdt-action');

        if (action === 'toggle') {
          if (this.state.open) {
            this.close();
          } else {
            this.open();
          }
        } else if (action === 'close') {
          this.close();
        } else if (action === 'dismiss') {
          this.dismiss();
        } else if (action === 'filter') {
          this.state.origin = element.getAttribute('data-hdt-origin') ?? ALL_ORIGINS;

          this.saveState();
          this.render();
        }
      });
    });
  }
}
