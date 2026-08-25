export function pathFromUri(uri: string): string {
  return decodeURIComponent(uri.replace(/^file:\/\//, ""))
}

export function uriFromPath(filePath: string): string {
  return `file://${filePath.split("/").map(segment => encodeURIComponent(segment)).join("/")}`
}
