// DevTools page entry point for Herb DevTools
// This creates the main DevTools panel

/// <reference types="webextension-polyfill" />

const browserAPI = ((globalThis as any).browser || chrome) as typeof chrome;

const panelFile = 'panel.html'
const panelPath = (globalThis as any).browser ? panelFile : `devtools/${panelFile}`;

browserAPI.devtools.panels.create('Herb', '', panelPath, (panel: any) => {
  console.log('Herb DevTools panel created');

  panel.onShown.addListener(() => {
    console.log('Herb DevTools panel shown');
  });

  panel.onHidden.addListener(() => {
    console.log('Herb DevTools panel hidden');
  });
});

browserAPI.devtools.panels.elements.createSidebarPane('Herb', (sidebar: any) => {
  console.log('Herb sidebar pane created');

  const sidebarPath = (globalThis as any).browser ? 'sidebar.html' : 'devtools/sidebar.html';

  sidebar.setPage(sidebarPath);
});

export {};
