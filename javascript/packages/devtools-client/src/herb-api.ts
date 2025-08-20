import type {
  HerbComponent,
  HerbComponentOptions,
  HerbDevToolsMessage,
  HerbDevToolsAPI
} from './types';

export class HerbAPI implements HerbDevToolsAPI {
  public readonly version = '0.5.0';
  public readonly components = new Map<string, HerbComponent>();

  public devToolsEnabled = false;
  private eventListeners = new Map<string, Set<Function>>();
  private componentIdCounter = 0;

  constructor() {
    this.setupDevToolsDetection();
  }

  registerComponent(element: HTMLElement, options: HerbComponentOptions): void {
    const component: HerbComponent = {
      ...options,
      element,
      children: [],
    };

    element.setAttribute('data-herb-component', options.name);
    element.setAttribute('data-herb-id', options.id);

    this.components.set(options.id, component);

    this.updateComponentHierarchy(component);

    if (this.devToolsEnabled) {
      this.sendToDevTools({
        type: 'component-registered',
        source: 'herb-devtools',
        data: {
          id: options.id,
          name: options.name,
          props: options.props,
          state: options.state
        }
      });
    }

    this.emit('component:registered', component);
  }

  unregisterComponent(id: string): void {
    const component = this.components.get(id);
    if (!component) return;

    if (component.element) {
      component.element.removeAttribute('data-herb-component');
      component.element.removeAttribute('data-herb-id');
    }

    if (component.parent) {
      const index = component.parent.children?.indexOf(component) ?? -1;
      if (index > -1) {
        component.parent.children?.splice(index, 1);
      }
    }

    this.components.delete(id);

    if (this.devToolsEnabled) {
      this.sendToDevTools({
        type: 'component-unregistered',
        source: 'herb-devtools',
        data: { id }
      });
    }

    this.emit('component:unregistered', { id });
  }

  updateComponent(id: string, updates: Partial<HerbComponentOptions>): void {
    const component = this.components.get(id);
    if (!component) return;

    Object.assign(component, updates);

    if (updates.name && component.element) {
      component.element.setAttribute('data-herb-component', updates.name);
    }

    if (this.devToolsEnabled) {
      this.sendToDevTools({
        type: 'component-updated',
        source: 'herb-devtools',
        data: { id, updates }
      });
    }

    this.emit('component:updated', { id, updates });
  }

  getComponent(id: string): HerbComponent | undefined {
    return this.components.get(id);
  }

  getAllComponents(): HerbComponent[] {
    return Array.from(this.components.values());
  }

  getComponentsByName(name: string): HerbComponent[] {
    return this.getAllComponents().filter(component => component.name === name);
  }

  getTemplateSource(id: string): string | undefined {
    const component = this.components.get(id);
    return component?.templateSource;
  }

  setTemplateSource(id: string, source: string): void {
    const component = this.components.get(id);
    if (component) {
      component.templateSource = source;
      this.emit('template:updated', { id, source });
    }
  }

  enableDevTools(): void {
    this.devToolsEnabled = true;

    this.sendToDevTools({
      type: 'herb-initialized',
      source: 'herb-devtools',
      data: {
        version: this.version,
        componentCount: this.components.size,
        components: this.getAllComponents().map(c => ({
          id: c.id,
          name: c.name,
          props: c.props,
          state: c.state
        }))
      }
    });

    this.emit('devtools:enabled');
  }

  disableDevTools(): void {
    this.devToolsEnabled = false;
    this.emit('devtools:disabled');
  }

  sendToDevTools(message: HerbDevToolsMessage): void {
    if (!this.devToolsEnabled) return;

    if (window.__HERB_DEVTOOLS__) {
      window.__HERB_DEVTOOLS__.sendToDevTools(message);
    }
  }

  on(event: string, callback: Function): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }

    this.eventListeners.get(event)!.add(callback);
  }

  off(event: string, callback: Function): void {
    const listeners = this.eventListeners.get(event);

    if (listeners) {
      listeners.delete(callback);
    }
  }

  emit(event: string, data?: any): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in event listener for ${event}:`, error);
        }
      });
    }
  }

  private setupDevToolsDetection(): void {
    window.addEventListener('message', (event) => {
      if (event.data?.source === 'herb-devtools-command') {
        this.handleDevToolsCommand(event.data);
      }
    });
  }

  private handleDevToolsCommand(command: any): void {
    switch (command.type) {
      case 'get-components':
        this.sendToDevTools({
          type: 'components-response',
          source: 'herb-devtools',
          data: {
            components: this.getAllComponents().map(c => ({
              id: c.id,
              name: c.name,
              element: c.element?.tagName.toLowerCase(),
              props: c.props,
              state: c.state
            }))
          }
        });
        break;

      case 'get-component':
        const component = this.getComponent(command.data?.id);
        if (component) {
          this.sendToDevTools({
            type: 'component-response',
            source: 'herb-devtools',
            data: {
              id: component.id,
              name: component.name,
              element: component.element?.tagName.toLowerCase(),
              props: component.props,
              state: component.state,
              templateSource: component.templateSource
            }
          });
        }
        break;

      case 'highlight-component':
        this.highlightComponent(command.data?.id);
        break;
    }
  }

  private updateComponentHierarchy(component: HerbComponent): void {
    if (!component.element) return;

    let parentElement = component.element.parentElement;

    while (parentElement) {
      const parentId = parentElement.getAttribute('data-herb-id');

      if (parentId) {
        const parentComponent = this.components.get(parentId);

        if (parentComponent) {
          component.parent = parentComponent;

          if (!parentComponent.children) {
            parentComponent.children = [];
          }

          parentComponent.children.push(component);

          break;
        }
      }

      parentElement = parentElement.parentElement;
    }
  }

  private highlightComponent(id: string): void {
    const component = this.components.get(id);
    if (component?.element) {
      const originalStyle = component.element.style.cssText;
      component.element.style.cssText += '; outline: 2px solid #007acc !important; outline-offset: 2px !important;';

      setTimeout(() => {
        if (component.element) {
          component.element.style.cssText = originalStyle;
        }
      }, 2000);

      component.element.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
        inline: 'center'
      });
    }
  }

  generateComponentId(): string {
    return `herb-component-${++this.componentIdCounter}`;
  }
}
