import { window,  workspace } from "vscode"
import { DecorationOptions, DecorationRangeBehavior, Disposable, MarkdownString, Range, TextEditor, TextEditorDecorationType, ThemeColor } from "vscode"
import type { Client } from "./client"

interface RuntimeOverlay {
  range: { start: { line: number; character: number }; end: { line: number; character: number } }
  text: string
  code: string | null
  origin: string | null
  recent: { value: string; at: string | null }[]
}

export type RuntimeOverlayDisplay = "replace" | "report" | "off"

const SETTING = "languageServerHerb.runtimeOverlays.display"
const DEBOUNCE = 150
const MAX_LENGTH = 120

export const DISPLAY_MODES: RuntimeOverlayDisplay[] = ["replace", "report", "off"]

/**
 * Shows a tag as the thing it rendered instead of the expression that rendered it,
 * so a template reads "Upcoming events" where it says `<%= t(".title") %>`.
 *
 * This cannot be done from the language server. LSP can add text beside a range
 * (an inlay hint) but has nothing that replaces or hides one, so the server says
 * what to draw and the editor's decoration API is what draws it. Hiding the
 * source is a CSS trick on a decoration, which is an editor concept and not a
 * protocol one.
 *
 * Which of those two things is wanted depends on what the file is being opened
 * for, so it is a setting rather than a decision made here. Reading a template
 * is easier when it shows what it produced; editing one is impossible when the
 * code is hidden. `replace` swaps the tag for its value, `report` leaves the tag
 * alone and marks it as having one.
 *
 * Under `replace` the overlay is dropped on whichever lines the selection
 * touches, because text you cannot see is text you cannot edit. Moving the caret
 * onto a tag reveals it and moving away hides it again.
 */
export class RuntimeOverlayProvider {
  private readonly client: Client

  private readonly replaced = window.createTextEditorDecorationType({
    textDecoration: "none; display: none;",
    rangeBehavior: DecorationRangeBehavior.ClosedClosed,
  })

  private readonly reported = window.createTextEditorDecorationType({
    textDecoration: "underline dashed 1px",
    rangeBehavior: DecorationRangeBehavior.ClosedClosed,
  })

  private timer: NodeJS.Timeout | undefined

  constructor(client: Client) {
    this.client = client
  }

  register(): Disposable[] {
    return [
      this.replaced,
      this.reported,
      window.onDidChangeVisibleTextEditors(() => this.refreshAll()),
      window.onDidChangeTextEditorSelection(event => this.refresh(event.textEditor)),
      workspace.onDidChangeTextDocument(event => {
        for (const editor of window.visibleTextEditors) {
          if (editor.document === event.document) this.schedule(editor)
        }
      }),
      workspace.onDidChangeConfiguration(event => {
        if (event.affectsConfiguration(SETTING)) this.refreshAll()
      }),
      this.client.onNotification("herb/runtimeReportsChanged", () => this.refreshAll()),
    ]
  }

  refreshAll() {
    for (const editor of window.visibleTextEditors) {
      this.refresh(editor)
    }
  }

  display(): RuntimeOverlayDisplay {
    return workspace.getConfiguration().get<RuntimeOverlayDisplay>(SETTING, "replace")
  }

  private schedule(editor: TextEditor) {
    if (this.timer) clearTimeout(this.timer)

    this.timer = setTimeout(() => this.refresh(editor), DEBOUNCE)
  }

  private async refresh(editor: TextEditor) {
    const display = this.display()

    if (display === "off" || !this.erb(editor)) {
      this.clear(editor)

      return
    }

    let overlays: RuntimeOverlay[]

    try {
      overlays = await this.client.sendRequest<RuntimeOverlay[]>("herb/runtimeOverlays", {
        textDocument: { uri: editor.document.uri.toString() },
      })
    } catch {
      return
    }

    if (!window.visibleTextEditors.includes(editor)) return

    const decorations = overlays.flatMap(overlay => this.decoration(editor, overlay, display))

    editor.setDecorations(this.of(display), decorations)
    editor.setDecorations(this.of(display === "replace" ? "report" : "replace"), [])
  }

  private clear(editor: TextEditor) {
    editor.setDecorations(this.replaced, [])
    editor.setDecorations(this.reported, [])
  }

  private of(display: RuntimeOverlayDisplay): TextEditorDecorationType {
    return display === "replace" ? this.replaced : this.reported
  }

  private erb(editor: TextEditor): boolean {
    return editor.document.languageId === "erb" || editor.document.fileName.endsWith(".erb")
  }

  private decoration(editor: TextEditor, overlay: RuntimeOverlay, display: RuntimeOverlayDisplay): DecorationOptions[] {
    const range = new Range(
      overlay.range.start.line,
      overlay.range.start.character,
      overlay.range.end.line,
      overlay.range.end.character,
    )

    if (display === "replace" && editor.selections.some(selection => this.sharesLine(selection, range))) {
      return []
    }

    const option: DecorationOptions = {
      range,
      hoverMessage: this.hover(editor, overlay, range, display),
    }

    if (display === "replace") {
      option.renderOptions = {
        after: {
          contentText: this.text(overlay.text),
          color: new ThemeColor("editorCodeLens.foreground"),
          backgroundColor: new ThemeColor("editor.inlayHint.background"),
          margin: "0 0.15em",
          fontStyle: "normal",
        },
      }
    }

    return [option]
  }

  private hover(editor: TextEditor, overlay: RuntimeOverlay, range: Range, display: RuntimeOverlayDisplay): MarkdownString {
    const hover = new MarkdownString()

    hover.appendMarkdown("**Source**\n")
    hover.appendCodeblock(editor.document.getText(range), "erb")

    if (new Set(overlay.recent.map(entry => entry.value)).size > 1) {
      hover.appendMarkdown(`\n**Last ${overlay.recent.length} renders**\n`)
      hover.appendMarkdown(overlay.recent.map(entry => `- ${this.text(entry.value)}`).join("\n"))
      hover.appendMarkdown("\n")
    } else {
      hover.appendMarkdown("\n**Rendered**\n")
      hover.appendCodeblock(overlay.text, "text")
    }

    hover.appendMarkdown(`\nFrom the last time this page was built${overlay.origin ? `, recorded by ${overlay.origin}` : ""}.`)

    hover.appendMarkdown(
      display === "replace"
        ? "\n\nClick the line to edit the tag, or run *Herb: Change Runtime Value Display* to stop replacing it."
        : "\n\nRun *Herb: Change Runtime Value Display* to show this value in place of the tag.",
    )

    return hover
  }

  private sharesLine(selection: { start: { line: number }; end: { line: number } }, range: Range): boolean {
    return selection.start.line <= range.end.line && selection.end.line >= range.start.line
  }

  private text(value: string): string {
    const flattened = value.replace(/\s+/g, " ").trim()

    if (flattened === "") {
      return "″"
    }

    return flattened.length > MAX_LENGTH ? `${flattened.slice(0, MAX_LENGTH)}…` : flattened
  }
}
