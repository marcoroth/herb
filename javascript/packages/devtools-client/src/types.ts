export interface HerbComponent {
  id: string;
  name: string;
  templatePath?: string;
  templateSource?: string;
  props?: Record<string, any>;
  state?: Record<string, any>;
  element?: HTMLElement;
  parent?: HerbComponent;
  children?: HerbComponent[];
}

export interface HerbComponentOptions {
  id: string;
  name: string;
  templatePath?: string;
  templateSource?: string;
  props?: Record<string, any>;
  state?: Record<string, any>;
}

export interface HerbDevToolsMessage {
  type: string;
  source: 'herb-devtools';
  data?: any;
}

export interface HerbDevToolsAPI {
  version: string;
  components: Map<string, HerbComponent>;

  registerComponent(element: HTMLElement, options: HerbComponentOptions): void;
  unregisterComponent(id: string): void;
  updateComponent(id: string, updates: Partial<HerbComponentOptions>): void;

  getComponent(id: string): HerbComponent | undefined;
  getAllComponents(): HerbComponent[];
  getComponentsByName(name: string): HerbComponent[];

  getTemplateSource(id: string): string | undefined;
  setTemplateSource(id: string, source: string): void;

  enableDevTools(): void;
  disableDevTools(): void;
  sendToDevTools(message: HerbDevToolsMessage): void;

  on(event: string, callback: Function): void;
  off(event: string, callback: Function): void;
  emit(event: string, data?: any): void;
}

export interface HerbGlobal extends HerbDevToolsAPI {
  __HERB_DEVTOOLS_CLIENT__: boolean;

  tracker: any;
  templates: any;
  track: (element: HTMLElement, options?: Partial<HerbComponentOptions>) => string;
  untrack: (element: HTMLElement) => void;
  mount: (element: HTMLElement, options?: Partial<HerbComponentOptions>) => string;
  unmount: (element: HTMLElement) => void;
  update: (element: HTMLElement, updates: Partial<HerbComponentOptions>) => void;
  registerTemplate: (id: string, source: string, options?: { path?: string; language?: 'erb' | 'html' }) => void;
  linkTemplate: (templateId: string, componentId: string) => void;
  enableAutoTracking: () => void;
  disableAutoTracking: () => void;
  enableHotReload: () => void;
  devToolsEnabled?: boolean;
  debug: {
    logComponents: () => void;
    highlightAll: () => void;
    clearHighlights: () => void;
  };
}

declare global {
  interface Window {
    __HERB__?: HerbGlobal;
    __HERB_DEVTOOLS__?: {
      sendToDevTools(message: any): void;
    };
  }
}
