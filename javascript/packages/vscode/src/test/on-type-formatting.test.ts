import * as assert from "node:assert"
import * as os from "node:os"
import * as path from "node:path"

import * as vscode from "vscode"

const PREFIX = "<% if condition %"

suite("On-type formatting", () => {
  suiteSetup(async () => {
    const extension = vscode.extensions.getExtension("marcoroth.herb-lsp")

    assert.ok(extension, "Herb extension is installed in the test host")
    await extension.activate()
  })

  test("is enabled by default for Herb documents", async () => {
    const document = await openHerbDocument("format-on-type-default")

    try {
      assert.strictEqual(
        vscode.workspace
          .getConfiguration("editor", document)
          .get("formatOnType"),
        true,
      )
    } finally {
      await closeAndDelete(document)
    }
  })

  for (const testCase of [
    {
      name: "two spaces",
      insertSpaces: true,
      tabSize: 2,
      indentation: "  ",
    },
    {
      name: "four spaces",
      insertSpaces: true,
      tabSize: 4,
      indentation: "    ",
    },
    {
      name: "tabs",
      insertSpaces: false,
      tabSize: 4,
      indentation: "\t",
    },
  ]) {
    test(`inserts the block and places the cursor using ${testCase.name}`, async () => {
      const document = await openHerbDocument(`on-type-${testCase.name}`)
      const editor = vscode.window.activeTextEditor

      assert.ok(editor)
      const editorConfiguration = vscode.workspace.getConfiguration(
        "editor",
        document.uri,
      )
      const originalInsertSpaces =
        editorConfiguration.inspect<boolean>("insertSpaces")?.workspaceValue
      const originalTabSize =
        editorConfiguration.inspect<number>("tabSize")?.workspaceValue
      await editorConfiguration.update(
        "insertSpaces",
        testCase.insertSpaces,
        vscode.ConfigurationTarget.Workspace,
      )
      await editorConfiguration.update(
        "tabSize",
        testCase.tabSize,
        vscode.ConfigurationTarget.Workspace,
      )
      await waitFor(
        () =>
          editor.options.insertSpaces === testCase.insertSpaces &&
          editor.options.tabSize === testCase.tabSize,
        () => `editor options were ${JSON.stringify(editor.options)}`,
      )
      editor.selection = new vscode.Selection(
        0,
        PREFIX.length,
        0,
        PREFIX.length,
      )

      try {
        await vscode.commands.executeCommand("type", { text: ">" })

        const expected = `${PREFIX}>\n${testCase.indentation}\n<% end %>`
        await waitFor(
          () => document.getText() === expected,
          () => `document text was ${JSON.stringify(document.getText())}`,
        )
        await waitFor(
          () =>
            editor.selection.active.line === 1 &&
            editor.selection.active.character === testCase.indentation.length,
        )

        assert.strictEqual(document.getText(), expected)
        assert.strictEqual(editor.selection.active.line, 1)
        assert.strictEqual(
          editor.selection.active.character,
          testCase.indentation.length,
        )
      } finally {
        await editorConfiguration.update(
          "insertSpaces",
          originalInsertSpaces,
          vscode.ConfigurationTarget.Workspace,
        )
        await editorConfiguration.update(
          "tabSize",
          originalTabSize,
          vscode.ConfigurationTarget.Workspace,
        )
        await closeAndDelete(document)
      }
    })
  }
})

async function openHerbDocument(name: string): Promise<vscode.TextDocument> {
  const uri = vscode.Uri.file(
    path.join(os.tmpdir(), `herb-${name.replaceAll(" ", "-")}.html.erb`),
  )
  await vscode.workspace.fs.writeFile(uri, Buffer.from(PREFIX))

  let document = await vscode.workspace.openTextDocument(uri)
  if (document.languageId !== "erb") {
    document = await vscode.languages.setTextDocumentLanguage(document, "erb")
  }

  await vscode.window.showTextDocument(document)

  return document
}

async function closeAndDelete(document: vscode.TextDocument): Promise<void> {
  await vscode.commands.executeCommand(
    "workbench.action.revertAndCloseActiveEditor",
  )
  await vscode.workspace.fs.delete(document.uri)
}

async function waitFor(
  predicate: () => boolean,
  describeFailure: () => string = () => "condition was not met",
): Promise<void> {
  const deadline = Date.now() + 10_000

  while (!predicate()) {
    if (Date.now() >= deadline) {
      assert.fail(
        `Timed out waiting for on-type formatting: ${describeFailure()}`,
      )
    }

    await new Promise((resolve) => setTimeout(resolve, 25))
  }
}
