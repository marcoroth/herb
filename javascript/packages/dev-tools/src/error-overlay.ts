import { Diagnostic } from '@herb-tools/core';

export interface ValidationError extends Omit<Diagnostic, 'location'> {
  location?: {
    line: number;
    column: number;
  };
  suggestion?: string;
}

export interface ValidationData {
  validationErrors: ValidationError[];
  filename: string;
  timestamp: string;
}

export class ErrorOverlay {
  private overlay: HTMLElement | null = null;
  private allValidationData: ValidationData[] = [];
  private isVisible = false;

  constructor() {
    this.init();
  }

  private init() {
    this.detectValidationErrors();

    const hasParserErrors = document.querySelector('.herb-parser-error-overlay') !== null;

    if (this.getTotalErrorCount() > 0) {
      this.createOverlay();
      this.setupToggleHandler();
    } else if (hasParserErrors) {
      console.log('[ErrorOverlay] Parser error overlay already displayed');
    } else {
      console.log('[ErrorOverlay] No errors found, not creating overlay');
    }
  }

  private detectValidationErrors() {
    const templatesToRemove: HTMLTemplateElement[] = [];
    const validationTemplates = document.querySelectorAll('template[data-herb-validation-error]') as NodeListOf<HTMLTemplateElement>;

    if (validationTemplates.length > 0) {
      this.processValidationTemplates(validationTemplates, templatesToRemove);
    }

    const jsonTemplates = document.querySelectorAll('template[data-herb-validation-errors]') as NodeListOf<HTMLTemplateElement>;

    jsonTemplates.forEach((template, _index) => {
      try {
        let jsonData = template.textContent?.trim();

        if (!jsonData) {
          jsonData = template.innerHTML?.trim();
        }

        if (jsonData) {
          const validationData = JSON.parse(jsonData) as ValidationData;
          this.allValidationData.push(validationData);

          templatesToRemove.push(template);
        }
      } catch (error) {
        console.error('Failed to parse validation errors from template:', error, {
          textContent: template.textContent,
          innerHTML: template.innerHTML
        });

        templatesToRemove.push(template);
      }
    });

    const htmlTemplates = document.querySelectorAll('template[data-herb-parser-error]') as NodeListOf<HTMLTemplateElement>;

    htmlTemplates.forEach((template, _index) => {
      try {
        let htmlContent = template.innerHTML?.trim() || template.textContent?.trim();

        if (htmlContent) {
          this.displayParserErrorOverlay(htmlContent);
          templatesToRemove.push(template);
        }
      } catch (error) {
        console.error('Failed to process parser error template:', error);
        templatesToRemove.push(template);
      }
    });

    templatesToRemove.forEach((template, _index) => template.remove());
  }

  private processValidationTemplates(templates: NodeListOf<HTMLTemplateElement>, templatesToRemove: HTMLTemplateElement[]) {
    const validationFragments: Array<{
      metadata: {
        severity: string;
        source: string;
        code: string;
        line: number;
        column: number;
        filename: string;
        message: string;
        suggestion?: string;
        timestamp: string;
      };
      html: string;
      count: number;
    }> = [];

    const errorMap = new Map<string, typeof validationFragments[0]>();

    templates.forEach((template) => {
      try {
        const metadata = {
          severity: template.getAttribute('data-severity') || 'error',
          source: template.getAttribute('data-source') || 'unknown',
          code: template.getAttribute('data-code') || '',
          line: parseInt(template.getAttribute('data-line') || '0'),
          column: parseInt(template.getAttribute('data-column') || '0'),
          filename: template.getAttribute('data-filename') || 'unknown',
          message: template.getAttribute('data-message') || '',
          suggestion: template.getAttribute('data-suggestion') || undefined,
          timestamp: template.getAttribute('data-timestamp') || new Date().toISOString()
        };

        const html = template.innerHTML?.trim() || '';

        if (html) {
          const errorKey = `${metadata.filename}:${metadata.line}:${metadata.column}:${metadata.code}:${metadata.message}`;

          if (errorMap.has(errorKey)) {
            const existing = errorMap.get(errorKey)!;
            existing.count++;
          } else {
            errorMap.set(errorKey, { metadata, html, count: 1 });
          }

          templatesToRemove.push(template);
        }
      } catch (error) {
        console.error('Failed to process validation template:', error);
        templatesToRemove.push(template);
      }
    });

    validationFragments.push(...errorMap.values());

    if (validationFragments.length > 0) {
      this.displayValidationOverlay(validationFragments);
    }
  }

