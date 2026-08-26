export const RUNTIME_REPORT_VERSION = 1;
export const RUNTIME_REPORT_SELECTOR = 'script[type="application/json"][data-herb-diagnostics]';
export const MAX_RUNTIME_DIAGNOSTICS = 200;
export const DEFAULT_ORIGIN = 'unknown';
export const UNKNOWN_TEMPLATE = '(unknown template)';
export const DEFAULT_SEVERITY: RuntimeSeverity = 'error';
export const RENDER_VIA_VALUES = ['layout', 'template', 'partial', 'component'] as const;
export const RUNTIME_SEVERITIES = ['error', 'warning', 'info', 'hint'] as const;
export const RUNTIME_KINDS = ['diagnostic', 'metric'] as const;
export const OVERLAY_MODES = ['blocking', 'dismissible'] as const;
export const PHASES = ['compile', 'runtime'] as const;
export const FIX_KINDS = ['safe', 'unsafe'] as const;
export const DEFAULT_FIX_KIND: FixKind = 'safe';

export type RenderVia = typeof RENDER_VIA_VALUES[number];
export type RuntimeSeverity = typeof RUNTIME_SEVERITIES[number];
export type RuntimeKind = typeof RUNTIME_KINDS[number];
export type OverlayMode = typeof OVERLAY_MODES[number];
export type Phase = typeof PHASES[number];
export type FixKind = typeof FIX_KINDS[number];

export function trimOrigin(value: unknown): string {
  if (typeof value !== 'string') {
    return DEFAULT_ORIGIN;
  }

  const trimmed = value.trim();

  return trimmed.length === 0 ? DEFAULT_ORIGIN : trimmed;
}

export interface RuntimePosition {
  line: number;
  column: number;
}

export interface RuntimeRange {
  start: RuntimePosition;
  end?: RuntimePosition;
}

export interface RenderTreeNode {
  id: string;
  template: string;
  parent: string | null;
  via: RenderVia;
  location?: RuntimePosition;
}

export interface RuntimeFix {
  kind?: FixKind;
  source: string;
}

export interface NormalizedFix {
  kind: FixKind;
  source: string;
}

export interface RuntimeDiagnostic {
  template: string;
  message: string;
  node?: string;
  code?: string;
  severity?: RuntimeSeverity;
  kind?: RuntimeKind;
  origin?: string;
  location?: RuntimeRange;
  suggestion?: string;
  docsUrl?: string;
  value?: string;
  fix?: RuntimeFix;
  overlay?: OverlayMode | false;
  phase?: Phase;
  source?: string;
  element?: Element | null;
}

export interface RuntimeReport {
  version: number;
  renderTree?: RenderTreeNode[];
  diagnostics?: RuntimeDiagnostic[];
  sources?: Record<string, string>;
}

export interface NormalizedDiagnostic {
  template: string;
  message: string;
  node: string | null;
  code: string | null;
  severity: RuntimeSeverity | null;
  kind: RuntimeKind;
  origin: string;
  location: RuntimeRange | null;
  suggestion: string | null;
  docsUrl: string | null;
  value: string | null;
  fix: NormalizedFix | null;
  overlay: OverlayMode | null;
  phase: Phase | null;
  element: Element | null;
}

export interface NormalizedRuntimeReport {
  version: number;
  renderTree: RenderTreeNode[];
  diagnostics: NormalizedDiagnostic[];
  sources: Record<string, string>;
}

export interface RenderStackFrame {
  template: string;
  via: RenderVia | null;
  line: number | null;
  column: number | null;
}

const warnedVersions = new Set<number | string>();

export function resetRuntimeReportWarnings() {
  warnedVersions.clear();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function asPositiveInteger(value: unknown, minimum: number): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null;
  }

  const rounded = Math.floor(value);

  return rounded < minimum ? minimum : rounded;
}

