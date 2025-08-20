# Herb DevTools Client

**Package**: [`@herb-tools/devtools-client`](https://www.npmjs.com/package/@herb-tools/devtools-client)

---

Client-side library for Herb DevTools integration.

## Installation

```bash
npm install @herb-tools/devtools-client
# or
yarn add @herb-tools/devtools-client
```

## Quick Start

### Basic Usage

```javascript
import { HerbDevTools } from '@herb-tools/devtools-client';

HerbDevTools.init();

HerbDevTools.init({
  autoTrack: true,     // Automatically track components
  hotReload: true,     // Enable hot reload in development
  debug: true          // Enable debug utilities
});
```

### Manual Component Tracking

```javascript
import { HerbDevTools } from '@herb-tools/devtools-client';

const herb = HerbDevTools.init();

const componentId = herb.track(document.getElementById('my-component'), {
  name: 'MyComponent',
  props: { title: 'Hello World' },
  templateSource: '<div><%= title %></div>'
});

herb.update(element, {
  props: { title: 'Updated Title' }
});

herb.untrack(element);
```
