import "../style.css"
import "../prism"

// import "@alenaksu/json-viewer"

import lz from "lz-string"
import dedent from "dedent"
import Prism from "prismjs"

import { Controller } from "@hotwired/stimulus"
import { replaceTextareaWithMonaco } from "../monaco"
import { findTreeLocationItemWithSmallestRangeFromPosition } from "../ranges"

import { Herb } from "@herb-tools/browser"
import { analyze } from "../analyze"

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

export default class extends Controller {
  static targets = [
    "input",
    "parseViewer",
    "parserOptions",
    "rubyViewer",
    "htmlViewer",
    "lexViewer",
    "formatViewer",
    "formatSuccess",
    "formatError",
    "formatButton",
    "formatTooltip",
    "shareButton",
    "shareTooltip",
    "githubButton",
    "githubTooltip",
    "diagnosticsViewer",
    "diagnosticsContent",
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
  ]

  connect() {
    if (this.isDarkMode) {
      document.documentElement.classList.add('dark')
    }

    document.querySelectorAll('.fa-circle-check').forEach(icon => {
      icon.style.display = 'none'
    })

    this.restoreInput()
    this.restoreActiveTab()
    this.restoreParserOptions()
    this.inputTarget.focus()
    this.load()

    this.urlUpdatedFromChangeEvent = false

    this.editor = replaceTextareaWithMonaco("input", this.inputTarget, {
      language: "erb",
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

    this.setupThemeListener()
    this.setupShareTooltip()
    this.setupGitHubTooltip()
  }

  get isDarkMode() {
    const actualTheme = localStorage.getItem('vitepress-theme-actual')

    if (actualTheme) {
      return actualTheme === 'dark'
    }

    return window.matchMedia('(prefers-color-scheme: dark)').matches
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
  }

  handlePopState = async (event) => {
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

    const options = this.getParserOptions()
    this.setOptionsInURL(options)
  }

  async insert(event) {
    if (
      this.inputTarget.value !== "" &&
      !window.confirm("Do you want to overwrite the current content?")
    ) {
      return
    }

    if (this.editor) {
      this.editor.setValue(exampleFile)
    } else {
      this.inputTarget.value = exampleFile
    }

    const button = this.getClosestButton(event.target)

    button.querySelector(".fa-file").classList.add("hidden")
    button.querySelector(".fa-circle-check").classList.remove("hidden")

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
    } catch (error) {
      button.querySelector(".fa-circle-xmark").classList.remove("hidden")
    }

    button.querySelector(".fa-copy").classList.add("hidden")

    setTimeout(() => {
      button.querySelector(".fa-copy").classList.remove("hidden")
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
    } catch (error) {
      console.error('Failed to copy editor content:', error)
    }
  }

  async copyViewerContent(event) {
    const button = this.getClosestButton(event.target)
    const activeViewer = this.activeViewerButton.dataset.viewer
    let content = ''

    switch(activeViewer) {
      case 'parse':
        content = this.parseViewerTarget.textContent
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
      case 'format':
        if (!this.formatSuccessTarget.classList.contains('hidden')) {
          content = this.formatSuccessTarget.textContent
        } else if (!this.formatErrorTarget.classList.contains('hidden')) {
          const blurredPre = this.formatErrorTarget.querySelector('pre.language-html')
          content = blurredPre ? blurredPre.textContent : ''
        }
        break
      case 'diagnostics':
        content = this.getDiagnosticsAsText()
        break
    }

    if (content) {
      try {
        await navigator.clipboard.writeText(content)
        this.showCopySuccessFixed(button)
      } catch (error) {
        console.error('Failed to copy viewer content:', error)
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

  isValidTab(tab) {
    const validTabs = ['parse', 'lex', 'ruby', 'html', 'format', 'diagnostics', 'full']
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

  selectViewer(event) {
    const button = this.getClosestButton(event.target)
    const tabName = button.dataset.viewer

    this.setActiveTab(tabName)
    this.updateTabInURL(tabName)
  }

  showDiagnostics(event) {
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

  enclargeViewer(event) {
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

  shrinkViewer(event) {
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

  clearTreeLocationHighlights() {
    this.parseViewerTarget
      .querySelectorAll(".tree-location-highlight")
      .forEach((element) => {
        element.classList.remove("tree-location-highlight")
      })
  }

  get treeLocations() {
    return Array.from(
      this.parseViewerTarget?.querySelectorAll(".token.location") || [],
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
    const button = this.getClosestButton(event.target)

    if (button.disabled) {
      return
    }

    try {
      const value = this.editor ? this.editor.getValue() : this.inputTarget.value
      const result = await analyze(Herb, value)

      if (result.formatted) {
        if (this.editor) {
          this.editor.setValue(result.formatted)
        } else {
          this.inputTarget.value = result.formatted
        }

        button.querySelector(".fa-indent").classList.add("hidden")
        button.querySelector(".fa-circle-check").classList.remove("hidden")

        setTimeout(() => {
          button.querySelector(".fa-indent").classList.remove("hidden")
          button.querySelector(".fa-circle-check").classList.add("hidden")
        }, 1000)
      }
    } catch (error) {
      console.error('Format error:', error)
    }
  }

  async analyze() {
    this.updateURL()

    const value = this.editor ? this.editor.getValue() : this.inputTarget.value
    const options = this.getParserOptions()
    const result = await analyze(Herb, value, options)

    this.updatePosition(1, 0, value.length)

    this.editor.clearDiagnostics()

    const allDiagnostics = []

    if (result.parseResult) {
      const errors = result.parseResult.recursiveErrors()
      allDiagnostics.push(...errors.map((error) => error.toMonacoDiagnostic()))
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
      if (result.duration.toFixed(2) == 0.0) {
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
        const githubUrl = `https://github.com/marcoroth/herb/commit/${commitInfo.hash}`

        if (commitInfo.ahead > 0) {
          this.commitHashTarget.textContent = `${commitInfo.tag} (+${commitInfo.ahead} commits) ${commitInfo.hash}`
        } else {
          this.commitHashTarget.textContent = `${commitInfo.tag} ${commitInfo.hash}`
        }

        this.commitHashTarget.href = githubUrl
        this.commitHashTarget.title = `View commit ${commitInfo.hash} on GitHub`
      } else {
        this.commitHashTarget.textContent = 'unknown'
        this.commitHashTarget.removeAttribute('href')
        this.commitHashTarget.removeAttribute('title')
      }
    }

    if (this.hasParseViewerTarget) {
      this.parseViewerTarget.classList.add("language-tree")
      this.parseViewerTarget.textContent = result.string

      Prism.highlightElement(this.parseViewerTarget)

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

    if (this.hasFormatViewerTarget) {
      const hasErrors = filteredDiagnosticsForEditor.some(diagnostic => diagnostic.severity === "error")

      if (hasErrors) {
        this.formatSuccessTarget.classList.add('hidden')
        this.formatErrorTarget.classList.remove('hidden')

        const pre = this.formatErrorTarget.querySelector('pre.language-html')
        pre.textContent = result.formatted || 'No formatted output available'

        Prism.highlightElement(pre)
      } else {
        this.formatErrorTarget.classList.add('hidden')
        this.formatSuccessTarget.classList.remove('hidden')

        this.formatSuccessTarget.textContent = result.formatted || 'No formatted output available'

        Prism.highlightElement(this.formatSuccessTarget)
      }
    }

    if (this.hasFormatButtonTarget) {
      const hasErrors = filteredDiagnosticsForEditor.some(diagnostic => diagnostic.severity === "error")

      if (hasErrors) {
        this.formatButtonTarget.disabled = true
        this.formatButtonTarget.classList.add('opacity-50', 'cursor-not-allowed')
        this.formatButtonTarget.classList.remove('hover:bg-gray-200', 'dark:hover:bg-gray-700')
        this.setupTooltip()
      } else {
        this.formatButtonTarget.disabled = false
        this.formatButtonTarget.classList.remove('opacity-50', 'cursor-not-allowed')
        this.formatButtonTarget.classList.add('hover:bg-gray-200', 'dark:hover:bg-gray-700')
        this.removeTooltip()
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

    if (this.hasDiagnosticsViewerTarget && this.hasDiagnosticsContentTarget) {
      this.updateDiagnosticsViewer(filteredDiagnosticsForEditor)
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
  }

  onOptionChange(event) {
    this.updateURL()
    this.analyze()
  }

  getOptionsFromURL() {
    const urlParams = new URLSearchParams(window.location.search)
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
    const url = new URL(window.location)

    const nonDefaultOptions = {}

    Object.keys(options).forEach(key => {
      if (options[key] !== false && options[key] !== '' && options[key] !== null && options[key] !== undefined) {
        nonDefaultOptions[key] = options[key]
      }
    })

    if (Object.keys(nonDefaultOptions).length > 0) {
      url.searchParams.set('options', JSON.stringify(nonDefaultOptions))
    } else {
      url.searchParams.delete('options')
    }

    window.history.replaceState({}, '', url)
  }

  updateDiagnosticsViewer(diagnostics) {
    const filteredDiagnostics = diagnostics.filter(diagnostic =>
      diagnostic.code !== 'parser-no-errors'
    )

    if (filteredDiagnostics.length === 0) {
      this.noDiagnosticsTarget.classList.remove('hidden')
      this.diagnosticsListTarget.classList.add('hidden')
      return
    }

    this.diagnosticsListTarget.classList.remove('hidden')
    this.noDiagnosticsTarget.classList.add('hidden')

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
        const endColumn = (diagnostic.endColumn || diagnostic.endColumn || diagnostic.column || 0) + 1

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
              <div class="flex-shrink-0 mt-1">
                <i class="${iconClass} text-sm"></i>
              </div>
              <div class="flex-1 min-w-0">
                <div class="text-sm font-medium text-gray-100">
                  ${this.escapeHtml(diagnostic.message)}
                </div>
                <div class="text-xs text-gray-400 mt-1">
                  Line ${startLine}:${startColumn - 1}
                  ${diagnostic.source ? `• ${diagnostic.source}` : ''}
                  ${diagnostic.code ? `• ${diagnostic.code}` : ''}
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

  setupShareTooltip() {
    if (this.hasShareButtonTarget && this.hasShareTooltipTarget) {
      this.shareButtonTarget.addEventListener('mouseenter', this.showShareTooltip)
      this.shareButtonTarget.addEventListener('mouseleave', this.hideShareTooltip)
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

  openGitHubIssue(event) {
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
}
