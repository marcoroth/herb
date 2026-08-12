import { resolve } from "node:path"

export function fileUrl(filePath: string): string {
  const absolutePath = resolve(filePath)
  return `file://${absolutePath}`
}