  private createOverlay() {
    if (this.allValidationData.length === 0) return;

    this.overlay = document.createElement('div');
    this.overlay.id = 'herb-error-overlay';
    this.overlay.innerHTML = `
      <style>
        #herb-error-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.8);
          z-index: 10000;
          display: none;
          overflow: auto;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        .herb-error-content {
          background: #1a1a1a;
          margin: 20px auto;
          padding: 20px;
          border-radius: 8px;
          max-width: 800px;
          color: #fff;
        }

        .herb-error-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
          border-bottom: 1px solid #333;
          padding-bottom: 10px;
        }

        .herb-error-title {
          font-size: 18px;
          font-weight: 600;
          color: #ff6b6b;
        }

        .herb-error-close {
          background: none;
          border: none;
          color: #fff;
          font-size: 20px;
          cursor: pointer;
          padding: 5px;
        }

        .herb-error-file-section {
          margin-bottom: 20px;
        }

        .herb-error-file {
          font-size: 14px;
          color: #888;
          margin-bottom: 10px;
          font-weight: 600;
        }

        .herb-error-item {
          background: #2a2a2a;
          border-radius: 6px;
          padding: 15px;
          margin-bottom: 10px;
          border-left: 4px solid #ff6b6b;
        }

        .herb-error-item.warning {
          border-left-color: #ffd93d;
        }

        .herb-error-item.info {
          border-left-color: #4ecdc4;
        }

        .herb-error-item.hint {
          border-left-color: #95a5a6;
        }

        .herb-error-message {
          font-size: 14px;
          margin-bottom: 8px;
          line-height: 1.4;
        }

        .herb-error-location {
          font-size: 12px;
          color: #888;
          margin-bottom: 8px;
        }

        .herb-error-suggestion {
          font-size: 12px;
          color: #4ecdc4;
          font-style: italic;
        }

        .herb-error-source {
          font-size: 11px;
          color: #666;
          text-align: right;
        }

        .herb-file-separator {
          border-top: 1px solid #444;
          margin: 20px 0;
        }
      </style>

      <div class="herb-error-content">
        <div class="herb-error-header">
          <div class="herb-error-title">
            Errors (${this.getTotalErrorCount()})
          </div>
          <button class="herb-error-close">&times;</button>
        </div>

        <div class="herb-error-files">
          ${this.allValidationData.map((validationData, index) => `
            ${index > 0 ? '<div class="herb-file-separator"></div>' : ''}
            <div class="herb-error-file-section">
              <div class="herb-error-file">${validationData.filename} (${this.getErrorSummary(validationData.validationErrors)})</div>
              <div class="herb-error-list">
                ${validationData.validationErrors.map(error => `
                  <div class="herb-error-item ${error.severity}">
                    <div class="herb-error-message">${this.escapeHtml(error.message)}</div>
                    ${error.location ? `<div class="herb-error-location">Line ${error.location.line}, Column ${error.location.column}</div>` : ''}
                    ${error.suggestion ? `<div class="herb-error-suggestion">💡 ${this.escapeHtml(error.suggestion)}</div>` : ''}
                    <div class="herb-error-source">${error.source}${error.code ? ` (${error.code})` : ''}</div>
                  </div>
                `).join('')}
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    document.body.appendChild(this.overlay);

    const closeBtn = this.overlay.querySelector('.herb-error-close');
    closeBtn?.addEventListener('click', () => this.hide());

    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) {
        this.hide();
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isVisible) {
        this.hide();
      }
    });
  }

  private setupToggleHandler() {
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'E') {
        e.preventDefault();
        this.toggle();
      }
    });

    if (this.hasErrorSeverity()) {
      setTimeout(() => this.show(), 100);
    }
  }

  private getTotalErrorCount(): number {
    return this.allValidationData.reduce((total, data) => total + data.validationErrors.length, 0);
  }

  private getErrorSummary(errors: ValidationError[]): string {
    if (errors.length === 1) {
      return '1 error';
    }

    const errorsBySource = errors.reduce((acc, error) => {
      const source = error.source || 'Unknown';
      acc[source] = (acc[source] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const sourceKeys = Object.keys(errorsBySource);
    if (sourceKeys.length === 1) {
      const source = sourceKeys[0];
      const count = errorsBySource[source];
      const sourceLabel = this.getSourceLabel(source);

      return `${count} ${sourceLabel} error${count === 1 ? '' : 's'}`;
    } else {
      const parts = sourceKeys.map(source => {
        const count = errorsBySource[source];
        const sourceLabel = this.getSourceLabel(source);
        return `${count} ${sourceLabel}`;
      });

      return `${errors.length} errors (${parts.join(', ')})`;
    }
  }

  private getSourceLabel(source: string): string {
    switch (source) {
      case 'Parser': return 'parser';
      case 'SecurityValidator': return 'security';
      case 'NestingValidator': return 'nesting';
      case 'AccessibilityValidator': return 'accessibility';
      default: return 'validation';
    }
  }

  private hasErrorSeverity(): boolean {
    return this.allValidationData.some(data =>
      data.validationErrors.some(error => error.severity === 'error')
    );
  }

  private escapeHtml(unsafe: string): string {
    return unsafe
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  public show() {
    if (this.overlay) {
      this.overlay.style.display = 'block';
      this.isVisible = true;
    }
  }

  public hide() {
    if (this.overlay) {
      this.overlay.style.display = 'none';
      this.isVisible = false;
    }
  }

  public toggle() {
    if (this.isVisible) {
      this.hide();
    } else {
      this.show();
    }
  }

  public hasErrors(): boolean {
    return this.getTotalErrorCount() > 0;
  }

  public getErrorCount(): number {
    return this.getTotalErrorCount();
  }

  private displayParserErrorOverlay(htmlContent: string) {
    const existingOverlay = document.querySelector('.herb-parser-error-overlay');
    if (existingOverlay) {
      existingOverlay.remove();
    }

    const container = document.createElement('div');
    container.innerHTML = htmlContent;

    const overlay = container.querySelector('.herb-parser-error-overlay') as HTMLElement;

    if (overlay) {
      document.body.appendChild(overlay);
      overlay.style.display = 'flex';
    } else {
      console.error('[ErrorOverlay] No parser error overlay found in HTML template');
    }
  }

  private displayValidationOverlay(fragments: Array<{
    metadata: {
      severity: string;
      source: string;
      code: string;
      line: number;
      column: number;
      filename: string;
      message: string;
      suggestion?: string;
      timestamp: string;
    };
    html: string;
    count: number;
  }>) {
    const existingOverlay = document.querySelector('.herb-validation-overlay');
    if (existingOverlay) {
      existingOverlay.remove();
    }

    const errorsBySource = new Map<string, typeof fragments>();
    const errorsByFile = new Map<string, typeof fragments>();

    fragments.forEach(fragment => {
      const source = fragment.metadata.source;

      if (!errorsBySource.has(source)) {
        errorsBySource.set(source, []);
      }

      errorsBySource.get(source)!.push(fragment);

      const file = fragment.metadata.filename;

      if (!errorsByFile.has(file)) {
        errorsByFile.set(file, []);
      }
      errorsByFile.get(file)!.push(fragment);
    });

    const errorCount = fragments.filter(f => f.metadata.severity === 'error').reduce((sum, f) => sum + f.count, 0);
    const warningCount = fragments.filter(f => f.metadata.severity === 'warning').reduce((sum, f) => sum + f.count, 0);
    const totalCount = fragments.reduce((sum, f) => sum + f.count, 0);
    const uniqueCount = fragments.length;

    const overlayHTML = this.buildValidationOverlayHTML(
      fragments,
      errorsBySource,
      errorsByFile,
      { errorCount, warningCount, totalCount, uniqueCount }
    );

    const overlay = document.createElement('div');
    overlay.className = 'herb-validation-overlay';
    overlay.innerHTML = overlayHTML;

    document.body.appendChild(overlay);

    this.setupValidationOverlayHandlers(overlay);
  }

  private buildValidationOverlayHTML(
    _fragments: Array<any>,
    errorsBySource: Map<string, any[]>,
    errorsByFile: Map<string, any[]>,
    counts: { errorCount: number; warningCount: number; totalCount: number; uniqueCount: number }
  ): string {
    let title = counts.uniqueCount === 1 ? 'Validation Issue' : `Validation Issues`;

    if (counts.totalCount !== counts.uniqueCount) {
      title += ` (${counts.uniqueCount} unique, ${counts.totalCount} total)`;
    } else {
      title += ` (${counts.totalCount})`;
    }

    const subtitle = [];

    if (counts.errorCount > 0) subtitle.push(`${counts.errorCount} error${counts.errorCount !== 1 ? 's' : ''}`);
    if (counts.warningCount > 0) subtitle.push(`${counts.warningCount} warning${counts.warningCount !== 1 ? 's' : ''}`);

    let fileTabs = '';

    if (errorsByFile.size > 1) {
      const totalErrors = Array.from(errorsByFile.values()).reduce((sum, errors) => sum + errors.length, 0);

      fileTabs = `
        <div class="herb-file-tabs">
          <button class="herb-file-tab active" data-file="*">
            All (${totalErrors})
          </button>
          ${Array.from(errorsByFile.entries()).map(([file, errors]) => `
            <button class="herb-file-tab" data-file="${this.escapeAttr(file)}">
              ${this.escapeHtml(file)} (${errors.length})
            </button>
          `).join('')}
        </div>
      `;
    }

    const contentSections = Array.from(errorsBySource.entries()).map(([source, sourceFragments]) => `
      <div class="herb-validator-section" data-source="${this.escapeAttr(source)}">
        <div class="herb-validator-header">
          <h3>${this.escapeHtml(source.replace('Validator', ''))} Issues (${sourceFragments.length})</h3>
        </div>
        <div class="herb-validator-content">
          ${sourceFragments.map(f => {
            const fileAttribute = `data-error-file="${this.escapeAttr(f.metadata.filename)}"`;

            if (f.count > 1) {
              return `
                <div class="herb-validation-item-wrapper" ${fileAttribute}>
                  ${f.html}
                  <div class="herb-occurrence-badge" title="This error occurs ${f.count} times in the template">
                    <span class="herb-occurrence-icon">⚠</span>
                    <span class="herb-occurrence-count">×${f.count}</span>
                  </div>
                </div>
              `;
            }
            return `<div class="herb-validation-error-container" ${fileAttribute}>${f.html}</div>`;
          }).join('')}
        </div>
      </div>
    `).join('');

    return `
      <style>${this.getValidationOverlayStyles()}</style>
      <div class="herb-validation-container">
        <div class="herb-validation-header">
          <div class="herb-validation-header-content">
            <div class="herb-validation-title">
              <span class="herb-validation-icon">⚠️</span>
              ${title}
            </div>
            <div class="herb-validation-subtitle">${subtitle.join(', ')}</div>
          </div>
          <button class="herb-close-button" title="Close (Esc)">×</button>
        </div>
        ${fileTabs}
        <div class="herb-validation-content">
          ${contentSections}
        </div>
        <div class="herb-dismiss-hint" style="padding-left: 24px; padding-right: 24px; padding-bottom: 12px;">
          Click outside, press <kbd style="display: inline-block; padding: 2px 6px; font-family: monospace; font-size: 0.9em; color: #333; background: #f7f7f7; border: 1px solid #ccc; border-radius: 4px; box-shadow: 0 2px 0 #ccc, 0 2px 3px rgba(0,0,0,0.2) inset;">Esc</kbd> key, or fix the code to dismiss.<br>

          You can also disable this overlay by passing <code style="color: #ffeb3b; font-family: monospace; font-size: 12pt;">validation_mode: :none</code> to <code style="color: #ffeb3b; font-family: monospace; font-size: 12pt;">Herb::Engine</code>.
        </div>
      </div>
    `;
  }

  private getValidationOverlayStyles(): string {
    return `
      .herb-validation-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.8);
        backdrop-filter: blur(4px);
        z-index: 9999;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 20px;
        font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace;
        color: #e5e5e5;
        line-height: 1.6;
      }

      .herb-validation-container {
        background: #000000;
        border: 1px solid #374151;
        border-radius: 12px;
        box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
        max-width: 1200px;
        max-height: 80vh;
        width: 100%;
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }

      .herb-validation-header {
        background: linear-gradient(135deg, #f59e0b, #d97706);
        padding: 20px 24px;
        border-bottom: 1px solid #374151;
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
      }

      .herb-validation-title {
        font-size: 18px;
        font-weight: 600;
        color: white;
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .herb-validation-subtitle {
        font-size: 14px;
        color: rgba(255, 255, 255, 0.9);
        margin-top: 4px;
      }

      .herb-file-tabs {
        background: #1a1a1a;
        border-bottom: 1px solid #374151;
        padding: 0;
        display: flex;
        overflow-x: auto;
      }

      .herb-file-tab {
        background: transparent;
        border: none;
        color: #9ca3af;
        padding: 12px 20px;
        cursor: pointer;
        font-size: 13px;
        white-space: nowrap;
        transition: all 0.2s;
        border-bottom: 2px solid transparent;
      }

      .herb-file-tab:hover {
        background: #262626;
        color: #e5e5e5;
      }

      .herb-file-tab.active {
        color: #f59e0b;
        border-bottom-color: #f59e0b;
        background: #262626;
      }

      .herb-validation-content {
        flex: 1;
        overflow-y: auto;
        padding: 24px;
        display: flex;
        flex-direction: column;
        gap: 24px;
      }

      .herb-validator-section {
        background: #0f0f0f;
        border: 1px solid #2d2d2d;
        border-radius: 8px;
      }

      .herb-validator-header {
        background: #1a1a1a;
        padding: 12px 16px;
        border-bottom: 1px solid #2d2d2d;
      }

      .herb-validator-header h3 {
        margin: 0;
        font-size: 14px;
        font-weight: 500;
        color: #e5e5e5;
      }

      .herb-validator-content {
        padding: 16px;
        display: flex;
        flex-direction: column;
        gap: 16px;
      }

      .herb-validation-item {
        border-left: 3px solid #4a4a4a;
        padding-left: 16px;
      }

      .herb-validation-item[data-severity="error"] {
        border-left-color: #7f1d1d;
      }

      .herb-validation-item[data-severity="warning"] {
        border-left-color: #78350f;
      }

      .herb-validation-item[data-severity="info"] {
        border-left-color: #1e3a8a;
      }

      .herb-validation-header {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 8px;
      }

      .herb-validation-badge {
        padding: 2px 8px;
        border-radius: 4px;
        font-size: 11px;
        font-weight: 600;
        color: white;
        text-transform: uppercase;
      }

      .herb-validation-location {
        font-size: 12px;
        color: #9ca3af;
      }

      .herb-validation-message {
        font-size: 14px;
        margin-bottom: 12px;
        line-height: 1.5;
      }

      .herb-code-snippet {
        background: #1a1a1a;
        border: 1px solid #2d2d2d;
        border-radius: 4px;
        padding: 12px;
        overflow-x: auto;
      }

      .herb-code-line {
        display: flex;
        align-items: flex-start;
        min-height: 20px;
        font-size: 13px;
        line-height: 1.5;
      }

      .herb-line-number {
        color: #6b7280;
        width: 40px;
        text-align: right;
        padding-right: 16px;
        user-select: none;
        flex-shrink: 0;
      }

      .herb-line-content {
        flex: 1;
        white-space: pre;
        font-family: inherit;
      }

      .herb-error-line {
        background: rgba(220, 38, 38, 0.1);
      }

      .herb-error-line .herb-line-number {
        color: #dc2626;
        font-weight: 600;
      }

      .herb-error-pointer {
        color: #dc2626;
        font-weight: bold;
        margin-left: 56px;
        font-size: 12px;
      }

      .herb-validation-suggestion {
        background: #1e3a1e;
        border: 1px solid #10b981;
        border-radius: 4px;
        padding: 8px 12px;
        margin-top: 8px;
        font-size: 13px;
        color: #10b981;
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .herb-validation-item-wrapper,
      .herb-validation-error-container {
        position: relative;
      }

      .herb-validation-error-container.hidden,
      .herb-validation-item-wrapper.hidden,
      .herb-validator-section.hidden {
        display: none;
      }

      .herb-occurrence-badge {
        position: absolute;
        top: 8px;
        right: 8px;
        background: #dc2626;
        color: white;
        padding: 4px 8px;
        border-radius: 12px;
        font-size: 12px;
        font-weight: 600;
        display: flex;
        align-items: center;
        gap: 4px;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
      }

      .herb-occurrence-icon {
        font-size: 10px;
      }

      .herb-occurrence-count {
        font-weight: bold;
      }

      .herb-close-button {
        background: rgba(255, 255, 255, 0.1);
        border: 1px solid rgba(255, 255, 255, 0.2);
        color: white;
        width: 32px;
        height: 32px;
        border-radius: 6px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        font-size: 16px;
        transition: all 0.2s;
      }

      .herb-close-button:hover {
        background: rgba(255, 255, 255, 0.2);
        border-color: rgba(255, 255, 255, 0.3);
      }

      /* Syntax highlighting */
      .herb-erb { color: #61dafb; }
      .herb-erb-content { color: #c678dd; }
      .herb-tag { color: #e06c75; }
      .herb-attr { color: #d19a66; }
      .herb-value { color: #98c379; }
      .herb-comment { color: #5c6370; font-style: italic; }
    `;
  }

  private setupValidationOverlayHandlers(overlay: HTMLElement) {
    const closeBtn = overlay.querySelector('.herb-close-button');

    if (closeBtn) {
      closeBtn.addEventListener('click', () => overlay.remove());
    }

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        overlay.remove();
      }
    });

    const escHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        overlay.remove();
        document.removeEventListener('keydown', escHandler);
      }
    };

    document.addEventListener('keydown', escHandler);

    const fileTabs = overlay.querySelectorAll('.herb-file-tab');

    fileTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const selectedFile = tab.getAttribute('data-file');

        fileTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        const errorContainers = overlay.querySelectorAll('[data-error-file]');
        const validatorSections = overlay.querySelectorAll('.herb-validator-section');

        errorContainers.forEach(container => {
          const containerFile = container.getAttribute('data-error-file');
          if (selectedFile === '*' || containerFile === selectedFile) {
            container.classList.remove('hidden');
          } else {
            container.classList.add('hidden');
          }
        });

        validatorSections.forEach(section => {
          const sectionContent = section.querySelector('.herb-validator-content');
          const visibleErrors = sectionContent?.querySelectorAll('[data-error-file]:not(.hidden)').length || 0;

          const header = section.querySelector('h3');
          const source = section.getAttribute('data-source')?.replace('Validator', '') || 'Unknown';

          if (header) {
            header.textContent = `${source} Issues (${visibleErrors})`;
          }

          if (visibleErrors === 0) {
            section.classList.add('hidden');
          } else {
            section.classList.remove('hidden');
          }
        });
      });
    });
  }

  private escapeAttr(text: string): string {
    return this.escapeHtml(text).replace(/"/g, '&quot;');
  }
}
