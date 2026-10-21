import EditorWorker from "monaco-editor/editor/editor.worker?worker"

self.MonacoEnvironment = {
  getWorker() {
    return new EditorWorker()
  },
}
