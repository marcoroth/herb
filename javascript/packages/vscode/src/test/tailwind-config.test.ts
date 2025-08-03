import * as assert from 'assert'
import { readFileSync } from 'fs'
import { join } from 'path'

describe('VS Code Extension Tailwind Configuration', () => {
  test('should have proper Tailwind sorting configuration', () => {
    const packageJsonPath = join(__dirname, '..', '..', 'package.json')
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'))
    
    const config = packageJson.contributes.configuration.properties
    
    // Check that the Tailwind sorting setting exists
    const tailwindSetting = config['languageServerHerb.formatter.sortTailwindClasses']
    assert.ok(tailwindSetting, 'Tailwind sorting setting should exist')
    assert.strictEqual(tailwindSetting.type, 'boolean')
    assert.strictEqual(tailwindSetting.scope, 'resource')
    assert.strictEqual(tailwindSetting.default, false)
    
    // Check description contains expected content  
    assert.ok(tailwindSetting.description, 'Should have description')
    assert.ok(tailwindSetting.description.includes('Tailwind CSS'), 'Description should mention Tailwind CSS')
    assert.ok(tailwindSetting.markdownDescription, 'Should have markdown description')
    assert.ok(tailwindSetting.markdownDescription.includes('prettier-plugin-tailwindcss'), 'Should reference prettier plugin')
  })

  test('should have proper formatter configuration structure', () => {
    const packageJsonPath = join(__dirname, '..', '..', 'package.json')
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'))
    
    const config = packageJson.contributes.configuration.properties
    
    // Check formatter enabled setting
    const formatterEnabled = config['languageServerHerb.formatter.enabled']
    assert.ok(formatterEnabled, 'Formatter enabled setting should exist')
    assert.strictEqual(formatterEnabled.type, 'boolean')
    assert.strictEqual(formatterEnabled.default, false)
    
    // Check indent width setting
    const indentWidth = config['languageServerHerb.formatter.indentWidth']
    assert.ok(indentWidth, 'Indent width setting should exist')
    assert.strictEqual(indentWidth.type, 'number')
    assert.strictEqual(indentWidth.default, 2)
    
    // Check max line length setting
    const maxLineLength = config['languageServerHerb.formatter.maxLineLength']
    assert.ok(maxLineLength, 'Max line length setting should exist')
    assert.strictEqual(maxLineLength.type, 'number')
    assert.strictEqual(maxLineLength.default, 80)
  })

  test('should reference the correct packages', () => {
    const packageJsonPath = join(__dirname, '..', '..', 'package.json')
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'))
    
    // Check that the rewriter package is referenced in devDependencies
    assert.ok(packageJson.devDependencies['@herb-tools/rewriter'], 'Should reference rewriter package')
    assert.ok(packageJson.devDependencies['@herb-tools/formatter'], 'Should reference formatter package')
  })

  test('sync script should update defaults correctly', () => {
    const packageJsonPath = join(__dirname, '..', '..', 'package.json')
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'))
    
    const config = packageJson.contributes.configuration.properties
    
    // After running sync-defaults script, the defaults should match what we expect
    assert.strictEqual(config['languageServerHerb.formatter.indentWidth'].default, 2)
    assert.strictEqual(config['languageServerHerb.formatter.maxLineLength'].default, 80)
    assert.strictEqual(config['languageServerHerb.formatter.sortTailwindClasses'].default, false)
  })
})