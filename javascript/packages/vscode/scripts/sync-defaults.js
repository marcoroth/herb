#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Import the default options from the formatter package
const { defaultFormatOptions } = require('@herb-tools/formatter');

const packageJsonPath = path.join(__dirname, '..', 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

// Extract linter rule names from the linter package
function extractLinterRuleNames() {
  const rulesDir = path.join(__dirname, '..', '..', 'linter', 'src', 'rules');
  const ruleNames = [];

  const files = fs.readdirSync(rulesDir);

  for (const file of files) {
    if (file.endsWith('.ts') && file !== 'index.ts' && file !== 'rule-utils.ts') {
      const filePath = path.join(rulesDir, file);
      const content = fs.readFileSync(filePath, 'utf8');

      // Look for name = "rule-name" pattern
      const match = content.match(/name\s*=\s*["']([^"']+)["']/);
      if (match) {
        ruleNames.push(match[1]);
      }
    }
  }

  return ruleNames.sort();
}

// Import default settings from language-server
let languageServerDefaults;
try {
  const settingsPath = path.join(__dirname, '..', '..', 'language-server', 'dist', 'settings.js');
  // Note: This would require the language-server to be built first
  // For now, we'll use hardcoded defaults that match the settings.ts file
  languageServerDefaults = {
    linter: {
      enabled: true,
      excludedRules: ["parser-no-errors"]
    }
  };
} catch (e) {
  // Fallback defaults if we can't import from language-server
  languageServerDefaults = {
    linter: {
      enabled: true,
      excludedRules: ["parser-no-errors"]
    }
  };
}

// Extract available linter rule names
const availableRuleNames = extractLinterRuleNames();

// Update the VS Code settings defaults to match language server and formatter defaults
const config = packageJson.contributes.configuration.properties;

// Sync formatter defaults
if (config['languageServerHerb.formatter.indentWidth']) {
  config['languageServerHerb.formatter.indentWidth'].default = defaultFormatOptions.indentWidth;
}

if (config['languageServerHerb.formatter.maxLineLength']) {
  config['languageServerHerb.formatter.maxLineLength'].default = defaultFormatOptions.maxLineLength;
}

// Sync linter defaults
if (config['languageServerHerb.linter.enabled']) {
  config['languageServerHerb.linter.enabled'].default = languageServerDefaults.linter.enabled;
}

if (config['languageServerHerb.linter.excludedRules']) {
  config['languageServerHerb.linter.excludedRules'].default = languageServerDefaults.linter.excludedRules;
  // Update the enum with all available rule names for autocomplete
  config['languageServerHerb.linter.excludedRules'].items.enum = availableRuleNames;
}

// Write the updated package.json
fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');

console.log(`Updated VS Code settings defaults to match language server and formatter defaults:`);
console.log(`  indentWidth: ${defaultFormatOptions.indentWidth}`);
console.log(`  maxLineLength: ${defaultFormatOptions.maxLineLength}`);
console.log(`  linter.enabled: ${languageServerDefaults.linter.enabled}`);
console.log(`  linter.excludedRules: ${JSON.stringify(languageServerDefaults.linter.excludedRules)}`);
console.log(`  available linter rules: ${availableRuleNames.length} rules found for autocomplete`);
