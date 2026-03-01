#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const { Config } = require('@herb-tools/config');

const packageJsonPath = path.join(__dirname, '..', 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

const defaults = Config.getDefaultConfig()
const config = packageJson.contributes.configuration.properties;

if (config['languageServerHerb.formatter.indentWidth']) {
  config['languageServerHerb.formatter.indentWidth'].default = defaults.formatter.indentWidth;
}

if (config['languageServerHerb.formatter.maxLineLength']) {
  config['languageServerHerb.formatter.maxLineLength'].default = defaults.formatter.maxLineLength;
}

if (config['languageServerHerb.linter.enabled']) {
  config['languageServerHerb.linter.enabled'].default = defaults.linter.enabled;
}

if (config['languageServerHerb.linter.fixOnSave']) {
  config['languageServerHerb.linter.fixOnSave'].default = true;
}

fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');

console.log(`Updated VS Code settings defaults to match language server and formatter defaults:`);
console.log(Object.entries(config).map(entry => [`  ${entry[0]}`, entry[1].default].join(": ")).join("\n"))
