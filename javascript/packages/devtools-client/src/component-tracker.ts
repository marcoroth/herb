// Component tracking utilities for automatic component registration

import type { HerbAPI } from './herb-api';
import type { HerbComponentOptions } from './types';

export class ComponentTracker {
  private herbAPI: HerbAPI;
  private mutationObserver?: MutationObserver;
  private autoTrackingEnabled = false;
  private isProcessingMutations = false;

  constructor(herbAPI: HerbAPI) {
    this.herbAPI = herbAPI;
  }

  // Enable automatic component tracking via MutationObserver
  enableAutoTracking(): void {
    if (this.autoTrackingEnabled) return;

    this.autoTrackingEnabled = true;
    this.setupMutationObserver();
    this.scanExistingComponents();
  }

  // Disable automatic component tracking
  disableAutoTracking(): void {
    if (!this.autoTrackingEnabled) return;

    this.autoTrackingEnabled = false;
    this.mutationObserver?.disconnect();
    this.mutationObserver = undefined;
  }

  // Manually track a component by element
  trackComponent(element: HTMLElement, options?: Partial<HerbComponentOptions>): string {
    // Prevent tracking if we're already processing mutations to avoid infinite loops
    if (this.isProcessingMutations) {
      return '';
    }

    const componentName = options?.name ||
                         element.getAttribute('data-component') ||
                         element.tagName.toLowerCase();

    const componentId = options?.id || this.herbAPI.generateComponentId();

    const fullOptions: HerbComponentOptions = {
      id: componentId,
      name: componentName,
      templatePath: options?.templatePath,
      templateSource: options?.templateSource,
      props: options?.props || this.extractPropsFromElement(element),
      state: options?.state
    };

    // Temporarily disable mutation processing while we add our attributes
    this.isProcessingMutations = true;

    try {
      this.herbAPI.registerComponent(element, fullOptions);
    } finally {
      // Re-enable mutation processing after a short delay
      setTimeout(() => {
        this.isProcessingMutations = false;
      }, 10);
    }

    return componentId;
  }

  // Track multiple components
  trackComponents(elements: HTMLElement[], baseOptions?: Partial<HerbComponentOptions>): string[] {
    return elements.map(element => this.trackComponent(element, baseOptions));
  }

  // Untrack a component by element
  untrackComponent(element: HTMLElement): void {
    const componentId = element.getAttribute('data-herb-id');
    if (componentId) {
      this.herbAPI.unregisterComponent(componentId);
    }
  }

  // Update component props/state
  updateComponentData(element: HTMLElement, updates: Partial<HerbComponentOptions>): void {
    const componentId = element.getAttribute('data-herb-id');
    if (componentId) {
      this.herbAPI.updateComponent(componentId, updates);
    }
  }

  // Helper to find all component elements in a root element
  findComponents(root: Element = document.body): HTMLElement[] {
    return Array.from(root.querySelectorAll('[data-component], [data-herb-component]')) as HTMLElement[];
  }

  // Helper to check if an element is already tracked
  isTracked(element: HTMLElement): boolean {
    return !!element.getAttribute('data-herb-id');
  }

  // Decorator function for component methods
  static withTracking(tracker: ComponentTracker) {
    return function(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
      const originalMethod = descriptor.value;

      descriptor.value = function(this: any, element: HTMLElement, ...args: any[]) {
        // Track the component if not already tracked
        if (!tracker.isTracked(element)) {
          tracker.trackComponent(element);
        }

        // Call the original method
        const result = originalMethod.apply(this, [element, ...args]);

        // Update component data if method returns updates
        if (result && typeof result === 'object' && result.componentUpdates) {
          tracker.updateComponentData(element, result.componentUpdates);
        }

        return result;
      };

      return descriptor;
    };
  }

  // Lifecycle hooks for integration with rendering frameworks
  onComponentMount(element: HTMLElement, options?: Partial<HerbComponentOptions>): string {
    return this.trackComponent(element, options);
  }

  onComponentUpdate(element: HTMLElement, updates: Partial<HerbComponentOptions>): void {
    this.updateComponentData(element, updates);
  }

  onComponentUnmount(element: HTMLElement): void {
    this.untrackComponent(element);
  }

