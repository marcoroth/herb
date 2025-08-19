// Background script for Herb DevTools
// Manages connection between DevTools panel and content scripts
// Works in both Chrome (service worker) and Firefox (background script)

/// <reference types="webextension-polyfill" />

interface DevToolsPort {
  postMessage(message: any): void;
  onMessage: {
    addListener(callback: (message: any) => void): void;
  };
  onDisconnect: {
    addListener(callback: () => void): void;
  };
  name: string;
}

interface TabConnections {
  [tabId: number]: {
    devtools?: DevToolsPort;
    contentScript?: DevToolsPort;
  };
}

const connections: TabConnections = {};

const browserAPI = ((globalThis as any).browser || chrome) as typeof chrome;

browserAPI.runtime.onConnect.addListener((port: DevToolsPort) => {
  const extensionListener = (message: any) => {
    const tabId = message.tabId;

    if (message.name === 'init-devtools') {
      connections[tabId] = connections[tabId] || {};
      connections[tabId].devtools = port;

      if (connections[tabId].contentScript) {
        connections[tabId].devtools?.postMessage({
          name: 'content-script-ready',
          tabId: tabId
        });
      }
    } else if (message.name === 'init-content-script') {
      connections[tabId] = connections[tabId] || {};
      connections[tabId].contentScript = port;

      if (connections[tabId].devtools) {
        connections[tabId].devtools?.postMessage({
          name: 'content-script-ready',
          tabId: tabId
        });
      }
    } else {
      if (connections[tabId]) {
        if (port === connections[tabId].devtools && connections[tabId].contentScript) {
          connections[tabId].contentScript?.postMessage(message);
        } else if (port === connections[tabId].contentScript && connections[tabId].devtools) {
          connections[tabId].devtools?.postMessage(message);
        }
      }
    }
  };

  port.onMessage.addListener(extensionListener);

  port.onDisconnect.addListener(() => {
    try {
      (port.onMessage as any).removeListener?.(extensionListener);
    } catch (e) {
      console.error(e) // TODO
    }

    Object.keys(connections).forEach(tabIdStr => {
      const tabId = parseInt(tabIdStr);
      if (connections[tabId]) {
        if (connections[tabId].devtools === port) {
          delete connections[tabId].devtools;
        }
        if (connections[tabId].contentScript === port) {
          delete connections[tabId].contentScript;
        }

        if (!connections[tabId].devtools && !connections[tabId].contentScript) {
          delete connections[tabId];
        }
      }
    });
  });
});

browserAPI.tabs?.onUpdated?.addListener((tabId: number, changeInfo: any) => {
  if (changeInfo.status === 'loading' && connections[tabId]) {
    delete connections[tabId].contentScript;
  }
});

browserAPI.tabs?.onRemoved?.addListener((tabId: number) => {
  delete connections[tabId];
});

browserAPI.runtime.onMessage.addListener((message: any, sender: any, sendResponse: any) => {
  if (message.name === 'get-tab-id' && sender.tab?.id) {
    sendResponse({ tabId: sender.tab.id });
    return true;
  }
});

export {};
