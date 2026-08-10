import { SyntaxRenderer, generateStylesheet, resolveTheme } from '@herb-tools/highlighter';

export const HIGHLIGHTER_THEME = 'onedark';
export const HIGHLIGHTER_STYLE_ID = 'herb-highlighter-styles';

let highlighterSetup: Promise<SyntaxRenderer | null> | null = null;
let styleHolders = 0;

export function loadHighlighter(): Promise<SyntaxRenderer | null> {
  if (!highlighterSetup) {
    highlighterSetup = (async () => {
      const { Herb } = await import('@herb-tools/browser');
      const renderer = new SyntaxRenderer(resolveTheme(HIGHLIGHTER_THEME), Herb);

      await renderer.initialize();

      return renderer;
    })().catch((error) => {
      console.warn('[HerbDevTools] Syntax highlighting unavailable:', error);

      return null;
    });
  }

  return highlighterSetup;
}

export function retainHighlighterStyles() {
  styleHolders += 1;

  if (document.getElementById(HIGHLIGHTER_STYLE_ID)) {
    return;
  }

  const style = document.createElement('style');

  style.id = HIGHLIGHTER_STYLE_ID;
  style.textContent = generateStylesheet(resolveTheme(HIGHLIGHTER_THEME), HIGHLIGHTER_THEME);

  document.head.appendChild(style);
}

export function releaseHighlighterStyles() {
  styleHolders = Math.max(0, styleHolders - 1);

  if (styleHolders === 0) {
    document.getElementById(HIGHLIGHTER_STYLE_ID)?.remove();
  }
}