function normalizePosition(value: unknown): RuntimePosition | null {
  if (!isRecord(value)) {
    return null;
  }

  const line = asPositiveInteger(value.line, 1);

  if (line === null) {
    return null;
  }

  return { line, column: asPositiveInteger(value.column, 1) ?? 1 };
}

function normalizeRange(value: unknown): RuntimeRange | null {
  if (!isRecord(value)) {
    return null;
  }

  const start = normalizePosition(value.start);

  if (start === null) {
    return null;
  }

  const end = normalizePosition(value.end);

  return end === null ? { start } : { start, end };
}

function normalizeVia(value: unknown): RenderVia | null {
  return RENDER_VIA_VALUES.includes(value as RenderVia) ? (value as RenderVia) : null;
}

function normalizeSeverity(value: unknown): RuntimeSeverity | null {
  return RUNTIME_SEVERITIES.includes(value as RuntimeSeverity) ? (value as RuntimeSeverity) : null;
}

function normalizeKind(value: unknown): RuntimeKind {
  return RUNTIME_KINDS.includes(value as RuntimeKind) ? (value as RuntimeKind) : 'diagnostic';
}

function normalizeOverlay(value: unknown): OverlayMode | null {
  return OVERLAY_MODES.includes(value as OverlayMode) ? (value as OverlayMode) : null;
}

function normalizePhase(value: unknown): Phase | null {
  return PHASES.includes(value as Phase) ? (value as Phase) : null;
}

function normalizeFixKind(value: unknown): FixKind {
  return FIX_KINDS.includes(value as FixKind) ? (value as FixKind) : DEFAULT_FIX_KIND;
}

function normalizeFix(value: unknown, template: string, sources: Record<string, string>): NormalizedFix | null {
  if (!isRecord(value)) {
    return null;
  }

  const source = value.source;

  if (typeof source !== 'string') {
    return null;
  }

  if (sources[template] === source) {
    return null;
  }

  return { kind: normalizeFixKind(value.kind), source };
}

export function normalizeRenderTree(value: unknown): RenderTreeNode[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const nodes: RenderTreeNode[] = [];
  const seen = new Set<string>();

  for (const candidate of value) {
    if (!isRecord(candidate)) {
      continue;
    }

    const id = asString(candidate.id);
    const template = asString(candidate.template);

    if (id === null || template === null || seen.has(id)) {
      continue;
    }

    seen.add(id);

    const node: RenderTreeNode = {
      id,
      template,
      parent: asString(candidate.parent),
      via: normalizeVia(candidate.via) ?? 'template',
    };

    const location = normalizePosition(candidate.location);

    if (location !== null) {
      node.location = location;
    }

    nodes.push(node);
  }

  return nodes;
}

export function normalizeDiagnostic(value: unknown, sources: Record<string, string> = {}): NormalizedDiagnostic | null {
  if (!isRecord(value)) {
    return null;
  }

  const template = asString(value.template);
  const message = asString(value.message);

  if (template === null || message === null) {
    return null;
  }

  const kind = normalizeKind(value.kind);
  const severity = normalizeSeverity(value.severity);

  return {
    template,
    message,
    node: asString(value.node),
    code: asString(value.code),
    severity: kind === 'metric' ? null : severity ?? DEFAULT_SEVERITY,
    kind,
    origin: trimOrigin(value.origin),
    location: normalizeRange(value.location),
    suggestion: asString(value.suggestion),
    docsUrl: asString(value.docsUrl) ?? asString(value.docs_url),
    value: asString(value.value),
    fix: normalizeFix(value.fix, template, sources),
    overlay: normalizeOverlay(value.overlay),
    phase: normalizePhase(value.phase),
    element: asElement(value.element),
  };
}

function asElement(value: unknown): Element | null {
  return typeof Element !== 'undefined' && value instanceof Element ? value : null;
}

function normalizeSources(value: unknown): Record<string, string> {
  if (!isRecord(value)) {
    return {};
  }

  const sources: Record<string, string> = {};

  for (const [template, source] of Object.entries(value)) {
    if (typeof source === 'string') {
      sources[template] = source;
    }
  }

  return sources;
}

