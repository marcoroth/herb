export const PARTIAL_EXTENSIONS = [
  ".html.erb",
  ".html.herb",
  ".erb",
  ".herb",
  ".turbo_stream.erb",
  ".turbo_stream.herb",
] as const

const EXTENSION_ALTERNATIVES = PARTIAL_EXTENSIONS.map(extension => extension.slice(1)).join(",")

export const TEMPLATE_GLOB_PATTERN = `*.{${EXTENSION_ALTERNATIVES}}`
export const PARTIAL_GLOB_PATTERN = `_${TEMPLATE_GLOB_PATTERN}`

const PARTIAL_PREFIX = "_"
const APPLICATION_DIRECTORY = "application"

export type PartialPaths = Map<string, string | string[]>

function normalize(path: string): string {
  const separated = path.replace(/\\/g, "/")

  let end = separated.length

  while (end > 0 && separated[end - 1] === "/") end--

  return separated.slice(0, end)
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

export function relativeToViewRoots(path: string, viewRoots: string[]): [number, string] | null {
  for (const [index, root] of viewRoots.entries()) {
    const relative = relativeToViewRoot(path, root)

    if (relative !== null) return [index, relative]
  }

  return null
}

export function partialNameForRoots(filePath: string, viewRoots: string[]): string | null {
  for (const root of viewRoots) {
    const name = partialNameForFile(filePath, root)

    if (name !== null) return name
  }

  return null
}

export function templateNameForRoots(filePath: string, viewRoots: string[]): string | null {
  for (const root of viewRoots) {
    const name = templateNameForFile(filePath, root)

    if (name !== null) return name
  }

  return null
}

export function rootIndexFor(filePath: string, viewRoots: string[]): number {
  return relativeToViewRoots(filePath, viewRoots)?.[0] ?? viewRoots.length
}

export function projectRelativePath(filePath: string, projectPath: string | undefined): string {
  if (!projectPath) return normalize(filePath)

  return relativeToViewRoot(filePath, projectPath) ?? normalize(filePath)
}

export function formatOf(filePath: string): string | null {
  const name = basename(normalize(filePath))
  const dot = name.indexOf(".")

  if (dot === -1) return null

  const extension = name.slice(dot)
  const stripped = extension.endsWith(".erb")
    ? extension.slice(0, -".erb".length)
    : extension.endsWith(".herb")
      ? extension.slice(0, -".herb".length)
      : null

  if (stripped === null) return null

  const withVariant = stripped.startsWith(".") ? stripped.slice(1) : stripped
  const format = withVariant.split("+")[0] ?? withVariant

  return format === "" ? null : format
}

export function variantOf(filePath: string): string | null {
  const name = basename(normalize(filePath))
  const dot = name.indexOf(".")

  if (dot === -1) return null

  const extension = name.slice(dot)
  const stripped = extension.endsWith(".erb")
    ? extension.slice(0, -".erb".length)
    : extension.endsWith(".herb")
      ? extension.slice(0, -".herb".length)
      : null

  if (stripped === null) return null

  const plus = stripped.indexOf("+")

  if (plus === -1) return null

  const variant = stripped.slice(plus + 1)

  return variant === "" ? null : variant
}

export function withoutTemplateExtension(partialName: string): string {
  for (const extension of PARTIAL_EXTENSIONS) {
    if (partialName.endsWith(extension)) return partialName.slice(0, -extension.length)
  }

  return partialName
}

export function isTemplatePath(filePath: string): boolean {
  const name = basename(normalize(filePath))

  return PARTIAL_EXTENSIONS.some(extension => name.endsWith(extension))
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

  const withoutPrefix = name.slice(PARTIAL_PREFIX.length)
  const extension = withoutPrefix.indexOf(".")
  const withoutExtension = extension === -1 ? withoutPrefix : withoutPrefix.slice(0, extension)

  if (withoutExtension === "") return null

  return directory === "." ? withoutExtension : `${directory}/${withoutExtension}`
}

export const LAYOUTS_DIRECTORY = "layouts"
export const APPLICATION_LAYOUT = "application"
export const MAILER_LAYOUT = "mailer"
const MAILER_SUFFIX = "_mailer"

export function templateNameForFile(filePath: string, viewRoot: string): string | null {
  const relative = relativeToViewRoot(normalize(filePath), viewRoot)
  if (relative === null || relative === ".") return null

  const directory = dirname(relative)

  const name = basename(relative)
  if (name.startsWith(PARTIAL_PREFIX)) return null

  const extension = name.indexOf(".")

  const withoutExtension = extension === -1 ? name : name.slice(0, extension)
  if (withoutExtension === "") return null

  return directory === "." ? withoutExtension : `${directory}/${withoutExtension}`
}

export function layoutCandidatesForRoots(templateFile: string, viewRoots: string[]): string[] {
  for (const root of viewRoots) {
    const candidates = layoutCandidatesFor(templateFile, root)

    if (candidates.length > 0) return candidates
  }

  return []
}

export function layoutCandidatesFor(templateFile: string, viewRoot: string): string[] {
  const relative = relativeToViewRoot(normalize(templateFile), viewRoot)

  if (relative === null || relative === ".") return []
  if (basename(relative).startsWith(PARTIAL_PREFIX)) return []

  const directory = dirname(relative)

  if (directory === LAYOUTS_DIRECTORY || directory.startsWith(`${LAYOUTS_DIRECTORY}/`)) return []
  if (directory === "." || directory === "/") return [`${LAYOUTS_DIRECTORY}/${APPLICATION_LAYOUT}`]

  const segments = directory.split("/")
  const isMailer = segments[segments.length - 1].endsWith(MAILER_SUFFIX)
  const candidates: string[] = []

  while (segments.length > 0) {
    candidates.push(`${LAYOUTS_DIRECTORY}/${segments.join("/")}`)
    segments.pop()
  }

  candidates.push(`${LAYOUTS_DIRECTORY}/${isMailer ? MAILER_LAYOUT : APPLICATION_LAYOUT}`)

  return candidates
}

function pickForCaller(candidates: string | string[], sourceFile: string): string | null {
  if (!Array.isArray(candidates)) return candidates
  if (candidates.length === 0) return null

  const format = formatOf(sourceFile)

  if (format === null) return candidates[0] ?? null

  const ranked = [...candidates].sort((a, b) => rankForFormat(a, format) - rankForFormat(b, format))

  return ranked[0] ?? null
}

function rankForFormat(file: string, format: string): number {
  const candidate = formatOf(file)
  const matches = candidate === format ? 0 : candidate === null ? 1 : 2

  return matches * 2 + (variantOf(file) === null ? 0 : 1)
}

export function resolvePartial(
  partialName: string,
  sourceFile: string,
  index: PartialPaths,
  viewRoots: string[]
): string | null {
  partialName = withoutTemplateExtension(partialName)

  const exact = index.get(partialName)

  if (exact !== undefined) return pickForCaller(exact, sourceFile)

  const sourceDirectory = relativeToViewRoots(dirname(normalize(sourceFile)), viewRoots)?.[1] ?? null

  if (sourceDirectory !== null && sourceDirectory !== ".") {
    const relative = index.get(`${sourceDirectory}/${partialName}`)

    if (relative !== undefined) return pickForCaller(relative, sourceFile)
  }

  if (!partialName.includes("/")) {
    const application = index.get(`${APPLICATION_DIRECTORY}/${partialName}`)

    if (application !== undefined) return pickForCaller(application, sourceFile)
  }

  return null
}
