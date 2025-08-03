"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const fs_1 = require("fs");
const path_1 = require("path");
(0, vitest_1.describe)('VS Code Extension Configuration', () => {
    (0, vitest_1.it)('should have proper Tailwind sorting configuration', () => {
        const packageJsonPath = (0, path_1.join)(__dirname, '..', 'package.json');
        const packageJson = JSON.parse((0, fs_1.readFileSync)(packageJsonPath, 'utf8'));
        const config = packageJson.contributes.configuration.properties;
        // Check that the Tailwind sorting setting exists
        const tailwindSetting = config['languageServerHerb.formatter.sortTailwindClasses'];
        (0, vitest_1.expect)(tailwindSetting).toBeDefined();
        (0, vitest_1.expect)(tailwindSetting.type).toBe('boolean');
        (0, vitest_1.expect)(tailwindSetting.scope).toBe('resource');
        (0, vitest_1.expect)(tailwindSetting.default).toBe(false);
        // Check description contains expected content  
        (0, vitest_1.expect)(tailwindSetting.description).toBeTruthy();
        (0, vitest_1.expect)(tailwindSetting.description).toContain('Tailwind CSS');
        (0, vitest_1.expect)(tailwindSetting.markdownDescription).toBeTruthy();
        (0, vitest_1.expect)(tailwindSetting.markdownDescription).toContain('prettier-plugin-tailwindcss');
    });
    (0, vitest_1.it)('should have proper formatter configuration structure', () => {
        const packageJsonPath = (0, path_1.join)(__dirname, '..', 'package.json');
        const packageJson = JSON.parse((0, fs_1.readFileSync)(packageJsonPath, 'utf8'));
        const config = packageJson.contributes.configuration.properties;
        // Check formatter enabled setting
        const formatterEnabled = config['languageServerHerb.formatter.enabled'];
        (0, vitest_1.expect)(formatterEnabled).toBeDefined();
        (0, vitest_1.expect)(formatterEnabled.type).toBe('boolean');
        (0, vitest_1.expect)(formatterEnabled.default).toBe(false);
        // Check indent width setting
        const indentWidth = config['languageServerHerb.formatter.indentWidth'];
        (0, vitest_1.expect)(indentWidth).toBeDefined();
        (0, vitest_1.expect)(indentWidth.type).toBe('number');
        (0, vitest_1.expect)(indentWidth.default).toBe(2);
        // Check max line length setting
        const maxLineLength = config['languageServerHerb.formatter.maxLineLength'];
        (0, vitest_1.expect)(maxLineLength).toBeDefined();
        (0, vitest_1.expect)(maxLineLength.type).toBe('number');
        (0, vitest_1.expect)(maxLineLength.default).toBe(80);
    });
    (0, vitest_1.it)('should have proper extension metadata', () => {
        const packageJsonPath = (0, path_1.join)(__dirname, '..', 'package.json');
        const packageJson = JSON.parse((0, fs_1.readFileSync)(packageJsonPath, 'utf8'));
        (0, vitest_1.expect)(packageJson.name).toBe('herb-lsp');
        (0, vitest_1.expect)(packageJson.displayName).toBeTruthy();
        (0, vitest_1.expect)(packageJson.version).toBeTruthy();
        (0, vitest_1.expect)(packageJson.categories).toContain('Formatters');
        (0, vitest_1.expect)(packageJson.keywords).toContain('HTML');
        (0, vitest_1.expect)(packageJson.keywords).toContain('ERB');
    });
    (0, vitest_1.it)('should have proper activation events', () => {
        const packageJsonPath = (0, path_1.join)(__dirname, '..', 'package.json');
        const packageJson = JSON.parse((0, fs_1.readFileSync)(packageJsonPath, 'utf8'));
        (0, vitest_1.expect)(packageJson.activationEvents).toBeDefined();
        (0, vitest_1.expect)(packageJson.activationEvents).toContain('onLanguage:erb');
        (0, vitest_1.expect)(packageJson.activationEvents).toContain('onLanguage:html');
    });
    (0, vitest_1.it)('should reference the correct rewriter package', () => {
        const packageJsonPath = (0, path_1.join)(__dirname, '..', 'package.json');
        const packageJson = JSON.parse((0, fs_1.readFileSync)(packageJsonPath, 'utf8'));
        // Check that the rewriter package is referenced in devDependencies
        (0, vitest_1.expect)(packageJson.devDependencies['@herb-tools/rewriter']).toBeTruthy();
        (0, vitest_1.expect)(packageJson.devDependencies['@herb-tools/formatter']).toBeTruthy();
        (0, vitest_1.expect)(packageJson.devDependencies['@herb-tools/language-server']).toBe(undefined); // It's not a dependency
    });
});
//# sourceMappingURL=sync-defaults.test.js.map