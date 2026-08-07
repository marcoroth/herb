export const PARTIAL_EXTENSIONS = [
  ".html.erb",
  ".html.herb",
  ".erb",
  ".herb",
  ".turbo_stream.erb",
  ".turbo_stream.herb",
] as const

export const PARTIAL_GLOB_PATTERN = "_*.{html.erb,html.herb,erb,herb,turbo_stream.erb,turbo_stream.herb}"

const PARTIAL_PREFIX = "_"
const APPLICATION_DIRECTORY = "application"

export type PartialPaths = Map<string, string>

function normalize(path: string): string {
  return path.replace(/\\/g, "/").replace(/\/+$/, "")
}

function basename(path: string): string {
  const index = path.lastIndexOf("/")

  return index === -1 ? path : path.slice(index + 1)
}

function dirname(path: string): string {
  const index = path.lastIndexOf("/")

  return index === -1 ? "." : path.slice(0, index) || "/"
}

function relativeToViewRoot(path: string, viewRoot: string): string | null {
  const normalizedPath = normalize(path)
  const normalizedRoot = normalize(viewRoot)

  if (normalizedRoot === "" || normalizedRoot === ".") return normalizedPath
  if (normalizedPath === normalizedRoot) return "."
  if (!normalizedPath.startsWith(`${normalizedRoot}/`)) return null

  return normalizedPath.slice(normalizedRoot.length + 1)
}

export function isPartialPath(filePath: string): boolean {
  const name = basename(normalize(filePath))

  if (!name.startsWith(PARTIAL_PREFIX)) return false

  return PARTIAL_EXTENSIONS.some(extension => name.endsWith(extension))
}

export function partialNameForFile(filePath: string, viewRoot: string): string | null {
  const relative = relativeToViewRoot(filePath, viewRoot)

  if (relative === null || relative === ".") return null

  const directory = dirname(relative)
  const name = basename(relative)

  if (!name.startsWith(PARTIAL_PREFIX)) return null

  const withoutExtension = name.slice(PARTIAL_PREFIX.length).replace(/\..*$/, "")

  if (withoutExtension === "") return null

  return directory === "." ? withoutExtension : `${directory}/${withoutExtension}`
}

export function resolvePartial(partialName: string, sourceFile: string, index: PartialPaths, viewRoot: string): string | null {
  const exact = index.get(partialName)

  if (exact !== undefined) return exact

  const sourceDirectory = relativeToViewRoot(dirname(normalize(sourceFile)), viewRoot)

  if (sourceDirectory !== null && sourceDirectory !== ".") {
    const relative = index.get(`${sourceDirectory}/${partialName}`)

    if (relative !== undefined) return relative
  }

  if (!partialName.includes("/")) {
    const application = index.get(`${APPLICATION_DIRECTORY}/${partialName}`)

    if (application !== undefined) return application
  }

  return null
}
