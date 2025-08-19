// Main DevTools panel implementation for Herb
// This is the primary interface for inspecting Herb/Herb applications

/// <reference types="webextension-polyfill" />

interface HerbComponent {
  id: string;
  component: string;
  element: string;
  props?: Record<string, any>;
  children?: HerbComponent[];
}

interface PageInfo {
  url: string;
  title: string;
  hasHerb: boolean;
  components: HerbComponent[];
}

class HerbDevToolsPanel {
  private port: chrome.runtime.Port | null = null;
  private tabId: number = -1;
  private pageInfo: PageInfo | null = null;
  private selectedComponent: HerbComponent | null = null;

  constructor() {
    this.init();
  }

  private async init() {
    const browserAPI = ((globalThis as any).browser || chrome) as typeof chrome;

    this.tabId = browserAPI.devtools.inspectedWindow.tabId;

    this.connectToBackground();
    this.initializeUI();
    this.requestPageInfo();
  }

  private connectToBackground() {
    const browserAPI = ((globalThis as any).browser || chrome) as typeof chrome;
    this.port = browserAPI.runtime.connect({
      name: `herb-devtools-panel-${this.tabId}`
    });

    this.port?.postMessage({
      name: 'init-devtools',
      tabId: this.tabId
    });

    this.port?.onMessage.addListener((message) => {
      this.handleMessage(message);
    });

    this.port?.onDisconnect.addListener(() => {
      this.port = null;
      this.showConnectionError();
    });
  }

  private handleMessage(message: any) {
    switch (message.name) {
      case 'content-script-ready':
        this.showConnectionStatus(true);
        this.requestPageInfo();
        break;

      case 'herb-detected':
        this.handleHerbDetected(message.data);
        break;

      case 'page-info':
        this.handlePageInfo(message.data);
        break;

      default:
        console.log('Unknown message:', message);
    }
  }

  private requestPageInfo() {
    if (this.port) {
      this.port.postMessage({
        name: 'get-page-info',
        tabId: this.tabId
      });
    }
  }

  private handleHerbDetected(data: any) {
    this.showHerbStatus(true, data);
  }

  private handlePageInfo(data: PageInfo) {
    this.pageInfo = data;
    this.updateComponentTree();
    this.updatePageInfo();
  }

  private initializeUI() {
    document.body.innerHTML = `
      <div class="herb-devtools">
        <div class="herb-header">
          <div class="herb-logo">
            <h1>🌿 Herb DevTools</h1>
            <div class="herb-version">v0.5.0</div>
          </div>
          <div class="herb-status" id="status">
            <span class="status-indicator" id="connection-status">●</span>
            <span id="status-text">Connecting...</span>
          </div>
        </div>

        <div class="herb-main">
          <div class="herb-sidebar">
            <div class="herb-section">
              <h3>Page Information</h3>
              <div id="page-info" class="herb-info-panel">
                <p>Loading...</p>
              </div>
            </div>

            <div class="herb-section">
              <h3>Component Tree</h3>
              <div id="component-tree" class="herb-tree">
                <p>No components found</p>
              </div>
            </div>
          </div>

          <div class="herb-content">
            <div class="herb-section">
              <h3>Component Inspector</h3>
              <div id="component-inspector" class="herb-inspector">
                <p>Select a component to inspect</p>
              </div>
            </div>

            <div class="herb-section">
              <h3>Template Source</h3>
              <div id="template-source" class="herb-code">
                <pre><code>Select a component to view its template</code></pre>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    this.applyStyles();
    this.attachEventListeners();
  }

  private applyStyles() {
    const style = document.createElement('style');
    style.textContent = `
      * {
        box-sizing: border-box;
        margin: 0;
        padding: 0;
      }

      body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 13px;
        line-height: 1.4;
        color: #333;
        background: #f8f9fa;
      }

      .herb-devtools {
        height: 100vh;
        display: flex;
        flex-direction: column;
      }

      .herb-header {
        background: #fff;
        border-bottom: 1px solid #e1e5e9;
        padding: 8px 16px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        flex-shrink: 0;
      }

