import * as vscode from "vscode"
import * as path from "path"
import * as os from "os"

import { Config } from "@herb-tools/config"

const SETTING = "languageServerHerb.workspace.suggestAddingProjects"
const FILE_SCHEME = "file"
const LANGUAGES = new Set(["erb", "html"])
const ADD_FOLDER = "Add Folder to Workspace"
const OPEN_WINDOW = "Open in New Window"
const DONT_ASK = "Don't Ask Again"

export interface SuggestionDocument {
  fsPath: string
  scheme: string
  languageId: string
}

/**
 * The language server only reports on files inside a workspace folder, so a
 * file opened from somewhere else is silently unlinted. This answers which
 * project folder would have to be added to fix that, or null when there is
 * nothing to offer.
 */
export function outsideWorkspaceRoot(
  document: SuggestionDocument,
  folderPaths: readonly string[],
  findRoot: (startPath: string) => string
): string | null {
  if (document.scheme !== FILE_SCHEME) return null
  if (!LANGUAGES.has(document.languageId)) return null

  const folders = folderPaths.map(folder => folder.replace(/[\\/]+$/, ""))

  if (folders.length === 0) return null
  if (folders.some(folder => contains(folder, document.fsPath))) return null

  const directory = path.dirname(document.fsPath)
  const root = rootOf(directory, findRoot)

  // `findProjectRootSync` falls back to the process working directory when it
  // finds no marker, which in an extension host points at neither the file nor
  // anything the author would recognise.
  return contains(root, document.fsPath) ? root : directory
}

export function registerWorkspaceSuggestion(context: vscode.ExtensionContext) {
  const promptedRoots = new Set<string>()

  const maybePrompt = (document: vscode.TextDocument) => {
    if (!vscode.workspace.getConfiguration().get<boolean>(SETTING, true)) return

    const folders = (vscode.workspace.workspaceFolders ?? []).map(folder => folder.uri.fsPath)

    const root = outsideWorkspaceRoot(
      { fsPath: document.uri.fsPath, scheme: document.uri.scheme, languageId: document.languageId },
      folders,
      // Bound rather than passed bare: it reads `this.configPath` and
      // `this.PROJECT_INDICATORS`, so an unbound reference throws.
      startPath => Config.findProjectRootSync(startPath)
    )

    if (root === null || promptedRoots.has(root)) return

    // Claimed before awaiting, so a burst of restored tabs from one project
    // asks once rather than once per tab.
    promptedRoots.add(root)

    prompt(document, root)
  }

  context.subscriptions.push(vscode.workspace.onDidOpenTextDocument(maybePrompt))

  vscode.workspace.textDocuments.forEach(maybePrompt)
}

async function prompt(document: vscode.TextDocument, root: string) {
  const action = await vscode.window.showInformationMessage(
    `${path.basename(document.uri.fsPath)} is outside your workspace, so Herb isn't analyzing it. Add ${display(root)} to the workspace?`,
    ADD_FOLDER,
    OPEN_WINDOW,
    DONT_ASK
  )

  if (action === ADD_FOLDER) {
    const folders = vscode.workspace.workspaceFolders ?? []

    // Adding a folder to a single-folder window turns it into an untitled
    // multi-root workspace, which reloads the window and restarts this
    // extension, so nothing may run after a successful call.
    const added = vscode.workspace.updateWorkspaceFolders(folders.length, 0, { uri: vscode.Uri.file(root) })

    if (!added) {
      vscode.window.showErrorMessage(`Herb: could not add ${display(root)} to the workspace.`)
    }

    return
  }

  if (action === OPEN_WINDOW) {
    await vscode.commands.executeCommand("vscode.openFolder", vscode.Uri.file(root), { forceNewWindow: true })

    return
  }

  if (action === DONT_ASK) {
    await vscode.workspace.getConfiguration().update(SETTING, false, vscode.ConfigurationTarget.Global)
  }
}

function rootOf(directory: string, findRoot: (startPath: string) => string): string {
  try {
    return findRoot(directory)
  } catch {
    return directory
  }
}

function contains(directory: string, filePath: string): boolean {
  return filePath === directory || filePath.startsWith(`${directory}${path.sep}`)
}

function display(directory: string): string {
  const home = os.homedir()

  return contains(home, directory) ? `~${directory.slice(home.length)}` : directory
}
