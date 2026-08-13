import { Herb } from "@herb-tools/browser"

import type { DiffOperation, DiffOperationType, DiffOptions, DiffResult, SerializedNode } from "@herb-tools/core"

const FEED_LIMIT = 50

type RenderableNode = SerializedNode & {
  content?: any
  tag_name?: { value?: string }
  name?: { children?: any[] }
  value?: { children?: any[] }
}

type FeedEntry = {
  timestamp: Date
  operations: DiffOperation[]
  source: string
  previousSource: string
}

export type DiffElements = {
  viewer: HTMLElement | null
  output: HTMLElement | null
  status: HTMLElement | null
  parseError: HTMLElement | null
  liveButton: HTMLElement | null
  checkpointButton: HTMLElement | null
  snapshotButton: HTMLElement | null
  checkButton: HTMLElement | null
  whitespaceCheckbox: HTMLInputElement | null
}

export type DiffCallbacks = {
  getSource: () => string
  setSource?: (source: string) => void
  onOptionsChanged?: () => void
}

type ModeStyle = { color: string, background: string }

const OPERATION_STYLES: Record<DiffOperationType, { css: string, icon: string }> = {
  node_inserted:           { css: "inserted",   icon: "fa-plus" },
  node_removed:            { css: "removed",    icon: "fa-minus" },
  node_replaced:           { css: "replaced",   icon: "fa-right-left" },
  text_changed:            { css: "changed",    icon: "fa-pen" },
  whitespace_changed:      { css: "whitespace", icon: "fa-arrows-left-right-to-line" },
  erb_content_changed:     { css: "erb",        icon: "fa-code" },
  attribute_added:         { css: "attribute",  icon: "fa-plus" },
  attribute_removed:       { css: "removed",    icon: "fa-minus" },
  attribute_value_changed: { css: "attribute",  icon: "fa-pen" },
  tag_name_changed:        { css: "tag",        icon: "fa-tag" },
  node_moved:              { css: "moved",      icon: "fa-arrows-alt" },
  node_wrapped:            { css: "wrapped",    icon: "fa-compress" },
  node_unwrapped:          { css: "unwrapped",  icon: "fa-expand" },
}

const ACTIVE_MODE_STYLE = { color: "#e5c07b", background: "rgba(229, 192, 123, 0.2)" }
const INACTIVE_MODE_STYLE = { color: "#abb2bf", background: "rgba(171, 178, 191, 0.1)" }

function escapeHtml(unsafe: string): string {
  return String(unsafe)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
}

function visualizeWhitespace(value: string): string {
  return value.replace(/\t/g, "→").replace(/\n/g, "⏎").replace(/ /g, "·")
}

function extractNodeValue(node: RenderableNode | null | undefined, operationType: DiffOperationType): string | null {
  if (!node) return null

  if (operationType === "whitespace_changed") {
    return node.content ? visualizeWhitespace(node.content) : null
  }

  if (operationType === "text_changed" || node.type === "AST_HTML_TEXT_NODE") {
    return node.content || null
  }

  if (operationType === "erb_content_changed" || node.type === "AST_ERB_CONTENT_NODE") {
    if (node.content && node.content.value) return node.content.value

    return null
  }

  if (operationType === "attribute_value_changed" || operationType === "attribute_added" || operationType === "attribute_removed") {
    if (node.type === "AST_HTML_ATTRIBUTE_NODE") {
      let result = ""

      if (node.name && node.name.children) {
        result += node.name.children.map((child: any) => child.content || child.value || "").join("")
      }

      if (node.value && node.value.children) {
        result += `="${node.value.children.map((child: any) => child.content || child.value || "").join("")}"`
      }

      return result || null
    }
  }

  if (node.type === "AST_HTML_ELEMENT_NODE" || node.type === "AST_HTML_CONDITIONAL_ELEMENT_NODE") {
    if (node.tag_name && node.tag_name.value) return `<${node.tag_name.value}>`

    return null
  }

  if (node.type === "AST_LITERAL_NODE" || node.type === "AST_RUBY_LITERAL_NODE") {
    return node.content || null
  }

  return null
}

