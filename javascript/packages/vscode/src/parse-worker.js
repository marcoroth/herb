const { Herb } = require('@herb-tools/node-wasm');

(async () => {
  const file = process.argv[2];

  try {
    await Herb.load();

    const result = Herb.parseFile(file);
    const errors = result.recursiveErrors().length;

    process.stdout.write(JSON.stringify({ errors }));
  } catch (e) {
    process.stderr.write(String(e));

    process.exit(1);
  }
})();
