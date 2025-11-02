# Herb JavaScript Bindings

Herb provides official JavaScript bindings as NPM packages, published under the [`@herb-tools`](http://npmjs.com/org/herb-tools) organization. These packages are available for installation via [npmjs.org](https://www.npmjs.com) using any package manager of your choice.

Herb supports both **browser** and **Node.js** environments with separate packages, ensuring optimized compatibility for each platform.

> [!TIP] More Language Bindings
> Herb also has bindings for:
> - [Ruby](/bindings/ruby/)
> - [Java](/bindings/java/)

## Installation

### Browser usage

#### Installing the NPM Package

To use Herb in a browser environment, install the `@herb-tools/browser` package:

:::code-group
```shell [npm]
npm add @herb-tools/browser
```

```shell [pnpm]
pnpm add @herb-tools/browser
```

```shell [yarn]
yarn add @herb-tools/browser
```

```shell [bun]
bun add @herb-tools/browser
```
:::

###### Importing in Your Project

Import the `Herb` object into your project:

:::code-group
```js twoslash [async/await]
import { Herb } from "@herb-tools/browser"

await Herb.load()

Herb.parse("content")
```

```js twoslash [Promise]
import { Herb } from "@herb-tools/browser"

Herb.load().then(() => {
  Herb.parse("content")
})
```
:::

You are now ready to parse HTML+ERB in the browser using JavaScript.

---

### Node.js usage

#### Installing the NPM Package

To use Herb in a Node.js environment, install the `@herb-tools/node` package:

:::code-group
```shell [npm]
npm add @herb-tools/node
```

```shell [pnpm]
pnpm add @herb-tools/node
```

```shell [yarn]
yarn add @herb-tools/node
```

```shell [bun]
bun add @herb-tools/node
```
:::


###### Importing in Your Project

Import the `Herb` object into your project:

:::code-group
```js twoslash [async/await]
import { Herb } from "@herb-tools/node"

await Herb.load()

Herb.parse("content")
```

```js twoslash [Promise]
import { Herb } from "@herb-tools/node"

Herb.load().then(() => {
  Herb.parse("content")
})
```
:::

You are now ready to parse HTML+ERB in Node.js.

## Getting Started

Regardless of whether you imported `Herb` from `@herb-tools/browser` or `@herb-tools/node`, the API remains the same for both packages.