function describeNode(node: RenderableNode | null | undefined, operationType: DiffOperationType): string {
  if (!node) return "unknown"

  if (node.type === "AST_HTML_ELEMENT_NODE" || node.type === "AST_HTML_CONDITIONAL_ELEMENT_NODE") {
    if (node.tag_name && node.tag_name.value) return `<${node.tag_name.value}>`
  }

  if (node.type === "AST_HTML_TEXT_NODE") {
    const trimmed = (node.content || "").trim()

    return trimmed.length > 30 ? `"${trimmed.slice(0, 30)}..."` : `"${trimmed}"`
  }

  if (node.type === "AST_ERB_CONTENT_NODE" && node.content && node.content.value) {
    return `<%= ${node.content.value.trim()} %>`
  }

  if (node.type === "AST_ERB_IF_NODE" || node.type === "AST_ERB_UNLESS_NODE") {
    const keyword = node.type === "AST_ERB_IF_NODE" ? "if" : "unless"
    const condition = node.content && node.content.value ? node.content.value.trim().replace(/^(if|unless)\s+/, "") : ""

    return condition ? `<% ${keyword} ${condition} %>` : `<% ${keyword} %>`
  }

  if (node.type && node.type.startsWith("AST_ERB_")) {
    const keyword = node.type.replace("AST_ERB_", "").replace("_NODE", "").toLowerCase().replace(/_/g, " ")
    const condition = node.content && node.content.value ? node.content.value.trim() : ""

    return condition ? `<% ${condition} %>` : `<% ${keyword} %>`
  }

  const value = extractNodeValue(node, operationType)

  if (value) return value

  return node.type.replace("AST_", "").replace("_NODE", "").toLowerCase().replace(/_/g, " ")
}

export class DiffView {
  #elements: DiffElements
  #getSource: () => string
  #setSource?: (source: string) => void
  #onOptionsChanged?: () => void

  #mode: "live" | "checkpoint" = "live"
  #snapshotSource: string | null = null
  #feed: FeedEntry[] = []
  #noChangeset = false
  #previousSource: string | null = null

  constructor(elements: DiffElements, { getSource, setSource, onOptionsChanged }: DiffCallbacks) {
    this.#elements = elements
    this.#getSource = getSource
    this.#setSource = setSource
    this.#onOptionsChanged = onOptionsChanged
  }

  get mode(): string {
    return this.#mode
  }

  get options(): DiffOptions {
    const checkbox = this.#elements.whitespaceCheckbox

    if (!checkbox) return {}

    return { track_whitespace_changes: checkbox.checked }
  }

  setModeLive(): void {
    this.#mode = "live"
    this.#snapshotSource = null

    this.#styleButton(this.#elements.liveButton, ACTIVE_MODE_STYLE)
    this.#styleButton(this.#elements.checkpointButton, INACTIVE_MODE_STYLE)

    this.#elements.snapshotButton?.classList.add("hidden")
    this.#elements.checkButton?.classList.add("hidden")

    this.update()
  }

