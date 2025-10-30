import { join } from "path"
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs"

export interface VSCodeExtensionsJson {
  recommendations?: string[]
  unwantedRecommendations?: string[]
}

const HERB_EXTENSION_ID = "marcoroth.herb-lsp"
const VSCODE_DIR = ".vscode"
const EXTENSIONS_FILE = "extensions.json"

/**
 * Ensures the .vscode directory exists in the project
 */
function ensureVSCodeDirectory(projectPath: string): string {
  const vscodeDir = join(projectPath, VSCODE_DIR)

  if (!existsSync(vscodeDir)) {
    mkdirSync(vscodeDir, { recursive: true })
  }

  return vscodeDir
}

/**
 * Gets the path to the VSCode extensions.json file
 */
function getExtensionsJsonPath(projectPath: string): string {
  const vscodeDir = ensureVSCodeDirectory(projectPath)

  return join(vscodeDir, EXTENSIONS_FILE)
}

/**
 * Reads the current extensions.json file, or returns an empty structure
 */
function readExtensionsJson(filePath: string): VSCodeExtensionsJson {
  if (!existsSync(filePath)) {
    return { recommendations: [] }
  }

  try {
    const content = readFileSync(filePath, "utf-8")
    const parsed = JSON.parse(content)

    if (!Array.isArray(parsed.recommendations)) {
      parsed.recommendations = []
    }

    return parsed
  } catch (error) {
    console.warn(`Warning: Could not parse ${filePath}, creating new file`)

    return { recommendations: [] }
  }
}

/**
 * Writes the extensions.json file with proper formatting
 */
function writeExtensionsJson(filePath: string, data: VSCodeExtensionsJson): void {
  const content = JSON.stringify(data, null, 2) + "\n"

  writeFileSync(filePath, content, "utf-8")
}

/**
 * Adds the Herb VSCode extension to the recommended extensions list
 * Returns true if the extension was added, false if it was already present
 */
export function addHerbExtensionRecommendation(projectPath: string): boolean {
  const extensionsPath = getExtensionsJsonPath(projectPath)
  const extensions = readExtensionsJson(extensionsPath)

  if (extensions.recommendations?.includes(HERB_EXTENSION_ID)) {
    return false
  }

  if (!extensions.recommendations) {
    extensions.recommendations = []
  }

  extensions.recommendations.push(HERB_EXTENSION_ID)

  writeExtensionsJson(extensionsPath, extensions)

  return true
}

/**
 * Gets the relative path to the extensions.json file from the project root
 */
export function getExtensionsJsonRelativePath(): string {
  return join(VSCODE_DIR, EXTENSIONS_FILE)
}
