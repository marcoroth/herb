import "../style.css"
import "../prism"

// import "@alenaksu/json-viewer"
import "element-internals-polyfill"

import lz from "lz-string"
import dedent from "dedent"
import Prism from "prismjs"

import { Controller } from "@hotwired/stimulus"

import LightEditor from "light-pen/exports/components/light-editor/light-editor.js"

import { loader as ERBLoader } from "prism-esm/components/prism-erb.js"
LightEditor.define()

import { Herb } from "@herb-tools/browser"

window.Herb = Herb

const exampleFile = dedent`
  <!-- Example HTML+ERB File -->

  <input required />

  <h1 class="bg-gray-300 text-gray" id='' data-controller="example">
    Hello World <%= RUBY_VERSION %>
  </h1>

  <h2>
    <% if Date.today.friday? %>
      <div>Happy Friday!</div>
    <% else %>
      <div>Happy Day!</div>
    <% end %>
  </h2>

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
    "prettyViewer",
    "rubyViewer",
    "htmlViewer",
    "lexViewer",
    "fullViewer",
    "viewerButton",
    "version",
  ]

  connect() {
    this.restoreInput()
    this.analyze()

    this.highlighter = this.inputTarget.highlighter

    ERBLoader(this.highlighter)

    this.inputTarget.setAttribute("language", "erb")
    this.inputTarget.requestUpdate("highlighter")

    this.inputTarget.focus()
  }

  updateURL() {
    window.location.hash = this.compressedValue
  }

  async insert(event) {
    if (
      this.inputTarget.value !== "" &&
      !window.confirm("Do you want to overwrite the current content?")
    ) {
      return
    }

    this.inputTarget.value = exampleFile

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
      await navigator.clipboard.writeText(window.location.href)

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
    if (window.location.hash && this.inputTarget.value === "") {
      this.inputTarget.value = this.decompressedValue
    }
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

    this.viewerButtonTargets.forEach((button) => {
      button.dataset.active = false
    })
    button.dataset.active = true

    this.element
      .querySelectorAll("[data-viewer-target]")
      .forEach((viewer) => viewer.classList.add("hidden"))

    this.currentViewer?.classList.remove("hidden")
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

  async analyze() {
    this.updateURL()

    if (this.timeout) {
      clearTimeout(this.timeout)
    }

    this.timeout = setTimeout(() => {
      this.prettyViewerTarget.textContent = "..."
    }, 2000)

    let response
    let json

    try {
      response = await fetch("/api/analyze", {
        method: "POST",
        body: this.inputTarget.value,
      })
    } catch (error) {
      this.prettyViewerTarget.data = { error, message: error.message }
      this.fullViewerTarget.data = { error, message: error.message }
      return
    }

    clearTimeout(this.timeout)

    if (response.ok) {
      try {
        json = await response.json()

        if (this.hasVersionTarget) {
          this.versionTarget.textContent = json.version
        }

        if (this.hasPrettyViewerTarget) {
          this.prettyViewerTarget.classList.add("language-tree")
          this.prettyViewerTarget.textContent = json.string

          Prism.highlightElement(this.prettyViewerTarget)
        }

        if (this.hasHtmlViewerTarget) {
          this.htmlViewerTarget.classList.add("language-html")
          this.htmlViewerTarget.textContent = json.html

          Prism.highlightElement(this.htmlViewerTarget)
        }

        if (this.hasRubyViewerTarget) {
          this.rubyViewerTarget.classList.add("language-ruby")
          this.rubyViewerTarget.textContent = json.ruby

          Prism.highlightElement(this.rubyViewerTarget)
        }

        if (this.hasLexViewerTarget) {
          this.lexViewerTarget.classList.add("language-tree")
          this.lexViewerTarget.textContent = json.lex

          console.log(json)

          Prism.highlightElement(this.lexViewerTarget)
        }

        if (this.hasFullViewerTarget) {
          const isEmpty = !this.fullViewerTarget.data

          this.fullViewerTarget.data = { ast: json.ast }

          if (isEmpty) {
            this.fullViewerTarget.expand("ast")
          }
        }
      } catch (error) {
        this.prettyViewerTarget.data = {
          error: "Server didn't return JSON",
          response: error.message,
        }
        this.fullViewerTarget.data = {
          error: "Server didn't return JSON",
          response: error.message,
        }
      }
    } else {
      this.prettyViewerTarget.data = {
        error: "Server didn't respond with a 200 response",
      }
      this.fullViewerTarget.data = {
        error: "Server didn't respond with a 200 response",
      }
    }
  }

  get compressedValue() {
    return lz.compressToEncodedURIComponent(this.inputTarget.value)
  }

  get decompressedValue() {
    return lz.decompressFromEncodedURIComponent(window.location.hash.slice(1))
  }
}
