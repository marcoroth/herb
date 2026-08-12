import { defaultFormatOptions } from "@herb-tools/formatter"
import { defaultInlayHintOptions } from "@herb-tools/language-service"

import type { Connection } from "vscode-languageserver/node"
import type { Capabilities } from "./capabilities"

// TODO: ideally we could just Config all the way through
export interface PersonalHerbSettings {
  trace?: {
    server?: string
  }
  linter?: {
    enabled?: boolean
    fixOnSave?: boolean
  }
  formatter?: {
    enabled?: boolean
    indentWidth?: number
    indentStyle?: "space" | "tab"
    maxLineLength?: number
  }
  inlayHints?: {
    enabled?: boolean
    minimumLines?: number
    maximumClasses?: number
  }
}

/**
 * What every one of these settings falls back to. Editors that surface them as
 * their own preferences read from here rather than restating the values, so
 * there is one place to change a default.
 */
export const defaultPersonalSettings: PersonalHerbSettings = {
  linter: {
    enabled: true,
    fixOnSave: true
  },
  formatter: {
    enabled: false,
    indentWidth: defaultFormatOptions.indentWidth,
    indentStyle: defaultFormatOptions.indentStyle,
    maxLineLength: defaultFormatOptions.maxLineLength
  },
  inlayHints: {
    enabled: true,
    minimumLines: defaultInlayHintOptions.minimumLines,
    maximumClasses: defaultInlayHintOptions.maximumClasses
  }
}

/**
 * The editor-level preferences a user sets for themselves, which are per-document
 * because a client can scope them to a folder. Project-level `.herb.yml` settings
 * are owned by `Project` and deliberately not merged in here.
 */
export class UserSettings {
  readonly defaults: PersonalHerbSettings = defaultPersonalSettings

  global: PersonalHerbSettings = this.defaults

  private readonly connection: Connection
  private readonly capabilities: Capabilities
  private readonly byDocument: Map<string, Thenable<PersonalHerbSettings>> = new Map()

  constructor(connection: Connection, capabilities: Capabilities) {
    this.connection = connection
    this.capabilities = capabilities
  }

  getDocumentSettings(resource: string): Thenable<PersonalHerbSettings> {
    if (!this.capabilities.hasConfiguration) {
      return Promise.resolve(this.withDefaults(this.global))
    }

    const cached = this.byDocument.get(resource)

    if (cached) return cached

    const requested = this.connection.workspace.getConfiguration({
      scopeUri: resource,
      section: "languageServerHerb",
    }).then((settings: PersonalHerbSettings) => this.withDefaults(settings))

    this.byDocument.set(resource, requested)

    return requested
  }

  forget(resource: string) {
    this.byDocument.delete(resource)
  }

  forgetAll() {
    this.byDocument.clear()
  }

  /**
   * Layers an answer from the client over what we already have. A client that
   * supports `workspace/configuration` but has nothing filed under
   * `languageServerHerb`, which is every editor that keeps LSP settings under
   * its own key, answers with nothing, and then the settings it sent at
   * `initialize` are all we have to go on.
   */
  private withDefaults(settings: PersonalHerbSettings | null): PersonalHerbSettings {
    const resolved = settings || this.global

    return {
      trace: resolved.trace,
      linter: {
        enabled: resolved.linter?.enabled ?? this.defaults.linter!.enabled!,
        fixOnSave: resolved.linter?.fixOnSave ?? this.defaults.linter!.fixOnSave!
      },
      formatter: {
        enabled: resolved.formatter?.enabled ?? this.defaults.formatter!.enabled!,
        indentWidth: resolved.formatter?.indentWidth ?? this.defaults.formatter!.indentWidth!,
        indentStyle: resolved.formatter?.indentStyle ?? this.defaults.formatter!.indentStyle!,
        maxLineLength: resolved.formatter?.maxLineLength ?? this.defaults.formatter!.maxLineLength!
      },
      inlayHints: {
        enabled: resolved.inlayHints?.enabled ?? this.defaults.inlayHints!.enabled!,
        minimumLines: resolved.inlayHints?.minimumLines ?? this.defaults.inlayHints!.minimumLines!,
        maximumClasses: resolved.inlayHints?.maximumClasses ?? this.defaults.inlayHints!.maximumClasses!
      }
    }
  }
}