  setModeCheckpoint(): void {
    this.#mode = "checkpoint"

    this.#styleButton(this.#elements.checkpointButton, ACTIVE_MODE_STYLE)
    this.#styleButton(this.#elements.liveButton, INACTIVE_MODE_STYLE)

    this.#elements.snapshotButton?.classList.remove("hidden")
    this.#elements.checkButton?.classList.remove("hidden")

    if (!this.#snapshotSource) this.takeSnapshot()

    this.#setStatus("Checkpoint mode - click Snapshot then edit and Diff")
  }

  takeSnapshot(): void {
    this.#snapshotSource = this.#getSource()

    this.#setStatus("Snapshot taken - edit the code then click Diff")
    this.#setOutput('<span class="text-gray-400">Snapshot captured. Edit the code and click "Diff" to compare.</span>')
  }

  checkpoint(): void {
    if (!this.#snapshotSource) {
      this.#setStatus("No snapshot - click Snapshot first")

      return
    }

    const value = this.#getSource()

    try {
      const result = Herb.diff(this.#snapshotSource, value, this.options)

      this.#renderResult(result, this.#snapshotSource !== value)
    } catch (error) {
      console.error("Diff error:", error)
      this.#setStatus("Error computing diff")
    }
  }

  optionsChanged(): void {
    this.#onOptionsChanged?.()
    this.#noChangeset = false

    if (this.#mode === "checkpoint") {
      if (this.#snapshotSource) this.checkpoint()

      return
    }

    this.#feed = []
    this.#previousSource = null

    this.update()
  }

  clearFeed(): void {
    this.#feed = []
    this.#noChangeset = false
    this.#previousSource = this.#getSource()

    this.#setOutput('<span class="diff-empty">Feed cleared. Start typing to see live differences...</span>')
    this.hideParseError()
    this.#setStatus("Cleared")
  }

  update(parseSuccess = true): void {
    if (!this.#elements.viewer) return
    if (this.#mode !== "live") return

    const value = this.#getSource()

    if (this.#previousSource === null) {
      this.#previousSource = value
      this.#feed = []

      this.#setOutput('<span class="diff-empty">Start typing to see live differences...</span>')

      return
    }

    if (this.#previousSource === value) return

    if (!parseSuccess) {
      this.showParseError()
      this.#setStatus("Paused")

      return
    }

    this.hideParseError()

    try {
      const result = Herb.diff(this.#previousSource, value, this.options)

      if (result.identical) {
        this.#noChangeset = true
      } else {
        this.#noChangeset = false

        this.#feed.unshift({
          timestamp: new Date(),
          operations: result.operations,
          source: value,
          previousSource: this.#previousSource,
        })

        if (this.#feed.length > FEED_LIMIT) this.#feed = this.#feed.slice(0, FEED_LIMIT)
      }

      this.#renderFeed(result)
      this.#previousSource = value
    } catch (error) {
      console.error("Diff error:", error)
    }
  }

  showParseError(): void {
    this.#elements.parseError?.classList.remove("hidden")
  }

  hideParseError(): void {
    this.#elements.parseError?.classList.add("hidden")
  }

  #styleButton(button: HTMLElement | null, style: ModeStyle): void {
    if (!button) return

    button.style.color = style.color
    button.style.background = style.background
  }

  #setOutput(html: string): void {
    if (!this.#elements.output) return

    this.#elements.output.innerHTML = html
  }

  #setStatus(text: string): void {
    const status = this.#elements.status

    if (!status) return

    status.className = "px-2 py-1 text-xs rounded font-mono font-medium"

    if (text.includes("Identical") || text.includes("Cleared")) {
      status.style.color = "#90b874"
      status.style.background = "rgba(144, 184, 116, 0.15)"
    } else if (text.includes("change") || text.includes("difference")) {
      status.style.color = "#e5c07b"
      status.style.background = "rgba(229, 192, 123, 0.15)"
    } else {
      status.style.color = "#abb2bf"
      status.style.background = "rgba(171, 178, 191, 0.1)"
    }

    status.textContent = text
  }

  #renderFeed(latestResult?: DiffResult): void {
    if (!this.#elements.output) return

    if (this.#feed.length === 0) {
      if (this.#noChangeset) {
        this.#setOutput(this.#noChangesetNotice())
        this.#setStatus("No changeset")
      } else if (latestResult && latestResult.identical) {
        this.#setOutput('<span class="diff-empty">No changes detected.</span>')
        this.#setStatus("Identical")
      }

      return
    }

    const totalOperations = this.#feed.reduce((sum, entry) => sum + entry.operations.length, 0)

    this.#setStatus(`${totalOperations} change${totalOperations === 1 ? "" : "s"} in ${this.#feed.length} edit${this.#feed.length === 1 ? "" : "s"}`)

    let html = this.#noChangeset ? this.#noChangesetNotice() : ""

    this.#feed.forEach((entry, entryIndex) => {
      const time = entry.timestamp.toLocaleTimeString()
      const isCurrent = entryIndex === 0

      html += `<div class="${isCurrent ? "diff-feed-current" : "diff-feed-past"} mb-4">`
      html += `<div class="diff-feed-header flex items-center gap-2 text-xs font-mono">`
      html += `<span>${isCurrent ? "Latest" : time}</span>`
      html += `<span class="diff-location">${entry.operations.length} operation${entry.operations.length === 1 ? "" : "s"}</span>`

      if (!isCurrent && entry.source) {
        html += `<button class="diff-rollback-button ml-auto" data-diff-rollback-index="${entryIndex}" title="Restore editor to this point">`
        html += `<i class="fas fa-rotate-left"></i> Rollback to this`
        html += `</button>`
      } else if (isCurrent && entry.previousSource) {
        html += `<button class="diff-rollback-button ml-auto" data-diff-undo-index="${entryIndex}" title="Undo this change">`
        html += `<i class="fas fa-rotate-left"></i> Undo`
        html += `</button>`
      }

      html += `</div>`
      html += this.#renderOperations(entry.operations)
      html += `</div>`
    })

    this.#setOutput(html)
    this.#bindRollbackButtons()
  }

  #bindRollbackButtons(): void {
    const output = this.#elements.output

    if (!output) return

    output.querySelectorAll("[data-diff-rollback-index]").forEach((button) => {
      button.addEventListener("click", (event) => {
        event.preventDefault()
        this.#rollbackTo(parseInt((button as HTMLElement).dataset.diffRollbackIndex!))
      })
    })

    output.querySelectorAll("[data-diff-undo-index]").forEach((button) => {
      button.addEventListener("click", (event) => {
        event.preventDefault()
        this.#undo(parseInt((button as HTMLElement).dataset.diffUndoIndex!))
      })
    })
  }

  #rollbackTo(entryIndex: number): void {
    const entry = this.#feed[entryIndex]

    if (!entry || !entry.source) return

    this.#feed = this.#feed.slice(entryIndex)
    this.#previousSource = entry.source

    this.#setSource?.(entry.source)
  }

