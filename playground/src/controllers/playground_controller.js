import "../style.css"
import "../prism"

// import "@alenaksu/json-viewer"

import lz from "lz-string"
import dedent from "dedent"
import Prism from "prismjs"

import { Controller } from "@hotwired/stimulus"
import { replaceTextareaWithMonaco } from "../monaco"
import { findTreeLocationItemWithSmallestRangeFromPosition } from "../ranges"
import { makeTreeCollapsible, expandAllNodes as expandAll, collapseAllNodes as collapseAll, revealTreeLine } from "../tree-collapse"

import { Herb } from "@herb-tools/browser"
import { Linter } from "@herb-tools/linter"
import { analyze } from "../analyze"
import { analyzeRuby } from "../analyze-ruby"

window.Herb = Herb
window.analyze = analyze

const exampleFile = dedent`
  <!-- Example HTML+ERB File -->

  <input     required />

  <h1     class='bg-gray-300 text-gray"     id=''     data-controller="example">
    Hello World <%= RUBY_VERSION %>
  </h1>

  <h2>
    <% if Date.today.friday? %>
      <div>Happy Friday!</div>
    <% else %>
      <div>Happy Day!</div>
    <% end %>
  </h2>

  <!-- Track whitespace example -->
  <div   class="example"></div   >

  <!-- invalid -->
  </br>

  <!-- mismatched tags -->
  <form></div>

  <!-- missing closing tag -->
  <div>
`

const rubyExampleFile = dedent`
  class User
    attr_reader :name, :email

    def initialize(name, email)
      @name = name
      @email = email
    end

    def greeting
      "Hello, #{name}!"
    end
  end
`

export default class extends Controller {
  static values = {
    mode: { type: String, default: "erb" },
  }

  static targets = [
    "input",
    "parseViewer",
    "parseOutput",
    "parserOptions",
    "rubyViewer",
    "htmlViewer",
    "rewriteViewer",
    "rewriteOutput",
    "rewriteStatus",
    "rewriteActionViewHelpers",
    "lexViewer",
    "formatViewer",
    "formatSuccess",
    "formatError",
    "formatVerification",
    "formatButton",
    "formatTooltip",
    "autofixButton",
    "autofixTooltip",
    "autofixUnsafeWrapper",
    "autofixUnsafeButton",
    "autofixUnsafeTooltip",
    "printerViewer",
    "printerOutput",
    "printerVerification",
    "printerIgnoreErrors",
    "printerDiff",
    "formatterMaxLineLength",
    "printerDiffContent",
    "printerLegend",
    "shareButton",
    "shareTooltip",
    "githubButton",
    "githubTooltip",
    "copyButton",
    "copyTooltip",
    "exampleButton",
    "exampleTooltip",
    "copyViewerButton",
    "copyViewerTooltip",
    "diagnosticsViewer",
    "diagnosticsContent",
    "diagnosticsFilter",
    "noDiagnostics",
    "diagnosticsList",
    "fullViewer",
    "viewerButton",
    "version",
    "time",
    "position",
    "diagnosticStatus",
    "errorCount",
    "warningCount",
    "infoCount",
    "commitHash",
    "prismNodesDeepLabel",
    "switchLink",
    "diffViewer",
    "diffOutput",
    "diffStatus",
    "diffLiveButton",
    "diffCheckpointButton",
    "diffSnapshotButton",
    "diffCheckButton",
    "diffParseError",
  ]

  get isRubyMode() {
    return this.modeValue === "ruby"
  }

  get currentExampleFile() {
    return this.isRubyMode ? rubyExampleFile : exampleFile
  }

  connect() {
    this.currentDiagnosticsFilter = this.restoreDiagnosticsFilter()
    this.allDiagnostics = []

    if (this.isDarkMode) {
      document.documentElement.classList.add('dark')
    }

    document.querySelectorAll('.fa-circle-check').forEach(icon => {
      icon.style.display = 'none'
    })

    this.diffMode = "live"
    this.diffSnapshotSource = null
    this.previousSource = null
    this.diffFeedEntries = []

    this.restoreInput()
    this.restoreActiveTab()

    if (!this.isRubyMode) {
      this.restoreParserOptions()
      this.restorePrinterOptions()
      this.restoreFormatterOptions()
    }

    this.inputTarget.focus()
    this.load()

    this.urlUpdatedFromChangeEvent = false

    this.editor = replaceTextareaWithMonaco("input", this.inputTarget, {
      language: this.isRubyMode ? "ruby" : "erb",
      theme: this.isDarkMode ? 'vs-dark' : 'vs',
      automaticLayout: true,
      minimap: { enabled: false },
    })

    this.editor.onEditorClick((position) => {
      this.editor.clearAllHighlights()
      this.clearTreeLocationHighlights()

      const range = findTreeLocationItemWithSmallestRangeFromPosition(
        this.treeLocations,
        position.lineNumber,
        position.column - 1,
      )

      if (range) {
        revealTreeLine(range.element)
        range.element.classList.add("tree-location-highlight")
        range.element.scrollIntoView({
          behavior: "smooth",
          block: "center",
          inline: "center",
        })
      }
    })

    this.editor.onDidChangeCursorPosition(({ position }) => {
      this.updatePosition(
        position.lineNumber,
        position.column - 1,
        this.editor.getValue().length,
      )
    })

    window.addEventListener("popstate", this.handlePopState)
    window.editor = this.editor

    this.setupSwitchLinks()
    this.setupThemeListener()
    this.setupTooltip()
    this.setupAutofixTooltip()
    this.setupAutofixUnsafeTooltip()
    this.setupShareTooltip()
    this.setupGitHubTooltip()
    this.setupCopyTooltip()
    this.setupExampleTooltip()
    this.setupCopyViewerTooltip()
    this.setupPrinterVerificationTooltip()
  }

  get isDarkMode() {
    const actualTheme = localStorage.getItem('vitepress-theme-actual')

    if (actualTheme) {
      return actualTheme === 'dark'
    }

    return window.matchMedia('(prefers-color-scheme: dark)').matches
  }

  setupSwitchLinks() {
    if (!this.hasSwitchLinkTarget) return

    const isEmbedded = window.frameElement

    if (isEmbedded) {
      const linkMap = {
        "/": "/playground/",
        "/prism/": "/playground/prism",
      }

      this.switchLinkTargets.forEach(link => {
        const href = link.getAttribute("href")
        const parentHref = linkMap[href]

        if (parentHref) {
          link.addEventListener("click", (event) => {
            event.preventDefault()
            window.parent.location.href = parentHref
          })
        }
      })
    }
  }

  setupThemeListener() {
    window.addEventListener('storage', (event) => {
      if (event.key === 'vitepress-theme-actual' && event.newValue) {
        window.location.reload()
      }
    })
  }

  updatePosition(line, column, length) {
    if (this.hasPositionTarget) {
      this.positionTarget.textContent = `Position: ${`(${line}:${column})`.toString().padStart(8)}, Length: ${length.toString().padStart(4)}`
    }
  }

  disconnect() {
    window.removeEventListener("popstate", this.handlePopState)
    this.removeTooltip()
    this.removeAutofixTooltip()
    this.removeAutofixUnsafeTooltip()
    this.removeShareTooltip()
    this.removeGitHubTooltip()
    this.removeCopyTooltip()
    this.removeExampleTooltip()
    this.removeCopyViewerTooltip()
    this.removePrinterVerificationTooltip()
  }

  handlePopState = async (_event) => {
    if (this.urlUpdatedFromChangeEvent === false) {
      this.editor.setValue(this.decompressedValue)
    }
  }

  async load() {
    await Herb.load()
    this.analyze()
  }

  updateURL() {
    window.parent.location.hash = this.compressedValue

    if (!this.isRubyMode) {
      const options = this.getParserOptions()
      const printerOptions = this.getPrinterOptions()
      const formatterOptions = this.getFormatterOptions()
      this.setOptionsInURL(options)
      this.setPrinterOptionsInURL(printerOptions)
      this.setFormatterOptionsInURL(formatterOptions)
    }
  }

  async insert(event) {
    if (
      this.inputTarget.value !== "" &&
      !window.confirm("Do you want to overwrite the current content?")
    ) {
      return
    }

    if (this.editor) {
      this.editor.setValue(this.currentExampleFile)
    } else {
      this.inputTarget.value = this.currentExampleFile
    }

    const button = this.getClosestButton(event.target)

    button.querySelector(".fa-file").classList.add("hidden")
    button.querySelector(".fa-circle-check").classList.remove("hidden")
    this.showTemporaryMessage("Inserted example document to editor", "success")

    setTimeout(() => {
      button.querySelector(".fa-file").classList.remove("hidden")
      button.querySelector(".fa-circle-check").classList.add("hidden")
    }, 1000)
  }

  async share(event) {
    const button = this.getClosestButton(event.target)

    try {
      await navigator.clipboard.writeText(window.parent.location.href)

      button.querySelector(".fa-circle-check").classList.remove("hidden")
      this.showShareSuccessMessage()
    } catch (_error) {
      button.querySelector(".fa-circle-xmark").classList.remove("hidden")
      this.showShareErrorMessage()
    }

    button.querySelector(".fa-share").classList.add("hidden")

    setTimeout(() => {
      button.querySelector(".fa-share").classList.remove("hidden")
      button.querySelector(".fa-circle-xmark").classList.add("hidden")
      button.querySelector(".fa-circle-check").classList.add("hidden")
    }, 1000)
  }

  async copyEditorContent(event) {
    const button = this.getClosestButton(event.target)
    const content = this.editor ? this.editor.getValue() : this.inputTarget.value

    try {
      await navigator.clipboard.writeText(content)
      this.showCopySuccessFixed(button)
      this.showTemporaryMessage("Copied editor content to clipboard", "success")
    } catch (error) {
      console.error('Failed to copy editor content:', error)
      this.showTemporaryMessage("Failed to copy editor content", "error")
    }
  }

  async copyViewerContent(event) {
    const button = this.getClosestButton(event.target)
    const activeViewer = this.activeViewerButton.dataset.viewer
    let content = ''

    switch(activeViewer) {
      case 'parse':
        content = this.parseOutputTarget.textContent
        break
      case 'lex':
        content = this.lexViewerTarget.textContent
        break
      case 'ruby':
        content = this.rubyViewerTarget.textContent
        break
      case 'html':
        content = this.htmlViewerTarget.textContent
        break
      case 'rewrite':
        content = this.rewriteOutputTarget.textContent
        break
      case 'format':
        if (!this.formatSuccessTarget.classList.contains('hidden')) {
          content = this.formatSuccessTarget.textContent
        } else if (!this.formatErrorTarget.classList.contains('hidden')) {
          const blurredPre = this.formatErrorTarget.querySelector('pre.language-html')
          content = blurredPre ? blurredPre.textContent : ''
        }
        break
      case 'printer':
        content = this.printerOutputTarget.textContent
        break
      case 'diagnostics':
        content = this.getDiagnosticsAsText()
        break
    }

    if (content) {
      try {
        await navigator.clipboard.writeText(content)
        this.showCopySuccessFixed(button)
        this.showTemporaryMessage("Copied viewer content to clipboard", "success")
      } catch (error) {
        console.error('Failed to copy viewer content:', error)
        this.showTemporaryMessage("Failed to copy viewer content", "error")
      }
    }
  }

