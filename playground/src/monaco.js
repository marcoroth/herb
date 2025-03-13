import * as monaco from "monaco-editor"

/**
 * Replaces a textarea with a Monaco editor instance
 *
 * @param {string} textareaId - The ID of the textarea to replace, or data-target attribute
 * @param {HTMLElement} textareaElement - Optional direct reference to the textarea element
 * @param {Object} options - Monaco editor options
 * @returns {Object} - The Monaco editor instance
 */
export function replaceTextareaWithMonaco(
  textareaId,
  textareaElement = null,
  options = {},
) {
  const textarea =
    textareaElement ||
    document.getElementById(textareaId) ||
    document.querySelector(`[data-${textareaId}-target]`)

  if (!textarea) {
    console.error(`Textarea not found: ${textareaId}`)
    return null
  }

  const container = document.createElement("div")
  container.id = `monaco-${textareaId}-container`

  Object.assign(container.style, {
    width: "100%",
    height: "400px",
    border: "1px solid #ccc",
    borderRadius: "4px",
    overflow: "hidden",
    boxSizing: "border-box",
    margin: textarea.style.margin,
    marginBottom: "1rem",
    boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
  })

  if (textarea.className) {
    container.className = textarea.className
  }

  textarea.parentNode.insertBefore(container, textarea)

  textarea.style.display = "none"

  const defaultOptions = {
    value: textarea.value || "",
    language: "html",
    theme: "vs-dark",
    automaticLayout: true,
    minimap: { enabled: true },
    lineNumbers: "on",
    scrollBeyondLastLine: false,
    wordWrap: "on",
    tabSize: 2,
    renderWhitespace: "selection",
    fontFamily: 'Menlo, Monaco, "Courier New", monospace',
    fontSize: 14,
    suggestFontSize: 14,
    lineHeight: 21,
  }

  const editor = monaco.editor.create(container, {
    ...defaultOptions,
    ...options,
  })

  if (!monaco.languages.getLanguages().some((lang) => lang.id === "erb")) {
    monaco.languages.register({ id: "erb" })

    monaco.languages.setMonarchTokensProvider("erb", {
      tokenizer: {
        root: [
          [/<%=?/, { token: "delimiter.erb", next: "@rubyInject" }],
          [/<%#/, { token: "comment.erb", next: "@rubyComment" }],
          { include: "html" },
        ],
        rubyInject: [
          [/%>/, { token: "delimiter.erb", next: "@root" }],
          { include: "@ruby" },
        ],
        rubyComment: [
          [/%>/, { token: "comment.erb", next: "@root" }],
          [/./, "comment.erb"],
        ],
        ruby: [
          [/[a-zA-Z_][\w]*/, "identifier"],
          [/"/, { token: "string.double", next: "@string_double" }],
          [/'/, { token: "string.single", next: "@string_single" }],
          [/\d+/, "number"],
          [/[{}()\[\]]/, "@brackets"],
          [/@|@@|$/, "variable"],
        ],
        string_double: [
          [/[^"]+/, "string.double"],
          [/"/, { token: "string.double", next: "@pop" }],
        ],
        string_single: [
          [/[^']+/, "string.single"],
          [/'/, { token: "string.single", next: "@pop" }],
        ],
        html: [
          [/<\/?[\w\-.:]+/, "tag"],
          [/\s+[\w\-.:]+/, "attribute.name"],
          [/"[^"]*"/, "attribute.value"],
          [/'[^']*'/, "attribute.value"],
          [/<!--/, { token: "comment", next: "@comment" }],
        ],
        comment: [
          [/-->/, { token: "comment", next: "@pop" }],
          [/./, "comment"],
        ],
      },
    })
  }

  monaco.editor.setModelLanguage(editor.getModel(), "erb")

  editor.onDidChangeModelContent(() => {
    textarea.value = editor.getValue()

    const event = new Event("input", { bubbles: true })
    textarea.dispatchEvent(event)

    const changeEvent = new Event("change", { bubbles: true })
    textarea.dispatchEvent(changeEvent)
  })

  editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, function () {
    const saveEvent = new CustomEvent("monaco:save", {
      detail: { content: editor.getValue() },
    })
    document.dispatchEvent(saveEvent)
  })

  const resizeObserver = new ResizeObserver(() => {
    editor.layout()
  })
  resizeObserver.observe(container)

  editor._resizeObserver = resizeObserver

  textarea.monacoEditor = editor

  editor.addDiagnostics = function (diagnostics) {
    addDiagnosticsToEditor(editor, diagnostics)
  }

  editor.addDiagnosticFromString = function (str, options) {
    addDiagnosticFromString(editor, str, options)
  }

  editor.clearDiagnostics = function () {
    monaco.editor.setModelMarkers(editor.getModel(), "herb", [])
  }

  editor.dispose = function () {
    if (editor._resizeObserver) {
      editor._resizeObserver.disconnect()
    }
    monaco.editor.getModels().forEach((model) => model.dispose())
    return editor
  }

  return editor
}

export function dedupeWithStringify(arr) {
  const seen = new Set()
  return arr.filter((obj) => {
    const serialized = JSON.stringify(obj)
    if (seen.has(serialized)) {
      return false
    }
    seen.add(serialized)
    return true
  })
}

/**
 * Adds diagnostics (errors/warnings) to the Monaco editor
 *
 * @param {Object} editor - The Monaco editor instance
 * @param {Array} diagnostics - Array of diagnostic objects
 */
export function addDiagnosticsToEditor(editor, diagnostics = []) {
  if (!editor) {
    console.error("Editor instance is required")
    return
  }

  const model = editor.getModel()
  if (!model) {
    console.error("Editor model not found")
    return
  }

  monaco.editor.setModelMarkers(model, "herb", [])

  if (!diagnostics || diagnostics.length === 0) {
    return
  }

  const markers = dedupeWithStringify(diagnostics).map((diagnostic) => {
    let severity = monaco.MarkerSeverity.Error

    if (diagnostic.severity) {
      switch (diagnostic.severity.toLowerCase()) {
        case "info":
          severity = monaco.MarkerSeverity.Info
          break
        case "warning":
          severity = monaco.MarkerSeverity.Warning
          break
        case "hint":
          severity = monaco.MarkerSeverity.Hint
          break
      }
    }

    return {
      severity,
      message: diagnostic.message || "Unknown error",
      startLineNumber: diagnostic.line || 1,
      startColumn: diagnostic.column || 1,
      endLineNumber: diagnostic.endLine || diagnostic.line || 1,
      endColumn: diagnostic.endColumn || diagnostic.column || 1000,
      source: diagnostic.source || "herb",
      code: diagnostic.code || "",
    }
  })

  monaco.editor.setModelMarkers(model, "herb", markers)
}
