import { ErrorOverlay } from './error-overlay';

export interface HerbDevToolsOptions {
  projectPath?: string;
  autoInit?: boolean;
}

export class HerbOverlay {
  private showingERB = false;
  private showingERBOutlines = false;
  private showingERBHoverReveal = false;
  private showingTooltips = true;
  private showingViewOutlines = false;
  private showingPartialOutlines = false;
  private showingComponentOutlines = false;
  private menuOpen = false;
  private projectPath = '';
  private currentlyHoveredERBElement: HTMLElement | null = null;
  private errorOverlay: ErrorOverlay | null = null;

  private static readonly SETTINGS_KEY = 'herb-dev-tools-settings';

  constructor(private options: HerbDevToolsOptions = {}) {
    if (options.autoInit !== false) {
      this.init();
    }
  }

  private init() {
    this.loadProjectPath();
    this.loadSettings();
    this.injectMenu();
    this.setupMenuToggle();
    this.setupToggleSwitches();
    this.initializeErrorOverlay();
    this.setupTurboListeners();
    this.applySettings();
  }

  private loadProjectPath() {
    if (this.options.projectPath) {
      this.projectPath = this.options.projectPath;
      return;
    }

    const metaTag = document.querySelector('meta[name="herb-project-path"]') as HTMLMetaElement;

    if (metaTag?.content) {
      this.projectPath = metaTag.content;
    }
  }

  private loadSettings() {
    const savedSettings = localStorage.getItem(HerbOverlay.SETTINGS_KEY);
    if (savedSettings) {
      try {
        const settings = JSON.parse(savedSettings);
        this.showingERB = settings.showingERB || false;
        this.showingERBOutlines = settings.showingERBOutlines || false;
        this.showingERBHoverReveal = settings.showingERBHoverReveal || false;
        this.showingTooltips = settings.showingTooltips !== undefined ? settings.showingTooltips : true;
        this.showingViewOutlines = settings.showingViewOutlines || false;
        this.showingPartialOutlines = settings.showingPartialOutlines || false;
        this.showingComponentOutlines = settings.showingComponentOutlines || false;
        this.menuOpen = settings.menuOpen || false;
      } catch (e) {
        console.warn('Failed to load Herb dev tools settings:', e);
      }
    }
  }

  private saveSettings() {
    const settings = {
      showingERB: this.showingERB,
      showingERBOutlines: this.showingERBOutlines,
      showingERBHoverReveal: this.showingERBHoverReveal,
      showingTooltips: this.showingTooltips,
      showingViewOutlines: this.showingViewOutlines,
      showingPartialOutlines: this.showingPartialOutlines,
      showingComponentOutlines: this.showingComponentOutlines,
      menuOpen: this.menuOpen
    };

    localStorage.setItem(HerbOverlay.SETTINGS_KEY, JSON.stringify(settings));
    this.updateMenuButtonState();
  }

  private updateMenuButtonState() {
    const menuTrigger = document.getElementById('herbMenuTrigger');
    if (menuTrigger) {
      const hasActiveOptions = this.showingERB || this.showingERBOutlines || this.showingViewOutlines || this.showingPartialOutlines || this.showingComponentOutlines;
      if (hasActiveOptions) {
        menuTrigger.classList.add('has-active-options');
      } else {
        menuTrigger.classList.remove('has-active-options');
      }
    }
  }

