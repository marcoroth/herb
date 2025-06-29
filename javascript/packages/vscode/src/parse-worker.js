const { Herb } = require('@herb-tools/node-wasm');
const { ParseResult } = require('@herb-tools/core');
const fs = require('fs');

(async () => {
  const file = process.argv[2];

  if (!file) {
    process.stderr.write('Please specify input file.\n');
    process.stdout.write(JSON.stringify({ errors: 1 }));
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
    const errors = parseResult.recursiveErrors().length;

    const result = { 
      errors,
      version: Herb.version 
    };

    process.stdout.write(JSON.stringify(result));
    process.exit(0);
  } catch (e) {
    process.stderr.write(String(e));
    const result = { errors: 1 };
    try {
      if (Herb && Herb.version) {
        result.version = Herb.version;
      }
    } catch {}
    process.stdout.write(JSON.stringify(result));
    process.exit(1);
  }
})();