  showCopySuccessFixed(button) {
    const allIcons = button.querySelectorAll('svg, i')

    let copyIcon = null
    let checkIcon = null

    allIcons.forEach(icon => {
      if (icon.classList.contains('fa-copy')) {
        copyIcon = icon
      } else if (icon.classList.contains('fa-circle-check')) {
        checkIcon = icon
      }
    })

    if (!copyIcon || !checkIcon) {
      console.error('Icons not found', { copyIcon, checkIcon })
      return
    }

    if (this.copyTimeout) {
      clearTimeout(this.copyTimeout)
    }

    copyIcon.style.display = 'none'
    checkIcon.style.display = 'inline-block'

    this.copyTimeout = setTimeout(() => {
      copyIcon.style.display = 'inline-block'
      checkIcon.style.display = 'none'
      this.copyTimeout = null
    }, 1000)
  }

  showCopySuccess(button) {
    const copyIcon = button.querySelector('.fa-copy, svg.fa-copy')
    const checkIcon = button.querySelector('.fa-circle-check, svg.fa-circle-check')

    if (!copyIcon || !checkIcon) return

    if (this.copyTimeout) {
      clearTimeout(this.copyTimeout)
    }

    checkIcon.classList.add('hidden')
    checkIcon.classList.remove('hidden')
    copyIcon.classList.add('hidden')

    this.copyTimeout = setTimeout(() => {
      copyIcon.classList.remove('hidden')
      checkIcon.classList.add('hidden')
      this.copyTimeout = null
    }, 1000)
  }

  getDiagnosticsAsText() {
    const diagnosticItems = this.diagnosticsContentTarget.querySelectorAll('.diagnostic-item')

    if (diagnosticItems.length === 0) {
      return 'No diagnostics to display'
    }

    let text = 'Diagnostics:\n\n'
    diagnosticItems.forEach(item => {
      const message = item.querySelector('.text-sm.font-medium').textContent.trim()
      const location = item.querySelector('.text-xs.text-gray-400').textContent.trim()
      text += `• ${message}\n  ${location}\n\n`
    })

    return text
  }

  restoreInput() {
    if (window.parent.location.hash && this.inputTarget.value === "") {
      this.inputTarget.value = this.decompressedValue
    }
  }

  restoreActiveTab() {
    const urlParams = new URLSearchParams(window.parent.location.search)
    const tabParam = urlParams.get('tab')

    if (tabParam && this.isValidTab(tabParam)) {
      this.setActiveTab(tabParam)
    }
  }

  restoreParserOptions() {
    const optionsFromURL = this.getOptionsFromURL()
    if (Object.keys(optionsFromURL).length > 0) {
      this.setParserOptions(optionsFromURL)
    }
  }

  restorePrinterOptions() {
    const printerOptionsFromURL = this.getPrinterOptionsFromURL()
    if (Object.keys(printerOptionsFromURL).length > 0) {
      this.setPrinterOptions(printerOptionsFromURL)
    }
  }

  restoreFormatterOptions() {
    const formatterOptionsFromURL = this.getFormatterOptionsFromURL()

    if (Object.keys(formatterOptionsFromURL).length > 0) {
      this.setFormatterOptions(formatterOptionsFromURL)
    }
  }

  setPrinterOptions(printerOptions) {
    if (this.hasPrinterIgnoreErrorsTarget && printerOptions.hasOwnProperty('ignoreErrors')) {
      this.printerIgnoreErrorsTarget.checked = Boolean(printerOptions.ignoreErrors)
    }
  }

  setFormatterOptions(formatterOptions) {
    if (this.hasFormatterMaxLineLengthTarget && formatterOptions.hasOwnProperty('maxLineLength')) {
      this.formatterMaxLineLengthTarget.value = formatterOptions.maxLineLength
    }
  }

  isValidTab(tab) {
    const validTabs = ['parse', 'lex', 'ruby', 'html', 'format', 'printer', 'diagnostics', 'rewrite', 'diff', 'full']
    return validTabs.includes(tab)
  }

  setActiveTab(tabName) {
    this.viewerButtonTargets.forEach((button) => {
      button.dataset.active = false
    })

    const targetButton = this.viewerButtonTargets.find(
      (button) => button.dataset.viewer === tabName
    )

    if (targetButton) {
      targetButton.dataset.active = true

      this.element
        .querySelectorAll("[data-viewer-target]")
        .forEach((viewer) => viewer.classList.add("hidden"))

      const targetViewer = this.element.querySelector(
        `[data-viewer-target=${tabName}]`
      )

      targetViewer?.classList.remove("hidden")
    }
  }

  updateTabInURL(tabName) {
    const url = new URL(window.parent.location)

    if (tabName && tabName !== 'parse') {
      url.searchParams.set('tab', tabName)
    } else {
      url.searchParams.delete('tab')
    }

    if (tabName !== 'diagnostics') {
      url.searchParams.delete('diagnosticsFilter')
    }

    window.parent.history.replaceState({}, '', url)
  }

  getClosestButton(element) {
    return element instanceof window.HTMLButtonElement
      ? element
      : element.closest("button")
  }

  get currentViewer() {
    return this.element.querySelector(
      `[data-viewer-target=${this.activeViewerButton.dataset.viewer}]`,
    )
  }

  get activeViewerButton() {
    return this.viewerButtonTargets.find(
      (button) => button.dataset.active === "true",
    )
  }

  selectViewer(_event) {
    const button = this.getClosestButton(event.target)
    const tabName = button.dataset.viewer

    this.setActiveTab(tabName)
    this.updateTabInURL(tabName)
  }

  showDiagnostics(_event) {
    this.setActiveTab('diagnostics')
    this.updateTabInURL('diagnostics')
  }


  toggleViewer() {
    if (this.currentViewer) {
      if (this.currentViewer.style.position === "absolute") {
        this.shrinkViewer()
      } else {
        this.enclargeViewer()
      }
    }
  }

  enclargeViewer(_event) {
    this.currentViewer.style.position = "absolute"
    this.currentViewer.style.top = `0px`
    this.currentViewer.style.right = `10px`
    this.currentViewer.style.left = `10px`
    this.currentViewer.style.bottom = `10px`
    this.currentViewer.style.zIndex = `1000`
    this.currentViewer.style.height = "calc(100% - 20px)"
    this.currentViewer.style.width = "calc(100% - 20px)"
    this.currentViewer.style.cursor = "zoom-out"
  }

  shrinkViewer(_event) {
    this.currentViewer.style.position = null
    this.currentViewer.style.left = null
    this.currentViewer.style.top = null
    this.currentViewer.style.right = null
    this.currentViewer.style.bottom = null
    this.currentViewer.style.zIndex = null
    this.currentViewer.style.height = null
    this.currentViewer.style.width = null
    this.currentViewer.style.cursor = null
  }

  setupHoverListener(element, location) {
    element.addEventListener("mouseenter", () => {
      this.clearTreeLocationHighlights()
      this.editor.clearAllHighlights()
      this.editor.highlightAndRevealSection(
        ...location,
        element.classList.contains("error-class")
          ? "error-highlight"
          : "info-highlight",
      )
    })

    element.classList.add("hover-highlight")
  }

  expandAllNodes() {
    if (this.hasParseOutputTarget) {
      expandAll(this.parseOutputTarget)
    }
  }

  collapseAllNodes() {
    if (this.hasParseOutputTarget) {
      collapseAll(this.parseOutputTarget)
    }
  }

  setDiffModeLive() {
    this.diffMode = "live"
    this.diffSnapshotSource = null

    if (this.hasDiffLiveButtonTarget) {
      this.diffLiveButtonTarget.style.color = "#e5c07b"
      this.diffLiveButtonTarget.style.background = "rgba(229, 192, 123, 0.2)"
    }

    if (this.hasDiffCheckpointButtonTarget) {
      this.diffCheckpointButtonTarget.style.color = "#abb2bf"
      this.diffCheckpointButtonTarget.style.background = "rgba(171, 178, 191, 0.1)"
    }

    if (this.hasDiffSnapshotButtonTarget) {
      this.diffSnapshotButtonTarget.classList.add("hidden")
    }

    if (this.hasDiffCheckButtonTarget) {
      this.diffCheckButtonTarget.classList.add("hidden")
    }

    this.updateDiff()
  }

  setDiffModeCheckpoint() {
    this.diffMode = "checkpoint"

    if (this.hasDiffCheckpointButtonTarget) {
      this.diffCheckpointButtonTarget.style.color = "#e5c07b"
      this.diffCheckpointButtonTarget.style.background = "rgba(229, 192, 123, 0.2)"
    }

    if (this.hasDiffLiveButtonTarget) {
      this.diffLiveButtonTarget.style.color = "#abb2bf"
      this.diffLiveButtonTarget.style.background = "rgba(171, 178, 191, 0.1)"
    }

    if (this.hasDiffSnapshotButtonTarget) {
      this.diffSnapshotButtonTarget.classList.remove("hidden")
    }

    if (this.hasDiffCheckButtonTarget) {
      this.diffCheckButtonTarget.classList.remove("hidden")
    }

    if (!this.diffSnapshotSource) {
      this.diffTakeSnapshot()
    }

    this.updateDiffStatus("Checkpoint mode - click Snapshot then edit and Diff")
  }

  diffTakeSnapshot() {
    const value = this.editor ? this.editor.getValue() : this.inputTarget.value
    this.diffSnapshotSource = value
    this.updateDiffStatus("Snapshot taken - edit the code then click Diff")

    if (this.hasDiffOutputTarget) {
      this.diffOutputTarget.innerHTML = '<span class="text-gray-400">Snapshot captured. Edit the code and click "Diff" to compare.</span>'
    }
  }

  diffCheckpoint() {
    if (!this.diffSnapshotSource) {
      this.updateDiffStatus("No snapshot - click Snapshot first")
      return
    }

    const value = this.editor ? this.editor.getValue() : this.inputTarget.value

    try {
      const result = Herb.diff(this.diffSnapshotSource, value)
      this.renderDiffResult(result)
    } catch (error) {
      console.error("Diff error:", error)
      this.updateDiffStatus("Error computing diff")
    }
  }

  // alias for data-action naming
  diffSnapshot() {
    this.diffTakeSnapshot()
  }

  diffCheck() {
    this.diffCheckpoint()
  }

  clearDiffFeed() {
    this.diffFeedEntries = []
    this.previousSource = this.editor ? this.editor.getValue() : this.inputTarget.value

    if (this.hasDiffOutputTarget) {
      this.diffOutputTarget.innerHTML = '<span class="diff-empty">Feed cleared. Start typing to see live differences...</span>'
    }

    this.hideDiffParseError()
    this.updateDiffStatus("Cleared")
  }

  updateDiff(parseSuccess = true) {
    if (!this.hasDiffViewerTarget) return
    if (this.diffMode !== "live") return

    const value = this.editor ? this.editor.getValue() : this.inputTarget.value

    if (this.previousSource === null) {
      this.previousSource = value
      this.diffFeedEntries = []

      if (this.hasDiffOutputTarget) {
        this.diffOutputTarget.innerHTML = '<span class="diff-empty">Start typing to see live differences...</span>'
      }

      return
    }

    if (this.previousSource === value) return

    if (!parseSuccess) {
      this.showDiffParseError()
      this.updateDiffStatus("Paused")
      return
    }

    this.hideDiffParseError()

    try {
      const result = Herb.diff(this.previousSource, value)

      if (!result.identical) {
        if (!this.diffFeedEntries) { this.diffFeedEntries = [] }

        this.diffFeedEntries.unshift({
          timestamp: new Date(),
          operations: result.operations,
          source: value,
          previousSource: this.previousSource,
        })

        if (this.diffFeedEntries.length > 50) {
          this.diffFeedEntries = this.diffFeedEntries.slice(0, 50)
        }
      }

      this.renderDiffFeed(result)
      this.previousSource = value
    } catch (error) {
      console.error("Diff error:", error)
    }
  }

