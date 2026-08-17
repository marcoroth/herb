import styles from './styles.css'

import { HerbClient } from './dev-server/client.js'
import { HerbOverlay } from './overlay/overlay.js'

import type { HerbClientOptions } from './dev-server/types.js'
import type { ErrorOverlay } from './overlay/error-overlay.js'

export interface HerbDevToolsOptions {
  projectPath?: string
  devServer?: boolean | HerbClientOptions
  overlay?: boolean
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

    return devTools
  }

  static get instance(): HerbDevTools | null {
    return HerbDevTools.current
  }

  private devServerClient: HerbClient | null = null
  private devToolsOverlay: HerbOverlay | null = null
  private styleElement: HTMLStyleElement | null = null

  private constructor(private options: HerbDevToolsOptions) {}

  stop(): void {
    if (HerbDevTools.current !== this) return

    HerbDevTools.current = null

    this.devServerClient?.disconnect()
    this.devServerClient = null

    this.devToolsOverlay?.destroy()
    this.devToolsOverlay = null

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

  get errorOverlay(): ErrorOverlay | null {
    return this.devToolsOverlay?.errorOverlay ?? null
  }

  private setup(): void {
    this.injectStyles()

    if (this.options.devServer !== false) {
      const clientOptions = typeof this.options.devServer === 'object' ? this.options.devServer : {}

      this.devServerClient = new HerbClient({ ...clientOptions, errorOverlay: () => this.errorOverlay })
      this.devServerClient.connect()
    }

    if (this.options.overlay !== false) {
      this.devToolsOverlay = new HerbOverlay({
        projectPath: this.options.projectPath,
        devServerClient: this.devServerClient,
      })
    }
  }

  private injectStyles(): void {
    const element = document.createElement('style')

    element.setAttribute('data-herb-dev-tools', '')
    element.textContent = styles

    document.head.appendChild(element)

    this.styleElement = element
  }
}
