#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const { defaultFormatOptions } = require('@herb-tools/formatter');

const packageJsonPath = path.join(__dirname, '..', 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

let languageServerDefaults;
try {
  languageServerDefaults = {
    linter: {
      enabled: true
    }
  };
} catch {
  languageServerDefaults = {
    linter: {
      enabled: true
    }
  };
}

const config = packageJson.contributes.configuration.properties;

if (config['languageServerHerb.formatter.indentWidth']) {
  config['languageServerHerb.formatter.indentWidth'].default = defaultFormatOptions.indentWidth;
}

if (config['languageServerHerb.formatter.maxLineLength']) {
  config['languageServerHerb.formatter.maxLineLength'].default = defaultFormatOptions.maxLineLength;
}

if (config['languageServerHerb.linter.enabled']) {
  config['languageServerHerb.linter.enabled'].default = languageServerDefaults.linter.enabled;
}

fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');

console.log(`Updated VS Code settings defaults to match language server and formatter defaults:`);
console.log(`  indentWidth: ${defaultFormatOptions.indentWidth}`);
console.log(`  maxLineLength: ${defaultFormatOptions.maxLineLength}`);
console.log(`  linter.enabled: ${languageServerDefaults.linter.enabled}`);
