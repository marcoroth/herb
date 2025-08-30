import './styles.css';
import { HerbOverlay, type HerbDevToolsOptions } from './herb-overlay.js';

export { HerbOverlay };
export type { HerbDevToolsOptions };

export function initHerbDevTools(options: HerbDevToolsOptions = {}): HerbOverlay {
  return new HerbOverlay(options);
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  const shouldAutoInit = document.querySelector('meta[name="herb-debug-mode"]')?.getAttribute('content') === 'true' || document.querySelector('[data-herb-debug-erb]') !== null;

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
