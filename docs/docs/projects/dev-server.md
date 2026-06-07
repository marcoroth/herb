# Herb Dev Server

The Herb Dev Server watches template files and provides real-time hot-reloading during development via WebSocket.

> [!WARNING]
> The dev server is experimental and may not work correctly in all cases.

## Usage

```bash
herb dev [directory] [--port 8592]
```

The server starts watching all template files in the directory, diffs changes using the Herb diff engine, and broadcasts updates to connected clients.

## How It Works

1. **File watching**: monitors all `.html.erb`, `.html.herb`, and other template files for changes
2. **AST diffing**: when a file changes, diffs the old and new AST to determine what changed
3. **Smart patching**: for text and attribute changes, sends a patch that the client applies without reloading
4. **Reload fallback**: for structural changes (insertions, removals, ERB changes), tells the client to reload

## Architecture

The dev server consists of two parts:

- **Server** (`lib/herb/dev/`): Ruby WebSocket server that watches files and broadcasts changes
- **Client** (`@herb-tools/client`): JavaScript package that connects to the server and applies DOM patches

## CLI Output

```
 🌿 Herb Dev Server

  ⚠️ Experimental: The dev server is experimental and may not work correctly in all cases.

  Herb:      0.10.1
  Project:   /path/to/project
  Config:    .herb.yaml
  Files:     453 templates indexed
  WebSocket: ws://localhost:8592

  Ready! Watching for changes...

  Recent changes:

    20:13:40 ✓ patch  app/views/posts/show.html.erb (1 operation) [1 client]
                      #1 text changed [4, 8]
    20:13:45 ↻ reload app/views/posts/index.html.erb (2 operations) [1 client]
                      #1 node inserted [0, 3]
                      #2 text changed [0, 4]
```

## Links

- [Dev Server Client (`@herb-tools/client`)](/projects/client)
