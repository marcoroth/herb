import './styles.css';
import { HerbOverlay, type HerbDevToolsOptions } from './herb-overlay.js';
import { startDevServerClient } from './dev-server/dev-server.js';
import { ErrorOverlay, type ValidationError, type ValidationData } from './error-overlay.js';

export { HerbOverlay, ErrorOverlay };
export { HerbClient, initHerbClient, getHerbClient, startDevServerClient } from './dev-server/dev-server.js';
export { Connection } from './dev-server/connection.js';
export { applyPatch } from './dev-server/patch.js';

export type { HerbDevToolsOptions, ValidationError, ValidationData };

/**
 * Both halves of the development experience, either of which can be left out.
 *
 * They were separate packages, which meant a project chose between them by choosing what to
 * install. Neither ships to production, so there was no bundle to keep lean by splitting them, and
 * the overlay already draws the connection's state. An option is the cheaper seam.
 */
export function initHerbDevTools(options: HerbDevToolsOptions = {}): HerbOverlay | null {
  if (options.devServer !== false) startDevServerClient();

  if (typeof window !== 'undefined') {
    const existingOverlay = (window as any).HerbDevTools?._overlay as HerbOverlay | undefined;

    existingOverlay?.destroy();
  }

  if (options.overlay === false) return null;

  const overlay = new HerbOverlay(options);

  if (typeof window !== 'undefined') {
    (window as any).HerbDevTools._overlay = overlay;
    (window as any).HerbDevTools._errorOverlay = (overlay as any).errorOverlay;
  }

  return overlay;
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  const hasDebugMode = document.querySelector('meta[name="herb-debug-mode"]')?.getAttribute('content') === 'true';
  const hasDebugErb = document.querySelector('[data-herb-debug-erb]') !== null;
  const hasValidationErrors = document.querySelector('template[data-herb-validation-errors]') !== null;
  const hasValidationError = document.querySelector('template[data-herb-validation-error]') !== null;
  const hasParserErrors = document.querySelector('template[data-herb-parser-error]') !== null;
  const hasOptimizationMismatches = document.querySelector('template[data-herb-optimization-mismatch]') !== null;
  const shouldAutoInit = hasDebugMode || hasDebugErb || hasValidationErrors || hasValidationError || hasParserErrors || hasOptimizationMismatches;

  if (shouldAutoInit) {
    document.addEventListener('DOMContentLoaded', () => {
      initHerbDevTools();
    });
  }
}

if (typeof window !== 'undefined') {
  (window as any).HerbDevTools = {
    init: initHerbDevTools,
    HerbOverlay,
    ErrorOverlay
  };
}