      .herb-logo {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .herb-logo h1 {
        font-size: 16px;
        font-weight: 600;
        color: #2d3748;
      }

      .herb-version {
        background: #e2e8f0;
        color: #4a5568;
        padding: 2px 6px;
        border-radius: 4px;
        font-size: 11px;
      }

      .herb-status {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 12px;
      }

      .status-indicator {
        color: #f56565;
        font-size: 16px;
      }

      .status-indicator.connected {
        color: #48bb78;
      }

      .herb-main {
        flex: 1;
        display: flex;
        min-height: 0;
      }

      .herb-sidebar {
        width: 300px;
        background: #fff;
        border-right: 1px solid #e1e5e9;
        overflow-y: auto;
        flex-shrink: 0;
      }

      .herb-content {
        flex: 1;
        background: #fff;
        overflow-y: auto;
      }

      .herb-section {
        border-bottom: 1px solid #e1e5e9;
      }

      .herb-section h3 {
        background: #f7fafc;
        padding: 8px 16px;
        font-size: 12px;
        font-weight: 600;
        color: #4a5568;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }

      .herb-info-panel,
      .herb-tree,
      .herb-inspector,
      .herb-code {
        padding: 16px;
      }

      .herb-tree {
        max-height: 300px;
        overflow-y: auto;
      }

      .herb-code {
        background: #f8f9fa;
        font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
        font-size: 12px;
      }

      .herb-code pre {
        margin: 0;
        white-space: pre-wrap;
      }

      .component-item {
        padding: 4px 8px;
        cursor: pointer;
        border-radius: 4px;
        margin: 2px 0;
      }

      .component-item:hover {
        background: #edf2f7;
      }

      .component-item.selected {
        background: #bee3f8;
        color: #2b6cb0;
      }

      .component-id {
        font-weight: 600;
      }

      .component-type {
        color: #718096;
        font-size: 11px;
      }
    `;
    document.head.appendChild(style);
  }

  private attachEventListeners() {
    const refreshButton = document.createElement('button');

    refreshButton.textContent = 'Refresh';
    refreshButton.onclick = () => this.requestPageInfo();

    document.querySelector('.herb-header')?.appendChild(refreshButton);
  }

  private showConnectionStatus(connected: boolean) {
    const indicator = document.getElementById('connection-status');
    const text = document.getElementById('status-text');

    if (indicator && text) {
      if (connected) {
        indicator.className = 'status-indicator connected';
        text.textContent = 'Connected';
      } else {
        indicator.className = 'status-indicator';
        text.textContent = 'Disconnected';
      }
    }
  }

  private showConnectionError() {
    this.showConnectionStatus(false);
    const pageInfo = document.getElementById('page-info');

    if (pageInfo) {
      pageInfo.innerHTML = '<p>Connection lost. Please refresh the page.</p>';
    }
  }

  private showHerbStatus(detected: boolean, data: any) {
    const info = document.getElementById('page-info');

    if (!info) return;

    if (detected) {
      info.innerHTML = `
        <p><strong>Herb Detected</strong></p>
        <p>Version: ${data.version || 'Unknown'}</p>
        <p>Herb Version: ${data.herbVersion || 'Unknown'}</p>
        <p>Components: ${data.hasComponents ? 'Yes' : 'No'}</p>
      `;
    } else {
      info.innerHTML = '<p>Herb not detected on this page</p>';
    }
  }

  private updatePageInfo() {
    if (!this.pageInfo) return;

    const info = document.getElementById('page-info');

    if (!info) return;

    info.innerHTML = `
      <p><strong>URL:</strong> ${this.pageInfo.url}</p>
      <p><strong>Title:</strong> ${this.pageInfo.title}</p>
      <p><strong>Herb:</strong> ${this.pageInfo.hasHerb ? 'Yes' : 'No'}</p>
      <p><strong>Components:</strong> ${this.pageInfo.components.length}</p>
    `;
  }

  private updateComponentTree() {
    if (!this.pageInfo) return;

    const tree = document.getElementById('component-tree');
    if (!tree) return;

    if (this.pageInfo.components.length === 0) {
      tree.innerHTML = '<p>No components found</p>';
      return;
    }

    const componentItems = this.pageInfo.components.map(component => `
      <div class="component-item" data-component-id="${component.id}">
        <div class="component-id">${component.component || component.element}</div>
        <div class="component-type">${component.element} #${component.id}</div>
      </div>
    `).join('');

    tree.innerHTML = componentItems;

    tree.querySelectorAll('.component-item').forEach(item => {
      item.addEventListener('click', () => {
        const componentId = (item as HTMLElement).dataset.componentId;
        if (componentId) {
          this.selectComponent(componentId);
        }
      });
    });
  }

  private selectComponent(componentId: string) {
    const component = this.pageInfo?.components.find(c => c.id === componentId);
    if (!component) return;

    this.selectedComponent = component;

    document.querySelectorAll('.component-item').forEach(item => {
      item.classList.remove('selected');
    });

    document.querySelector(`[data-component-id="${componentId}"]`)?.classList.add('selected');

    this.updateComponentInspector();
  }

  private updateComponentInspector() {
    if (!this.selectedComponent) return;

    const inspector = document.getElementById('component-inspector');
    const templateSource = document.getElementById('template-source');

    if (!inspector || !templateSource) return;

    inspector.innerHTML = `
      <h4>${this.selectedComponent.component || this.selectedComponent.element}</h4>
      <p><strong>ID:</strong> ${this.selectedComponent.id}</p>
      <p><strong>Element:</strong> ${this.selectedComponent.element}</p>
      ${this.selectedComponent.props ? `<p><strong>Props:</strong> ${JSON.stringify(this.selectedComponent.props)}</p>` : ''}
    `;

    templateSource.innerHTML = `
      <pre><code>// Template source will be available when devtools-client is implemented
// Component: ${this.selectedComponent.component || this.selectedComponent.element}
// ID: ${this.selectedComponent.id}</code></pre>
    `;
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => new HerbDevToolsPanel());
} else {
  new HerbDevToolsPanel();
}

export {};