  renderDiffFeed(latestResult) {
    if (!this.hasDiffOutputTarget) return

    if (!this.diffFeedEntries || this.diffFeedEntries.length === 0) {
      if (latestResult && latestResult.identical) {
        this.diffOutputTarget.innerHTML = '<span class="diff-empty">No changes detected.</span>'
        this.updateDiffStatus("Identical")
      }

      return
    }

    const totalOperations = this.diffFeedEntries.reduce((sum, entry) => sum + entry.operations.length, 0)
    this.updateDiffStatus(`${totalOperations} change${totalOperations === 1 ? "" : "s"} in ${this.diffFeedEntries.length} edit${this.diffFeedEntries.length === 1 ? "" : "s"}`)

    let html = ""

    this.diffFeedEntries.forEach((entry, entryIndex) => {
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
      html += this.renderOperations(entry.operations)
      html += `</div>`
    })

    this.diffOutputTarget.innerHTML = html
    this.bindDiffRollbackButtons()
  }

  bindDiffRollbackButtons() {
    if (!this.hasDiffOutputTarget) return

    this.diffOutputTarget.querySelectorAll("[data-diff-rollback-index]").forEach((button) => {
      button.addEventListener("click", (event) => {
        event.preventDefault()
        const entryIndex = parseInt(button.dataset.diffRollbackIndex)
        this.diffRollbackTo(entryIndex)
      })
    })

    this.diffOutputTarget.querySelectorAll("[data-diff-undo-index]").forEach((button) => {
      button.addEventListener("click", (event) => {
        event.preventDefault()
        const entryIndex = parseInt(button.dataset.diffUndoIndex)
        this.diffUndo(entryIndex)
      })
    })
  }

  diffRollbackTo(entryIndex) {
    const entry = this.diffFeedEntries[entryIndex]
    if (!entry || !entry.source) return

    this.diffFeedEntries = this.diffFeedEntries.slice(entryIndex)
    this.previousSource = entry.source

    if (this.editor) {
      this.editor.setValue(entry.source)
    } else {
      this.inputTarget.value = entry.source
    }

    this.analyze()
  }

  diffUndo(entryIndex) {
    const entry = this.diffFeedEntries[entryIndex]
    if (!entry || !entry.previousSource) return

    this.diffFeedEntries.shift()
    this.previousSource = entry.previousSource

    if (this.editor) {
      this.editor.setValue(entry.previousSource)
    } else {
      this.inputTarget.value = entry.previousSource
    }

    this.analyze()
  }

  renderDiffResult(result) {
    if (!this.hasDiffOutputTarget) return

    if (result.identical) {
      this.diffOutputTarget.innerHTML = '<span class="diff-empty">Trees are identical - no differences found.</span>'
      this.updateDiffStatus("Identical")
      return
    }

    const operations = result.operations
    this.updateDiffStatus(`${operations.length} difference${operations.length === 1 ? "" : "s"}`)
    this.diffOutputTarget.innerHTML = this.renderOperations(operations)
  }

  renderOperations(operations) {
    const typeStyles = {
      node_inserted:          { css: "inserted",   icon: "fa-plus" },
      node_removed:           { css: "removed",    icon: "fa-minus" },
      node_replaced:          { css: "replaced",   icon: "fa-right-left" },
      text_changed:           { css: "changed",    icon: "fa-pen" },
      erb_content_changed:    { css: "erb",        icon: "fa-code" },
      attribute_added:        { css: "attribute",  icon: "fa-plus" },
      attribute_removed:      { css: "removed",    icon: "fa-minus" },
      attribute_value_changed:{ css: "attribute",  icon: "fa-pen" },
      tag_name_changed:       { css: "tag",        icon: "fa-tag" },
      node_moved:             { css: "moved",      icon: "fa-arrows-alt" },
      node_wrapped:           { css: "wrapped",    icon: "fa-compress" },
      node_unwrapped:         { css: "unwrapped",  icon: "fa-expand" },
    }

    let html = ""

    operations.forEach((operation, index) => {
      const style = typeStyles[operation.type] || { css: "changed", icon: "fa-circle" }
      const typeLabel = operation.type.replace(/_/g, " ")

      html += `<div class="diff-operation diff-op-${style.css}">`
      html += `<div class="flex items-center gap-2">`
      html += `<span class="diff-index text-xs font-mono">#${index + 1}</span>`
      html += `<i class="fas ${style.icon} diff-label-${style.css} text-xs"></i>`
      html += `<span class="diff-label-${style.css} font-semibold text-sm">${typeLabel}</span>`
      html += `<span class="diff-path text-xs font-mono ml-auto">[${operation.path.join(", ")}]</span>`
      html += `</div>`

      const oldNode = operation.oldNode || operation.old_node
      const newNode = operation.newNode || operation.new_node

      if (operation.type === "node_wrapped" && oldNode && newNode) {
        const oldLabel = this.describeNode(oldNode, operation.type)
        const newLabel = this.describeNode(newNode, operation.type)

        html += `<div class="text-xs mt-1 font-mono">`
        html += `<span class="diff-value-old">${this.escapeHtml(oldLabel)}</span>`
        html += ` wrapped in `
        html += `<span class="diff-value-new">${this.escapeHtml(newLabel)}</span>`
        html += `</div>`
      } else if (operation.type === "node_unwrapped" && oldNode && newNode) {
        const oldLabel = this.describeNode(oldNode, operation.type)
        const newLabel = this.describeNode(newNode, operation.type)

        html += `<div class="text-xs mt-1 font-mono">`
        html += `<span class="diff-value-new">${this.escapeHtml(newLabel)}</span>`
        html += ` unwrapped from `
        html += `<span class="diff-value-old">${this.escapeHtml(oldLabel)}</span>`
        html += `</div>`
      } else {
        if (oldNode) {
          html += `<div class="text-xs mt-1 font-mono"><span class="diff-label-removed">-</span> <span class="diff-node-type">${oldNode.type}</span>`

          if (oldNode.location) {
            html += ` <span class="diff-location">(${oldNode.location.start.line}:${oldNode.location.start.column})</span>`
          }

          html += `</div>`

          const oldValue = this.extractNodeValue(oldNode, operation.type)
          if (oldValue !== null) {
            html += `<div class="text-xs font-mono diff-value-old">${this.escapeHtml(oldValue)}</div>`
          }
        }

        if (newNode) {
          html += `<div class="text-xs mt-1 font-mono"><span class="diff-label-inserted">+</span> <span class="diff-node-type">${newNode.type}</span>`

          if (newNode.location) {
            html += ` <span class="diff-location">(${newNode.location.start.line}:${newNode.location.start.column})</span>`
          }

          html += `</div>`

          const newValue = this.extractNodeValue(newNode, operation.type)

          if (newValue !== null) {
            html += `<div class="text-xs font-mono diff-value-new">${this.escapeHtml(newValue)}</div>`
          }
        }
      }

      html += `</div>`
    })

    return html
  }

  extractNodeValue(node, operationType) {
    if (!node) return null

    if (operationType === "text_changed" || node.type === "AST_HTML_TEXT_NODE") {
      return node.content || null
    }

    if (operationType === "erb_content_changed" || node.type === "AST_ERB_CONTENT_NODE") {
      if (node.content && node.content.value) {
        return node.content.value
      }

      return null
    }

    if (operationType === "attribute_value_changed" || operationType === "attribute_added" || operationType === "attribute_removed") {
      if (node.type === "AST_HTML_ATTRIBUTE_NODE") {
        let result = ""

        if (node.name && node.name.children) {
          const nameParts = node.name.children.map(child => child.content || child.value || "").join("")
          result += nameParts
        }

        if (node.value && node.value.children) {
          const valueParts = node.value.children.map(child => child.content || child.value || "").join("")
          result += `="${valueParts}"`
        }

        return result || null
      }
    }

    if (node.type === "AST_HTML_ELEMENT_NODE" || node.type === "AST_HTML_CONDITIONAL_ELEMENT_NODE") {
      if (node.tag_name && node.tag_name.value) {
        return `<${node.tag_name.value}>`
      }

      return null
    }

    if (node.type === "AST_LITERAL_NODE" || node.type === "AST_RUBY_LITERAL_NODE") {
      return node.content || null
    }

    return null
  }

