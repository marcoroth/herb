/// <reference types="vite/client" />

declare module "monaco-editor/esm/vs/editor/edcore.main.js" {
  export * from "monaco-editor/esm/vs/editor/editor.api"
}

declare module "*?worker" {
  const WorkerConstructor: { new (): Worker }

  export default WorkerConstructor
}

declare const __COMMIT_INFO__: {
  hash: string
  tag: string
  ahead: number
  prNumber: string | null
}

declare module "prismjs" {
  const Prism: {
    languages: Record<string, any>
    highlight(code: string, grammar: any, language: string): string
    highlightElement(element: Element): void
  }

  export default Prism
}

declare module "*/playground_controller" {
  const PlaygroundController: any

  export default PlaygroundController
}

declare module "*/iframe_controller" {
  const IframeController: any

  export default IframeController
}