  #undo(entryIndex: number): void {
    const entry = this.#feed[entryIndex]

    if (!entry || !entry.previousSource) return

    this.#feed.shift()
    this.#previousSource = entry.previousSource

    this.#setSource?.(entry.previousSource)
  }

  #renderResult(result: DiffResult, sourceChanged = false): void {
    if (!this.#elements.output) return

    if (result.identical) {
      if (sourceChanged) {
        this.#setOutput(this.#noChangesetNotice())
        this.#setStatus("No changeset")
      } else {
        this.#setOutput('<span class="diff-empty">Trees are identical - no differences found.</span>')
        this.#setStatus("Identical")
      }

      return
    }

    const operations = result.operations

    this.#setStatus(`${operations.length} difference${operations.length === 1 ? "" : "s"}`)
    this.#setOutput(this.#renderOperations(operations))
  }

  #noChangesetNotice(): string {
    const hint = this.options.track_whitespace_changes
      ? "The edit does not affect the syntax tree."
      : "Whitespace that HTML collapses is not reported. Enable \"Track insignificant whitespace changes\" to see it."

    let html = `<div class="diff-no-changeset">`
    html += `<div class="text-sm font-semibold"><i class="fas fa-circle-info mr-2"></i>Source changed, but no changeset was emitted.</div>`
    html += `<div class="text-xs diff-no-changeset-hint">${hint}</div>`
    html += `</div>`

    return html
  }

  #renderOperations(operations: DiffOperation[]): string {
    let html = ""

    operations.forEach((operation, index) => {
      const style = OPERATION_STYLES[operation.type] || { css: "changed", icon: "fa-circle" }
      const typeLabel = operation.type.replace(/_/g, " ")

      html += `<div class="diff-operation diff-op-${style.css}">`
      html += `<div class="flex items-center gap-2">`
      html += `<span class="diff-index text-xs font-mono">#${index + 1}</span>`
      html += `<i class="fas ${style.icon} diff-label-${style.css} text-xs"></i>`
      html += `<span class="diff-label-${style.css} font-semibold text-sm">${typeLabel}</span>`
      html += `<span class="diff-path text-xs font-mono ml-auto">[${operation.path.join(", ")}]</span>`
      html += `</div>`

      const oldNode = operation.oldNode as RenderableNode | null
      const newNode = operation.newNode as RenderableNode | null

      if (operation.type === "node_wrapped" && oldNode && newNode) {
        html += `<div class="text-xs mt-1 font-mono">`
        html += `<span class="diff-value-old">${escapeHtml(describeNode(oldNode, operation.type))}</span>`
        html += ` wrapped in `
        html += `<span class="diff-value-new">${escapeHtml(describeNode(newNode, operation.type))}</span>`
        html += `</div>`
      } else if (operation.type === "node_unwrapped" && oldNode && newNode) {
        html += `<div class="text-xs mt-1 font-mono">`
        html += `<span class="diff-value-new">${escapeHtml(describeNode(newNode, operation.type))}</span>`
        html += ` unwrapped from `
        html += `<span class="diff-value-old">${escapeHtml(describeNode(oldNode, operation.type))}</span>`
        html += `</div>`
      } else {
        html += this.#renderNodeChange(oldNode, operation.type, "removed", "-")
        html += this.#renderNodeChange(newNode, operation.type, "inserted", "+")
      }

      html += `</div>`
    })

    return html
  }

  #renderNodeChange(node: RenderableNode | null | undefined, operationType: DiffOperationType, label: "removed" | "inserted", sign: string): string {
    if (!node) return ""

    let html = `<div class="text-xs mt-1 font-mono"><span class="diff-label-${label}">${sign}</span> <span class="diff-node-type">${node.type}</span>`

    if (node.location) {
      html += ` <span class="diff-location">(${node.location.start.line}:${node.location.start.column})</span>`
    }

    html += `</div>`

    const value = extractNodeValue(node, operationType)

    if (value !== null) {
      html += `<div class="text-xs font-mono diff-value-${label === "removed" ? "old" : "new"}">${escapeHtml(value)}</div>`
    }

    return html
  }
}