  describeNode(node, operationType) {
    if (!node) return "unknown"

    if (node.type === "AST_HTML_ELEMENT_NODE" || node.type === "AST_HTML_CONDITIONAL_ELEMENT_NODE") {
      if (node.tag_name && node.tag_name.value) {
        return `<${node.tag_name.value}>`
      }
    }

    if (node.type === "AST_HTML_TEXT_NODE") {
      const text = node.content || ""
      const trimmed = text.trim()

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

    const value = this.extractNodeValue(node, operationType)
    if (value) return value

    return node.type.replace("AST_", "").replace("_NODE", "").toLowerCase().replace(/_/g, " ")
  }

  escapeHtml(text) {
    const div = document.createElement("div")
    div.textContent = text
    return div.innerHTML
  }

  updateDiffStatus(text) {
    if (this.hasDiffStatusTarget) {
      this.diffStatusTarget.className = "px-2 py-1 text-xs rounded font-mono font-medium"

      if (text.includes("Identical") || text.includes("Cleared")) {
        this.diffStatusTarget.style.color = "#90b874"
        this.diffStatusTarget.style.background = "rgba(144, 184, 116, 0.15)"
      } else if (text.includes("change") || text.includes("difference")) {
        this.diffStatusTarget.style.color = "#e5c07b"
        this.diffStatusTarget.style.background = "rgba(229, 192, 123, 0.15)"
      } else {
        this.diffStatusTarget.style.color = "#abb2bf"
        this.diffStatusTarget.style.background = "rgba(171, 178, 191, 0.1)"
      }

      this.diffStatusTarget.textContent = text
    }
  }

  showDiffParseError() {
    if (this.hasDiffParseErrorTarget) {
      this.diffParseErrorTarget.classList.remove("hidden")
    }
  }

  hideDiffParseError() {
    if (this.hasDiffParseErrorTarget) {
      this.diffParseErrorTarget.classList.add("hidden")
    }
  }

  clearTreeLocationHighlights() {
    this.parseOutputTarget
      .querySelectorAll(".tree-location-highlight")
      .forEach((element) => {
        element.classList.remove("tree-location-highlight")
      })
  }

  get treeLocations() {
    return Array.from(
      this.parseOutputTarget?.querySelectorAll(".token.location") || [],
    ).map((locationElement) => {
      const element = locationElement.previousElementSibling
      const location = Array.from(
        locationElement.textContent.matchAll(/\d+/g),
      ).map((i) => parseInt(i))

      location[1] += 1
      location[3] += 1

      return { element, locationElement, location }
    })
  }

  async input() {
    this.urlUpdatedFromChangeEvent = true
    await this.analyze()
    this.urlUpdatedFromChangeEvent = false
  }

  async formatEditor(event) {
    if (this.isRubyMode) return

    const button = this.getClosestButton(event.target)

    if (button.disabled) {
      return
    }

    try {
      const value = this.editor ? this.editor.getValue() : this.inputTarget.value
      const formatterOptions = this.getFormatterOptions()
      const result = await analyze(Herb, value, {}, {}, formatterOptions)

      if (result.formatted) {
        if (this.editor) {
          this.editor.setValue(result.formatted)
        } else {
          this.inputTarget.value = result.formatted
        }

        button.querySelector(".fa-indent").classList.add("hidden")
        button.querySelector(".fa-circle-check").classList.remove("hidden")
        this.showTemporaryMessage("Formatted editor content", "success")

        setTimeout(() => {
          button.querySelector(".fa-indent").classList.remove("hidden")
          button.querySelector(".fa-circle-check").classList.add("hidden")
        }, 1000)
      }
    } catch (error) {
      console.error('Format error:', error)
    }
  }

  async autofixEditor(event) {
    if (this.isRubyMode) return

    const button = this.getClosestButton(event.target)

    if (button.disabled) {
      return
    }

    const wandIcon = button.querySelector(".fa-wand-magic-sparkles")
    const checkIcon = button.querySelector(".fa-circle-check")

    try {
      const value = this.editor ? this.editor.getValue() : this.inputTarget.value
      const linter = new Linter(Herb)
      const result = linter.autofix(value)

      if (result && typeof result === "object" && "source" in result) {
        const fixedCount = Array.isArray(result.fixed) ? result.fixed.length : 0

        if (fixedCount > 0 && typeof result.source === "string") {
          if (this.editor) {
            this.editor.setValue(result.source)
          } else {
            this.inputTarget.value = result.source
          }

          if (wandIcon && checkIcon) {
            wandIcon.classList.add("hidden")
            checkIcon.classList.remove("hidden")
            checkIcon.style.display = ""

            setTimeout(() => {
              this.resetAutofixButtonIcons()
            }, 1000)
          }

          const offensesLabel = fixedCount === 1 ? "offense" : "offenses"
          this.showTemporaryMessage(`Autofixed ${fixedCount} linter ${offensesLabel}`, "success")

          await this.analyze()
          this.resetAutofixButtonIcons()
        } else {
          this.showTemporaryMessage("No autocorrectable linter offenses found", "info")
        }
      } else {
        this.showTemporaryMessage("Failed to autofix linter offenses", "error")
      }
    } catch (error) {
      console.error("Autofix error:", error)
      this.showTemporaryMessage("Failed to autofix linter offenses", "error")
    }
  }

  async autofixUnsafeEditor(event) {
    if (this.isRubyMode) return

    const button = this.getClosestButton(event.target)

    if (button.disabled) {
      return
    }

    const warningIcon = button.querySelector(".fa-triangle-exclamation")
    const checkIcon = button.querySelector(".fa-circle-check")

    try {
      const value = this.editor ? this.editor.getValue() : this.inputTarget.value
      const linter = new Linter(Herb)
      const result = linter.autofix(value, undefined, undefined, { includeUnsafe: true })

      if (result && typeof result === "object" && "source" in result) {
        const fixedCount = Array.isArray(result.fixed) ? result.fixed.length : 0

        if (fixedCount > 0 && typeof result.source === "string") {
          if (this.editor) {
            this.editor.setValue(result.source)
          } else {
            this.inputTarget.value = result.source
          }

          if (warningIcon && checkIcon) {
            warningIcon.classList.add("hidden")
            checkIcon.classList.remove("hidden")
            checkIcon.style.display = ""

            setTimeout(() => {
              this.resetAutofixUnsafeButtonIcons()
            }, 1000)
          }

          const offensesLabel = fixedCount === 1 ? "offense" : "offenses"
          this.showTemporaryMessage(`Autofixed ${fixedCount} unsafe linter ${offensesLabel}`, "success")

          await this.analyze()
          this.resetAutofixUnsafeButtonIcons()
        } else {
          this.showTemporaryMessage("No unsafe autocorrectable linter offenses found", "info")
        }
      } else {
        this.showTemporaryMessage("Failed to autofix unsafe linter offenses", "error")
      }
    } catch (error) {
      console.error("Autofix unsafe error:", error)
      this.showTemporaryMessage("Failed to autofix unsafe linter offenses", "error")
    }
  }

  async analyze() {
    this.updateURL()

    const value = this.editor ? this.editor.getValue() : this.inputTarget.value

    if (this.isRubyMode) {
      return this.analyzeRuby(value)
    }

    const options = this.getParserOptions()
    const printerOptions = this.getPrinterOptions()
    const formatterOptions = this.getFormatterOptions()
    const result = await analyze(Herb, value, options, printerOptions, formatterOptions)

    this.updatePosition(1, 0, value.length)

    this.editor.clearDiagnostics()

    const allDiagnostics = []

    if (result.parseResult) {
      const errors = result.parseResult.recursiveErrors()
      allDiagnostics.push(...errors.map((error) => {
        const diagnostic = error.toMonacoDiagnostic()

        diagnostic.source = "Herb Parser"
        diagnostic.code = diagnostic.code || error.constructor?.name || 'parser-error'

        return diagnostic
      }))
    }

    if (result.lintResult && result.lintResult.offenses) {
      const lintDiagnostics = result.lintResult.offenses.map((offense) => ({
        severity: offense.severity,
        message: offense.message,
        line: offense.location.start.line,
        column: offense.location.start.column,
        endLine: offense.location.end.line,
        endColumn: offense.location.end.column,
        source: "Herb Linter ",
        code: offense.rule,
      }))

      allDiagnostics.push(...lintDiagnostics)
    }

    const filteredDiagnosticsForEditor = allDiagnostics.filter(diagnostic =>
      diagnostic.code !== 'parser-no-errors'
    )

    this.editor.addDiagnostics(filteredDiagnosticsForEditor)

    if (this.hasDiagnosticStatusTarget && this.hasErrorCountTarget && this.hasWarningCountTarget && this.hasInfoCountTarget) {
      const errorCount = filteredDiagnosticsForEditor.filter(diagnostic => diagnostic.severity === "error").length
      const warningCount = filteredDiagnosticsForEditor.filter(diagnostic => diagnostic.severity === "warning").length
      const infoCount = filteredDiagnosticsForEditor.filter(diagnostic => diagnostic.severity === "info" || diagnostic.severity === "hint").length

      this.diagnosticStatusTarget.classList.remove("hidden")

      this.errorCountTarget.textContent = errorCount
      this.warningCountTarget.textContent = warningCount
      this.infoCountTarget.textContent = infoCount
    }

    if (this.hasTimeTarget) {
      if (result.duration.toFixed(2) === 0.0) {
        this.timeTarget.textContent = `(in < 0.00 ms)`
      } else {
        this.timeTarget.textContent = `(in ${result.duration.toFixed(2)} ms)`
      }
    }

    if (this.hasVersionTarget) {
      const fullVersion = result.version
      let displayVersion = fullVersion

      if (typeof __COMMIT_INFO__ !== 'undefined') {
        const commitInfo = __COMMIT_INFO__

        displayVersion = fullVersion.split(',').map(component => {
          if (component.includes('libprism')) {
            return component
          }

          return component.replace(/@[\d]+\.[\d]+\.[\d]+/g, `@${commitInfo.hash}`)
        }).join(',')
      }

      const shortVersion = displayVersion.split(',')[0]

      const icon = this.versionTarget.querySelector('i')
      if (icon) {
        const textNodes = Array.from(this.versionTarget.childNodes).filter(node => node.nodeType === Node.TEXT_NODE)
        textNodes.forEach(node => node.remove())
        this.versionTarget.insertBefore(document.createTextNode(shortVersion), icon)
      } else {
        this.versionTarget.textContent = shortVersion
      }

      this.versionTarget.title = displayVersion
    }

    if (this.hasCommitHashTarget) {
      if (typeof __COMMIT_INFO__ !== 'undefined') {
        const commitInfo = __COMMIT_INFO__

        if (commitInfo.prNumber) {
          const prUrl = `https://github.com/marcoroth/herb/pull/${commitInfo.prNumber}`

          this.commitHashTarget.textContent = `PR #${commitInfo.prNumber} @ ${commitInfo.hash}`
          this.commitHashTarget.href = prUrl
          this.commitHashTarget.title = `View PR #${commitInfo.prNumber} on GitHub (commit ${commitInfo.hash})`
        } else {
          const githubUrl = `https://github.com/marcoroth/herb/commit/${commitInfo.hash}`

          if (commitInfo.ahead > 0) {
            this.commitHashTarget.textContent = `${commitInfo.tag} (+${commitInfo.ahead} commits) ${commitInfo.hash}`
          } else {
            this.commitHashTarget.textContent = `${commitInfo.tag} ${commitInfo.hash}`
          }

          this.commitHashTarget.href = githubUrl
          this.commitHashTarget.title = `View commit ${commitInfo.hash} on GitHub`
        }
      } else {
        this.commitHashTarget.textContent = 'unknown'
        this.commitHashTarget.removeAttribute('href')
        this.commitHashTarget.removeAttribute('title')
      }
    }

    if (this.hasParseOutputTarget) {
      this.parseOutputTarget.classList.add("language-tree")
      this.parseOutputTarget.textContent = result.string

      Prism.highlightElement(this.parseOutputTarget)
      makeTreeCollapsible(this.parseOutputTarget)

      this.treeLocations.forEach(({ element, locationElement, location }) => {
        this.setupHoverListener(locationElement, location)
        this.setupHoverListener(element, location)

        if (element.classList.contains("string")) {
          this.setupHoverListener(element.previousElementSibling, location)
        }
      })
    }

    if (this.hasHtmlViewerTarget) {
      this.htmlViewerTarget.classList.add("language-html")
      this.htmlViewerTarget.textContent = result.html

      Prism.highlightElement(this.htmlViewerTarget)
    }

    if (this.hasRewriteViewerTarget) {
      const options = this.getParserOptions()

      if (this.hasRewriteActionViewHelpersTarget) {
        this.rewriteActionViewHelpersTarget.checked = !!options.action_view_helpers
      }

      if (!options.action_view_helpers) {
        this.rewriteStatusTarget.textContent = '⚠ Enable "Action View helpers" option'
        this.rewriteStatusTarget.className = 'px-2 py-1 text-xs rounded font-medium bg-yellow-600 text-yellow-100'
        this.rewriteOutputTarget.classList.remove("language-html")
        this.rewriteOutputTarget.textContent = ''
      } else {
        this.rewriteStatusTarget.textContent = 'ActionView Tag Helper → HTML'
        this.rewriteStatusTarget.className = 'px-2 py-1 text-xs rounded font-medium bg-green-600 text-green-100'
        this.rewriteOutputTarget.classList.add("language-html")
        this.rewriteOutputTarget.textContent = result.rewritten || 'No rewritten output available'

        Prism.highlightElement(this.rewriteOutputTarget)
      }
    }

    const hasParserErrors = result.parseResult ? result.parseResult.recursiveErrors().length > 0 : false
    const currentSource = this.editor ? this.editor.getValue() : this.inputTarget.value
    const isWellFormatted = currentSource === result.formatted

    if (this.hasFormatViewerTarget) {
      if (hasParserErrors) {
        this.formatSuccessTarget.classList.add('hidden')
        this.formatErrorTarget.classList.remove('hidden')

        const pre = this.formatErrorTarget.querySelector('pre.language-html')
        pre.textContent = result.formatted || 'No formatted output available'

        Prism.highlightElement(pre)

        if (this.hasFormatVerificationTarget) {
          this.formatVerificationTarget.textContent = '⚠ Formatting Error'
          this.formatVerificationTarget.className = 'px-2 py-1 text-xs rounded font-medium bg-red-600 text-red-100'
        }
      } else {
        this.formatErrorTarget.classList.add('hidden')
        this.formatSuccessTarget.classList.remove('hidden')

        this.formatSuccessTarget.textContent = result.formatted || 'No formatted output available'

        Prism.highlightElement(this.formatSuccessTarget)

        if (this.hasFormatVerificationTarget) {
          if (isWellFormatted) {
            this.formatVerificationTarget.textContent = '✓ Document is Well-formatted'
            this.formatVerificationTarget.className = 'px-2 py-1 text-xs rounded font-medium bg-green-600 text-green-100'
          } else {
            this.formatVerificationTarget.textContent = '⚠ Document needs formatting'
            this.formatVerificationTarget.className = 'px-2 py-1 text-xs rounded font-medium bg-yellow-600 text-yellow-100'
          }
        }
      }
    }

    if (this.hasFormatButtonTarget) {
      const hasParserErrors = result.parseResult ? result.parseResult.recursiveErrors().length > 0 : false

      if (hasParserErrors) {
        this.formatButtonTarget.disabled = true
        this.formatButtonTarget.classList.add('opacity-50', 'cursor-not-allowed')
        this.formatButtonTarget.classList.remove('hover:bg-gray-200', 'dark:hover:bg-gray-700')
        this.setupTooltip()
        this.updateFormatTooltipText('Cannot format code due to parser errors. Fix parser errors in Diagnostics tab first.')
      } else {
        this.formatButtonTarget.disabled = false
        this.formatButtonTarget.classList.remove('opacity-50', 'cursor-not-allowed')
        this.formatButtonTarget.classList.add('hover:bg-gray-200', 'dark:hover:bg-gray-700')
        this.updateFormatTooltipText('Format the editor content using the Herb Formatter')
      }
    }

    if (this.hasAutofixButtonTarget) {
      const hasParserErrors = result.parseResult ? result.parseResult.recursiveErrors().length > 0 : false
      const hasLintOffenses = !!(result.lintResult && Array.isArray(result.lintResult.offenses) && result.lintResult.offenses.length > 0)

      if (hasParserErrors) {
        this.disableAutofixButton()
        this.setupAutofixTooltip()
        this.updateAutofixTooltipText('Cannot autofix code due to parser errors. Fix parser errors in Diagnostics tab first.')
      } else if (!hasLintOffenses) {
        this.disableAutofixButton()
        this.setupAutofixTooltip()
        this.updateAutofixTooltipText('No Herb Linter offenses found to autofix.')
      } else {
        this.enableAutofixButton()
        this.updateAutofixTooltipText('Autocorrect autocorrectable Herb Linter offenses')
      }
    }

    if (this.hasAutofixUnsafeWrapperTarget) {
      const hasParserErrors = result.parseResult ? result.parseResult.recursiveErrors().length > 0 : false
      const hasUnsafeOffenses = !!(result.lintResult && Array.isArray(result.lintResult.offenses) &&
        result.lintResult.offenses.some(offense => offense.autofixContext && offense.autofixContext.unsafe === true))

      if (hasParserErrors || !hasUnsafeOffenses) {
        this.autofixUnsafeWrapperTarget.classList.add('hidden')
      } else {
        this.autofixUnsafeWrapperTarget.classList.remove('hidden')
        this.enableAutofixUnsafeButton()
        this.updateAutofixUnsafeTooltipText('Autocorrect unsafe Herb Linter offenses')
      }
    }

    if (this.hasRubyViewerTarget) {
      this.rubyViewerTarget.classList.add("language-ruby")
      this.rubyViewerTarget.textContent = result.ruby

      Prism.highlightElement(this.rubyViewerTarget)
    }

    if (this.hasLexViewerTarget) {
      this.lexViewerTarget.classList.add("language-tree")
      this.lexViewerTarget.textContent = result.lex

      Prism.highlightElement(this.lexViewerTarget)
    }

    if (this.hasPrinterViewerTarget) {
      const printedContent = result.printed || 'No printed output available'

      if (typeof printedContent === 'string' && printedContent.startsWith('Error: Cannot print')) {
        this.printerOutputTarget.classList.remove("language-html")
        this.printerOutputTarget.textContent = printedContent
      } else {
        this.printerOutputTarget.classList.add("language-html")
        this.printerOutputTarget.textContent = printedContent
        Prism.highlightElement(this.printerOutputTarget)
      }

      if (this.hasPrinterVerificationTarget) {
        const currentSource = this.editor ? this.editor.getValue() : this.inputTarget.value
        const isMatch = currentSource === result.printed
        const options = this.getParserOptions()
        const trackWhitespace = options.track_whitespace
        const isError = typeof printedContent === 'string' && printedContent.startsWith('Error: Cannot print')

        if (isError) {
          this.printerVerificationTarget.textContent = '⚠ Round-trip Failed'
          this.printerVerificationTarget.className = 'px-2 py-1 text-xs rounded font-medium bg-red-600 text-red-100'
          this.updatePrinterVerificationTooltip('Source → Parse → AST → Print → Source failed due to printer error - unable to verify document preservation. Try enabling "Ignore errors" to attempt printing anyway.')
          this.hidePrinterDiff()
          this.hidePrinterLegend()
        } else if (!trackWhitespace) {
          this.printerVerificationTarget.textContent = '⚠ Enable "Track whitespace"'
          this.printerVerificationTarget.className = 'px-2 py-1 text-xs rounded font-medium bg-yellow-600 text-yellow-100'
          this.updatePrinterVerificationTooltip('Enable "Track whitespace" to verify no document details are lost during parsing (Source → Parse → AST → Print → Source)')
          this.hidePrinterDiff()
          this.hidePrinterLegend()
        } else if (isMatch) {
          this.printerVerificationTarget.textContent = '✓ Perfect Round-trip'
          this.printerVerificationTarget.className = 'px-2 py-1 text-xs rounded font-medium bg-green-600 text-green-100'
          this.updatePrinterVerificationTooltip('✓ No document details lost during parsing - Source → Parse → AST → Print → Source preserved everything')
          this.hidePrinterDiff()
          this.hidePrinterLegend()
        } else {
          this.printerVerificationTarget.textContent = '✗ Round-trip Differences'
          this.printerVerificationTarget.className = 'px-2 py-1 text-xs rounded font-medium bg-red-600 text-red-100'
          this.updatePrinterVerificationTooltip('⚠ Document details lost during parsing - differences below show what was lost in Source → Parse → AST → Print → Source')
          this.showPrinterDiff(currentSource, result.printed)
          this.showPrinterLegend()
        }
      }
    }

    if (this.hasDiagnosticsViewerTarget && this.hasDiagnosticsContentTarget) {
      this.allDiagnostics = filteredDiagnosticsForEditor
      this.updateDiagnosticsFilterButtons(this.currentDiagnosticsFilter)
      this.updateDiagnosticsViewer(this.getFilteredDiagnostics())
    }

    this.updateDiff(!hasParserErrors)
  }

  async analyzeRuby(value) {
    const result = await analyzeRuby(Herb, value)

    this.updatePosition(1, 0, value.length)

    if (this.hasTimeTarget) {
      if (result.duration.toFixed(2) === 0.0) {
        this.timeTarget.textContent = `(in < 0.00 ms)`
      } else {
        this.timeTarget.textContent = `(in ${result.duration.toFixed(2)} ms)`
      }
    }

    if (this.hasVersionTarget) {
      const fullVersion = result.version
      let displayVersion = fullVersion

      if (typeof __COMMIT_INFO__ !== 'undefined') {
        const commitInfo = __COMMIT_INFO__

        displayVersion = fullVersion.split(',').map(component => {
          if (component.includes('libprism')) {
            return component
          }

          return component.replace(/@[\d]+\.[\d]+\.[\d]+/g, `@${commitInfo.hash}`)
        }).join(',')
      }

      const shortVersion = displayVersion.split(',')[0]

      const icon = this.versionTarget.querySelector('i')
      if (icon) {
        const textNodes = Array.from(this.versionTarget.childNodes).filter(node => node.nodeType === Node.TEXT_NODE)
        textNodes.forEach(node => node.remove())
        this.versionTarget.insertBefore(document.createTextNode(shortVersion), icon)
      } else {
        this.versionTarget.textContent = shortVersion
      }

      this.versionTarget.title = displayVersion
    }

    if (this.hasCommitHashTarget) {
      if (typeof __COMMIT_INFO__ !== 'undefined') {
        const commitInfo = __COMMIT_INFO__

        if (commitInfo.prNumber) {
          const prUrl = `https://github.com/marcoroth/herb/pull/${commitInfo.prNumber}`

          this.commitHashTarget.textContent = `PR #${commitInfo.prNumber} @ ${commitInfo.hash}`
          this.commitHashTarget.href = prUrl
          this.commitHashTarget.title = `View PR #${commitInfo.prNumber} on GitHub (commit ${commitInfo.hash})`
        } else {
          const githubUrl = `https://github.com/marcoroth/herb/commit/${commitInfo.hash}`

          if (commitInfo.ahead > 0) {
            this.commitHashTarget.textContent = `${commitInfo.tag} (+${commitInfo.ahead} commits) ${commitInfo.hash}`
          } else {
            this.commitHashTarget.textContent = `${commitInfo.tag} ${commitInfo.hash}`
          }

          this.commitHashTarget.href = githubUrl
          this.commitHashTarget.title = `View commit ${commitInfo.hash} on GitHub`
        }
      } else {
        this.commitHashTarget.textContent = 'unknown'
        this.commitHashTarget.removeAttribute('href')
        this.commitHashTarget.removeAttribute('title')
      }
    }

    if (this.hasParseOutputTarget) {
      this.parseOutputTarget.classList.add("language-tree")
      this.parseOutputTarget.textContent = result.string

      Prism.highlightElement(this.parseOutputTarget)
      makeTreeCollapsible(this.parseOutputTarget)

      this.treeLocations.forEach(({ element, locationElement, location }) => {
        this.setupHoverListener(locationElement, location)
        this.setupHoverListener(element, location)

        if (element.classList.contains("string")) {
          this.setupHoverListener(element.previousElementSibling, location)
        }
      })
    }
  }

  get compressedValue() {
    const value = this.editor ? this.editor.getValue() : this.inputTarget.value
    return lz.compressToEncodedURIComponent(value)
  }

  get decompressedValue() {
    return lz.decompressFromEncodedURIComponent(
      window.parent.location.hash.slice(1),
    )
  }

  getParserOptions() {
    const options = {}
    if (!this.hasParserOptionsTarget) return options
    const optionInputs = this.parserOptionsTarget.querySelectorAll('input[data-option]')

    optionInputs.forEach(input => {
      const optionName = input.dataset.option
      if (input.type === 'checkbox') {
        options[optionName] = input.checked
      } else {
        options[optionName] = input.value
      }
    })

    return options
  }

  setParserOptions(options) {
    if (!this.hasParserOptionsTarget) return
    const optionInputs = this.parserOptionsTarget.querySelectorAll('input[data-option]')

    optionInputs.forEach(input => {
      const optionName = input.dataset.option
      if (options.hasOwnProperty(optionName)) {
        if (input.type === 'checkbox') {
          input.checked = Boolean(options[optionName])
        } else {
          input.value = options[optionName]
        }
      }
    })

    if (this.hasPrismNodesDeepLabelTarget) {
      const prismNodesInput = this.parserOptionsTarget.querySelector('input[data-option="prism_nodes"]')
      this.prismNodesDeepLabelTarget.classList.toggle("hidden", !prismNodesInput?.checked)
    }
  }

  onOptionChange(_event) {
    this.updateURL()
    this.analyze()
  }

  onPrismNodesChange(event) {
    const checked = event.target.checked

    if (this.hasPrismNodesDeepLabelTarget) {
      this.prismNodesDeepLabelTarget.classList.toggle("hidden", !checked)
    }
  }

  onPrinterOptionChange(_event) {
    this.updateURL()
    this.analyze()
  }

  onRewriteActionViewHelpersChange(event) {
    const checked = event.target.checked
    const parserCheckbox = this.parserOptionsTarget.querySelector('input[data-option="action_view_helpers"]')

    if (parserCheckbox) {
      parserCheckbox.checked = checked
    }

    this.updateURL()
    this.analyze()
  }

  onFormatterOptionChange(_event) {
    this.updateURL()
    this.analyze()
  }

  getPrinterOptions() {
    const options = {}
    if (this.hasPrinterIgnoreErrorsTarget) {
      options.ignoreErrors = this.printerIgnoreErrorsTarget.checked
    }
    return options
  }

  getFormatterOptions() {
    const options = {}

    if (this.hasFormatterMaxLineLengthTarget) {
      const value = parseInt(this.formatterMaxLineLengthTarget.value, 10)

      if (!isNaN(value) && value > 0) {
        options.maxLineLength = value
      }
    }

    return options
  }

  getOptionsFromURL() {
    const urlParams = new URLSearchParams(window.parent.location.search)
    const optionsString = urlParams.get('options')

    if (optionsString) {
      try {
        return JSON.parse(decodeURIComponent(optionsString))
      } catch (e) {
        console.warn('Failed to parse options from URL:', e)
      }
    }

    return {}
  }

  setOptionsInURL(options) {
    const url = new URL(window.parent.location)

    const defaults = {
      track_whitespace: false,
      analyze: true,
      strict: true,
      action_view_helpers: false,
      transform_conditionals: false,
      render_nodes: false,
      strict_locals: false,
      prism_program: false,
      prism_nodes: false,
      prism_nodes_deep: false,
      dot_notation_tags: false,
      html: true,
    }

    const nonDefaultOptions = {}

    Object.keys(options).forEach(key => {
      const value = options[key]
      const defaultValue = defaults[key]

      if (value !== defaultValue && value !== '' && value !== null && value !== undefined) {
        nonDefaultOptions[key] = value
      }
    })

    if (Object.keys(nonDefaultOptions).length > 0) {
      url.searchParams.set('options', JSON.stringify(nonDefaultOptions))
    } else {
      url.searchParams.delete('options')
    }

    window.parent.history.replaceState({}, '', url)
  }

  setPrinterOptionsInURL(printerOptions) {
    const url = new URL(window.parent.location)

    const defaults = {
      ignoreErrors: false,
    }

    const nonDefaultPrinterOptions = {}

    Object.keys(printerOptions).forEach(key => {
      const value = printerOptions[key]
      const defaultValue = defaults[key]

      if (value !== defaultValue && value !== '' && value !== null && value !== undefined) {
        nonDefaultPrinterOptions[key] = value
      }
    })

    if (Object.keys(nonDefaultPrinterOptions).length > 0) {
      url.searchParams.set('printerOptions', JSON.stringify(nonDefaultPrinterOptions))
    } else {
      url.searchParams.delete('printerOptions')
    }

    window.parent.history.replaceState({}, '', url)
  }

  getPrinterOptionsFromURL() {
    const urlParams = new URLSearchParams(window.parent.location.search)
    const printerOptionsString = urlParams.get('printerOptions')

    if (printerOptionsString) {
      try {
        return JSON.parse(decodeURIComponent(printerOptionsString))
      } catch (e) {
        console.warn('Failed to parse printer options from URL:', e)
      }
    }

    return {}
  }

  setFormatterOptionsInURL(formatterOptions) {
    const url = new URL(window.parent.location)

    const nonDefaultFormatterOptions = {}

    Object.keys(formatterOptions).forEach(key => {
      if (key === 'maxLineLength' && formatterOptions[key] !== 80) {
        nonDefaultFormatterOptions[key] = formatterOptions[key]
      }
    })

    if (Object.keys(nonDefaultFormatterOptions).length > 0) {
      url.searchParams.set('formatterOptions', JSON.stringify(nonDefaultFormatterOptions))
    } else {
      url.searchParams.delete('formatterOptions')
    }

    window.parent.history.replaceState({}, '', url)
  }

  getFormatterOptionsFromURL() {
    const urlParams = new URLSearchParams(window.parent.location.search)
    const formatterOptionsString = urlParams.get('formatterOptions')

    if (formatterOptionsString) {
      try {
        return JSON.parse(decodeURIComponent(formatterOptionsString))
      } catch (e) {
        console.warn('Failed to parse formatter options from URL:', e)
      }
    }

    return {}
  }

  restoreDiagnosticsFilter() {
    const urlParams = new URLSearchParams(window.parent.location.search)
    const filterParam = urlParams.get('diagnosticsFilter')

    if (filterParam && ['all', 'parser', 'linter'].includes(filterParam)) {
      return filterParam
    }

    return 'all'
  }

  updateDiagnosticsFilterInURL(filter) {
    const url = new URL(window.parent.location)

    if (filter && filter !== 'all') {
      url.searchParams.set('diagnosticsFilter', filter)
    } else {
      url.searchParams.delete('diagnosticsFilter')
    }

    window.parent.history.replaceState({}, '', url)
  }

  updateDiagnosticsViewer(diagnostics) {
    const filteredDiagnostics = diagnostics.filter(diagnostic =>
      diagnostic.code !== 'parser-no-errors'
    )

    if (filteredDiagnostics.length === 0) {
      console.log('No diagnostics, showing message')
      this.diagnosticsListTarget.classList.add('hidden')
      this.noDiagnosticsTarget.classList.remove('hidden')
      this.updateNoDiagnosticsMessage()
      return
    }

    console.log('Has diagnostics, showing list')
    this.noDiagnosticsTarget.classList.add('hidden')
    this.diagnosticsListTarget.classList.remove('hidden')

    const sortDiagnostics = (items) => {
      return items.sort((a, b) => {
        const lineA = a.line || a.startLineNumber || 1
        const lineB = b.line || b.startLineNumber || 1
        if (lineA !== lineB) return lineA - lineB

        const colA = a.column || a.startColumn || 0
        const colB = b.column || b.startColumn || 0
        return colA - colB
      })
    }

    const diagnosticsByType = {
      error: sortDiagnostics(filteredDiagnostics.filter(d => d.severity === "error")),
      warning: sortDiagnostics(filteredDiagnostics.filter(d => d.severity === "warning")),
      info: sortDiagnostics(filteredDiagnostics.filter(d => d.severity === "info" || d.severity === "hint"))
    }

    let html = ''

    const renderDiagnosticGroup = (title, items, iconClass, textColorClass) => {
      if (items.length === 0) return ''

      let groupHtml = `
        <div class="mb-6">
          <h3 class="flex items-center gap-2 text-lg font-semibold mb-3 ${textColorClass}">
            <i class="${iconClass}"></i>
            ${title} (${items.length})
          </h3>

          <div class="space-y-2">
      `

      items.forEach((diagnostic, index) => {
        const startLine = diagnostic.line || diagnostic.startLineNumber || 1
        const startColumn = (diagnostic.column || diagnostic.startColumn || 0) + 1
        const endLine = diagnostic.endLine || diagnostic.endLineNumber || startLine
        const endColumn = (diagnostic.endColumn || diagnostic.column || 0) + 1

        groupHtml += `
          <div
            class="p-3 border rounded-lg cursor-pointer bg-gray-700 hover:border-gray-400 border-gray-500 diagnostic-item transition-colors duration-150"
            data-diagnostic-index="${index}"
            data-start-line="${startLine}"
            data-start-column="${startColumn}"
            data-end-line="${endLine}"
            data-end-column="${endColumn}"
          >
            <div class="flex items-start gap-3">
              <div class="flex-1 min-w-0">
                <div class="flex items-start justify-between mb-1">
                  <div class="text-sm font-medium text-gray-100">
                    ${this.escapeHtml(diagnostic.message)}
                  </div>
                  ${diagnostic.source ? `<span class="px-2 py-0.5 text-xs rounded ${diagnostic.source.toLowerCase().includes('linter') ? 'bg-blue-600' : 'bg-red-600'} text-white ml-2 flex-shrink-0">${diagnostic.source}</span>` : ''}
                </div>

                <div class="text-xs text-gray-400 flex items-center gap-2">
                  ${diagnostic.severity ? `<span class="px-1.5 py-0.5 rounded text-xs font-medium ${diagnostic.severity === 'error' ? 'bg-red-600 text-red-100' : diagnostic.severity === 'warning' ? 'bg-yellow-600 text-yellow-100' : 'bg-gray-600 text-gray-100'}">${diagnostic.severity.toUpperCase()}</span>` : ''}
                  <span>Line ${startLine}:${startColumn - 1}</span>
                  ${diagnostic.code ? `<span>• ${diagnostic.code}</span>` : ''}
                </div>
              </div>
            </div>
          </div>
        `
      })

      groupHtml += `
          </div>
        </div>
      `

      return groupHtml
    }

    html += renderDiagnosticGroup(
      'Errors',
      diagnosticsByType.error,
      'fas fa-circle-xmark text-red-400',
      'text-red-400'
    )

    html += renderDiagnosticGroup(
      'Warnings',
      diagnosticsByType.warning,
      'fas fa-triangle-exclamation text-yellow-400',
      'text-yellow-400'
    )

    html += renderDiagnosticGroup(
      'Info',
      diagnosticsByType.info,
      'fas fa-info-circle text-blue-400',
      'text-blue-400'
    )

    this.diagnosticsListTarget.innerHTML = html

    this.diagnosticsListTarget.querySelectorAll('.diagnostic-item').forEach(item => {
      item.addEventListener('click', () => {
        const startLine = parseInt(item.dataset.startLine)
        const startColumn = parseInt(item.dataset.startColumn)
        const endLine = parseInt(item.dataset.endLine)
        const endColumn = parseInt(item.dataset.endColumn)

        if (this.editor) {
          this.editor.clearAllHighlights()
          this.editor.highlightAndRevealSection(
            startLine,
            startColumn,
            endLine,
            endColumn,
            'error-highlight'
          )
          this.editor.setCursorPosition(startLine, startColumn - 1)
        }
      })

      item.addEventListener('mouseenter', () => {
        const startLine = parseInt(item.dataset.startLine)
        const startColumn = parseInt(item.dataset.startColumn)
        const endLine = parseInt(item.dataset.endLine)
        const endColumn = parseInt(item.dataset.endColumn)

        if (this.editor) {
          this.editor.clearAllHighlights()
          this.editor.highlightAndRevealSection(
            startLine,
            startColumn,
            endLine,
            endColumn,
            'info-highlight'
          )
        }
      })

      item.addEventListener('mouseleave', () => {
        if (this.editor) {
          this.editor.clearAllHighlights()
        }
      })
    })
  }

  setupTooltip() {
    if (this.hasFormatTooltipTarget) {
      this.formatButtonTarget.addEventListener('mouseenter', this.showTooltip)
      this.formatButtonTarget.addEventListener('mouseleave', this.hideTooltip)
    }
  }

  removeTooltip() {
    if (this.hasFormatTooltipTarget) {
      this.formatButtonTarget.removeEventListener('mouseenter', this.showTooltip)
      this.formatButtonTarget.removeEventListener('mouseleave', this.hideTooltip)

      this.hideTooltip()
    }
  }

  showTooltip = ()  => {
    if (this.hasFormatTooltipTarget) {
      this.formatTooltipTarget.classList.remove('hidden')
    }
  }

  hideTooltip = () => {
    if (this.hasFormatTooltipTarget) {
      this.formatTooltipTarget.classList.add('hidden')
    }
  }

  updateFormatTooltipText(text) {
    if (this.hasFormatTooltipTarget) {
      const textNode = this.formatTooltipTarget.firstChild
      if (textNode && textNode.nodeType === Node.TEXT_NODE) {
        textNode.textContent = text
      }
    }
  }

  setupAutofixTooltip() {
    if (this.hasAutofixTooltipTarget) {
      this.autofixButtonTarget.addEventListener('mouseenter', this.showAutofixTooltip)
      this.autofixButtonTarget.addEventListener('mouseleave', this.hideAutofixTooltip)
    }
  }

  removeAutofixTooltip() {
    if (this.hasAutofixTooltipTarget) {
      this.autofixButtonTarget.removeEventListener('mouseenter', this.showAutofixTooltip)
      this.autofixButtonTarget.removeEventListener('mouseleave', this.hideAutofixTooltip)

      this.hideAutofixTooltip()
    }
  }

  showAutofixTooltip = () => {
    if (this.hasAutofixTooltipTarget) {
      this.autofixTooltipTarget.classList.remove('hidden')
    }
  }

  hideAutofixTooltip = () => {
    if (this.hasAutofixTooltipTarget) {
      this.autofixTooltipTarget.classList.add('hidden')
    }
  }

  updateAutofixTooltipText(text) {
    if (this.hasAutofixTooltipTarget) {
      const textNode = this.autofixTooltipTarget.firstChild
      if (textNode && textNode.nodeType === Node.TEXT_NODE) {
        textNode.textContent = text
      }
    }
  }

  enableAutofixButton() {
    this.autofixButtonTarget.disabled = false
    this.autofixButtonTarget.classList.remove('opacity-50', 'cursor-not-allowed')
    this.autofixButtonTarget.classList.add('hover:bg-gray-200', 'dark:hover:bg-gray-700')
  }

  disableAutofixButton() {
    this.autofixButtonTarget.disabled = true
    this.autofixButtonTarget.classList.add('opacity-50', 'cursor-not-allowed')
    this.autofixButtonTarget.classList.remove('hover:bg-gray-200', 'dark:hover:bg-gray-700')
    this.resetAutofixButtonIcons()
  }

  resetAutofixButtonIcons() {
    if (!this.hasAutofixButtonTarget) return

    const wandIcon = this.autofixButtonTarget.querySelector(".fa-wand-magic-sparkles")
    const checkIcon = this.autofixButtonTarget.querySelector(".fa-circle-check")

    if (wandIcon) {
      wandIcon.classList.remove("hidden")
    }

    if (checkIcon) {
      checkIcon.classList.add("hidden")
      checkIcon.style.display = ""
    }
  }

  setupAutofixUnsafeTooltip() {
    if (this.hasAutofixUnsafeTooltipTarget) {
      this.autofixUnsafeButtonTarget.addEventListener('mouseenter', this.showAutofixUnsafeTooltip)
      this.autofixUnsafeButtonTarget.addEventListener('mouseleave', this.hideAutofixUnsafeTooltip)
    }
  }

  removeAutofixUnsafeTooltip() {
    if (this.hasAutofixUnsafeTooltipTarget) {
      this.autofixUnsafeButtonTarget.removeEventListener('mouseenter', this.showAutofixUnsafeTooltip)
      this.autofixUnsafeButtonTarget.removeEventListener('mouseleave', this.hideAutofixUnsafeTooltip)

      this.hideAutofixUnsafeTooltip()
    }
  }

  showAutofixUnsafeTooltip = () => {
    if (this.hasAutofixUnsafeTooltipTarget) {
      this.autofixUnsafeTooltipTarget.classList.remove('hidden')
    }
  }

  hideAutofixUnsafeTooltip = () => {
    if (this.hasAutofixUnsafeTooltipTarget) {
      this.autofixUnsafeTooltipTarget.classList.add('hidden')
    }
  }

  updateAutofixUnsafeTooltipText(text) {
    if (this.hasAutofixUnsafeTooltipTarget) {
      const textNode = this.autofixUnsafeTooltipTarget.firstChild
      if (textNode && textNode.nodeType === Node.TEXT_NODE) {
        textNode.textContent = text
      }
    }
  }

  enableAutofixUnsafeButton() {
    this.autofixUnsafeButtonTarget.disabled = false
    this.autofixUnsafeButtonTarget.classList.remove('opacity-50', 'cursor-not-allowed')
    this.autofixUnsafeButtonTarget.classList.add('hover:bg-gray-200', 'dark:hover:bg-gray-700')
  }

  disableAutofixUnsafeButton() {
    this.autofixUnsafeButtonTarget.disabled = true
    this.autofixUnsafeButtonTarget.classList.add('opacity-50', 'cursor-not-allowed')
    this.autofixUnsafeButtonTarget.classList.remove('hover:bg-gray-200', 'dark:hover:bg-gray-700')
    this.resetAutofixUnsafeButtonIcons()
  }

  resetAutofixUnsafeButtonIcons() {
    if (!this.hasAutofixUnsafeButtonTarget) return

    const warningIcon = this.autofixUnsafeButtonTarget.querySelector(".fa-triangle-exclamation")
    const checkIcon = this.autofixUnsafeButtonTarget.querySelector(".fa-circle-check")

    if (warningIcon) {
      warningIcon.classList.remove("hidden")
    }

    if (checkIcon) {
      checkIcon.classList.add("hidden")
      checkIcon.style.display = ""
    }
  }

  setupShareTooltip() {
    if (this.hasShareButtonTarget && this.hasShareTooltipTarget) {
      this.shareButtonTarget.addEventListener('mouseenter', this.showShareTooltip)
      this.shareButtonTarget.addEventListener('mouseleave', this.hideShareTooltip)
    }
  }

  removeShareTooltip() {
    if (this.hasShareButtonTarget && this.hasShareTooltipTarget) {
      this.shareButtonTarget.removeEventListener('mouseenter', this.showShareTooltip)
      this.shareButtonTarget.removeEventListener('mouseleave', this.hideShareTooltip)
      this.hideShareTooltip()
    }
  }

  showShareTooltip = () => {
    if (this.hasShareTooltipTarget) {
      this.shareTooltipTarget.classList.remove('hidden')
    }
  }

  hideShareTooltip = () => {
    if (this.hasShareTooltipTarget) {
      this.shareTooltipTarget.classList.add('hidden')
    }
  }

  setupGitHubTooltip() {
    if (this.hasGithubButtonTarget && this.hasGithubTooltipTarget) {
      this.githubButtonTarget.addEventListener('mouseenter', this.showGitHubTooltip)
      this.githubButtonTarget.addEventListener('mouseleave', this.hideGitHubTooltip)
    }
  }

  removeGitHubTooltip() {
    if (this.hasGithubButtonTarget && this.hasGithubTooltipTarget) {
      this.githubButtonTarget.removeEventListener('mouseenter', this.showGitHubTooltip)
      this.githubButtonTarget.removeEventListener('mouseleave', this.hideGitHubTooltip)
      this.hideGitHubTooltip()
    }
  }

  showGitHubTooltip = () => {
    if (this.hasGithubTooltipTarget) {
      this.githubTooltipTarget.classList.remove('hidden')
    }
  }

  hideGitHubTooltip = () => {
    if (this.hasGithubTooltipTarget) {
      this.githubTooltipTarget.classList.add('hidden')
    }
  }

  setupCopyTooltip() {
    if (this.hasCopyButtonTarget && this.hasCopyTooltipTarget) {
      this.copyButtonTarget.addEventListener('mouseenter', this.showCopyTooltip)
      this.copyButtonTarget.addEventListener('mouseleave', this.hideCopyTooltip)
    }
  }

  removeCopyTooltip() {
    if (this.hasCopyButtonTarget && this.hasCopyTooltipTarget) {
      this.copyButtonTarget.removeEventListener('mouseenter', this.showCopyTooltip)
      this.copyButtonTarget.removeEventListener('mouseleave', this.hideCopyTooltip)
      this.hideCopyTooltip()
    }
  }

  showCopyTooltip = () => {
    if (this.hasCopyTooltipTarget) {
      this.copyTooltipTarget.classList.remove('hidden')
    }
  }

  hideCopyTooltip = () => {
    if (this.hasCopyTooltipTarget) {
      this.copyTooltipTarget.classList.add('hidden')
    }
  }

  setupExampleTooltip() {
    if (this.hasExampleButtonTarget && this.hasExampleTooltipTarget) {
      this.exampleButtonTarget.addEventListener('mouseenter', this.showExampleTooltip)
      this.exampleButtonTarget.addEventListener('mouseleave', this.hideExampleTooltip)
    }
  }

  removeExampleTooltip() {
    if (this.hasExampleButtonTarget && this.hasExampleTooltipTarget) {
      this.exampleButtonTarget.removeEventListener('mouseenter', this.showExampleTooltip)
      this.exampleButtonTarget.removeEventListener('mouseleave', this.hideExampleTooltip)
      this.hideExampleTooltip()
    }
  }

  showExampleTooltip = () => {
    if (this.hasExampleTooltipTarget) {
      this.exampleTooltipTarget.classList.remove('hidden')
    }
  }

  hideExampleTooltip = () => {
    if (this.hasExampleTooltipTarget) {
      this.exampleTooltipTarget.classList.add('hidden')
    }
  }

  setupCopyViewerTooltip() {
    if (this.hasCopyViewerButtonTarget && this.hasCopyViewerTooltipTarget) {
      this.copyViewerButtonTarget.addEventListener('mouseenter', this.showCopyViewerTooltip)
      this.copyViewerButtonTarget.addEventListener('mouseleave', this.hideCopyViewerTooltip)
    }
  }

  removeCopyViewerTooltip() {
    if (this.hasCopyViewerButtonTarget && this.hasCopyViewerTooltipTarget) {
      this.copyViewerButtonTarget.removeEventListener('mouseenter', this.showCopyViewerTooltip)
      this.copyViewerButtonTarget.removeEventListener('mouseleave', this.hideCopyViewerTooltip)
      this.hideCopyViewerTooltip()
    }
  }

  showCopyViewerTooltip = () => {
    if (this.hasCopyViewerTooltipTarget) {
      this.copyViewerTooltipTarget.classList.remove('hidden')
    }
  }

  hideCopyViewerTooltip = () => {
    if (this.hasCopyViewerTooltipTarget) {
      this.copyViewerTooltipTarget.classList.add('hidden')
    }
  }

  setupPrinterVerificationTooltip() {
    if (this.hasPrinterVerificationTarget) {
      this.printerVerificationTarget.addEventListener('mouseenter', this.showPrinterVerificationTooltip)
      this.printerVerificationTarget.addEventListener('mouseleave', this.hidePrinterVerificationTooltip)
    }
  }

  removePrinterVerificationTooltip() {
    if (this.hasPrinterVerificationTarget) {
      this.printerVerificationTarget.removeEventListener('mouseenter', this.showPrinterVerificationTooltip)
      this.printerVerificationTarget.removeEventListener('mouseleave', this.hidePrinterVerificationTooltip)
      this.hidePrinterVerificationTooltip()
    }
  }

  showPrinterVerificationTooltip = () => {
    if (!this.printerVerificationTooltipText) return

    const existing = document.getElementById('printer-verification-tooltip')
    if (existing) existing.remove()

    const rect = this.printerVerificationTarget.getBoundingClientRect()

    const tooltip = document.createElement('div')
    tooltip.id = 'printer-verification-tooltip'
    tooltip.className = 'fixed px-2 py-1 text-xs text-white bg-black rounded-md whitespace-nowrap z-[9999] pointer-events-none'
    tooltip.textContent = this.printerVerificationTooltipText

    tooltip.style.left = `${rect.left + (rect.width / 2)}px`
    tooltip.style.top = `${rect.top - 8}px`
    tooltip.style.transform = 'translate(-50%, -100%)'

    document.body.appendChild(tooltip)
  }

  hidePrinterVerificationTooltip = () => {
    const tooltip = document.getElementById('printer-verification-tooltip')
    if (tooltip) tooltip.remove()
  }

  updatePrinterVerificationTooltip(text) {
    this.printerVerificationTooltipText = text
  }

  showShareSuccessMessage() {
    this.showTemporaryMessage("Copied Share URL to clipboard", "success")
  }

  showShareErrorMessage() {
    this.showTemporaryMessage("Failed to copy Share URL", "error")
  }

  showTemporaryMessage(text, type = "info") {
    const existingMessage = document.getElementById('temp-message')
    if (existingMessage) {
      existingMessage.remove()
    }

    const messageDiv = document.createElement('div')
    messageDiv.id = 'temp-message'

    const bgClass = type === "success" ? "bg-green-600" : type === "error" ? "bg-red-600" : "bg-blue-600"

    messageDiv.className = `fixed top-4 left-1/2 transform -translate-x-1/2 ${bgClass} text-white px-4 py-2 rounded-md shadow-lg z-50 text-sm font-medium`
    messageDiv.textContent = text

    document.body.appendChild(messageDiv)
    setTimeout(() => messageDiv.remove(), 4000)
  }

  filterDiagnostics(event) {
    const filter = event.target.getAttribute('data-filter')
    this.currentDiagnosticsFilter = filter

    this.updateDiagnosticsFilterButtons(filter)
    this.updateDiagnosticsFilterInURL(filter)
    this.updateDiagnosticsViewer(this.getFilteredDiagnostics())
  }

  updateNoDiagnosticsMessage() {
    console.log('updateNoDiagnosticsMessage called', {
      hasTarget: !!this.noDiagnosticsTarget,
      filter: this.currentDiagnosticsFilter,
      allDiagnosticsCount: this.allDiagnostics?.length || 0
    })

    if (!this.hasNoDiagnosticsTarget) {
      console.log('No noDiagnosticsTarget found')
      return
    }

    const realDiagnostics = this.allDiagnostics.filter(d => d.code !== 'parser-no-errors')
    const hasAnyDiagnostics = realDiagnostics.length > 0
    const parserCount = realDiagnostics.filter(d => (d.source || '').toLowerCase().includes('herb parser')).length
    const linterCount = realDiagnostics.filter(d => (d.source || '').toLowerCase().includes('herb linter')).length

    let iconClass = 'fas fa-circle-check text-green-400 text-2xl mb-3'
    let title = 'No Issues Found'
    let message = 'No diagnostics to display'

    if (hasAnyDiagnostics) {
      iconClass = 'fas fa-filter text-blue-400 text-2xl mb-3'

      switch(this.currentDiagnosticsFilter) {
        case 'parser':
          title = 'No Parser Issues'

          if (linterCount > 0) {
            message = `No parser errors found.<br>Switch to <button class="text-blue-400 hover:text-blue-300 underline" onclick="document.querySelector('[data-playground-target=diagnosticsFilter][data-filter=linter]').click()">Linter</button> or <button class="text-blue-400 hover:text-blue-300 underline" onclick="document.querySelector('[data-playground-target=diagnosticsFilter][data-filter=all]').click()">All</button> to see other diagnostics.`
          } else {
            message = 'No parser errors found.'
          }

          break
        case 'linter':
          title = 'No Linter Issues'

          if (parserCount > 0) {
            message = `No linter issues found.<br>Switch to <button class="text-blue-400 hover:text-blue-300 underline" onclick="document.querySelector('[data-playground-target=diagnosticsFilter][data-filter=parser]').click()">Parser</button> or <button class="text-blue-400 hover:text-blue-300 underline" onclick="document.querySelector('[data-playground-target=diagnosticsFilter][data-filter=all]').click()">All</button> to see other diagnostics.`
          } else {
            message = 'No linter issues found.'
          }

          break
        default:
          iconClass = 'fas fa-circle-check text-green-400 text-2xl mb-3'
          title = 'No Issues Found'
          message = 'No diagnostics to display'
      }
    }

    const containerDiv = this.noDiagnosticsTarget.querySelector('.absolute.inset-0')

    if (!containerDiv) {
      this.noDiagnosticsTarget.innerHTML = `
        <div class="absolute inset-0 flex items-center justify-center z-10">
          <div class="bg-gray-700 border border-gray-500 rounded-lg p-6 text-center">
            <i class="${iconClass}"></i>
            <h3 class="text-lg font-semibold text-gray-100 mb-2">${title}</h3>
            <p class="text-gray-300 text-sm">
              ${message}
            </p>
          </div>
        </div>
      `
    } else {
      const contentBox = containerDiv.querySelector('.bg-gray-700')

      if (contentBox) {
        contentBox.innerHTML = `
          <i class="${iconClass}"></i>
          <h3 class="text-lg font-semibold text-gray-100 mb-2">${title}</h3>
          <p class="text-gray-300 text-sm">
            ${message}
          </p>
        `
      }
    }
  }

  updateDiagnosticsFilterButtons(activeFilter) {
    const allCount = this.allDiagnostics.length
    const parserCount = this.allDiagnostics.filter(d => (d.source || '').toLowerCase().includes('herb parser')).length
    const linterCount = this.allDiagnostics.filter(d => (d.source || '').toLowerCase().includes('herb linter')).length

    this.diagnosticsFilterTargets.forEach(button => {
      const filter = button.getAttribute('data-filter')
      let count = 0
      let label = ''

      switch(filter) {
        case 'all':
          count = allCount
          label = 'All'
          break
        case 'parser':
          count = parserCount
          label = 'Parser'
          break
        case 'linter':
          count = linterCount
          label = 'Linter'
          break
      }

      button.innerHTML = `${label} (${count})`

      if (filter === activeFilter) {
        button.className = 'px-2 py-1 text-xs rounded bg-green-600 hover:bg-green-700 text-white'
      } else {
        button.className = 'px-2 py-1 text-xs rounded bg-gray-600 hover:bg-gray-500 text-white'
      }
    })
  }

  getFilteredDiagnostics() {
    if (this.currentDiagnosticsFilter === 'all') {
      return this.allDiagnostics
    }

    return this.allDiagnostics.filter(diagnostic => {
      const source = diagnostic.source || ''

      if (this.currentDiagnosticsFilter === 'parser') {
        return source.toLowerCase().includes('herb parser')
      } else if (this.currentDiagnosticsFilter === 'linter') {
        return source.toLowerCase().includes('herb linter')
      }

      return true
    })
  }


  openGitHubIssue(_event) {
    const currentUrl = window.parent.location.href

    const issueTitle = encodeURIComponent('Bug report from Herb Playground')
    const issueBody = encodeURIComponent(dedent`
      ## Bug Report

      <!-- Describe the issue you're experiencing -->

      ## Reproduction

      You can reproduce this issue using the following playground link:

      ${currentUrl}

      ## Expected Behavior

      <!-- What did you expect to happen? -->

      ## Actual Behavior

      <!-- What actually happened? -->

      ## Additional Context

      <!-- Add any other context about the problem here -->
    `)

    const githubUrl = `https://github.com/marcoroth/herb/issues/new?title=${issueTitle}&body=${issueBody}`

    window.open(githubUrl, '_blank')
  }

  escapeHtml(unsafe) {
    return unsafe
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;")
  }

  showPrinterDiff(original, printed) {
    if (!this.hasPrinterDiffTarget || !this.hasPrinterDiffContentTarget) {
      return
    }

    this.printerOutputTarget.classList.add('hidden')
    this.printerDiffTarget.classList.remove('hidden')

    const diff = this.computeCharDiff(original, printed)
    this.printerDiffContentTarget.innerHTML = diff.replace(/^(\s*\n)+/, '')
  }

  hidePrinterDiff() {
    if (!this.hasPrinterDiffTarget) {
      return
    }

    this.printerOutputTarget.classList.remove('hidden')
    this.printerDiffTarget.classList.add('hidden')
  }

  showPrinterLegend() {
    if (this.hasPrinterLegendTarget) {
      this.printerLegendTarget.classList.remove('hidden')
    }
  }

  hidePrinterLegend() {
    if (this.hasPrinterLegendTarget) {
      this.printerLegendTarget.classList.add('hidden')
    }
  }

  computeCharDiff(original, printed) {
    const originalChars = Array.from(original)
    const printedChars = Array.from(printed)

    const dp = this.computeEditDistance(originalChars, printedChars)
    const diff = this.backtrackDiff(originalChars, printedChars, dp)

    let result = ''
    for (const op of diff) {
      if (op.type === 'equal') {
        result += this.escapeHtml(op.char)
      } else if (op.type === 'delete') {
        result += `<span class="bg-yellow-400 text-black">${this.escapeHtml(op.char)}</span>`
      } else if (op.type === 'insert') {
        result += `<span class="bg-green-500 text-black">${this.escapeHtml(op.char)}</span>`
      }
    }

    return result
  }

  computeEditDistance(str1, str2) {
    const m = str1.length
    const n = str2.length
    const dp = Array(m + 1).fill().map(() => Array(n + 1).fill(0))

    for (let i = 0; i <= m; i++) dp[i][0] = i
    for (let j = 0; j <= n; j++) dp[0][j] = j

    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (str1[i - 1] === str2[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1]
        } else {
          dp[i][j] = Math.min(
            dp[i - 1][j] + 1,     // deletion
            dp[i][j - 1] + 1,     // insertion
            dp[i - 1][j - 1] + 1  // substitution
          )
        }
      }
    }

    return dp
  }

  backtrackDiff(str1, str2, dp) {
    const diff = []
    let i = str1.length
    let j = str2.length

    while (i > 0 || j > 0) {
      if (i > 0 && j > 0 && str1[i - 1] === str2[j - 1]) {
        diff.unshift({ type: 'equal', char: str1[i - 1] })
        i--
        j--
      } else if (i > 0 && j > 0 && dp[i][j] === dp[i - 1][j - 1] + 1) {
        // Substitution - show as delete + insert
        diff.unshift({ type: 'delete', char: str1[i - 1] })
        diff.unshift({ type: 'insert', char: str2[j - 1] })
        i--
        j--
      } else if (i > 0 && dp[i][j] === dp[i - 1][j] + 1) {
        diff.unshift({ type: 'delete', char: str1[i - 1] })
        i--
      } else if (j > 0 && dp[i][j] === dp[i][j - 1] + 1) {
        diff.unshift({ type: 'insert', char: str2[j - 1] })
        j--
      }
    }

    return diff
  }

}
