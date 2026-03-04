const fs = require('fs');
const { Herb } = require('@herb-tools/node-wasm');
const { Linter, loadCustomRules } = require('@herb-tools/linter/loader');
const { Formatter } = require('@herb-tools/formatter');
const { Config } = require('@herb-tools/config');

(async () => {
  const file = process.argv[2];
  const linterEnabled = process.argv[3] !== 'false';
  const formatterEnabled = process.argv[4] === 'true';
  const formatterIndentWidth = parseInt(process.argv[5]) || 2;
  const formatterMaxLineLength = parseInt(process.argv[6]) || 80;
  const linterRulesJson = process.argv[7] || '{}';
  const workspaceRoot = process.argv[8] || process.cwd();

  let linterRules = {};
  try {
    linterRules = JSON.parse(linterRulesJson);
  } catch (_error) {
    // Invalid JSON, use empty rules
  }

  if (!file) {
    process.stderr.write('Please specify input file.\n');
    process.stdout.write(JSON.stringify({
      errors: 1,
      lintOffenses: [],
      lintWarnings: 0,
      lintErrors: 0,
      linterDisabled: false
    }));
    process.exit(1);
  }

  try {
    const originalConsoleLog = console.log;
    const originalConsoleError = console.error;
    console.log = () => {};
    console.error = () => {};

    await Herb.load();

    console.log = originalConsoleLog;
    console.error = originalConsoleError;

    const content = fs.readFileSync(file, 'utf8');
    const parseResult = Herb.parse(content);
    const parseErrors = parseResult.recursiveErrors().length;

    let lintOffenses = [];
    let lintErrors = 0;
    let lintWarnings = 0;

    if (parseErrors === 0 && linterEnabled) {
      try {
        const config = Config.fromObject({
          linter: {
            enabled: true,
            rules: linterRules
          }
        }, { projectPath: workspaceRoot });

        let customRules = undefined;

        try {
          const result = await loadCustomRules({
            baseDir: workspaceRoot,
            silent: true
          });
          customRules = result.rules;
        } catch (_customRuleError) {
          // Ignore custom rule loading errors in worker
        }

        const linter = Linter.from(Herb, config, customRules);
        const lintResult = linter.lint(content, { fileName: file });

        lintOffenses = lintResult.offenses || [];

        lintErrors = lintOffenses.filter(o => o.severity === 'error').length;
        lintWarnings = lintOffenses.filter(o => o.severity === 'warning').length;
      } catch (lintError) {
        console.error('Linting failed:', lintError);
      }
    }

    let formatterIssues = false;
    if (parseErrors === 0 && formatterEnabled) {
      try {
        const formatter = new Formatter(Herb, {
          indentWidth: formatterIndentWidth,
          maxLineLength: formatterMaxLineLength
        });
        const formattedContent = formatter.format(content);

        formatterIssues = formattedContent !== content;

        if (process.env.DEBUG_FORMATTER) {
          console.error(`File: ${file}`);
          console.error(`Formatter enabled: ${formatterEnabled}`);
          console.error(`Formatter issues: ${formatterIssues}`);
          if (formatterIssues) {
            console.error(`Original length: ${content.length}, Formatted length: ${formattedContent.length}`);

            for (let i = 0; i < Math.min(content.length, formattedContent.length); i++) {
              if (content[i] !== formattedContent[i]) {
                console.error(`First difference at position ${i}: '${content[i]}' vs '${formattedContent[i]}'`);
                break;
              }
            }
          }
        }
      } catch (formatterError) {
        console.error('Formatting check failed:', formatterError);
        formatterIssues = false;
      }
    }

    const result = {
      errors: parseErrors,
      lintOffenses: lintOffenses,
      lintWarnings: lintWarnings,
      lintErrors: lintErrors,
      linterDisabled: !linterEnabled,
      formatterIssues,
      formatterDisabled: !formatterEnabled,
      version: Herb.version
    };

    process.stdout.write(JSON.stringify(result));
    process.exit(0);
  } catch (e) {
    process.stderr.write(String(e));
    const result = {
      errors: 1,
      lintOffenses: [],
      lintWarnings: 0,
      lintErrors: 0,
      linterDisabled: !linterEnabled,
      formatterIssues: false,
      formatterDisabled: !formatterEnabled
    };

    try {
      if (Herb && Herb.version) {
        result.version = Herb.version;
      }
    } catch {}

    process.stdout.write(JSON.stringify(result));
    process.exit(1);
  }
})();