  private injectMenu() {
    const existingMenu = document.querySelector('.herb-floating-menu');

    if (existingMenu) {
      return;
    }

    const menuHTML = `
      <div class="herb-floating-menu">
        <button class="herb-menu-trigger" id="herbMenuTrigger">
          <span class="herb-icon">🌿</span>
          <span class="herb-text">Herb</span>
        </button>

        <div class="herb-menu-panel" id="herbMenuPanel">
          <div class="herb-menu-header">Herb Debug Tools</div>

          <div class="herb-toggle-item">
            <label class="herb-toggle-label">
              <input type="checkbox" id="herbToggleViewOutlines" class="herb-toggle-input">
              <span class="herb-toggle-switch"></span>
              <span class="herb-toggle-text">Show View Outlines</span>
            </label>
          </div>

          <div class="herb-toggle-item">
            <label class="herb-toggle-label">
              <input type="checkbox" id="herbTogglePartialOutlines" class="herb-toggle-input">
              <span class="herb-toggle-switch"></span>
              <span class="herb-toggle-text">Show Partial Outlines</span>
            </label>
          </div>

          <div class="herb-toggle-item">
            <label class="herb-toggle-label">
              <input type="checkbox" id="herbToggleComponentOutlines" class="herb-toggle-input">
              <span class="herb-toggle-switch"></span>
              <span class="herb-toggle-text">Show Component Outlines</span>
            </label>
          </div>

          <div class="herb-toggle-item">
            <label class="herb-toggle-label">
              <input type="checkbox" id="herbToggleERBOutlines" class="herb-toggle-input">
              <span class="herb-toggle-switch"></span>
              <span class="herb-toggle-text">Show ERB Output Outlines</span>
            </label>

            <div class="herb-nested-toggle" id="herbERBHoverRevealNested" style="display: none;">
              <label class="herb-toggle-label herb-nested-label">
                <input type="checkbox" id="herbToggleERBHoverReveal" class="herb-toggle-input">
                <span class="herb-toggle-switch herb-nested-switch"></span>
                <span class="herb-toggle-text">Reveal ERB Output tag on hover</span>
              </label>
            </div>

            <div class="herb-nested-toggle" id="herbTooltipsNested" style="display: none;">
              <label class="herb-toggle-label herb-nested-label">
                <input type="checkbox" id="herbToggleTooltips" class="herb-toggle-input">
                <span class="herb-toggle-switch herb-nested-switch"></span>
                <span class="herb-toggle-text">Show Tooltips</span>
              </label>
            </div>
          </div>

          <div class="herb-toggle-item">
            <label class="herb-toggle-label">
              <input type="checkbox" id="herbToggleERB" class="herb-toggle-input">
              <span class="herb-toggle-switch"></span>
              <span class="herb-toggle-text">Show ERB Output Tags</span>
            </label>
          </div>

          <div class="herb-disable-all-section">
            <button id="herbDisableAll" class="herb-disable-all-btn">Disable All</button>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', menuHTML);
  }

  private applySettings() {
    this.toggleViewOutlines(this.showingViewOutlines);
    this.togglePartialOutlines(this.showingPartialOutlines);
    this.toggleComponentOutlines(this.showingComponentOutlines);
    this.toggleERBTags(this.showingERB);
    this.toggleERBOutlines(this.showingERBOutlines);

    const menuTrigger = document.getElementById('herbMenuTrigger');
    const menuPanel = document.getElementById('herbMenuPanel');

    if (menuTrigger && menuPanel && this.menuOpen) {
      menuTrigger.classList.add('active');
      menuPanel.classList.add('open');
    }
  }

  private setupMenuToggle() {
    const menuTrigger = document.getElementById('herbMenuTrigger');
    const menuPanel = document.getElementById('herbMenuPanel');

    if (menuTrigger && menuPanel) {
      menuTrigger.addEventListener('click', () => {
        this.menuOpen = !this.menuOpen;

        if (this.menuOpen) {
          menuTrigger.classList.add('active');
          menuPanel.classList.add('open');
        } else {
          menuTrigger.classList.remove('active');
          menuPanel.classList.remove('open');
        }

        this.saveSettings();
      });

      document.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        const floatingMenu = document.querySelector('.herb-floating-menu');

        if (floatingMenu && !floatingMenu.contains(target) && this.menuOpen) {
          this.menuOpen = false;
          menuTrigger.classList.remove('active');
          menuPanel.classList.remove('open');
          this.saveSettings();
        }
      });
    }
  }

  private setupTurboListeners() {
    document.addEventListener('turbo:load', () => {
      this.reinitializeAfterNavigation();
    });

    document.addEventListener('turbo:render', () => {
      this.reinitializeAfterNavigation();
    });

    document.addEventListener('turbo:visit', () => {
      this.reinitializeAfterNavigation();
    });
  }

  private reinitializeAfterNavigation() {
    this.injectMenu();
    this.setupMenuToggle();
    this.setupToggleSwitches();
    this.applySettings();
    this.updateMenuButtonState();
  }

  private setupToggleSwitches() {
    const toggleViewOutlinesSwitch = document.getElementById('herbToggleViewOutlines') as HTMLInputElement;

    if (toggleViewOutlinesSwitch) {
      toggleViewOutlinesSwitch.checked = this.showingViewOutlines;
      toggleViewOutlinesSwitch.addEventListener('change', () => {
        this.toggleViewOutlines(toggleViewOutlinesSwitch.checked);
      });
    }

    const togglePartialOutlinesSwitch = document.getElementById('herbTogglePartialOutlines') as HTMLInputElement;

    if (togglePartialOutlinesSwitch) {
      togglePartialOutlinesSwitch.checked = this.showingPartialOutlines;
      togglePartialOutlinesSwitch.addEventListener('change', () => {
        this.togglePartialOutlines(togglePartialOutlinesSwitch.checked);
      });
    }

    const toggleComponentOutlinesSwitch = document.getElementById('herbToggleComponentOutlines') as HTMLInputElement;

    if (toggleComponentOutlinesSwitch) {
      toggleComponentOutlinesSwitch.checked = this.showingComponentOutlines;
      toggleComponentOutlinesSwitch.addEventListener('change', () => {
        this.toggleComponentOutlines(toggleComponentOutlinesSwitch.checked);
      });
    }

    const toggleERBSwitch = document.getElementById('herbToggleERB') as HTMLInputElement;
    const toggleERBOutlinesSwitch = document.getElementById('herbToggleERBOutlines') as HTMLInputElement;

    if (toggleERBSwitch) {
      toggleERBSwitch.checked = this.showingERB;
      toggleERBSwitch.addEventListener('change', () => {
        if (toggleERBSwitch.checked && toggleERBOutlinesSwitch) {
          toggleERBOutlinesSwitch.checked = false;
          this.toggleERBOutlines(false);
        }
        this.toggleERBTags(toggleERBSwitch.checked);
      });
    }

    if (toggleERBOutlinesSwitch) {
      toggleERBOutlinesSwitch.checked = this.showingERBOutlines;
      toggleERBOutlinesSwitch.addEventListener('change', () => {
        if (toggleERBOutlinesSwitch.checked && toggleERBSwitch) {
          toggleERBSwitch.checked = false;
          this.toggleERBTags(false);
        }

        this.toggleERBOutlines(toggleERBOutlinesSwitch.checked);
        this.updateNestedToggleVisibility();
      });
    } else {
      console.warn('ERB outlines toggle switch not found');
    }

    const toggleERBHoverRevealSwitch = document.getElementById('herbToggleERBHoverReveal') as HTMLInputElement;

    if (toggleERBHoverRevealSwitch) {
      toggleERBHoverRevealSwitch.checked = this.showingERBHoverReveal;
      toggleERBHoverRevealSwitch.addEventListener('change', () => {
        this.toggleERBHoverReveal(toggleERBHoverRevealSwitch.checked);
      });
    }

    const toggleTooltipsSwitch = document.getElementById('herbToggleTooltips') as HTMLInputElement;

    if (toggleTooltipsSwitch) {
      toggleTooltipsSwitch.checked = this.showingTooltips;
      toggleTooltipsSwitch.addEventListener('change', () => {
        this.toggleTooltips(toggleTooltipsSwitch.checked);
      });
    }

    this.updateNestedToggleVisibility();

    const disableAllBtn = document.getElementById('herbDisableAll') as HTMLButtonElement;
    if (disableAllBtn) {
      disableAllBtn.addEventListener('click', () => {
        this.disableAll();
      });
    }
  }

  private toggleViewOutlines(show?: boolean) {
    this.showingViewOutlines = show !== undefined ? show : !this.showingViewOutlines;
    const viewOutlines = document.querySelectorAll('[data-herb-debug-outline-type="view"], [data-herb-debug-outline-type*="view"]');

    viewOutlines.forEach((outline) => {
      const element = outline as HTMLElement;

      if (this.showingViewOutlines) {
        element.style.outline = '2px dotted #3b82f6';
        element.style.outlineOffset = element.tagName.toLowerCase() === 'html' ? '-2px' : '2px';
        element.classList.add('show-outline');

        this.createOverlayLabel(element, 'view');
      } else {
        element.style.outline = 'none';
        element.style.outlineOffset = '0';
        element.classList.remove('show-outline');

        this.removeOverlayLabel(element);
      }
    });

    this.saveSettings();
  }

  private togglePartialOutlines(show?: boolean) {
    this.showingPartialOutlines = show !== undefined ? show : !this.showingPartialOutlines;
    const partialOutlines = document.querySelectorAll('[data-herb-debug-outline-type="partial"], [data-herb-debug-outline-type*="partial"]');

    partialOutlines.forEach((outline) => {
      const element = outline as HTMLElement;

      if (this.showingPartialOutlines) {
        element.style.outline = '2px dotted #10b981';
        element.style.outlineOffset = element.tagName.toLowerCase() === 'html' ? '-2px' : '2px';
        element.classList.add('show-outline');

        this.createOverlayLabel(element, 'partial');
      } else {
        element.style.outline = 'none';
        element.style.outlineOffset = '0';
        element.classList.remove('show-outline');

        this.removeOverlayLabel(element);
      }
    });

    this.saveSettings();
  }

  private toggleComponentOutlines(show?: boolean) {
    this.showingComponentOutlines = show !== undefined ? show : !this.showingComponentOutlines;
    const componentOutlines = document.querySelectorAll('[data-herb-debug-outline-type="component"], [data-herb-debug-outline-type*="component"]');

    componentOutlines.forEach((outline) => {
      const element = outline as HTMLElement;

      if (this.showingComponentOutlines) {
        element.style.outline = '2px dotted #f59e0b';
        element.style.outlineOffset = element.tagName.toLowerCase() === 'html' ? '-2px' : '2px';
        element.classList.add('show-outline');

        this.createOverlayLabel(element, 'component');
      } else {
        element.style.outline = 'none';
        element.style.outlineOffset = '0';
        element.classList.remove('show-outline');

        this.removeOverlayLabel(element);
      }
    });

    this.saveSettings();
  }

  private createOverlayLabel(element: HTMLElement, type: 'view' | 'partial' | 'component') {
    if (element.querySelector('.herb-overlay-label')) {
      return;
    }

    const shortName = element.getAttribute('data-herb-debug-file-name') || '';
    const relativePath = element.getAttribute('data-herb-debug-file-relative-path') || shortName;
    const fullPath = element.getAttribute('data-herb-debug-file-full-path') || relativePath;
    const label = document.createElement('div');

    label.className = 'herb-overlay-label';
    label.textContent = shortName;
    label.setAttribute('data-label-setup', 'true');

    label.addEventListener('mouseenter', () => {
      label.textContent = relativePath;

      document.querySelectorAll('.herb-overlay-label').forEach(otherLabel => {
        (otherLabel as HTMLElement).style.zIndex = '1000';
      });

      label.style.zIndex = '1002';
    });

    label.addEventListener('mouseleave', () => {
      label.textContent = shortName;
      label.style.zIndex = '1000';
    });

    label.addEventListener('click', (e) => {
      e.stopPropagation();
      this.openFileInEditor(fullPath, 1, 1);
    });

    const shouldAttachToParent = element.getAttribute('data-herb-debug-attach-to-parent') === 'true';

    if (shouldAttachToParent && element.parentElement) {
      const parent = element.parentElement;

      element.style.outline = 'none';
      element.classList.remove('show-outline');

      const outlineColor = type === 'component' ? '#f59e0b' : type === 'partial' ? '#10b981' : '#3b82f6';
      parent.style.outline = `2px dotted ${outlineColor}`;
      parent.style.outlineOffset = parent.tagName.toLowerCase() === 'html' ? '-2px' : '2px';
      parent.classList.add('show-outline');

      parent.setAttribute('data-herb-debug-attached-outline-type', type);

      parent.style.position = 'relative';
      label.style.position = 'absolute';
      label.style.top = '0';
      label.style.left = '0';

      parent.appendChild(label);
      return;
    }

    element.style.position = 'relative';
    element.appendChild(label);
  }

  private removeOverlayLabel(element: HTMLElement) {
    const shouldAttachToParent = element.getAttribute('data-herb-debug-attach-to-parent') === 'true';

    if (shouldAttachToParent && element.parentElement) {
      const parent = element.parentElement;
      const label = parent.querySelector('.herb-overlay-label');

      if (label) {
        label.remove();
      }

      parent.style.outline = 'none';
      parent.style.outlineOffset = '0';
      parent.classList.remove('show-outline');
      parent.removeAttribute('data-herb-debug-attached-outline-type');
    } else {
      const label = element.querySelector('.herb-overlay-label');

      if (label) {
        label.remove();
      }
    }
  }

  private resetShowingERB() {
    const elements = document.querySelectorAll('[data-herb-debug-showing-erb')

    elements.forEach(element => {
      const originalContent = element.getAttribute('data-herb-debug-original')  || "";

      element.innerHTML = originalContent;
      element.removeAttribute("data-herb-debug-showing-erb")
    })
  }

  private toggleERBTags(show?: boolean) {
    this.showingERB = show !== undefined ? show : !this.showingERB;
    const erbOutputs = document.querySelectorAll<HTMLElement>('[data-herb-debug-outline-type*="erb-output"]');

    erbOutputs.forEach((element) => {
      const erbCode = element.getAttribute('data-herb-debug-erb');

      if (this.showingERB && erbCode) {
        // this.resetShowingERB()

        if (!element.hasAttribute('data-herb-debug-original')) {
          element.setAttribute('data-herb-debug-original', element.innerHTML);
        }

        element.textContent = erbCode;
        element.setAttribute("data-herb-debug-showing-erb", "true")

        element.style.background = '#f3e8ff';
        element.style.color = '#7c3aed';

        if (this.showingTooltips) {
          this.addTooltipHoverHandler(element);
        }
      } else {
        const originalContent = element.getAttribute('data-herb-debug-original')  || "";

        if (element && element.hasAttribute("data-herb-debug-showing-erb")) {
          element.innerHTML = originalContent;
          element.removeAttribute("data-herb-debug-showing-erb")
        }

        element.style.background = 'transparent';
        element.style.color = 'inherit';

        this.removeTooltipHoverHandler(element);
        this.removeHoverTooltip(element);
      }
    });

    this.saveSettings();
  }

  private toggleERBOutlines(show?: boolean) {
    this.showingERBOutlines = show !== undefined ? show : !this.showingERBOutlines;

    this.clearCurrentHoveredERB();

    const erbOutputs = document.querySelectorAll<HTMLElement>('[data-herb-debug-outline-type*="erb-output"]');

    erbOutputs.forEach(element => {
      const inserted = element.hasAttribute("data-herb-debug-inserted")
      const needsWrapperToggled = (inserted && !element.children[0])

      const realElement = (element.children[0] as HTMLElement) || element

      if (this.showingERBOutlines) {

        realElement.style.outline = '2px dotted #a78bfa';
        realElement.style.outlineOffset = '1px';

        if (needsWrapperToggled) {
          element.style.display = 'inline';
        }

        if (this.showingTooltips) {
          this.addTooltipHoverHandler(element);
        }

        if (this.showingERBHoverReveal) {
          this.addERBHoverReveal(element);
        }
      } else {
        realElement.style.outline = 'none';
        realElement.style.outlineOffset = '0';

        if (needsWrapperToggled) {
          element.style.display = 'contents';
        }

        this.removeTooltipHoverHandler(element);
        this.removeHoverTooltip(element);
        this.removeERBHoverReveal(element);
      }
    });

    this.saveSettings();
  }

  private updateNestedToggleVisibility() {
    const nestedToggle = document.getElementById('herbERBHoverRevealNested');
    const tooltipsNestedToggle = document.getElementById('herbTooltipsNested');

    if (nestedToggle) {
      nestedToggle.style.display = this.showingERBOutlines ? 'block' : 'none';
    }

    if (tooltipsNestedToggle) {
      tooltipsNestedToggle.style.display = this.showingERBOutlines ? 'block' : 'none';
    }
  }

  private toggleERBHoverReveal(show?: boolean) {
    this.showingERBHoverReveal = show !== undefined ? show : !this.showingERBHoverReveal;

    if (this.showingERBHoverReveal && this.showingTooltips) {
      this.toggleTooltips(false);
      const toggleTooltipsSwitch = document.getElementById('herbToggleTooltips') as HTMLInputElement;

      if (toggleTooltipsSwitch) {
        toggleTooltipsSwitch.checked = false;
      }
    }

    this.clearCurrentHoveredERB();

    const erbOutputs = document.querySelectorAll('[data-herb-debug-outline-type*="erb-output"]');

    erbOutputs.forEach((el) => {
      const element = el as HTMLElement;

      this.removeERBHoverReveal(element);

      if (this.showingERBHoverReveal && this.showingERBOutlines) {
        this.addERBHoverReveal(element);
      }
    });

    this.saveSettings();
  }

  private clearCurrentHoveredERB() {
    if (this.currentlyHoveredERBElement) {
      const handlers = (this.currentlyHoveredERBElement as any)._erbHoverHandlers;
      if (handlers) {
        handlers.hideERBCode();
      }
      this.currentlyHoveredERBElement = null;
    }
  }

  private handleRevealedERBClick = (event: Event) => {
    event.stopPropagation();
    event.preventDefault();

    const element = event.currentTarget as HTMLElement;
    if (!element) return;

    const fullPath = element.getAttribute('data-herb-debug-file-full-path');
    const line = element.getAttribute('data-herb-debug-line');
    const column = element.getAttribute('data-herb-debug-column');

    if (fullPath) {
      this.openFileInEditor(
        fullPath,
        line ? parseInt(line) : 1,
        column ? parseInt(column) : 1
      );
    }
  }

  private addERBHoverReveal(element: HTMLElement) {
    const erbCode = element.getAttribute('data-herb-debug-erb');
    if (!erbCode) return;

    this.removeERBHoverReveal(element);

    if (!element.hasAttribute('data-herb-debug-original')) {
      element.setAttribute('data-herb-debug-original', element.innerHTML);
    }

    const showERBCode = () => {
      if (!this.showingERBHoverReveal || !this.showingERBOutlines) {
        return;
      }

      if (this.currentlyHoveredERBElement === element) {
        return;
      }

      this.clearCurrentHoveredERB();

      this.currentlyHoveredERBElement = element;

      element.style.background = '#f3e8ff';
      element.style.color = '#7c3aed';
      element.style.fontFamily = 'inherit';
      element.style.fontSize = 'inherit';
      element.style.borderRadius = '3px';
      element.style.cursor = 'pointer';
      element.textContent = erbCode;

      element.addEventListener('click', this.handleRevealedERBClick);
    };

    const hideERBCode = () => {
      if (this.currentlyHoveredERBElement === element) {
        this.currentlyHoveredERBElement = null;
      }

      const originalContent = element.getAttribute('data-herb-debug-original');

      if (originalContent) {
        element.innerHTML = originalContent;
      }

      element.style.background = 'transparent';
      element.style.color = 'inherit';
      element.style.fontFamily = 'inherit';
      element.style.fontSize = 'inherit';
      element.style.borderRadius = '0';
      element.style.cursor = 'default';

      element.removeEventListener('click', this.handleRevealedERBClick);
    };

    (element as any)._erbHoverHandlers = { showERBCode, hideERBCode };

    element.addEventListener('mouseenter', showERBCode);
  }

  private removeERBHoverReveal(element: HTMLElement) {
    const handlers = (element as any)._erbHoverHandlers;
    if (handlers) {
      element.removeEventListener('mouseenter', handlers.showERBCode);

      delete (element as any)._erbHoverHandlers;

      handlers.hideERBCode();
    }
  }

  private createHoverTooltip(element: HTMLElement, elementForPosition: HTMLElement) {
    this.removeHoverTooltip(element);

    const relativePath = element.getAttribute('data-herb-debug-file-relative-path') || element.getAttribute('data-herb-debug-file-name') || '';
    const fullPath = element.getAttribute('data-herb-debug-file-full-path') || relativePath;
    const line = element.getAttribute('data-herb-debug-line') || '';
    const column = element.getAttribute('data-herb-debug-column') || '';
    const erb = element.getAttribute('data-herb-debug-erb') || '';

    if (!relativePath || !erb) return;

    const tooltip = document.createElement('div');
    tooltip.className = 'herb-tooltip';

    tooltip.innerHTML = `
      <div class="herb-location" data-tooltip="Open in Editor">
        <span class="herb-file-path">${relativePath}:${line}:${column}</span>
        <button class="herb-copy-path-btn" data-tooltip="Copy file path">📋</button>
      </div>
      <div class="herb-erb-code">${erb}</div>
    `;

    let hideTimeout: number | null = null;

    const showTooltip = () => {
      if (hideTimeout) {
        clearTimeout(hideTimeout);
        hideTimeout = null;
      }
      tooltip.classList.add('visible');
    };

    const hideTooltip = () => {
      hideTimeout = window.setTimeout(() => {
        tooltip.classList.remove('visible');
      }, 100);
    };

    element.addEventListener('mouseenter', showTooltip);
    element.addEventListener('mouseleave', hideTooltip);
    tooltip.addEventListener('mouseenter', showTooltip);
    tooltip.addEventListener('mouseleave', hideTooltip);

    const locationElement = tooltip.querySelector('.herb-location');
    const openInEditor = (e: Event) => {
      if ((e.target as HTMLElement).closest('.herb-copy-path-btn')) {
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      this.openFileInEditor(fullPath, parseInt(line), parseInt(column));
    };
    locationElement?.addEventListener('click', openInEditor);

    const copyButton = tooltip.querySelector('.herb-copy-path-btn');
    const copyFilePath = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      const textToCopy = `${relativePath}:${line}:${column}`;
      navigator.clipboard.writeText(textToCopy).then(() => {
        copyButton!.textContent = '✅';
        setTimeout(() => {
          copyButton!.textContent = '📋';
        }, 1000);
      }).catch((err) => {
        console.error('Failed to copy file path:', err);
      });
    };
    copyButton?.addEventListener('click', copyFilePath);

    const positionTooltip = () => {
      const elementRect = elementForPosition.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const viewportWidth = window.innerWidth;

      tooltip.style.position = 'fixed';
      tooltip.style.left = '0';
      tooltip.style.top = '0';
      tooltip.style.transform = 'none';
      tooltip.style.bottom = 'auto';

      const actualTooltipRect = tooltip.getBoundingClientRect();
      const tooltipWidth = actualTooltipRect.width;
      const tooltipHeight = actualTooltipRect.height;

      let left = elementRect.left + (elementRect.width / 2) - (tooltipWidth / 2);
      let top = elementRect.top - tooltipHeight - 8;

      if (left < 8) {
        left = 8;
      } else if (left + tooltipWidth > viewportWidth - 8) {
        left = viewportWidth - tooltipWidth - 8;
      }

      if (top < 8) {
        top = elementRect.bottom + 8;

        if (top + tooltipHeight > viewportHeight - 8) {
          top = Math.max(8, (viewportHeight - tooltipHeight) / 2);
        }
      }

      if (top + tooltipHeight > viewportHeight - 8) {
        top = viewportHeight - tooltipHeight - 8;
      }

      tooltip.style.position = 'fixed';
      tooltip.style.left = `${left}px`;
      tooltip.style.top = `${top}px`;
      tooltip.style.transform = 'none';
      tooltip.style.bottom = 'auto';
    };

    (element as any)._tooltipHandlers = { showTooltip, hideTooltip, openInEditor, copyFilePath, positionTooltip };
    (tooltip as any)._tooltipHandlers = { showTooltip, hideTooltip };

    element.appendChild(tooltip);

    setTimeout(positionTooltip, 0);
    window.addEventListener('scroll', positionTooltip, { passive: true });
    window.addEventListener('resize', positionTooltip, { passive: true });
  }

  private removeHoverTooltip(element: HTMLElement) {
    const tooltip = element.querySelector('.herb-tooltip');

    if (tooltip) {
      const handlers = (element as any)._tooltipHandlers;
      const tooltipHandlers = (tooltip as any)._tooltipHandlers;

      if (handlers) {
        element.removeEventListener('mouseenter', handlers.showTooltip);
        element.removeEventListener('mouseleave', handlers.hideTooltip);

        const locationElement = tooltip.querySelector('.herb-location');
        locationElement?.removeEventListener('click', handlers.openInEditor);

        const copyButton = tooltip.querySelector('.herb-copy-path-btn');
        copyButton?.removeEventListener('click', handlers.copyFilePath);

        if (handlers.positionTooltip) {
          window.removeEventListener('scroll', handlers.positionTooltip);
          window.removeEventListener('resize', handlers.positionTooltip);
        }

        delete (element as any)._tooltipHandlers;
      }

      if (tooltipHandlers) {
        tooltip.removeEventListener('mouseenter', tooltipHandlers.showTooltip);
        tooltip.removeEventListener('mouseleave', tooltipHandlers.hideTooltip);
        delete (tooltip as any)._tooltipHandlers;
      }

      tooltip.remove();
    }
  }

  private addTooltipHoverHandler(element: HTMLElement) {
    this.removeTooltipHoverHandler(element);

    const lazyTooltipHandler = () => {
      if (!this.showingTooltips || !this.showingERBOutlines) {
        return;
      }

      if (element.querySelector('.herb-tooltip')) {
        return;
      }

      this.createHoverTooltip(element, element);
    };

    (element as any)._lazyTooltipHandler = lazyTooltipHandler;
    element.addEventListener('mouseenter', lazyTooltipHandler);
  }

  private removeTooltipHoverHandler(element: HTMLElement) {
    const handler = (element as any)._lazyTooltipHandler;
    if (handler) {
      element.removeEventListener('mouseenter', handler);
      delete (element as any)._lazyTooltipHandler;
    }
  }

  private openFileInEditor(file: string, line: number, column: number) {
    const absolutePath = file.startsWith('/') ? file : (this.projectPath ? `${this.projectPath}/${file}` : file);

    const editors = [
      `vscode://file/${absolutePath}:${line}:${column}`,
      `subl://open?url=file://${absolutePath}&line=${line}&column=${column}`,
      `atom://core/open/file?filename=${absolutePath}&line=${line}&column=${column}`,
      `txmt://open?url=file://${absolutePath}&line=${line}&column=${column}`,
    ];

