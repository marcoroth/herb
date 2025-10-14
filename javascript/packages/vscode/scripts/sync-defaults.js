#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const { defaultFormatOptions } = require('@herb-tools/formatter');

const packageJsonPath = path.join(__dirname, '..', 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

function extractLinterRuleNames() {
  const rulesDir = path.join(__dirname, '..', '..', 'linter', 'src', 'rules');
  const ruleNames = [];

  const files = fs.readdirSync(rulesDir);

  for (const file of files) {
    if (file.endsWith('.ts') && file !== 'index.ts' && file !== 'rule-utils.ts') {
      const filePath = path.join(rulesDir, file);
      const content = fs.readFileSync(filePath, 'utf8');
      const match = content.match(/name\s*=\s*["']([^"']+)["']/);

      if (match) {
        ruleNames.push(match[1]);
      }
    }
  }

  return ruleNames.sort();
}

let languageServerDefaults;
try {
  languageServerDefaults = {
    linter: {
      enabled: true,
      excludedRules: ["parser-no-errors"]
    }
  };
} catch {
  languageServerDefaults = {
    linter: {
      enabled: true,
      excludedRules: ["parser-no-errors"]
    }
  };
}

const availableRuleNames = extractLinterRuleNames();
const config = packageJson.contributes.configuration.properties;

const existingRuleNames = config['languageServerHerb.linter.excludedRules']?.items?.enum || [];
const hasNewRules = JSON.stringify(availableRuleNames.sort()) !== JSON.stringify(existingRuleNames.sort());

if (config['languageServerHerb.formatter.indentWidth']) {
  config['languageServerHerb.formatter.indentWidth'].default = defaultFormatOptions.indentWidth;
}

if (config['languageServerHerb.formatter.maxLineLength']) {
  config['languageServerHerb.formatter.maxLineLength'].default = defaultFormatOptions.maxLineLength;
}

if (config['languageServerHerb.linter.enabled']) {
  config['languageServerHerb.linter.enabled'].default = languageServerDefaults.linter.enabled;
}

if (config['languageServerHerb.linter.excludedRules']) {
  config['languageServerHerb.linter.excludedRules'].default = languageServerDefaults.linter.excludedRules;
  config['languageServerHerb.linter.excludedRules'].items.enum = availableRuleNames;
}

fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');

console.log(`Updated VS Code settings defaults to match language server and formatter defaults:`);
console.log(`  indentWidth: ${defaultFormatOptions.indentWidth}`);
console.log(`  maxLineLength: ${defaultFormatOptions.maxLineLength}`);
console.log(`  linter.enabled: ${languageServerDefaults.linter.enabled}`);
console.log(`  linter.excludedRules: ${JSON.stringify(languageServerDefaults.linter.excludedRules)}`);
console.log(`  available linter rules: ${availableRuleNames.length} rules found for autocomplete`);

if (hasNewRules) {
  console.log(`New linter rules detected - exiting with code 1`);
  process.exit(1);
}
