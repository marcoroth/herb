import { resolve } from "node:path"

const DOCS_BASE_URL = "https://herb-tools.dev/linter/rules"

export function ruleDocumentationUrl(ruleId: string): string {
  return `${DOCS_BASE_URL}/${ruleId}`
}

export function fileUrl(filePath: string): string {
  const absolutePath = resolve(filePath)
  return `file://${absolutePath}`
}
