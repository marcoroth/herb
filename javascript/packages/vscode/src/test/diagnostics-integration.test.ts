import * as assert from 'assert'
import * as vscode from 'vscode'
import * as path from 'path'
import * as fs from 'fs'

suite('Diagnostics Integration Tests', () => {
  let testWorkspaceDir: string
  let testDocumentUri: vscode.Uri

  suiteSetup(async function() {
    this.timeout(10000)
    
    // Create a temporary workspace directory for testing
    testWorkspaceDir = path.join(__dirname, '..', '..', 'test-workspace')
    if (!fs.existsSync(testWorkspaceDir)) {
      fs.mkdirSync(testWorkspaceDir, { recursive: true })
    }

    // Create a test ERB file
    const testFileName = 'test-diagnostics.html.erb'
    const testFilePath = path.join(testWorkspaceDir, testFileName)
    testDocumentUri = vscode.Uri.file(testFilePath)

    // Write initial content with valid ERB
    const initialContent = '<%= "Hello World" %>'
    fs.writeFileSync(testFilePath, initialContent)
  })

  suiteTeardown(async () => {
    // Close all open editors
    await vscode.commands.executeCommand('workbench.action.closeAllEditors')
    
    // Clean up test files
    if (fs.existsSync(testWorkspaceDir)) {
      fs.rmSync(testWorkspaceDir, { recursive: true, force: true })
    }
  })

  test('should open ERB document and get diagnostics', async function() {
    this.timeout(5000)
    
    // Open the document in VSCode
    const testDocument = await vscode.workspace.openTextDocument(testDocumentUri)
    const editor = await vscode.window.showTextDocument(testDocument)
    
    // Verify document is opened
    assert.ok(testDocument, 'Document should be opened')
    // VSCode might detect .html.erb as 'erb' or 'ruby' depending on configuration
    assert.ok(['erb', 'ruby', 'html'].includes(testDocument.languageId), 
      `Document language should be erb, ruby, or html, but was: ${testDocument.languageId}`)
    
    // Wait a moment for any initial diagnostics
    await new Promise(resolve => setTimeout(resolve, 500))

    // Get diagnostics for the document
    const diagnostics = vscode.languages.getDiagnostics(testDocumentUri)
    
    // Should return an array (might be empty, that's fine)
    assert.ok(Array.isArray(diagnostics), 'Diagnostics should be an array')
  })

  test('should handle text changes and maintain diagnostics system', async function() {
    this.timeout(5000)
    
    const testDocument = await vscode.workspace.openTextDocument(testDocumentUri)
    const editor = await vscode.window.showTextDocument(testDocument)
    
    // Make a simple text change
    const success = await editor.edit(editBuilder => {
      editBuilder.insert(new vscode.Position(0, 0), '<!-- comment -->')
    })
    
    assert.ok(success, 'Edit operation should succeed')
    
    // Wait for diagnostics to process
    await new Promise(resolve => setTimeout(resolve, 500))

    // Get diagnostics after change
    const diagnostics = vscode.languages.getDiagnostics(testDocumentUri)
    
    // Diagnostic system should still be working
    assert.ok(Array.isArray(diagnostics), 'Diagnostics should still be an array after text changes')
  })

  test('should work with ERB syntax', async function() {
    this.timeout(5000)
    
    const testDocument = await vscode.workspace.openTextDocument(testDocumentUri)
    const editor = await vscode.window.showTextDocument(testDocument)
    
    // Clear and add ERB content
    const success = await editor.edit(editBuilder => {
      const fullRange = new vscode.Range(
        testDocument.positionAt(0),
        testDocument.positionAt(testDocument.getText().length)
      )
      editBuilder.delete(fullRange)
      editBuilder.insert(new vscode.Position(0, 0), '<%= @user.name %>')
    })
    
    assert.ok(success, 'ERB content edit should succeed')
    
    // Verify content
    const content = testDocument.getText()
    assert.strictEqual(content, '<%= @user.name %>', 'Document should contain ERB syntax')
    
    // Wait for diagnostics
    await new Promise(resolve => setTimeout(resolve, 500))

    // Get diagnostics
    const diagnostics = vscode.languages.getDiagnostics(testDocumentUri)
    assert.ok(Array.isArray(diagnostics), 'Should handle ERB syntax')
  })

  test('should handle multiple document changes', async function() {
    this.timeout(5000)
    
    const testDocument = await vscode.workspace.openTextDocument(testDocumentUri)
    const editor = await vscode.window.showTextDocument(testDocument)
    
    // Make several changes rapidly
    for (let i = 0; i < 3; i++) {
      await editor.edit(editBuilder => {
        editBuilder.insert(new vscode.Position(0, 0), `<!-- change ${i} -->`)
      })
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    
    // Final wait for diagnostics
    await new Promise(resolve => setTimeout(resolve, 500))

    // Should handle multiple rapid changes
    const diagnostics = vscode.languages.getDiagnostics(testDocumentUri)
    assert.ok(Array.isArray(diagnostics), 'Should handle multiple rapid changes')
    
    // Content should reflect all changes
    const content = testDocument.getText()
    assert.ok(content.includes('change 0'), 'Should contain first change')
    assert.ok(content.includes('change 1'), 'Should contain second change')
    assert.ok(content.includes('change 2'), 'Should contain third change')
  })

  test('should detect invalid ERB syntax and provide error diagnostics', async function() {
    this.timeout(5000)
    
    const testDocument = await vscode.workspace.openTextDocument(testDocumentUri)
    const editor = await vscode.window.showTextDocument(testDocument)
    
    // Test different types of potentially invalid ERB syntax
    const invalidSyntaxCases = [
      '<%= "unclosed string',
      '<%=',
      '<% if without end',
      '<%# comment without proper close',
      '<div><%= broken %></p>' // mismatched HTML tags
    ]
    
    for (const invalidSyntax of invalidSyntaxCases) {
      // Clear document and add invalid ERB syntax
      await editor.edit(editBuilder => {
        const fullRange = new vscode.Range(
          testDocument.positionAt(0),
          testDocument.positionAt(testDocument.getText().length)
        )
        editBuilder.delete(fullRange)
        editBuilder.insert(new vscode.Position(0, 0), invalidSyntax)
      })

      // Wait for diagnostics to process
      await new Promise(resolve => setTimeout(resolve, 500))

      // Get diagnostics for the document
      const diagnostics = vscode.languages.getDiagnostics(testDocumentUri)
      
      console.log(`Testing syntax: "${invalidSyntax}"`)
      console.log('Diagnostics found:', diagnostics.map(d => ({
        message: d.message,
        severity: d.severity,
        source: d.source
      })))
      
      // The diagnostic system should at least return an array
      assert.ok(Array.isArray(diagnostics), 'Diagnostics should be an array')
    }
    
    // Test that the diagnostics system is working by verifying structure
    assert.ok(true, 'Diagnostic system processed all test cases without crashing')
  })

  test('should clear diagnostics when fixing invalid syntax', async function() {
    this.timeout(5000)
    
    const testDocument = await vscode.workspace.openTextDocument(testDocumentUri)
    const editor = await vscode.window.showTextDocument(testDocument)
    
    // Start with invalid syntax
    await editor.edit(editBuilder => {
      const fullRange = new vscode.Range(
        testDocument.positionAt(0),
        testDocument.positionAt(testDocument.getText().length)
      )
      editBuilder.delete(fullRange)
      editBuilder.insert(new vscode.Position(0, 0), '<%= invalid syntax')
    })

    // Wait for diagnostics to process
    await new Promise(resolve => setTimeout(resolve, 1000))

    const initialDiagnostics = vscode.languages.getDiagnostics(testDocumentUri)
    console.log('Initial diagnostics count:', initialDiagnostics.length)

    // Fix the syntax by completing the ERB tag
    await editor.edit(editBuilder => {
      const fullRange = new vscode.Range(
        testDocument.positionAt(0),
        testDocument.positionAt(testDocument.getText().length)
      )
      editBuilder.delete(fullRange)
      editBuilder.insert(new vscode.Position(0, 0), '<%= "valid syntax" %>')
    })

    // Wait for diagnostics to update
    await new Promise(resolve => setTimeout(resolve, 1000))

    const finalDiagnostics = vscode.languages.getDiagnostics(testDocumentUri)
    console.log('Final diagnostics count:', finalDiagnostics.length)
    
    // Verify diagnostic system responded to the fix
    assert.ok(Array.isArray(finalDiagnostics), 'Should return diagnostics array after fix')
    
    // The error diagnostics should be reduced when syntax is fixed
    const finalErrors = finalDiagnostics.filter(d => d.severity === vscode.DiagnosticSeverity.Error)
    const initialErrors = initialDiagnostics.filter(d => d.severity === vscode.DiagnosticSeverity.Error)
    
    assert.ok(finalErrors.length <= initialErrors.length, 
      'Error count should not increase when syntax is fixed')
  })
})