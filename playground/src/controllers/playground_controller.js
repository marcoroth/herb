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
    const validTabs = ['parse', 'lex', 'ruby', 'html', 'format', 'full']
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

    this.editor.addDiagnostics(allDiagnostics)

    if (this.hasDiagnosticStatusTarget && this.hasErrorCountTarget && this.hasWarningCountTarget && this.hasInfoCountTarget) {
      const errorCount = allDiagnostics.filter(diagnostic => diagnostic.severity === "error").length
      const warningCount = allDiagnostics.filter(diagnostic => diagnostic.severity === "warning").length
      const infoCount = allDiagnostics.filter(diagnostic => diagnostic.severity === "info" || diagnostic.severity === "hint").length

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
      this.formatViewerTarget.classList.add("language-html")
      this.formatViewerTarget.textContent = result.formatted

      Prism.highlightElement(this.formatViewerTarget)
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
}
