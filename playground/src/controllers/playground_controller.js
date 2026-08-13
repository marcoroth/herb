import "../style.css"
import "../prism"

// import "@alenaksu/json-viewer"

import lz from "lz-string"
import dedent from "dedent"
import Prism from "prismjs"

import { Controller } from "@hotwired/stimulus"
import { replaceTextareaWithMonaco } from "../monaco"
import { registerLanguageService } from "../language-service"
import { findTreeLocationItemWithSmallestRangeFromPosition } from "../ranges"
import { ParseTreeView } from "../parse-tree-view"
import { DiffView } from "../diff-view"
import { TooltipRegistry } from "../tooltip"

import { Herb } from "@herb-tools/browser"
import { FRAMEWORKS } from "@herb-tools/config/schema"
import { AnalyzeClient } from "../analyze-client"
import { analyzeRuby } from "../analyze-ruby"

window.Herb = Herb

const URL_UPDATE_THROTTLE = 100
const ANALYZE_DEBOUNCE = 250
const FAST_ANALYZE_DEBOUNCE = 50
const FAST_ANALYZE_MAX_LENGTH = 600
const DEFAULT_FRAMEWORK = "actionview"

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
    "autofixViewer",
    "autofixOutput",
    "autofixError",
    "autofixVerification",
    "autofixIncludeUnsafe",
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
    "linterFramework",
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
    "diffWhitespaceCheckbox",
    "diffParseError",
  ]

  pendingHash = null
  pendingSearch = null
  urlUpdateTimeout = null
  lastURLUpdateAt = 0

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

    this.restoreInput()
    this.restoreActiveTab()

    if (!this.isRubyMode) {
      this.restoreParserOptions()
      this.restorePrinterOptions()
      this.restoreFormatterOptions()
      this.restoreAutofixOptions()
      this.populateFrameworkOptions()
      this.restoreLinterOptions()
    }

    this.lastWrittenHash = null
    this.analyzeTimeout = null
    this.parseTreeView = this.hasParseOutputTarget ? this.createParseTreeView() : null
    this.diffView = this.createDiffView()
    this.analyzeClient = new AnalyzeClient()

    this.inputTarget.focus()
    this.load()

    this.editor = replaceTextareaWithMonaco("input", this.inputTarget, {
      language: this.isRubyMode ? "ruby" : "erb",
      theme: this.isDarkMode ? 'vs-dark' : 'vs',
      automaticLayout: true,
      minimap: { enabled: false },
    })

    this.editor.onEditorClick((position) => {
      this.editor.clearAllHighlights()
      this.parseTreeView?.clearHighlights()

      const range = findTreeLocationItemWithSmallestRangeFromPosition(
        this.treeLocations,
        position.lineNumber,
        position.column - 1,
      )

      if (!range) return

      this.parseTreeView.revealLine(range.lineIndex)
      this.parseTreeView.highlightLine(range.lineIndex)
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
    this.tooltips = this.createTooltips()
    this.tooltips.attachAll()
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

    this.languageService?.dispose()
    this.languageService = null

    this.analyzeClient?.dispose()
    this.analyzeClient = null

    this.parseTreeView?.dispose()
    this.parseTreeView = null

    if (this.analyzeTimeout !== null) {
      clearTimeout(this.analyzeTimeout)
      this.analyzeTimeout = null
    }

    if (this.urlUpdateTimeout !== null) {
      clearTimeout(this.urlUpdateTimeout)
      this.urlUpdateTimeout = null
      this.flushURLUpdate()
    }

    this.tooltips?.detachAll()
  }

  handlePopState = async (_event) => {
    if (window.parent.location.hash.slice(1) === this.lastWrittenHash) return

    this.editor.setValue(this.decompressedValue)
  }

  async load() {
    await Herb.load()
    this.setupLanguageService()
    this.analyze()
  }

  setupLanguageService() {
    if (this.isRubyMode) return
    if (this.languageService) return

    this.languageService = registerLanguageService(Herb)
    this.languageService.setFramework(this.getLinterOptions().framework)

    window.languageService = this.languageService
  }

  updateURL() {
    this.queueURLUpdate({ hash: this.compressedValue })

    if (!this.isRubyMode) {
      const options = this.getParserOptions()
      const printerOptions = this.getPrinterOptions()
      const formatterOptions = this.getFormatterOptions()
      const autofixOptions = this.getAutofixOptions()
      const linterOptions = this.getLinterOptions()
      this.setOptionsInURL(options)
      this.setPrinterOptionsInURL(printerOptions)
      this.setFormatterOptionsInURL(formatterOptions)
      this.setAutofixOptionsInURL(autofixOptions)
      this.setLinterOptionsInURL(linterOptions)
    }
  }

  updateSearchParams(update) {
    const params = new URLSearchParams(
      this.pendingSearch !== null ? this.pendingSearch : window.parent.location.search,
    )

    update(params)

    this.queueURLUpdate({ search: params.toString() })
  }

  queueURLUpdate({ hash, search }) {
    if (hash !== undefined) this.pendingHash = hash
    if (search !== undefined) this.pendingSearch = search

    if (this.urlUpdateTimeout !== null) return
    if (!this.hasPendingURLUpdate) return

    const elapsed = Date.now() - this.lastURLUpdateAt

    this.urlUpdateTimeout = setTimeout(() => {
      this.urlUpdateTimeout = null
      this.flushURLUpdate()
    }, Math.max(0, URL_UPDATE_THROTTLE - elapsed))
  }

  get hasPendingURLUpdate() {
    const location = window.parent.location

    if (this.pendingHash !== null && this.pendingHash !== location.hash.slice(1)) return true
    if (this.pendingSearch !== null && this.pendingSearch !== new URLSearchParams(location.search).toString()) return true

    return false
  }

  flushURLUpdate() {
    const location = window.parent.location
    const hash = this.pendingHash
    const search = this.pendingSearch

    this.pendingHash = null
    this.pendingSearch = null
    this.lastURLUpdateAt = Date.now()

    if (hash !== null && hash !== location.hash.slice(1)) {
      this.lastWrittenHash = hash
      location.hash = hash
    }

    if (search === null || search === new URLSearchParams(location.search).toString()) return

    const url = new URL(location)
    url.search = search

    window.parent.history.replaceState({}, '', url)
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
      case 'autofix':
        if (!this.autofixOutputTarget.classList.contains('hidden')) {
          content = this.autofixOutputTarget.textContent
        } else if (!this.autofixErrorTarget.classList.contains('hidden')) {
          const blurredPre = this.autofixErrorTarget.querySelector('pre.language-html')
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

  restoreAutofixOptions() {
    const autofixOptionsFromURL = this.getAutofixOptionsFromURL()

    if (Object.keys(autofixOptionsFromURL).length > 0) {
      this.setAutofixOptions(autofixOptionsFromURL)
    }
  }

  populateFrameworkOptions() {
    if (!this.hasLinterFrameworkTarget) return

    const options = Object.entries(FRAMEWORKS)
      .map(([framework, label]) => new Option(label, framework, false, framework === DEFAULT_FRAMEWORK))
      .sort((a, b) => a.text.localeCompare(b.text))

    this.linterFrameworkTarget.replaceChildren(...options, new Option("Not set", ""))
  }

  restoreLinterOptions() {
    const linterOptionsFromURL = this.getLinterOptionsFromURL()

    if (Object.keys(linterOptionsFromURL).length > 0) {
      this.setLinterOptions(linterOptionsFromURL)
    }
  }

  setLinterOptions(linterOptions) {
    if (!this.hasLinterFrameworkTarget) return
    if (!linterOptions.hasOwnProperty('framework')) return

    const framework = linterOptions.framework || ""
    const isKnownFramework = Array.from(this.linterFrameworkTarget.options).some(option => option.value === framework)

    if (isKnownFramework) {
      this.linterFrameworkTarget.value = framework
    }
  }

  setAutofixOptions(autofixOptions) {
    if (this.hasAutofixIncludeUnsafeTarget && autofixOptions.hasOwnProperty('includeUnsafe')) {
      this.autofixIncludeUnsafeTarget.checked = Boolean(autofixOptions.includeUnsafe)
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

  get activeTab() {
    return this.activeViewerButton?.dataset?.viewer ?? "parse"
  }

  get analyzeJobs() {
    const jobs = ["lint"]
    const tab = this.activeTab

    if (this.isValidTab(tab) && tab !== "diagnostics" && tab !== "diff") {
      jobs.push(tab)
    }

    return jobs
  }

  isValidTab(tab) {
    const validTabs = ['parse', 'lex', 'ruby', 'html', 'format', 'autofix', 'printer', 'diagnostics', 'rewrite', 'diff', 'full']
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
    this.updateSearchParams((params) => {
      if (tabName && tabName !== 'parse') {
        params.set('tab', tabName)
      } else {
        params.delete('tab')
      }

      if (tabName !== 'diagnostics') {
        params.delete('diagnosticsFilter')
      }
    })
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
    this.analyze()
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

  expandAllNodes() {
    this.parseTreeView?.expandAll()
  }

  collapseAllNodes() {
    this.parseTreeView?.collapseAll()
  }

  createTooltips() {
    const registry = new TooltipRegistry()

    const element = (name) => (this[`has${name[0].toUpperCase()}${name.slice(1)}Target`] ? this[`${name}Target`] : null)

    registry.add("format", element("formatButton"), element("formatTooltip"))
    registry.add("autofix", element("autofixButton"), element("autofixTooltip"))
    registry.add("autofixUnsafe", element("autofixUnsafeButton"), element("autofixUnsafeTooltip"))
    registry.add("share", element("shareButton"), element("shareTooltip"))
    registry.add("github", element("githubButton"), element("githubTooltip"))
    registry.add("copy", element("copyButton"), element("copyTooltip"))
    registry.add("example", element("exampleButton"), element("exampleTooltip"))
    registry.add("copyViewer", element("copyViewerButton"), element("copyViewerTooltip"))
    registry.addFloating("printerVerification", element("printerVerification"), "printer-verification-tooltip")

    return registry
  }

  createDiffView() {
    return new DiffView({
      viewer: this.hasDiffViewerTarget ? this.diffViewerTarget : null,
      output: this.hasDiffOutputTarget ? this.diffOutputTarget : null,
      status: this.hasDiffStatusTarget ? this.diffStatusTarget : null,
      parseError: this.hasDiffParseErrorTarget ? this.diffParseErrorTarget : null,
      liveButton: this.hasDiffLiveButtonTarget ? this.diffLiveButtonTarget : null,
      checkpointButton: this.hasDiffCheckpointButtonTarget ? this.diffCheckpointButtonTarget : null,
      snapshotButton: this.hasDiffSnapshotButtonTarget ? this.diffSnapshotButtonTarget : null,
      checkButton: this.hasDiffCheckButtonTarget ? this.diffCheckButtonTarget : null,
      whitespaceCheckbox: this.hasDiffWhitespaceCheckboxTarget ? this.diffWhitespaceCheckboxTarget : null,
    }, {
      getSource: () => (this.editor ? this.editor.getValue() : this.inputTarget.value),
      setSource: (source) => {
        if (this.editor) {
          this.editor.setValue(source)
        } else {
          this.inputTarget.value = source
        }

        this.analyze()
      },
      onOptionsChanged: () => this.updateURL(),
    })
  }

  setDiffModeLive() {
    this.diffView?.setModeLive()
  }

  setDiffModeCheckpoint() {
    this.diffView?.setModeCheckpoint()
  }

  diffTakeSnapshot() {
    this.diffView?.takeSnapshot()
  }

  diffCheckpoint() {
    this.diffView?.checkpoint()
  }

  diffSnapshot() {
    this.diffView?.takeSnapshot()
  }

  diffCheck() {
    this.diffView?.checkpoint()
  }

  diffOptions() {
    return this.diffView?.options ?? {}
  }

  onDiffOptionChange(_event) {
    this.diffView?.optionsChanged()
  }

  clearDiffFeed() {
    this.diffView?.clearFeed()
  }

  updateDiff(parseSuccess = true) {
    this.diffView?.update(parseSuccess)
  }

  createParseTreeView() {
    return new ParseTreeView(this.parseOutputTarget, {
      onHoverLocation: (location, isError) => {
        this.parseTreeView.clearHighlights()
        this.editor?.clearAllHighlights()
        this.editor?.highlightAndRevealSection(
          ...location,
          isError ? "error-highlight" : "info-highlight",
        )
      },
    })
  }

  clearTreeLocationHighlights() {
    this.parseTreeView?.clearHighlights()
  }

  get treeLocations() {
    return this.parseTreeView?.locations ?? []
  }

  renderParseTree(tree) {
    if (!this.hasParseOutputTarget) return

    this.parseTreeView?.render(tree)
  }

  input() {
    this.scheduleAnalyze()
  }

  scheduleAnalyze() {
    if (this.analyzeTimeout !== null) clearTimeout(this.analyzeTimeout)

    this.analyzeTimeout = setTimeout(() => {
      this.analyzeTimeout = null
      this.analyze()
    }, this.analyzeDebounce)
  }

  get analyzeDebounce() {
    const length = this.editor ? this.editor.getValue().length : this.inputTarget.value.length

    return length <= FAST_ANALYZE_MAX_LENGTH ? FAST_ANALYZE_DEBOUNCE : ANALYZE_DEBOUNCE
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
      const result = await this.analyzeClient.analyze({
        source: value,
        options: {},
        printerOptions: {},
        formatterOptions,
        autofixOptions: {},
        linterOptions: {},
        jobs: ["format"],
      })

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

  async autofixThroughWorker(source, includeUnsafe) {
    const result = await this.analyzeClient.analyze({
      source,
      options: {},
      printerOptions: {},
      formatterOptions: {},
      autofixOptions: { includeUnsafe },
      linterOptions: this.getLinterOptions(),
      jobs: ["lint", "autofix"],
    })

    return result.autofix
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
      const result = await this.autofixThroughWorker(value, false)

      if (result) {
        const fixedCount = result.fixedCount

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
      const result = await this.autofixThroughWorker(value, true)

      if (result) {
        const fixedCount = result.fixedCount

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
    const autofixOptions = this.getAutofixOptions()
    const linterOptions = this.getLinterOptions()
    const result = await this.analyzeClient.analyzeLatest({
      source: value,
      options,
      printerOptions,
      formatterOptions,
      autofixOptions,
      linterOptions,
      jobs: this.analyzeJobs,
    })

    if (!result) return

    this.updatePosition(1, 0, value.length)

    this.editor.clearDiagnostics()

    const allDiagnostics = []

    allDiagnostics.push(...result.parserDiagnostics)

    if (result.lintOffenses) {
      const lintDiagnostics = result.lintOffenses.map((offense) => ({
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

    if (result.string !== undefined) {
      this.renderParseTree(result.string)
    }

    if (this.hasHtmlViewerTarget && result.html !== undefined) {
      this.htmlViewerTarget.classList.add("language-html")
      this.htmlViewerTarget.textContent = result.html

      Prism.highlightElement(this.htmlViewerTarget)
    }

    if (this.hasRewriteViewerTarget && result.rewritten !== undefined) {
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

    const hasParserErrors = result.hasParserErrors
    const currentSource = this.editor ? this.editor.getValue() : this.inputTarget.value
    const isWellFormatted = currentSource === result.formatted

    if (this.hasFormatViewerTarget && result.formatted !== undefined) {
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

    if (this.hasAutofixViewerTarget && result.autofix !== undefined) {
      const autofixedSource = result.autofix ? result.autofix.source : null
      const fixedCount = result.autofix ? result.autofix.fixedCount : 0
      const offenseCount = result.lintOffenses ? result.lintOffenses.length : 0

      if (hasParserErrors || autofixedSource === null) {
        this.autofixOutputTarget.classList.add('hidden')
        this.autofixErrorTarget.classList.remove('hidden')

        const pre = this.autofixErrorTarget.querySelector('pre.language-html')
        pre.textContent = autofixedSource || currentSource

        Prism.highlightElement(pre)

        if (this.hasAutofixVerificationTarget) {
          this.autofixVerificationTarget.textContent = '⚠ Autofix Unavailable'
          this.autofixVerificationTarget.className = 'px-2 py-1 text-xs rounded font-medium bg-red-600 text-red-100'
        }
      } else {
        this.autofixErrorTarget.classList.add('hidden')
        this.autofixOutputTarget.classList.remove('hidden')

        this.autofixOutputTarget.textContent = autofixedSource

        Prism.highlightElement(this.autofixOutputTarget)

        if (this.hasAutofixVerificationTarget) {
          const offensesLabel = fixedCount === 1 ? 'offense' : 'offenses'

          if (fixedCount > 0) {
            this.autofixVerificationTarget.textContent = `✓ Autofixed ${fixedCount} ${offensesLabel}`
            this.autofixVerificationTarget.className = 'px-2 py-1 text-xs rounded font-medium bg-green-600 text-green-100'
          } else if (offenseCount > 0) {
            this.autofixVerificationTarget.textContent = '⚠ No autofixes available'
            this.autofixVerificationTarget.className = 'px-2 py-1 text-xs rounded font-medium bg-orange-600 text-orange-100'
          } else {
            this.autofixVerificationTarget.textContent = '✓ No Herb Linter offenses found'
            this.autofixVerificationTarget.className = 'px-2 py-1 text-xs rounded font-medium bg-green-600 text-green-100'
          }
        }
      }
    }

    if (this.hasFormatButtonTarget) {
      const hasParserErrors = result.hasParserErrors

      if (hasParserErrors) {
        this.formatButtonTarget.disabled = true
        this.formatButtonTarget.classList.add('opacity-50', 'cursor-not-allowed')
        this.formatButtonTarget.classList.remove('hover:bg-gray-200', 'dark:hover:bg-gray-700')
        this.tooltips.attach("format")
        this.tooltips.setText("format", 'Cannot format code due to parser errors. Fix parser errors in Diagnostics tab first.')
      } else {
        this.formatButtonTarget.disabled = false
        this.formatButtonTarget.classList.remove('opacity-50', 'cursor-not-allowed')
        this.formatButtonTarget.classList.add('hover:bg-gray-200', 'dark:hover:bg-gray-700')
        this.tooltips.setText("format", 'Format the editor content using the Herb Formatter')
      }
    }

    if (this.hasAutofixButtonTarget) {
      const hasParserErrors = result.hasParserErrors
      const hasLintOffenses = !!(result.lintOffenses && result.lintOffenses.length > 0)

      if (hasParserErrors) {
        this.disableAutofixButton()
        this.tooltips.attach("autofix")
        this.tooltips.setText("autofix", 'Cannot autofix code due to parser errors. Fix parser errors in Diagnostics tab first.')
      } else if (!hasLintOffenses) {
        this.disableAutofixButton()
        this.tooltips.attach("autofix")
        this.tooltips.setText("autofix", 'No Herb Linter offenses found to autofix.')
      } else {
        this.enableAutofixButton()
        this.tooltips.setText("autofix", 'Autocorrect autocorrectable Herb Linter offenses')
      }
    }

    if (this.hasAutofixUnsafeWrapperTarget) {
      const hasParserErrors = result.hasParserErrors
      const hasUnsafeOffenses = result.hasUnsafeOffenses

      if (hasParserErrors || !hasUnsafeOffenses) {
        this.autofixUnsafeWrapperTarget.classList.add('hidden')
      } else {
        this.autofixUnsafeWrapperTarget.classList.remove('hidden')
        this.enableAutofixUnsafeButton()
        this.tooltips.setText("autofixUnsafe", 'Autocorrect unsafe Herb Linter offenses')
      }
    }

    if (this.hasRubyViewerTarget && result.ruby !== undefined) {
      this.rubyViewerTarget.classList.add("language-ruby")
      this.rubyViewerTarget.textContent = result.ruby

      Prism.highlightElement(this.rubyViewerTarget)
    }

    if (this.hasLexViewerTarget && result.lex !== undefined) {
      this.lexViewerTarget.classList.add("language-tree")
      this.lexViewerTarget.textContent = result.lex

      Prism.highlightElement(this.lexViewerTarget)
    }

    if (this.hasPrinterViewerTarget && result.printed !== undefined) {
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
          this.tooltips.setText("printerVerification", 'Source → Parse → AST → Print → Source failed due to printer error - unable to verify document preservation. Try enabling "Ignore errors" to attempt printing anyway.')
          this.hidePrinterDiff()
          this.hidePrinterLegend()
        } else if (!trackWhitespace) {
          this.printerVerificationTarget.textContent = '⚠ Enable "Track whitespace"'
          this.printerVerificationTarget.className = 'px-2 py-1 text-xs rounded font-medium bg-yellow-600 text-yellow-100'
          this.tooltips.setText("printerVerification", 'Enable "Track whitespace" to verify no document details are lost during parsing (Source → Parse → AST → Print → Source)')
          this.hidePrinterDiff()
          this.hidePrinterLegend()
        } else if (isMatch) {
          this.printerVerificationTarget.textContent = '✓ Perfect Round-trip'
          this.printerVerificationTarget.className = 'px-2 py-1 text-xs rounded font-medium bg-green-600 text-green-100'
          this.tooltips.setText("printerVerification", '✓ No document details lost during parsing - Source → Parse → AST → Print → Source preserved everything')
          this.hidePrinterDiff()
          this.hidePrinterLegend()
        } else {
          this.printerVerificationTarget.textContent = '✗ Round-trip Differences'
          this.printerVerificationTarget.className = 'px-2 py-1 text-xs rounded font-medium bg-red-600 text-red-100'
          this.tooltips.setText("printerVerification", '⚠ Document details lost during parsing - differences below show what was lost in Source → Parse → AST → Print → Source')
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

    this.renderParseTree(result.string)
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

  onAutofixOptionChange(_event) {
    this.updateURL()
    this.analyze()
  }

  onLinterOptionChange(_event) {
    this.languageService?.setFramework(this.getLinterOptions().framework)
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

  getLinterOptions() {
    const options = {}

    if (this.hasLinterFrameworkTarget) {
      options.framework = this.linterFrameworkTarget.value || undefined
    }

    return options
  }

  getAutofixOptions() {
    const options = {}

    if (this.hasAutofixIncludeUnsafeTarget) {
      options.includeUnsafe = this.autofixIncludeUnsafeTarget.checked
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
    const defaults = {
      track_whitespace: false,
      analyze: true,
      strict: true,
      action_view_helpers: false,
      transform_conditionals: false,
      render_nodes: false,
      strict_locals: false,
      iteration_nodes: false,
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

    this.updateSearchParams((params) => {
      if (Object.keys(nonDefaultOptions).length > 0) {
        params.set('options', JSON.stringify(nonDefaultOptions))
      } else {
        params.delete('options')
      }
    })
  }

  setPrinterOptionsInURL(printerOptions) {
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

    this.updateSearchParams((params) => {
      if (Object.keys(nonDefaultPrinterOptions).length > 0) {
        params.set('printerOptions', JSON.stringify(nonDefaultPrinterOptions))
      } else {
        params.delete('printerOptions')
      }
    })
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
    const nonDefaultFormatterOptions = {}

    Object.keys(formatterOptions).forEach(key => {
      if (key === 'maxLineLength' && formatterOptions[key] !== 80) {
        nonDefaultFormatterOptions[key] = formatterOptions[key]
      }
    })

    this.updateSearchParams((params) => {
      if (Object.keys(nonDefaultFormatterOptions).length > 0) {
        params.set('formatterOptions', JSON.stringify(nonDefaultFormatterOptions))
      } else {
        params.delete('formatterOptions')
      }
    })
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

  setAutofixOptionsInURL(autofixOptions) {
    const defaults = {
      includeUnsafe: false,
    }

    const nonDefaultAutofixOptions = {}

    Object.keys(autofixOptions).forEach(key => {
      const value = autofixOptions[key]
      const defaultValue = defaults[key]

      if (value !== defaultValue && value !== '' && value !== null && value !== undefined) {
        nonDefaultAutofixOptions[key] = value
      }
    })

    this.updateSearchParams((params) => {
      if (Object.keys(nonDefaultAutofixOptions).length > 0) {
        params.set('autofixOptions', JSON.stringify(nonDefaultAutofixOptions))
      } else {
        params.delete('autofixOptions')
      }
    })
  }

  getAutofixOptionsFromURL() {
    const urlParams = new URLSearchParams(window.parent.location.search)
    const autofixOptionsString = urlParams.get('autofixOptions')

    if (autofixOptionsString) {
      try {
        return JSON.parse(decodeURIComponent(autofixOptionsString))
      } catch (e) {
        console.warn('Failed to parse autofix options from URL:', e)
      }
    }

    return {}
  }

  setLinterOptionsInURL(linterOptions) {
    const nonDefaultLinterOptions = {}

    if (linterOptions.hasOwnProperty('framework') && linterOptions.framework !== DEFAULT_FRAMEWORK) {
      nonDefaultLinterOptions.framework = linterOptions.framework ?? null
    }

    this.updateSearchParams((params) => {
      if (Object.keys(nonDefaultLinterOptions).length > 0) {
        params.set('linterOptions', JSON.stringify(nonDefaultLinterOptions))
      } else {
        params.delete('linterOptions')
      }
    })
  }

  getLinterOptionsFromURL() {
    const urlParams = new URLSearchParams(window.parent.location.search)
    const linterOptionsString = urlParams.get('linterOptions')

    if (linterOptionsString) {
      try {
        return JSON.parse(decodeURIComponent(linterOptionsString))
      } catch (e) {
        console.warn('Failed to parse linter options from URL:', e)
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
    this.updateSearchParams((params) => {
      if (filter && filter !== 'all') {
        params.set('diagnosticsFilter', filter)
      } else {
        params.delete('diagnosticsFilter')
      }
    })
  }

  updateDiagnosticsViewer(diagnostics) {
    const filteredDiagnostics = diagnostics.filter(diagnostic =>
      diagnostic.code !== 'parser-no-errors'
    )

    if (filteredDiagnostics.length === 0) {
      this.diagnosticsListTarget.classList.add('hidden')
      this.noDiagnosticsTarget.classList.remove('hidden')
      this.updateNoDiagnosticsMessage()
      return
    }

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
    if (!this.hasNoDiagnosticsTarget) {
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
