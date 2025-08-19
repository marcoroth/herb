// Injected script that runs in the page context
// This bridges between the page's Herb/Herb instance and the content script

(function() {
  (window as any).__HERB_DEVTOOLS__ = {
    sendToDevTools: function(message: any) {
      window.postMessage({
        source: 'herb-devtools',
        ...message
      }, '*');
    }
  };

  window.addEventListener('message', function(event) {
    if (event.data.source === 'herb-devtools-command') {
      console.log('DevTools command received:', event.data);
    }
  });

  const herb = (window as any).__HERB__;

  if (herb) {
    herb.enableDevTools?.();
  }
})();

export {};
