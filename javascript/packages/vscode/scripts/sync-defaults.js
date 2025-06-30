#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Import the default options from the formatter package
const { defaultFormatOptions } = require('@herb-tools/formatter');

const packageJsonPath = path.join(__dirname, '..', 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

// Update the VS Code settings defaults to match formatter defaults
const formattingConfig = packageJson.contributes.configuration.properties;

if (formattingConfig['languageServerHerb.formatting.indentWidth']) {
  formattingConfig['languageServerHerb.formatting.indentWidth'].default = defaultFormatOptions.indentWidth;
}

if (formattingConfig['languageServerHerb.formatting.maxLineLength']) {
  formattingConfig['languageServerHerb.formatting.maxLineLength'].default = defaultFormatOptions.maxLineLength;
}

// Write the updated package.json
fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');

console.log(`Updated VS Code settings defaults to match formatter defaults:`);
console.log(`  indentWidth: ${defaultFormatOptions.indentWidth}`);
console.log(`  maxLineLength: ${defaultFormatOptions.maxLineLength}`);
