import './styles.css';
import { HerbOverlay, type HerbDevToolsOptions } from './herb-overlay.js';
import { ErrorOverlay, type ValidationError, type ValidationData } from './error-overlay.js';
import { RuntimePanel, type RuntimeReportHandle } from './runtime-panel.js';
import { RUNTIME_REPORT_SELECTOR } from './runtime-report.js';

import type { RuntimeDiagnostic, RuntimeReport, RenderTreeNode } from './runtime-report.js';

export { HerbOverlay, ErrorOverlay, RuntimePanel };
export type { HerbDevToolsOptions, ValidationError, ValidationData, RuntimeDiagnostic, RuntimeReport, RenderTreeNode, RuntimeReportHandle };

const NOOP_HANDLE: RuntimeReportHandle = { dismiss() {} };

export function initHerbDevTools(options: HerbDevToolsOptions = {}): HerbOverlay {
  if (typeof window !== 'undefined') {
    const existingOverlay = (window as any).HerbDevTools?._overlay as HerbOverlay | undefined;

    existingOverlay?.destroy();
  }

  const overlay = new HerbOverlay(options);

  if (typeof window !== 'undefined') {
    (window as any).HerbDevTools._overlay = overlay;
    (window as any).HerbDevTools._errorOverlay = (overlay as any).errorOverlay;
    (window as any).HerbDevTools._runtimePanel = overlay.runtimePanel;
  }

  return overlay;
}

function activeRuntimePanel(): RuntimePanel | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const overlay = (window as any).HerbDevTools?._overlay as HerbOverlay | undefined;

  return overlay?.runtimePanel ?? null;
}

export function report(input: RuntimeDiagnostic | RuntimeDiagnostic[]): RuntimeReportHandle {
  return activeRuntimePanel()?.report(input) ?? NOOP_HANDLE;
}

export function clear(origin?: string): void {
  activeRuntimePanel()?.clear(origin);
}

export function show(options: { open?: boolean } = {}): void {
  activeRuntimePanel()?.show(options);
}

function shouldAutoInit(): boolean {
  const hasDebugMode = document.querySelector('meta[name="herb-debug-mode"]')?.getAttribute('content') === 'true';
  const hasDebugErb = document.querySelector('[data-herb-debug-erb]') !== null;
  const hasValidationErrors = document.querySelector('template[data-herb-validation-errors]') !== null;
  const hasValidationError = document.querySelector('template[data-herb-validation-error]') !== null;
  const hasParserErrors = document.querySelector('template[data-herb-parser-error]') !== null;
  const hasOptimizationMismatches = document.querySelector('template[data-herb-optimization-mismatch]') !== null;
  const hasRuntimeReport = document.querySelector(RUNTIME_REPORT_SELECTOR) !== null;

  return hasDebugMode || hasDebugErb || hasValidationErrors || hasValidationError || hasParserErrors || hasOptimizationMismatches || hasRuntimeReport;
}

if (typeof window !== 'undefined') {
  (window as any).HerbDevTools = {
    ...(window as any).HerbDevTools,
    init: initHerbDevTools,
    report,
    clear,
    show,
    HerbOverlay,
    ErrorOverlay,
    RuntimePanel
  };
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      if (shouldAutoInit()) {
        initHerbDevTools();
      }
    });
  } else if (shouldAutoInit()) {
    initHerbDevTools();
  }
}
