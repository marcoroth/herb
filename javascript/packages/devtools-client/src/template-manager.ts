import type { HerbAPI } from './herb-api';

export interface TemplateInfo {
  source: string;
  path?: string;
  language?: 'erb' | 'html';
  lastModified?: Date;
  componentIds: Set<string>;
}

export class TemplateManager {
  private herbAPI: HerbAPI;
  private templates = new Map<string, TemplateInfo>();
  private templatesByPath = new Map<string, string>();

  constructor(herbAPI: HerbAPI) {
    this.herbAPI = herbAPI;
  }

  registerTemplate(templateId: string, source: string, options?: {
    path?: string;
    language?: 'erb' | 'html';
  }): void {
    const templateInfo: TemplateInfo = {
      source,
      path: options?.path,
      language: options?.language || this.detectLanguage(source, options?.path),
      lastModified: new Date(),
      componentIds: new Set()
    };

    this.templates.set(templateId, templateInfo);

    if (options?.path) {
      this.templatesByPath.set(options.path, templateId);
    }

    this.herbAPI.emit('template:registered', { templateId, ...templateInfo });
  }

  updateTemplate(templateId: string, source: string): void {
    const template = this.templates.get(templateId);
    if (!template) return;

    template.source = source;
    template.lastModified = new Date();

    template.componentIds.forEach(componentId => {
      this.herbAPI.setTemplateSource(componentId, source);
    });

    this.herbAPI.emit('template:updated', { templateId, source });
  }

  linkTemplateToComponent(templateId: string, componentId: string): void {
    const template = this.templates.get(templateId);
    if (!template) return;

    template.componentIds.add(componentId);
    this.herbAPI.setTemplateSource(componentId, template.source);

    this.herbAPI.emit('template:linked', { templateId, componentId });
  }

  unlinkTemplateFromComponent(templateId: string, componentId: string): void {
    const template = this.templates.get(templateId);
    if (!template) return;

    template.componentIds.delete(componentId);

    this.herbAPI.emit('template:unlinked', { templateId, componentId });
  }

  getTemplate(templateId: string): TemplateInfo | undefined {
    return this.templates.get(templateId);
  }

  getTemplateByPath(path: string): TemplateInfo | undefined {
    const templateId = this.templatesByPath.get(path);
    return templateId ? this.templates.get(templateId) : undefined;
  }

  getAllTemplates(): Map<string, TemplateInfo> {
    return new Map(this.templates);
  }

  getTemplatesForComponent(componentId: string): TemplateInfo[] {
    const result: TemplateInfo[] = [];

    this.templates.forEach(template => {
      if (template.componentIds.has(componentId)) {
        result.push(template);
      }
    });

    return result;
  }

  parseTemplate(source: string): {
    components: Array<{
      name: string;
      startLine: number;
      endLine: number;
      props?: string[];
    }>;
    includes: string[];
    partials: string[];
  } {
    const components: any[] = [];
    const includes: string[] = [];
    const partials: string[] = [];

    const lines = source.split('\n');

    // ERB component patterns
    const componentPatterns = [
      // <%= component "name", props %>
      /<%=\s*component\s+["']([^"']+)["'](?:\s*,\s*(.+?))?\s*%>/g,
      // <%= render component: "name", props %>
      /<%=\s*render\s+component:\s*["']([^"']+)["'](?:\s*,\s*(.+?))?\s*%>/g,
      // <%= render "name", props %>
      /<%=\s*render\s+["']([^"']+)["'](?:\s*,\s*(.+?))?\s*%>/g
    ];

    const includePatterns = [
      // <%= include "path" %>
      /<%=\s*include\s+["']([^"']+)["']\s*%>/g,
      // <% include "path" %>
      /<%(.*?)\s*include\s+["']([^"']+)["'].*?%>/g
    ];

    const partialPatterns = [
      // <%= partial "path" %>
      /<%=\s*partial\s+["']([^"']+)["']\s*%>/g,
      // <%= render partial: "path" %>
      /<%=\s*render\s+partial:\s*["']([^"']+)["']\s*%>/g
    ];

    lines.forEach((line, lineNumber) => {
      componentPatterns.forEach(pattern => {
        let match;
        while ((match = pattern.exec(line)) !== null) {
          components.push({
            name: match[1],
            startLine: lineNumber + 1,
            endLine: lineNumber + 1,
            props: match[2] ? this.parseProps(match[2]) : undefined
          });
        }
      });

      includePatterns.forEach(pattern => {
        let match;
        while ((match = pattern.exec(line)) !== null) {
          const path = match[2] || match[1];
          if (path && !includes.includes(path)) {
            includes.push(path);
          }
        }
      });

      partialPatterns.forEach(pattern => {
        let match;
        while ((match = pattern.exec(line)) !== null) {
          if (!partials.includes(match[1])) {
            partials.push(match[1]);
          }
        }
      });
    });

    return { components, includes, partials };
  }

  registerTemplateFromElement(element: HTMLElement, componentId: string): void {
    const templatePath = element.getAttribute('data-template');
    const templateSource = element.getAttribute('data-template-source');

    if (templateSource) {
      const templateId = `template-${componentId}`;
      this.registerTemplate(templateId, templateSource, {
        path: templatePath || undefined,
        language: this.detectLanguageFromPath(templatePath || undefined)
      });
      this.linkTemplateToComponent(templateId, componentId);
    } else if (templatePath) {
      this.fetchTemplateFromPath(templatePath, componentId);
    }
  }

  enableHotReload(): void {
    window.addEventListener('message', (event) => {
      if (event.data?.type === 'herb-template-updated' && event.data?.source === 'herb-dev-server') {
        const { templatePath, source } = event.data.data;
        const templateId = this.templatesByPath.get(templatePath);

        if (templateId) {
          this.updateTemplate(templateId, source);
          console.log(`🔥 Hot reloaded template: ${templatePath}`);
        }
      }
    });
  }

  private detectLanguage(source: string, path?: string): 'erb' | 'html' {
    if (path) {
      return this.detectLanguageFromPath(path);
    }

    if (source.includes('<%') || source.includes('%>')) {
      return 'erb';
    }

    return 'html';
  }

  private detectLanguageFromPath(path?: string): 'erb' | 'html' {
    if (!path) return 'html';

    if (path.endsWith('.erb') || path.includes('.html.erb')) {
      return 'erb';
    }

    return 'html';
  }

  private parseProps(propsString: string): string[] {
    const props: string[] = [];

    if (propsString.trim().startsWith('{')) {
      const hashMatch = propsString.match(/\{([^}]+)\}/);
      if (hashMatch) {
        const pairs = hashMatch[1].split(',');
        pairs.forEach(pair => {
          const [key] = pair.split(':').map(s => s.trim());
          if (key) {
            props.push(key.replace(/^['"]|['"]$/g, ''));
          }
        });
      }
    } else {
      const variables = propsString.split(/[,\s]+/).filter(v => v.trim());
      props.push(...variables);
    }

    return props;
  }

  private async fetchTemplateFromPath(path: string, componentId: string): Promise<void> {
    try {
      const templateId = `template-${path.replace(/[^a-zA-Z0-9]/g, '-')}`;

      this.registerTemplate(templateId, `<!-- Template: ${path} -->\n<!-- Source not available in browser -->`, {
        path,
        language: this.detectLanguageFromPath(path)
      });

      this.linkTemplateToComponent(templateId, componentId);
    } catch (error) {
      console.warn(`Failed to fetch template from ${path}:`, error);
    }
  }
}
