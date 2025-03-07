import '../style.css'
import '../prism'

// import "@alenaksu/json-viewer"
import 'element-internals-polyfill'

import lz from 'lz-string'
import dedent from 'dedent'
import Prism from 'prismjs'

import { Controller } from '@hotwired/stimulus'

import LightEditor from 'light-pen/exports/components/light-editor/light-editor.js'

import { loader as ERBLoader } from 'prism-esm/components/prism-erb.js'
LightEditor.define()

const exampleFile = dedent`
  <!-- Example HTML+ERB File -->

  <input required />

  <h1 class="bg-gray-300 text-gray" id='' data-controller="example">
    Hello World <%= RUBY_VERSION %>
  </h1>

  <h2>
    <% if Date.today.friday? %>
      <div>Title 1</div>
    <% else %>
      <div>Title 2</div>
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
  static targets = ['input', 'simpleViewer', 'fullViewer', 'viewerButton']

  connect () {
    this.restoreInput()
    this.analyze()

    this.highlighter = this.inputTarget.highlighter

    ERBLoader(this.highlighter)

    this.inputTarget.setAttribute('language', 'erb')
    this.inputTarget.requestUpdate('highlighter')
  }

  updateURL () {
    window.location.hash = this.compressedValue
  }

  async insert (event) {
    if (this.inputTarget.value !== '' && !window.confirm('Do you want to overwrite the current content?')) {
      return
    }

    this.inputTarget.value = exampleFile

    const button = this.getClosestButton(event.target)

    button.querySelector('.fa-file').classList.add('hidden')
    button.querySelector('.fa-circle-check').classList.remove('hidden')

    setTimeout(() => {
      button.querySelector('.fa-file').classList.remove('hidden')
      button.querySelector('.fa-circle-check').classList.add('hidden')
    }, 1000)
  }

  async share (event) {
    const button = this.getClosestButton(event.target)

    try {
      await navigator.clipboard.writeText(window.location.href)

      button.querySelector('.fa-circle-check').classList.remove('hidden')
    } catch (error) {
      button.querySelector('.fa-circle-xmark').classList.remove('hidden')
    }

    button.querySelector('.fa-copy').classList.add('hidden')

    setTimeout(() => {
      button.querySelector('.fa-copy').classList.remove('hidden')
      button.querySelector('.fa-circle-xmark').classList.add('hidden')
      button.querySelector('.fa-circle-check').classList.add('hidden')
    }, 1000)
  }

  restoreInput () {
    if (window.location.hash && this.inputTarget.value === '') {
      this.inputTarget.value = this.decompressedValue
    }
  }

  getClosestButton (element) {
    return (element instanceof window.HTMLButtonElement) ? element : element.closest('button')
  }

  selectViewer (event) {
    const button = this.getClosestButton(event.target)

    this.viewerButtonTargets.forEach((button) => { button.dataset.active = false })
    button.dataset.active = true

    if (button.dataset.viewer === 'simple') {
      this.simpleViewerTarget.classList.remove('hidden')
      this.fullViewerTarget.classList.add('hidden')
    } else {
      this.simpleViewerTarget.classList.add('hidden')
      this.fullViewerTarget.classList.remove('hidden')
    }
  }

  async analyze () {
    this.updateURL()

    if (this.timeout) {
      clearTimeout(this.timeout)
    }

    this.timeout = setTimeout(() => {
      this.simpleViewerTarget.textContent = '...'
    }, 2000)

    let response
    let json

    try {
      response = await fetch('/api/analyze', {
        method: 'POST',
        body: this.inputTarget.value
      })
    } catch (error) {
      this.simpleViewerTarget.data = { error, message: error.message }
      this.fullViewerTarget.data = { error, message: error.message }
      return
    }

    clearTimeout(this.timeout)

    if (response.ok) {
      try {
        json = await response.json()

        if (this.hasSimpleViewerTarget) {
          this.simpleViewerTarget.classList.add('language-tree')
          this.simpleViewerTarget.textContent = json.string

          Prism.highlightElement(this.simpleViewerTarget)
        }

        if (this.hasFullViewerTarget) {
          const isEmpty = !this.fullViewerTarget.data

          this.fullViewerTarget.data = { ast: json.ast }

          if (isEmpty) {
            this.fullViewerTarget.expand('ast')
          }
        }
      } catch (error) {
        this.simpleViewerTarget.data = { error: "Server didn't return JSON", response: error.message }
        this.fullViewerTarget.data = { error: "Server didn't return JSON", response: error.message }
      }
    } else {
      this.simpleViewerTarget.data = { error: "Server didn't respond with a 200 response" }
      this.fullViewerTarget.data = { error: "Server didn't respond with a 200 response" }
    }
  }

  get compressedValue () {
    return lz.compressToEncodedURIComponent(this.inputTarget.value)
  }

  get decompressedValue () {
    return lz.decompressFromEncodedURIComponent(window.location.hash.slice(1))
  }
}