    try {
      window.open(editors[0], '_self');
    } catch (error) {
      console.log(`Open in editor: ${absolutePath}:${line}:${column}`);
    }
  }

  private toggleTooltips(show?: boolean) {
    this.showingTooltips = show !== undefined ? show : !this.showingTooltips;

    if (this.showingTooltips && this.showingERBHoverReveal) {
      this.toggleERBHoverReveal(false);
      const toggleERBHoverRevealSwitch = document.getElementById('herbToggleERBHoverReveal') as HTMLInputElement;

      if (toggleERBHoverRevealSwitch) {
        toggleERBHoverRevealSwitch.checked = false;
      }
    }

    const erbOutputs = document.querySelectorAll<HTMLElement>('[data-herb-debug-outline-type*="erb-output"]');

    erbOutputs.forEach((element) => {
      if (this.showingERBOutlines && this.showingTooltips) {
        this.addTooltipHoverHandler(element);
      } else {
        this.removeTooltipHoverHandler(element);
        this.removeHoverTooltip(element);
      }
    });

    this.saveSettings();
  }

  private disableAll() {
    this.clearCurrentHoveredERB();

    this.toggleViewOutlines(false);
    this.togglePartialOutlines(false);
    this.toggleComponentOutlines(false);
    this.toggleERBTags(false);
    this.toggleERBOutlines(false);
    this.toggleERBHoverReveal(false);
    this.toggleTooltips(false);

    const toggleViewOutlinesSwitch = document.getElementById('herbToggleViewOutlines') as HTMLInputElement;
    const togglePartialOutlinesSwitch = document.getElementById('herbTogglePartialOutlines') as HTMLInputElement;
    const toggleComponentOutlinesSwitch = document.getElementById('herbToggleComponentOutlines') as HTMLInputElement;
    const toggleERBSwitch = document.getElementById('herbToggleERB') as HTMLInputElement;
    const toggleERBOutlinesSwitch = document.getElementById('herbToggleERBOutlines') as HTMLInputElement;
    const toggleERBHoverRevealSwitch = document.getElementById('herbToggleERBHoverReveal') as HTMLInputElement;
    const toggleTooltipsSwitch = document.getElementById('herbToggleTooltips') as HTMLInputElement;

    if (toggleViewOutlinesSwitch) toggleViewOutlinesSwitch.checked = false;
    if (togglePartialOutlinesSwitch) togglePartialOutlinesSwitch.checked = false;
    if (toggleComponentOutlinesSwitch) toggleComponentOutlinesSwitch.checked = false;
    if (toggleERBSwitch) toggleERBSwitch.checked = false;
    if (toggleERBOutlinesSwitch) toggleERBOutlinesSwitch.checked = false;
    if (toggleERBHoverRevealSwitch) toggleERBHoverRevealSwitch.checked = false;
    if (toggleTooltipsSwitch) toggleTooltipsSwitch.checked = false;
  }

  private initializeErrorOverlay() {
    this.errorOverlay = new ErrorOverlay();
  }
}
