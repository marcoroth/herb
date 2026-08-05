# Herb JavaScript Bindings

Herb provides official JavaScript bindings as NPM packages, published under the [`@herb-tools`](http://npmjs.com/org/herb-tools) organization. These packages are available for installation via [npmjs.org](https://www.npmjs.com) using any package manager of your choice.

Herb supports both **browser** and **Node.js** environments with separate packages, ensuring optimized compatibility for each platform.

> [!TIP] More Language Bindings
> Herb also has bindings for:
> - [Ruby](/bindings/ruby/)
> - [Java](/bindings/java/)
> - [Rust](/bindings/rust/)

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

## Using Unreleased Commits

Each commit on the `main` branch and pull requests with approved reviews are published to [pkg.pr.new](https://pkg.pr.new/~/marcoroth/herb). You can install preview packages directly from commits or PRs:

:::code-group
```shell [npm]
npm i https://pkg.pr.new/@herb-tools/core@{commit}
```

```shell [pnpm]
pnpm add https://pkg.pr.new/@herb-tools/core@{commit}
```

```shell [yarn]
yarn add https://pkg.pr.new/@herb-tools/core@{commit}
```

```shell [bun]
bun add https://pkg.pr.new/@herb-tools/core@{commit}
```
:::

Replace `{commit}` with the short commit SHA (e.g., `0d2eabe`) or branch name (e.g., `main`).

### Running CLI Tools from Previews

You can also run CLI tools directly from preview releases without installing:

:::code-group
```shell [Linter]
npx https://pkg.pr.new/@herb-tools/linter@{commit} template.html.erb
```

```shell [Formatter]
npx https://pkg.pr.new/@herb-tools/formatter@{commit} template.html.erb
```

```shell [Language Server]
npx https://pkg.pr.new/@herb-tools/language-server@{commit} --stdio
```
:::

This is perfect for testing bug fixes or new features before they're officially released!

## Getting Started

Regardless of whether you imported `Herb` from `@herb-tools/browser` or `@herb-tools/node`, the API remains the same for both packages.
