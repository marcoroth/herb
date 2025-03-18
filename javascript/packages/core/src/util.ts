export function ensureString(object: any): string {
  if (typeof object === "string") {
    return object
  }

  throw new TypeError("Argument must be a string")
}

export function convertToUTF8(string: string) {
  const bytes = []

  for (let i = 0; i < string.length; i++) {
    bytes.push(string.charCodeAt(i))
  }

  const decoder = new TextDecoder("utf-8")

  return decoder.decode(new Uint8Array(bytes))
}
