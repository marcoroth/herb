const fs = require('fs');

(async () => {
  const file = process.argv[2];
  const linterEnabled = process.argv[3] !== 'false'; // Default to true unless explicitly false

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

    const { Herb } = await import('@herb-tools/node-wasm');
    const { Linter } = await import('@herb-tools/linter');

    await Herb.load();

    console.log = originalConsoleLog;
    console.error = originalConsoleError;

    const content = fs.readFileSync(file, 'utf8');
    const parseResult = Herb.parse(content);
    const parseErrors = parseResult.recursiveErrors().length;

    let lintOffenses = [];
    if (parseErrors === 0 && linterEnabled) {
      try {
        const linter = new Linter();
        const lintResult = linter.lint(parseResult.value);

        lintOffenses = lintResult.offenses || [];
      } catch (lintError) {
        console.error('Linting failed:', lintError);
      }
    }

    const result = {
      errors: parseErrors,
      lintOffenses: lintOffenses,
      lintWarnings: lintOffenses.filter(o => o.severity === 'warning').length,
      lintErrors: lintOffenses.filter(o => o.severity === 'error').length,
      linterDisabled: !linterEnabled,
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
      linterDisabled: !linterEnabled
    };

    try {
      const { Herb } = await import('@herb-tools/node-wasm');
      if (Herb && Herb.version) {
        result.version = Herb.version;
      }
    } catch {}

    process.stdout.write(JSON.stringify(result));
    process.exit(1);
  }
})();
