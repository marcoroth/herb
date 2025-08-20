import { HerbAPI } from './herb-api';
import { ComponentTracker } from './component-tracker';
import { TemplateManager } from './template-manager';
import type { HerbGlobal, HerbComponent, HerbComponentOptions } from './types';

export { HerbAPI, ComponentTracker, TemplateManager };
export type { HerbGlobal, HerbComponent, HerbComponentOptions };

const herbAPI = new HerbAPI();
const componentTracker = new ComponentTracker(herbAPI);
const templateManager = new TemplateManager(herbAPI);

const herbGlobal: HerbGlobal = Object.assign(herbAPI, {
  __HERB_DEVTOOLS_CLIENT__: true,

  tracker: componentTracker,
  templates: templateManager,

  track: (element: HTMLElement, options?: Partial<HerbComponentOptions>) => componentTracker.trackComponent(element, options),
  untrack: (element: HTMLElement) => componentTracker.untrackComponent(element),

  mount: (element: HTMLElement, options?: Partial<HerbComponentOptions>) => componentTracker.onComponentMount(element, options),
  unmount: (element: HTMLElement) => componentTracker.onComponentUnmount(element),

  update: (element: HTMLElement, updates: Partial<HerbComponentOptions>) => componentTracker.onComponentUpdate(element, updates),

  registerTemplate: (id: string, source: string, options?: { path?: string; language?: 'erb' | 'html' }) => templateManager.registerTemplate(id, source, options),

  linkTemplate: (templateId: string, componentId: string) => templateManager.linkTemplateToComponent(templateId, componentId),

  enableAutoTracking: () => componentTracker.enableAutoTracking(),
  disableAutoTracking: () => componentTracker.disableAutoTracking(),

  enableHotReload: () => templateManager.enableHotReload(),

  debug: {
    logComponents: () => {
      console.table(Array.from(herbAPI.components.values()).map(c => ({
        id: c.id,
        name: c.name,
        element: c.element?.tagName,
        props: Object.keys(c.props || {}).join(', '),
        hasTemplate: !!c.templateSource
      })));
    },

    highlightAll: () => {
      herbAPI.getAllComponents().forEach(component => {
        if (component.element) {
          component.element.style.outline = '1px solid red';
        }
      });
    },

    clearHighlights: () => {
      herbAPI.getAllComponents().forEach(component => {
        if (component.element) {
          component.element.style.outline = '';
        }
      });
    }
  }
});

function initializeHerbDevTools(): HerbGlobal {
  window.__HERB__ = herbGlobal;

  if (window.__HERB_DEVTOOLS__) {
    herbGlobal.enableDevTools();
  }

  const checkForDevTools = () => {
    if (window.__HERB_DEVTOOLS__ && !herbGlobal.devToolsEnabled) {
      herbGlobal.enableDevTools();
    }
  };

  setInterval(checkForDevTools, 1000);

  console.log('🌿 Herb DevTools Client initialized');

  return herbGlobal;
}

export const HerbDevTools = {
  init: (options?: {
    autoTrack?: boolean;
    hotReload?: boolean;
    debug?: boolean;
  }) => {
    const herb = initializeHerbDevTools();

    if (options?.autoTrack !== false) {
      herb.enableAutoTracking();
    }

    if (options?.hotReload) {
      herb.enableHotReload();
    }

    if (options?.debug) {
      (window as any).HerbDebug = herb.debug;
      console.log('🌿 Herb DevTools debug utilities available as window.HerbDebug');
    }

    return herb;
  },
};

export default herbGlobal;

if (process.env.NODE_ENV === 'development') {
  if (!window.__HERB_DEVTOOLS__) {
    console.warn(
      '🌿 Herb DevTools Client is loaded but no DevTools extension detected.\n' +
      'Install the Herb DevTools browser extension to enable component inspection.'
    );
  }
}
