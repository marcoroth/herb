# Herb Client

Dev server client for Herb templates, connects to the Herb Dev Server and applies live DOM patches during development.

> [!WARNING]
> The dev server and client are experimental and may not work correctly in all cases.

## How It Works

The client connects to the Herb Dev Server via WebSocket and receives messages when template files change. Depending on the type of change:

- **Text and attribute changes** are patched directly in the DOM without a page reload
- **Structural changes** (insertions, removals, ERB changes) trigger a full page reload

## Usage

The client auto-initializes when `<meta name="herb-debug-mode" content="true">` is present in the page.

> [!NOTE]
> No manual setup required when using ReActionView with `debug_mode` enabled.

### Manual initialization

```typescript
import { initHerbClient } from "@herb-tools/client"

const client = initHerbClient({
  port: 8592,
  host: "localhost",
  onPatch: (message) => console.log("Patched:", message.file),
  onReload: (message) => console.log("Reloading for:", message.file),
})
```

## Protocol

The client communicates with the Herb Dev Server using these message types:

| Message | Direction | Description |
|---------|-----------|-------------|
| `welcome` | Server → Client | Handshake with project path |
| `patch` | Server → Client | Text/attribute changes to apply |
| `reload` | Server → Client | Structural change requiring reload |
| `error` | Server → Client | Parse errors detected |
| `fixed` | Server → Client | Parse errors resolved |
