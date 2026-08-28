import baseStyles from './base.css'

import { injectStyle } from './styles.js'

import { HerbClient } from './dev-server/client.js'
import { HerbOverlay } from './overlay/overlay.js'
import { RuntimePanel } from './runtime/panel.js'

import type { DiagnosticSink, HerbClientOptions } from './dev-server/types.js'
import type { RuntimeReportHandle } from './runtime/panel.js'
import type { RuntimeDiagnostic } from './runtime/report.js'

import { DEV_SERVER_ORIGIN } from './dev-server/diagnostics.js'

const NOOP_HANDLE: RuntimeReportHandle = { dismiss() {} }

export const DEV_TOOLS_START_EVENT = 'herb:dev-tools-start'

export interface HerbDevToolsOptions {
  projectPath?: string
  devServer?: boolean | HerbClientOptions
  overlay?: boolean
  runtimePanel?: boolean
}

declare global {
  interface Window {
    HerbDevTools?: HerbDevTools
  }
}

export class HerbDevTools {
  private static current: HerbDevTools | null = null

  static start(options: HerbDevToolsOptions = {}): HerbDevTools | null {
    if (HerbDevTools.current) {
      console.warn('[herb-dev-tools] already started, ignoring this start() call')

      return null
    }

    const devTools = new HerbDevTools(options)

    HerbDevTools.current = devTools
    window.HerbDevTools = devTools

    devTools.setup()

    if (typeof document !== 'undefined') {
      document.dispatchEvent(new CustomEvent(DEV_TOOLS_START_EVENT, { detail: devTools }))
    }

    return devTools
  }

  static get instance(): HerbDevTools | null {
    return HerbDevTools.current
  }

  private devServerClient: HerbClient | null = null
  private devToolsOverlay: HerbOverlay | null = null
  private panel: RuntimePanel | null = null
  private styleElement: HTMLStyleElement | null = null

  private constructor(private options: HerbDevToolsOptions) {}

  stop(): void {
    if (HerbDevTools.current !== this) return

    HerbDevTools.current = null

    this.devServerClient?.disconnect()
    this.devServerClient = null

    this.devToolsOverlay?.destroy()
    this.devToolsOverlay = null

    this.panel?.destroy()
    this.panel = null

    this.styleElement?.remove()
    this.styleElement = null

    if (window.HerbDevTools === this) {
      delete window.HerbDevTools
    }
  }

  get client(): HerbClient | null {
    return this.devServerClient
  }

  get overlay(): HerbOverlay | null {
    return this.devToolsOverlay
  }

  get runtimePanel(): RuntimePanel | null {
    return this.panel
  }

  report(input: RuntimeDiagnostic | RuntimeDiagnostic[]): RuntimeReportHandle {
    return this.panel?.report(input) ?? NOOP_HANDLE
  }

  clear(origin?: string): void {
    this.panel?.clear(origin)
  }

  show(options: { open?: boolean } = {}): void {
    this.panel?.show(options)
  }

  open(options: { expanded?: boolean } = {}): void {
    this.panel?.show({ open: true })

    if (options.expanded === true) {
      this.panel?.expand()
    } else if (options.expanded === false) {
      this.panel?.collapse()
    }
  }

  close(): void {
    this.panel?.close()
  }

  private setup(): void {
    this.injectStyles()

    const runtimePanelEnabled = this.options.runtimePanel !== false

    if (this.options.devServer !== false) {
      const clientOptions = typeof this.options.devServer === 'object' ? this.options.devServer : {}

      this.devServerClient = new HerbClient({ ...clientOptions, diagnostics: () => this.diagnosticSink() })
      this.devServerClient.connect()
    }

    if (this.options.overlay !== false) {
      this.devToolsOverlay = new HerbOverlay({
        projectPath: this.options.projectPath,
        devServerClient: this.devServerClient,
        onMenuOpen: () => this.panel?.close(),
        onReinitialize: () => this.panel?.refresh(),
        isRuntimePanelVisible: runtimePanelEnabled ? () => this.panel === null || !this.panel.dismissed : undefined,
        onRuntimePanelToggle: runtimePanelEnabled
          ? visible => (visible ? this.panel?.show() : this.panel?.dismiss())
          : undefined,
      })
    }

    if (runtimePanelEnabled) {
      this.panel = new RuntimePanel({
        onOpenFile: (file, line, column) => this.devToolsOverlay?.openFileInEditor(file, line, column),
        onOpen: () => this.devToolsOverlay?.closeMenu(),
        onRender: () => this.devServerClient?.refreshConnection(),
      })

      this.devToolsOverlay?.syncRuntimePanelToggle()
    }
  }

  private diagnosticSink(): DiagnosticSink | null {
    const panel = this.panel

    if (panel === null) {
      return null
    }

    return {
      report: diagnostics => {
        panel.report(diagnostics)
      },
      clear: () => panel.clear(DEV_SERVER_ORIGIN),
    }
  }

  private injectStyles(): void {
    this.styleElement = injectStyle('base', baseStyles)
  }
}