  // Private helper methods
  private setupMutationObserver(): void {
    this.mutationObserver = new MutationObserver((mutations) => {
      // Skip processing if we're already tracking to prevent infinite loops
      if (this.isProcessingMutations) {
        return;
      }

      mutations.forEach((mutation) => {
        // Handle added nodes
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node as HTMLElement;
            this.handleElementAdded(element);
          }
        });

        // Handle removed nodes
        mutation.removedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node as HTMLElement;
            this.handleElementRemoved(element);
          }
        });

        // Handle attribute changes - but skip data-herb-id changes to prevent loops
        if (mutation.type === 'attributes' && mutation.target.nodeType === Node.ELEMENT_NODE) {
          const element = mutation.target as HTMLElement;
          const attributeName = mutation.attributeName || '';

          // Skip changes to our own tracking attributes to prevent infinite loops
          if (attributeName !== 'data-herb-id' && attributeName !== 'data-herb-component') {
            this.handleAttributeChange(element, attributeName);
          }
        }
      });
    });

    this.mutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['data-component', 'data-herb-component', 'data-props', 'data-state']
    });
  }

  private scanExistingComponents(): void {
    const existingComponents = this.findComponents();
    existingComponents.forEach(element => {
      if (!this.isTracked(element)) {
        this.trackComponent(element);
      }
    });
  }

  private handleElementAdded(element: HTMLElement): void {
    // Check if the element itself is a component
    if (this.isComponentElement(element) && !this.isTracked(element)) {
      this.trackComponent(element);
    }

    // Check for component children
    const childComponents = this.findComponents(element);
    childComponents.forEach(child => {
      if (!this.isTracked(child)) {
        this.trackComponent(child);
      }
    });
  }

  private handleElementRemoved(element: HTMLElement): void {
    // Untrack the element if it was tracked
    if (this.isTracked(element)) {
      this.untrackComponent(element);
    }

    // Untrack any child components
    const childComponents = this.findComponents(element);
    childComponents.forEach(child => {
      if (this.isTracked(child)) {
        this.untrackComponent(child);
      }
    });
  }

  private handleAttributeChange(element: HTMLElement, attributeName: string): void {
    if (!this.isTracked(element)) return;

    const componentId = element.getAttribute('data-herb-id');
    if (!componentId) return;

    switch (attributeName) {
      case 'data-props':
        const props = this.extractPropsFromElement(element);
        this.herbAPI.updateComponent(componentId, { props });
        break;

      case 'data-state':
        const state = this.extractStateFromElement(element);
        this.herbAPI.updateComponent(componentId, { state });
        break;

      case 'data-component':
      case 'data-herb-component':
        const name = element.getAttribute('data-component') ||
                    element.getAttribute('data-herb-component') ||
                    element.tagName.toLowerCase();
        this.herbAPI.updateComponent(componentId, { name });
        break;
    }
  }

  private isComponentElement(element: HTMLElement): boolean {
    return !!(
      element.getAttribute('data-component') ||
      element.getAttribute('data-herb-component') ||
      element.hasAttribute('data-track-component')
    );
  }

  private extractPropsFromElement(element: HTMLElement): Record<string, any> {
    const propsAttr = element.getAttribute('data-props');
    if (propsAttr) {
      try {
        return JSON.parse(propsAttr);
      } catch (error) {
        console.warn('Failed to parse component props:', error);
      }
    }

    // Fallback: extract data-* attributes as props
    const props: Record<string, any> = {};
    Array.from(element.attributes).forEach(attr => {
      if (attr.name.startsWith('data-') &&
          !attr.name.startsWith('data-herb-') &&
          !['data-component', 'data-props', 'data-state'].includes(attr.name)) {
        const propName = attr.name.substring(5); // Remove 'data-' prefix
        props[propName] = attr.value;
      }
    });

    return props;
  }

  private extractStateFromElement(element: HTMLElement): Record<string, any> {
    const stateAttr = element.getAttribute('data-state');
    if (stateAttr) {
      try {
        return JSON.parse(stateAttr);
      } catch (error) {
        console.warn('Failed to parse component state:', error);
      }
    }
    return {};
  }
}
