# Herb Dev Tools

**Package**: [`@herb-tools/dev-tools`](https://www.npmjs.com/package/@herb-tools/dev-tools)

---

Development tools for visual debugging in HTML+ERB templates. Provides a browser-based interface for inspecting ERB expressions, template boundaries, and more debugging information, together with the dev server client that applies live DOM patches.

## Installation

```bash
npm install @herb-tools/dev-tools

# or

yarn add @herb-tools/dev-tools
```

## Usage

Nothing runs on import. Call `start()` to bring up the overlay and connect to the [Herb Dev Server](/projects/dev-server).

```typescript
import { HerbDevTools } from "@herb-tools/dev-tools"

HerbDevTools.start()
```

Everything the dev tools own is page-global, so only one can run at a time. `start()` assigns the running instance to `window.HerbDevTools` and returns it. While one is running a further `start()` logs a warning and returns `null`, leaving the running instance untouched. Reach it again through `HerbDevTools.instance`.

Both halves hang off the instance, so `window.HerbDevTools.overlay` is the overlay and `window.HerbDevTools.client` is the dev server client. Either is `null` when that half is switched off.

Call `stop()` on the instance to disconnect the client, remove the overlay and the stylesheet, and release the global. A later `start()` then brings up a fresh one.

```typescript
const devTools = HerbDevTools.start()

devTools?.stop()
```

### Options

- `projectPath` is the absolute path of the project, used to resolve editor links. It falls back to the `herb-project-path` meta tag.
- `overlay` can be set to `false` to connect to the dev server without drawing the overlay.
- `devServer` can be set to `false` to draw the overlay without connecting. Pass an object instead to configure the client.

```typescript
HerbDevTools.start({
  devServer: {
    port: 8592,
    host: "localhost",
    onPatch: (message) => console.log("Patched:", message.file),
    onReload: (message) => console.log("Reloading for:", message.file),
  },
}).start()
```

## Dev Server Client

> [!WARNING]
> The dev server and client are experimental and may not work correctly in all cases.

The client connects to the Herb Dev Server via WebSocket and receives messages when template files change. Depending on the type of change:

- **Text and attribute changes** are patched directly in the DOM without a page reload
- **Structural changes** (insertions, removals, ERB changes) trigger a full page reload

### Protocol

The client communicates with the Herb Dev Server using these message types:

| Message   | Direction       | Description                        |
|-----------|-----------------|------------------------------------|
| `welcome` | Server → Client | Handshake with project path        |
| `patch`   | Server → Client | Text/attribute changes to apply    |
| `reload`  | Server → Client | Structural change requiring reload |
| `error`   | Server → Client | Parse errors detected              |
| `fixed`   | Server → Client | Parse errors resolved              |
