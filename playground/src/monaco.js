import {
  editor as MonacoEditor,
  Selection,
  Range,
  MarkerSeverity,
  KeyMod,
  KeyCode,
  languages,
} from "monaco-editor/esm/vs/editor/edcore.main.js"

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

  const editor = MonacoEditor.create(container, {
    ...defaultOptions,
    ...options,
  })

  // if (!languages.getLanguages().some((lang) => lang.id === "erb")) {
  languages.register({ id: "erb" })

  languages.setMonarchTokensProvider("erb", {
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
        [/[{}()[\]]/, "@brackets"],
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
  // }

  MonacoEditor.setModelLanguage(editor.getModel(), "erb")

  editor.onDidChangeModelContent(() => {
    textarea.value = editor.getValue()

    const event = new Event("input", { bubbles: true })
    textarea.dispatchEvent(event)

    const changeEvent = new Event("change", { bubbles: true })
    textarea.dispatchEvent(changeEvent)
  })

  editor.addCommand(KeyMod.CtrlCmd | KeyCode.KeyS, function () {
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
    MonacoEditor.setModelMarkers(editor.getModel(), "herb", [])
  }

  editor.clearAllHighlights = function () {
    clearAllHighlights(editor)
  }

  editor._decorationIds = []

  editor.highlightSection = function (
    startLine,
    startColumn,
    endLine,
    endColumn,
    highlightClass,
  ) {
    return highlightEditorSection(
      editor,
      startLine,
      startColumn,
      endLine,
      endColumn,
      highlightClass,
    )
  }

  editor.highlightAndRevealSection = function (
    startLine,
    startColumn,
    endLine,
    endColumn,
    highlightClass,
  ) {
    return highlightAndRevealSection(
      editor,
      startLine,
      startColumn,
      endLine,
      endColumn,
      { highlightClass },
    )
  }

  editor.removeHighlights = function (decorationIds) {
    removeHighlights(editor, decorationIds)
  }

  editor.highlightAndReveal = function (
    startLine,
    startColumn,
    endLine,
    endColumn,
    options,
  ) {
    return highlightAndRevealSection(
      editor,
      startLine,
      startColumn,
      endLine,
      endColumn,
      options,
    )
  }

  editor.flashHighlight = function (
    startLine,
    startColumn,
    endLine,
    endColumn,
    highlightClass,
    duration,
  ) {
    return createTemporaryHighlight(
      editor,
      startLine,
      startColumn,
      endLine,
      endColumn,
      highlightClass,
      duration,
    )
  }

  editor._clickHandlers = []

  editor.onEditorClick = function (callback) {
    const handler = registerEditorClickHandler(editor, callback)
    if (handler) {
      editor._clickHandlers.push(handler)
    }
    return handler
  }

  editor.removeAllClickHandlers = function () {
    if (editor._clickHandlers && editor._clickHandlers.length > 0) {
      editor._clickHandlers.forEach((handler) => {
        if (handler && typeof handler.dispose === "function") {
          handler.dispose()
        }
      })
      editor._clickHandlers = []
    }
  }

  editor.setCursorPosition = function (line, column) {
    const position = { lineNumber: line, column: column + 1 }
    editor.setPosition(position)
    editor.revealPositionInCenter(position)
  }

  editor.dispose = function () {
    if (editor._resizeObserver) {
      editor._resizeObserver.disconnect()
    }
    editor.removeAllClickHandlers()
    MonacoEditor.getModels().forEach((model) => model.dispose())
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

  MonacoEditor.setModelMarkers(model, "herb", [])

  if (!diagnostics || diagnostics.length === 0) {
    return
  }

  const markers = dedupeWithStringify(diagnostics).map((diagnostic) => {
    let severity = MarkerSeverity.Error

    if (diagnostic.severity) {
      switch (diagnostic.severity.toLowerCase()) {
        case "info":
          severity = MarkerSeverity.Info
          break
        case "warning":
          severity = MarkerSeverity.Warning
          break
        case "hint":
          severity = MarkerSeverity.Hint
          break
      }
    }

    return {
      severity,
      message: diagnostic.message || "Unknown error",
      startLineNumber: diagnostic.line || 1,
      startColumn: diagnostic.column + 1 || 1,
      endLineNumber: diagnostic.endLine || diagnostic.line || 1,
      endColumn: diagnostic.endColumn + 1 || diagnostic.column || 1000,
      source: diagnostic.source || "herb",
      code: diagnostic.code || "",
    }
  })

  MonacoEditor.setModelMarkers(model, "herb", markers)
}

/**
 * Highlights a section of code in the Monaco editor
 *
 * @param {Object} editor - The Monaco editor instance
 * @param {number} startLine - Start line (1-based index)
 * @param {number} startColumn - Start column (1-based index)
 * @param {number} endLine - End line (1-based index)
 * @param {number} endColumn - End column (1-based index)
 * @param {string} highlightClass - Optional decoration class
 * @returns {string[]} - Decoration IDs that can be used to remove the highlight later
 */
function highlightEditorSection(
  editor,
  startLine,
  startColumn,
  endLine,
  endColumn,
  highlightClass = "error-highlight",
) {
  if (!editor) {
    console.error("Editor instance is required")
    return []
  }

  const decorationOptions = {
    className: highlightClass,
    hoverMessage: { value: "Selected section" },
    isWholeLine: false,
    stickiness: MonacoEditor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
  }

  const range = new Range(startLine, startColumn, endLine, endColumn)

  const decorationIds = editor.deltaDecorations(
    [],
    [{ range, options: decorationOptions }],
  )

  trackDecorationIds(editor, decorationIds)

  return decorationIds
}

/**
 * Removes highlights from the editor
 *
 * @param {Object} editor - The Monaco editor instance
 * @param {string[]} decorationIds - Decoration IDs returned from highlightEditorSection
 */
function removeHighlights(editor, decorationIds) {
  if (!editor || !decorationIds || !decorationIds.length) {
    return
  }

  editor.deltaDecorations(decorationIds, [])
}

/**
 * Removes all highlights from the Monaco editor
 *
 * @param {Object} editor - The Monaco editor instance
 */
function clearAllHighlights(editor) {
  if (!editor) return

  if (editor._decorationIds && editor._decorationIds.length > 0) {
    editor.deltaDecorations(editor._decorationIds, [])
    editor._decorationIds = []
  } else {
    editor.deltaDecorations([], [])
  }
}

/**
 * Highlights a section of code and scrolls to it
 *
 * @param {Object} editor - The Monaco editor instance
 * @param {number} startLine - Start line (1-based index)
 * @param {number} startColumn - Start column (1-based index)
 * @param {number} endLine - End line (1-based index)
 * @param {number} endColumn - End column (1-based index)
 * @param {Object} options - Additional options (highlightClass, scrollBehavior)
 * @returns {Object} - Containing decorationIds and selection
 */
function highlightAndRevealSection(
  editor,
  startLine,
  startColumn,
  endLine,
  endColumn,
  options = {},
) {
  if (!editor) return { decorationIds: [], selection: null }

  const defaultOptions = {
    highlightClass: "error-highlight",
    scrollBehavior: MonacoEditor.ScrollType.Smooth,
  }

  const mergedOptions = { ...defaultOptions, ...options }

  const decorationIds = highlightEditorSection(
    editor,
    startLine,
    startColumn,
    endLine,
    endColumn,
    mergedOptions.highlightClass,
  )

  const selection = new Selection(startLine, startColumn, endLine, endColumn)

  editor.setSelection(selection)
  editor.revealRangeInCenter(selection, mergedOptions.scrollBehavior)

  return { decorationIds, selection }
}

/**
 * Creates a temporary highlight that fades out after a set time
 *
 * @param {Object} editor - The Monaco editor instance
 * @param {number} startLine - Start line
 * @param {number} startColumn - Start column
 * @param {number} endLine - End line
 * @param {number} endColumn - End column
 * @param {string} highlightClass - CSS class for the highlight
 * @param {number} duration - Duration in milliseconds before fading out
 * @returns {Object} - Containing decorationIds and the timeout ID
 */
function createTemporaryHighlight(
  editor,
  startLine,
  startColumn,
  endLine,
  endColumn,
  highlightClass = "flash-highlight",
  duration = 1500,
) {
  if (!editor) return { decorationIds: [], timeoutId: null }

  const decorationIds = highlightEditorSection(
    editor,
    startLine,
    startColumn,
    endLine,
    endColumn,
    highlightClass,
  )

  const timeoutId = setTimeout(() => {
    removeHighlights(editor, decorationIds)
  }, duration)

  return { decorationIds, timeoutId }
}

function trackDecorationIds(editor, decorationIds) {
  if (!editor._decorationIds) {
    editor._decorationIds = []
  }

  if (decorationIds && decorationIds.length) {
    editor._decorationIds = [...editor._decorationIds, ...decorationIds]
  }
}

/**
 * Registers a click handler on the Monaco editor
 *
 * @param {Object} editor - The Monaco editor instance
 * @param {Function} callback - Callback function that receives the position
 * @returns {IDisposable} - A disposable object to remove the event listener
 */
function registerEditorClickHandler(editor, callback) {
  if (!editor) {
    console.error("Editor instance is required")
    return null
  }

  const editorDomNode = editor.getDomNode()
  if (!editorDomNode) {
    console.error("Editor DOM node not found")
    return null
  }

  const disposition = editor.onMouseDown((e) => {
    if (e.event.leftButton) {
      const position = e.target.position

      if (position) {
        callback({
          lineNumber: position.lineNumber,
          column: position.column,
          mouseEvent: e.event,
          target: e.target.type,
          wordAtPosition: position
            ? editor.getModel().getWordAtPosition(position)
            : null,
        })
      }
    }
  })

  return disposition
}