export function normalizeRuntimeReport(value: unknown): NormalizedRuntimeReport | null {
  if (!isRecord(value)) {
    warnOnce('missing', 'Ignoring a runtime report payload that is not a JSON object.');

    return null;
  }

  const version = value.version;

  if (typeof version !== 'number' || !Number.isFinite(version)) {
    warnOnce('missing', `Ignoring a runtime report payload without a numeric "version". Expected ${RUNTIME_REPORT_VERSION}.`);

    return null;
  }

  if (Math.floor(version) !== RUNTIME_REPORT_VERSION) {
    warnOnce(version, `Ignoring a runtime report payload with unsupported version ${version}. This build understands version ${RUNTIME_REPORT_VERSION}.`);

    return null;
  }

  const sources = normalizeSources(value.sources);
  const diagnostics: NormalizedDiagnostic[] = [];

  if (Array.isArray(value.diagnostics)) {
    for (const candidate of value.diagnostics) {
      const diagnostic = normalizeDiagnostic(candidate, sources);

      if (diagnostic !== null) {
        diagnostics.push(diagnostic);
      }
    }
  }

  return {
    version: RUNTIME_REPORT_VERSION,
    renderTree: normalizeRenderTree(value.renderTree),
    diagnostics,
    sources,
  };
}

function warnOnce(key: number | string, message: string) {
  if (warnedVersions.has(key)) {
    return;
  }

  warnedVersions.add(key);

  console.warn(`[HerbDevTools] ${message}`);
}

export function parseRuntimeReport(text: string | null | undefined): NormalizedRuntimeReport | null {
  if (typeof text !== 'string' || text.trim().length === 0) {
    return null;
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(text);
  } catch (_error) {
    warnOnce('malformed', 'Ignoring a runtime report payload that is not valid JSON.');

    return null;
  }

  return normalizeRuntimeReport(parsed);
}

export function readRuntimeReport(root: ParentNode): NormalizedRuntimeReport | null {
  const script = root.querySelector(RUNTIME_REPORT_SELECTOR);

  if (script === null) {
    return null;
  }

  return parseRuntimeReport(script.textContent);
}

export function resolveRenderNode(tree: RenderTreeNode[], diagnostic: NormalizedDiagnostic): RenderTreeNode | null {
  if (diagnostic.node !== null) {
    const exact = tree.find(node => node.id === diagnostic.node);

    if (exact !== undefined) {
      return exact;
    }
  }

  return tree.find(node => node.template === diagnostic.template) ?? null;
}

export function buildRenderStack(tree: RenderTreeNode[], diagnostic: NormalizedDiagnostic): RenderStackFrame[] {
  const start = diagnostic.location?.start ?? null;
  const node = resolveRenderNode(tree, diagnostic);

  if (node === null) {
    return [{
      template: diagnostic.template,
      via: null,
      line: start?.line ?? null,
      column: start?.column ?? null,
    }];
  }

  const byId = new Map(tree.map(entry => [entry.id, entry]));
  const frames: RenderStackFrame[] = [];
  const visited = new Set<string>();

  let current: RenderTreeNode | null = node;
  let pending: RuntimePosition | null = start;

  while (current !== null && !visited.has(current.id)) {
    visited.add(current.id);

    frames.push({
      template: current.template,
      via: current.via,
      line: pending?.line ?? null,
      column: pending?.column ?? null,
    });

    pending = current.location ?? null;
    current = current.parent === null ? null : byId.get(current.parent) ?? null;
  }

  return frames;
}

export function diagnosticKey(diagnostic: NormalizedDiagnostic): string {
  const line = diagnostic.location?.start.line ?? '';
  const discriminator = diagnostic.code ?? diagnostic.message;

  return [diagnostic.template, line, diagnostic.code ?? '', discriminator].join(' ');
}
