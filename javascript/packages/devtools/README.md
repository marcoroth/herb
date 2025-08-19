# Herb DevTools

**Package**: [`@herb-tools/devtools`](https://www.npmjs.com/package/@herb-tools/devtools)

---

Browser extension for inspecting applications using the Herb rendering engine.

## Building

Run `yarn build` to build the extension.

```bash
yarn build
```

The extension will be built to the `dist/` directory.

For Chrome: Load it as an unpacked extension in your browser's developer mode.
For Firefox: Run `yarn run:firefox`

## Packaging

### Firefox
```bash
yarn package:firefox

yarn run:firefox

yarn lint:extension
```

#### Chrome/Edge

```bash
yarn package:chrome
```
