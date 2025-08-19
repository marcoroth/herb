declare global {
  var browser: typeof chrome | undefined;
}

declare namespace chrome {
  namespace devtools {
    namespace panels {
      interface Panel {
        onShown: chrome.events.Event<() => void>;
        onHidden: chrome.events.Event<() => void>;
      }

      interface ExtensionSidebarPane {
        setPage(path: string): void;
      }
    }
  }

  namespace tabs {
    interface TabChangeInfo {
      status?: string;
    }
  }
}

export {};
