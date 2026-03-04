import './styles.css';
import { HerbOverlay, type HerbDevToolsOptions } from './herb-overlay.js';

export { HerbOverlay };
export type { HerbDevToolsOptions };

export function initHerbDevTools(options: HerbDevToolsOptions = {}): HerbOverlay {
  return new HerbOverlay(options);
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  const hasDebugMode = document.querySelector('meta[name="herb-debug-mode"]')?.getAttribute('content') === 'true';
  const hasDebugErb = document.querySelector('[data-herb-debug-erb]') !== null;
  const hasValidationErrors = document.querySelector('template[data-herb-validation-errors]') !== null;
  const hasValidationError = document.querySelector('template[data-herb-validation-error]') !== null;
  const hasParserErrors = document.querySelector('template[data-herb-parser-error]') !== null;
  const shouldAutoInit = hasDebugMode || hasDebugErb || hasValidationErrors || hasValidationError || hasParserErrors;

  if (shouldAutoInit) {
    document.addEventListener('DOMContentLoaded', () => {
      initHerbDevTools();
    });
  }
}

if (typeof window !== 'undefined') {
  (window as any).HerbDevTools = {
    init: initHerbDevTools,
    HerbOverlay
  };
}
