// Content script bridge for Herb DevTools
// Connects the DevTools extension to the page's Herb application

/// <reference types="webextension-polyfill" />

interface DevToolsMessage {
  name: string;
  tabId?: number;
  data?: any;
}

class HerbDevToolsContentScript {
  private port: chrome.runtime.Port | null = null;
  private tabId: number = -1;
  private isHerbDetected = false;

  constructor() {
    this.init();
  }

  private async init() {
    this.tabId = await this.getTabId();

    this.connectToBackground();
    this.detectHerb();
    this.setupPageCommunication();
  }

  private async getTabId(): Promise<number> {
    return new Promise((resolve) => {
      const browserAPI = ((globalThis as any).browser || chrome) as typeof chrome;
      browserAPI.runtime.sendMessage({ name: 'get-tab-id' }, (response) => {
        resolve(response?.tabId || -1);
      });
    });
  }

  private connectToBackground() {
    const browserAPI = ((globalThis as any).browser || chrome) as typeof chrome;
    this.port = browserAPI.runtime.connect({
      name: `herb-devtools-content-${this.tabId}`
    });

    this.port?.postMessage({
      name: 'init-content-script',
      tabId: this.tabId
    });

    this.port?.onMessage.addListener((message: DevToolsMessage) => {
      this.handleDevToolsMessage(message);
    });

    this.port?.onDisconnect.addListener(() => {
      this.port = null;
    });
  }

  private detectHerb() {
    const checkForHerb = () => {
      const hasHerb = !!(window as any).__HERB__;
      const hasHerbElements = document.querySelector('[data-herb-component]') !== null;
      const hasHerbMeta = document.querySelector('meta[name="herb"]') !== null;

      if (hasHerb || hasHerbElements || hasHerbMeta) {
        this.isHerbDetected = true;
        this.sendToDevTools({
          name: 'herb-detected',
          data: {
            version: (window as any).__HERB__?.version,
            herbVersion: (window as any).__HERB__?.version,
            hasComponents: hasHerbElements
          }
        });
      }
    };

    checkForHerb();

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', checkForHerb);
    }

    setInterval(checkForHerb, 2000);
  }

  private setupPageCommunication() {
    const browserAPI = ((globalThis as any).browser || chrome) as typeof chrome;
    const script = document.createElement('script');
    script.src = browserAPI.runtime.getURL('injected-script.js');
    script.onload = () => {
      script.remove();
    };

    (document.head || document.documentElement).appendChild(script);

    window.addEventListener('message', (event) => {
      if (event.data?.source === 'herb-devtools') {
        this.sendToDevTools(event.data);
      }
    });
  }

  private handleDevToolsMessage(message: DevToolsMessage) {
    switch (message.name) {
      case 'get-page-info':
        this.sendPageInfo();
        break;
      case 'refresh-components':
        this.refreshComponentTree();
        break;
      case 'inspect-element':
        this.inspectElement(message.data);
        break;
      default:
        window.postMessage({
          source: 'herb-devtools-command',
          ...message
        }, '*');
    }
  }

  private sendToDevTools(message: DevToolsMessage) {
    if (this.port) {
      this.port.postMessage({
        ...message,
        tabId: this.tabId
      });
    }
  }

  private sendPageInfo() {
    this.sendToDevTools({
      name: 'page-info',
      data: {
        url: window.location.href,
        title: document.title,
        hasHerb: this.isHerbDetected,
        components: this.getComponentList()
      }
    });
  }

  private getComponentList() {
    const components = Array.from(document.querySelectorAll('[data-herb-component]')).map(element => ({
      id: element.getAttribute('data-herb-id'),
      component: element.getAttribute('data-herb-component'),
      element: element.tagName.toLowerCase()
    }));

    return components;
  }

  private refreshComponentTree() {
    this.sendPageInfo();
  }

  private inspectElement(data: any) {
    if (data.selector) {
      const element = document.querySelector(data.selector);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }
}

new HerbDevToolsContentScript();

export {};
