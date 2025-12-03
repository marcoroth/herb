---
title: What's new in Herb v0.8
author:
  name: Marco Roth
date: 2025-11-12
layout: doc
sidebar: false
outline:
  level: [2, 2]
  label: In this post
head:
  - - meta
    - property: og:type
      content: article

  - - meta
    - property: og:title
      content: What's new in Herb v0.8

  - - meta
    - property: og:image
      content: /blog/whats-new-in-herb-v0-8/hero.png

  - - meta
    - property: og:image:width
      content: "1560"

  - - meta
    - property: og:image:height
      content: "864"

  - - meta
    - property: og:url
      content: /blog/whats-new-in-herb-v0-8

  - - meta
    - property: og:description
      content: The most feature-packed Herb release yet with new Rust and Java bindings, linter autofix, configuration file support, custom rules, Tailwind class sorting, and major improvements across the ecosystem.

  - - meta
    - property: article:author
      content: Marco Roth

  - - meta
    - name: twitter:card
      content: summary_large_image
---

# What's new in Herb v0.8

_November 12, 2025_ • Marco Roth

![Herb v0.8 Announcement Cover Image](/blog/whats-new-in-herb-v0-8/hero.png)

Today, we are excited to announce **Herb v0.8**, the most feature-packed release so far!

If you're not familiar with Herb yet: it's an ecosystem of tools specifically built for HTML+ERB files. If you haven't used Herb before, we suggest reading the [Overview](/overview) page first.

Its main goal is to improve the developer experience while working with `.html.erb` files, but also to improve HTML rendering from Ruby and drive innovation in the Ruby and Rails view layers.

**Quick links:**

- [Herb v0.8.0 Changelog](https://github.com/marcoroth/herb/releases/tag/v0.8.0)
- [Documentation](/overview)

We would like to thank all contributors and everyone who reported issues to get this release out of the door. We encourage you to get involved and help us improve Herb for the entire ecosystem. Feel free to check out the [open issues](https://github.com/marcoroth/herb/issues) or get in touch.

For the latest news about Herb, follow [@marcoroth](https://github.com/marcoroth) on any of the socials.


## What's New in Herb v0.8

This release brings significant improvements across the entire Herb ecosystem. It includes new language bindings, enhanced tooling, powerful new features for linting and formatting your HTML+ERB templates, plus numerous bug fixes and quality of life improvements.

![Herb v0.8 Feature Summary](/blog/whats-new-in-herb-v0-8/summary.png)

## New Language Bindings

Herb was already available to be used from [C](/projects/parser), [Ruby](/bindings/ruby/), and the [JavaScript](/bindings/javascript/) bindings via WebAssembly (Emscripten) and Node.js (N-API).

With Herb v0.8 we expand the language support with official bindings for two new ecosystems, [Rust](/bindings/rust/) and [Java](/bindings/java/).

If you are looking to use these bindings and are missing functionality please feel free to open an issue.

### Rust Bindings

We've added comprehensive [Rust FFI bindings](/bindings/rust/), making Herb accessible to the Rust ecosystem. The Rust bindings provide full access to Herb's parsing capabilities with idiomatic Rust APIs, available on Crates.io as [`herb`](https://crates.io/crates/herb).

```rust [main.rs]
use herb::{lex, parse};

fn main() {
  let template = "<div><%= @user.name %></div>";

  match lex(template) {
    Ok(result) => { println!("{}", result); }
    Err(error) => { eprintln!("Lex error: {}", error); }
  }

  match parse(template) {
    Ok(result) => { println!("{}", result); }
    Err(error) => { eprintln!("Parse error: {}", error); }
  }
}
```

You can find the full [installation and getting started guide in the documentation](/bindings/rust/).

### Java Bindings

Herb v0.8 now supports [Java through JNI bindings](/bindings/java/), bringing HTML+ERB parsing to the JVM ecosystem. This should open up Herb's capabilities to Java, Kotlin, Scala, and other JVM languages.

```java [Main.java]
import org.herb.*;

public class Main {
  public static void main(String[] args) {
    String template = "<div><%= @user.name %></div>";

    LexResult lexResult = Herb.lex(template);
    System.out.println(lexResult.inspect());

    ParseResult parseResult = Herb.parse(template);
    System.out.println(parseResult.inspect());
  }
}
```

You can find the full [installation and getting started guide in the documentation](/bindings/java/).

## Configuration File Support

Herb v0.8 introduces a new `.herb.yml` configuration file for customizing Herb tools. You can configure the Herb Linter and Herb Formatter behavior across your project and share the configuration with your team by checking the `.herb.yml` file into git.

```yaml [.herb.yml]
files:
  exclude:
    - "node_modules/**/*"
    - "vendor/**/*"

linter:
  enabled: true
  rules:
    html-no-self-closing:
      enabled: true
      exclude:
        - "!app/views/*_mailer/**/*"

    erb-comment-syntax:
      enabled: false

formatter:
  enabled: true
  maxLineLength: 120

  rewriter:
    pre:
      - tailwind-class-sorter
```

The config options are all handled by the new [`@herb-tools/config` package](/projects/config).

You can check out the whole [configuration reference in the documentation](/configuration).

## Linter Improvements

### Autofix

The Herb Linter supports a new `--fix` option to automatically fix correctable offenses.

![Herb Linter autofix command showing correctable offenses being fixed](/blog/whats-new-in-herb-v0-8/linter-autofix.png)

The `--fix` option is not dependent on the Herb Formatter. It uses the [Herb Printer](/projects/printer) architecture, so the Linter can fix offenses without touching or formatting anything else in the document. This means you can use the Herb Linter without the Herb Formatter, if you prefer.

The CLI will show you which offenses are autocorrectable by annotating them with `[Correctable]`, and displays a summary at the end of the linter run showing how many offenses can be fixed.


### Disable Comments

You can now disable specific linter offenses inline using special `<%# herb:disable %>` comments. Given the following document:

```erb
<br />

<BR />
```

You can now disable these offenses by explicitly specifying the rule name(s) or by using the `all` directive:

```erb
<br /> <%# herb:disable html-no-self-closing %>

<BR /> <%# herb:disable html-no-self-closing, html-tag-name-lowercase %>

<BR /> <%# herb:disable all %>
```

There is also a new set of `herb-disable-*` linter rules to guide proper usage of `<%# herb:disable %>` comments, so you don't have to run the linter just to realize you had a typo in the rule name.

```erb
<br> <%# herb:disable %>

<br> <%# herb:disable all %>

<br> <%# herb:disable html-no-self-close %>

<br /> <%# herb:disable all, html-no-self-closing %>
```

You can also run the linter while ignoring all disable comments:

```bash
herb-lint --ignore-disable-comments
```

### New Linter Rules

This release brings a total of 14 new linter rules to help you write better HTML+ERB templates.

- [`erb-no-case-node-children`](/linter/rules/erb-no-case-node-children.md)<br/>
  Don't use `children` for `case/when` and `case/in` nodes

- [`erb-no-extra-newline`](/linter/rules/erb-no-extra-newline.md)<br/>
  Disallow extra newlines.

- [`erb-no-extra-whitespace-inside-tags`](/linter/rules/erb-no-extra-whitespace-inside-tags.md) <br/>
  Disallow multiple consecutive spaces inside ERB tags

- [`herb-disable-comment-malformed`](/linter/rules/herb-disable-comment-malformed.md) <br/>
  Detect malformed `herb:disable` comments.

- [`herb-disable-comment-missing-rules`](/linter/rules/herb-disable-comment-missing-rules.md) <br/>
  Require rule names in `herb:disable` comments.

- [`herb-disable-comment-no-duplicate-rules`](/linter/rules/herb-disable-comment-no-duplicate-rules.md) <br/>
  Disallow duplicate rule names in `herb:disable` comments.

- [`herb-disable-comment-no-redundant-all`](/linter/rules/herb-disable-comment-no-redundant-all.md) <br/>
  Disallow redundant use of `all` in `herb:disable` comments.

- [`herb-disable-comment-unnecessary`](/linter/rules/herb-disable-comment-unnecessary.md) <br/>
  Detect unnecessary `herb:disable` comments.

- [`herb-disable-comment-valid-rule-name`](/linter/rules/herb-disable-comment-valid-rule-name.md) <br/>
  Validate rule names in `herb:disable` comments.

- [`html-body-only-elements`](/linter/rules/html-body-only-elements.md) <br/>
  Require content elements inside `<body>`.

- [`html-head-only-elements`](/linter/rules/html-head-only-elements.md) <br/>
  Require head-scoped elements inside `<head>`.

- [`html-input-require-autocomplete`](/linter/rules/html-input-require-autocomplete.md) <br/>
  Require `autocomplete` attributes on `<input>` tags.

- [`html-no-duplicate-meta-names`](/linter/rules/html-no-duplicate-meta-names.md) <br/>
  Duplicate `<meta>` name attributes are not allowed.

- [`html-no-space-in-tag`](/linter/rules/html-no-space-in-tag.md) <br/>
  Disallow spaces in HTML tags


If you have ideas for good linter rules that would fit in the Herb Linter, please feel free to [open an issue with your proposal](https://github.com/marcoroth/herb/issues/new?template=linter-rule-proposal.md) to discuss it. There are currently ideas for around [60 more linter rules](https://github.com/marcoroth/herb/issues?q=is%3Aopen%20is%3Aissue%20label%3Alinter-rule), some of which are also a good starting point for contributing to Herb directly!

You can check all available linter rules in [the documentation](/linter/rules/).

### Custom Linter Rules

Herb v0.8 allows you to define your own linter rules now. You can create custom linter rules for project-specific requirements by placing JavaScript files in the `.herb/rules/` directory.

```js [.herb/rules/no-inline-styles.mjs]
import { BaseRuleVisitor } from "@herb-tools/linter"

class NoInlineStylesVisitor extends BaseRuleVisitor {
  // ...
}

export default class NoInlineStylesRule {
  name = "no-inline-styles"

  check(document, context) {
    // ...
  }
}
```

Learn more about how to write your [custom linter rules in the documentation](/projects/linter).


### Multiple Files in CLI

The `herb-lint` CLI now accepts multiple files/directories or globs as positional arguments.

```bash
herb-lint path/to/file1.html.erb path/to/file2.html.erb
```

or multiple directory/globs:

```bash
herb-lint app/views vendor/views/**/*.html
```

## Herb Rewriters

Herb v0.8 ships with a new `@herb-tools/rewriter` package that introduces the Herb Rewriter system. Rewriters provide a way to strategically traverse, modify, and rewrite the Herb Syntax Tree. This powerful system will be essential for writing Linter Rule Autocorrectors, Refactoring tools, and Code Actions.

The `@herb-tools/rewriter` package introduces a powerful rewriting API:

```typescript
import { rewrite, ASTRewriter } from "@herb-tools/rewriter"

class MyRewriter extends ASTRewriter {
  // ....
}

const template = `<div class="text-red-500 p-4 mt-2"></div>`
const result = rewrite(template, [new MyRewriter()])
```

The `@herb-tools/rewriter` package also ships with a few built-in rewriters. The first one is the Tailwind Class Sorter Rewriter, more on that in the formatter section below.

### Custom Rewriters

You can create custom rewriters for project-specific requirements by placing JavaScript files in the `.herb/rewriters/` directory.

```js [.herb/rewriters/my-rewriter.mjs]
import { ASTRewriter } from "@herb-tools/rewriter"

export default class MyRewriter extends ASTRewriter {
  async initialize(context) {
    // ...
  }

  rewrite(node, context) {
    // ...
  }
}
```

This rewriter is now discovered by Herb using the `my-rewriter` name, based on the file name. You can read more about the [rewriter system in the documentation](/projects/rewriter).


## Formatter Improvements

The formatter has received several improvements, including a lot of bug fixes regarding text content and whitespace formatting.

We are getting closer to removing the experimental label. Please give it a shot on your view files and report any weird behavior you might encounter using the [issue template](https://github.com/marcoroth/herb/issues/new?template=formatting-issue.md).

### Miscellaneous

- Improved root-level whitespace formatting
- Preservation of the `<%# herb:disable %>` comment placements during formatting
- Better handling of `case` statement children
- The formatter now respects and preserves frontmatter content
- The formatter now skips formatting Rails scaffold templates
- More consistent formatting of whitespace and text content handling
- The CLI now also accepts multiple files, directories, or globs

### Tailwind CSS class sorter integration

Earlier this year we published the [`@herb-tools/tailwind-class-sorter`](https://github.com/marcoroth/herb/tree/main/javascript/packages/tailwind-class-sorter#readme) package, which allows you to use the [official recommended Tailwind class order](https://tailwindcss.com/blog/automatic-class-sorting-with-prettier), without being dependent on Prettier.


![Tailwind CSS classes being automatically sorted into the recommended order](/blog/whats-new-in-herb-v0-8/tailwind-class-sorter.png)


The problem was that the algorithm was locked into the Prettier plugin itself, preventing independent use. The `@herb-tools/tailwind-class-sorter` extracts that algorithm into a standalone package that can be used from Node.js independently of Prettier or the Prettier Plugin:

```js
import { sortTailwindClasses } from "@herb-tools/tailwind-class-sorter"

const result = await sortTailwindClasses("px-4 bg-blue-500 text-white rounded py-2")
// "rounded bg-blue-500 px-4 py-2 text-white"
```


The new `@herb-tools/rewriter` package now ships with a built-in rewriter for `@herb-tools/tailwind-class-sorter`.

**TL;DR**: This built-in rewriter is fully integrated into the Herb Formatter, ensuring your Tailwind classes are always consistently ordered when you format documents.

![Video demonstration of Tailwind class sorter automatically reordering classes](/blog/whats-new-in-herb-v0-8/tailwind-class-sorter.mp4)


## Language Server Improvements

### Fix-on-Save

The Herb Language Server now supports automatic fix-on-save for lint offenses. Enable this feature in your editor settings to automatically apply fixes when you save files.

![Video demonstration of linter automatically fixing offenses on file save](/blog/whats-new-in-herb-v0-8/fix-on-save.mp4)

For Visual Studio Code, you can set your preference in the settings pane, or add the following to your settings:

```json
{
  "languageServerHerb.linter.fixOnSave": true
}
```

Also make sure your editor is set to automatically format on save. In Visual Studio Code the setting is:

```json
{
  "editor.formatOnSave": true
}
```

You can also choose to simultaneously use Fix-on-save and Format-on-save.

### Code Actions

The language server now provides code actions to disable linter rules at the current location, making it easy to suppress specific warnings when needed.

![Video demonstration of using code actions to add herb:disable comments](/blog/whats-new-in-herb-v0-8/herb-disable-code-action.mp4)

We also offer code actions to directly update the `.herb.yml`, to make it easier and less cumbersome to work with the linter and to configure it:

![Video demonstration of using code actions to update the .herb.yml configuration file](/blog/whats-new-in-herb-v0-8/herb-disable-config-code-action.mp4)


## Herb CLI Improvements

### Colored CLI Output

The Ruby CLI now features colored output for the `parse` and `lex` commands, making it easier to inspect parser output and debug templates.

```bash
herb parse template.html.erb
```

![Colored output from the herb parse command showing syntax tree](/blog/whats-new-in-herb-v0-8/herb-parse-cli.png)

```bash
herb lex template.html.erb
```

![Colored output from the herb lex command showing tokens](/blog/whats-new-in-herb-v0-8/herb-lex-cli.png)

### Parse Error Summary

When you parse an HTML+ERB file with errors, it now shows these errors as part of the pretty print output. However, for real-life templates the parse output can get quite long and verbose. To address this, we now show an error summary at the end of the `parse` output.

![Parse error summary showing list of errors found in template](/blog/whats-new-in-herb-v0-8/herb-parse-errors.png)


### Improved `analyze` command

The `herb analyze` command got some upgrades as well. It now parses and compiles all HTML+ERB templates it finds using the `Herb::Engine`, warning you early about potential issues and syntax errors in your templates.

![Output from herb analyze command showing template analysis results](/blog/whats-new-in-herb-v0-8/herb-analyze-cli.png)

## Visual Studio Code Improvements

Alongside all the improvements from the language server, there are also some more Visual Studio Code-specific improvements in the [Visual Studio Code Extension](/integrations/editors/vscode).

### `.herb.yml` Integration

The [Visual Studio Code Extension](/integrations/editors/vscode) fully supports and respects the new `.herb.yml` configuration and helps you to visualize the current settings.

### Status Bar

The Herb Status Bar shows you which settings are currently being applied in the current window/project you are working on.


![Visual Studio Code status bar showing Herb project settings indicator](/blog/whats-new-in-herb-v0-8/vscode-project-settings.png)

It will show `".herb.yml (Project Settings)"` when it's using the setting from the shared `.herb.yml` file, or it will show `"Herb (Personal Settings)"` when it's using the settings you have defined yourself in your editor.

The `.herb.yml` settings always have higher priority over your personal editor settings to make it easier to follow the project settings.


### Configuration

Clicking on the status bar will open the Herb Configuration Menu. You can also see the configuration source and the current status of the configured tools.

![Herb configuration menu in Visual Studio Code showing enabled tools](/blog/whats-new-in-herb-v0-8/vscode-herb-configuration.png)


### Sidebar

Additionally, you can also see the status of the configured tools in the sidebar.

![Visual Studio Code sidebar showing Herb configuration status](/blog/whats-new-in-herb-v0-8/vscode-config-sidebar.png)


### Create and Manage Configuration

The Visual Studio Code Extension also helps you create and manage/update the `.herb.yml` configuration file:

![Video demonstration of creating and managing .herb.yml configuration in VS Code](/blog/whats-new-in-herb-v0-8/vscode-herb-configuration.mp4)


### Rails Dev Container

The [Herb LSP Extension](https://marketplace.visualstudio.com/items?itemName=marcoroth.herb-lsp) is now installed by default as part of the [Rails Devcontainer Setup](https://github.com/rails/devcontainer). If you have a Devcontainer configured in your Rails application, you'll get these Language Tools for HTML+ERB files automatically out of the box.


## Dev Tools Improvements

### Editor Selector

The Herb Dev Tools (used in ReActionView) now feature a dropdown to select your preferred editor.

![Herb Dev Tools interface showing editor selection dropdown](/blog/whats-new-in-herb-v0-8/dev-tools-editor-select.png)

Tools like ReActionView can set a new `<meta name="herb-default-editor">` meta tag that will be picked up by the client-side dev tools. This value is being used for the `"Auto (from server)"` option.

In Rails, it will use the new `ActiveSupport::Editor` in Rails 8.1 or fallback to the value of the `RAILS_EDITOR` or `EDITOR` environment variables from your shell environment.


## Engine Improvements

The engine gets a few updates as well, including an important fix that caused HTML attribute values to be double escaped.

### Proper ERB Trimming Support

The Engine now properly supports ERB trimming, meaning the `<%-` and `-%>` ERB tags are now respected when compiling and evaluating a template using `Herb::Engine`.

### Customizable Escape Functions

The Engine now supports customizing HTML, JavaScript, and CSS escape functions. Previously, only the `escapefunc` was configurable, and it defaulted to `Herb::Engine.h`. Since Herb has a better understanding of HTML+ERB documents, we can now offer more accurate escaping functions depending on the context.

In addition to the `escapefunc` option, you can now pass these new options to `Herb::Engine`:

* `attrfunc`: Escape HTML Attribute Values (defaults to `Herb::Engine.attr`)
* `jsfunc`: Escape `<script>` content (defaults to `Herb::Engine.js`)
* `cssfunc`: Escape `<style>` content (defaults to `Herb::Engine.css`)

### Block Comment Support

The Engine can now properly handle `=begin/=end` Ruby block comments.

### ERB Comment Stripping

`Herb::Engine` now fully strips all ERB comments when compiling templates, as they could lead to syntax errors in the compiled template. For example, when ERB comments are followed by other ERB expressions on the same line, it could lead to runtime errors.

```erb [test.html.erb]
<% if valid? %><% # comment %><%= "Hello World" %><% end %>                                          <%# herb:disable all %>
```

**Before**

Previously, to avoid this issue, the compiler added a newline after any ERB Content Node that contained the `#` character.

`herb compile test.html.erb`
```ruby
__herb = ::Herb::Engine; _buf = ::String.new;
 if true; # comment // [!code focus]
 _buf << __herb.h(("Hello World")); end; _buf << '
'.freeze;
_buf.to_s
```


**After**

Now, we just strip any `<%# ... %>` and `<% # ... %>` comments in the compiled Ruby output:

`herb compile test.html.erb`
```ruby
__herb = ::Herb::Engine; _buf = ::String.new;
 if true; _buf << __herb.h(("Hello World")); end; _buf << ' // [!code focus]
'.freeze;
_buf.to_s
```


### For reference

In comparison, `Erubi::Engine` is not handling this, as it's much harder to detect these cases without actually parsing the code within the ERB tags.

`bin/erubi-compile test.html.erb`
```ruby
__erubi = ::Erubi; _buf = ::String.new; if true ; # comment ; _buf << __erubi.h(( "Hello World" )); end ; _buf << ' // [!code focus]
'.freeze;
_buf.to_s
```

When evaluated, this will result in a syntax error, since the comment is also commenting out the rest of the line:

`bin/erubi-render test.html.erb`
```ruby
bin/erubi-render:117:in 'Kernel#eval': (eval at bin/erubi-render:117):2: syntax errors found (SyntaxError)
  1 | __erubi = ::Erubi; _buf = ::String.new; if true ; # comment ; _buf << __erubi.h(( "Hello World" )); end ; _buf << '
> 2 | '.freeze;
    | ^ unterminated string meets end of file
  3 | _buf.to_s
> 4 |
    | ^ expected an `end` to close the conditional clause

    | ^ unexpected end-of-input, assuming it is closing the parent top level context

        from bin/erubi-render:117:in 'ErubiRenderer#render_template'
        from bin/erubi-render:31:in 'ErubiRenderer#run'
        from bin/erubi-render:152:in '<main>'
```

But thanks to these adjustments, Herb can render these templates now without any exceptions at runtime.

`herb render test.html.erb`
```txt [Evaluated Output]
Hello World
```

Thanks to this advanced understanding of HTML+ERB documents, we can provide better ergonomics when working with templates. We're also certain that this deep understanding will enable us to optimize runtime performance in the future.


## Parser Improvements

The parser now uses a two-pass algorithm for HTML tag matching to better handle ERB control flow boundaries and provide more accurate and actionable error messages.

Previously, HTML tags were matched during parsing (single-pass), which caused issues when tags appeared across ERB control flow boundaries. This would incorrectly report errors or miss mismatched tags because the parser couldn't understand that ERB control flow structures like `<% if %>` create scope boundaries.

This allows the parser to produce more accurate and actionable error messages:

```erb
<main>
  <div>
    <p>
      </span>
    </div>
  </p>
</main>
```

Previously, the parser couldn't match and recover as easily when it encountered out-of-order closing tags.

Another interesting aspect of this improvement can be demonstrated with the following example. We can see that this template might produce invalid HTML in the case when `valid?` is `false`.

:::code-group

```txt [Template]
<div>
  <% if valid? %>
    <h1>Title
  <% end %>
  </h1>
</div>
```

```ruby [Extracted Ruby]

     if valid?

     end

·
```


```html [Extracted HTML]
<div>

    <h1>Title

  </h1>
</div>
```

```erb [Improved Errors in v0.8]
<div>
  <% if valid? %>
    <h1>Title
  <% end %>
  </h1>
</div>
```
:::

If the parser only looked at the extracted HTML and the extracted Ruby code individually, it couldn't detect that something about this template is wrong, since these individual pieces are each valid in their respective language.



## Internal Memory and Performance Improvements

### Arena Allocator Implementation

We implemented a page-based Arena Allocator along with visual debug helpers to improve memory management throughout the parser and lexer.

![Visual diagram of arena allocator memory layout showing page-based allocation](/blog/whats-new-in-herb-v0-8/arena-memory-layout.png)

The Arena Allocator is currently not used for allocations yet, but we're planning to integrate it in the next release. This will bring better performance, a smaller memory footprint, fewer memory leaks, and improved ergonomics when allocating memory in C.


### `hb_string_T`

We introduced a new `hb_string_T` struct for more efficient string handling throughout the codebase. We aren't using this new struct everywhere yet, but we're planning to fully migrate to it across the entire codebase.

### Memory Improvements

We fixed several memory leaks and reduced the number of allocations needed for parsing and lexing. At this point, I want to give a big thank you to [Tim Kächele](https://github.com/timkaechele) for all his contributions in this area of the codebase. It's very much appreciated!


## Future Work

As you can see from this feature-packed release, there's tremendous potential for future improvements. While Herb v0.8 brings significant enhancements across the ecosystem, we're just getting started. Here's what's on the horizon:

### Linter Enhancements

**New Linter Rules**
We have around [60 linter rule proposals](https://github.com/marcoroth/herb/issues?q=is%3Aopen%20is%3Aissue%20label%3Alinter-rule) in the pipeline, covering accessibility, performance, security, and best practices. Some examples include:
- Accessibility rules for ARIA attributes and semantic HTML
- Performance rules for optimizing rendering paths
- Security rules for detecting XSS vulnerabilities
- Rails-specific rules for proper helper usage

**Autocorrectors for Linter Rules**
While the new `--fix` option is a great start, many linter rules still lack autocorrectors. We're working to expand autocorrection coverage, making it even easier to maintain clean, consistent templates automatically.

### Engine & Performance

**Action View Performance Improvements**
By leveraging Herb's deep understanding of HTML+ERB structure, we can optimize template compilation and runtime performance specifically for Rails applications, potentially reducing rendering times and memory usage.

**Rails Integration**
Deeper integration of Herb into Rails through [ReActionView](https://reactionview.dev).

**Reactive ERB Templates in ReActionView**
We're exploring reactive template rendering that can selectively re-render portions of your templates when data changes, bringing a more modern approach to server-side rendering without sacrificing the simplicity of ERB.

### Language Server Features

**Additional Code Actions**

- Extract to partial refactoring
- Convert inline styles to CSS classes
- Rewrite legacy helpers to modern equivalents
- Convert ERB to tag helpers and vice versa

**Folding Ranges**
Support for code folding in editors, making it easier to navigate large templates by collapsing sections of HTML, ERB blocks, and control flow structures.

**"Unnecessary" Diagnostics**
Visual indicators for unused variables, redundant code, and other opportunities for cleanup, helping you keep your templates lean and maintainable.

### Stimulus LSP Integration

The Stimulus LSP will be updated to fully leverage Herb's new capabilities, providing even better autocomplete, validation, and refactoring tools for Stimulus controllers and actions within your HTML+ERB templates.

### Parser & Core Improvements

**Arena Allocator Integration**
The newly implemented Arena Allocator will be integrated throughout the parser and lexer, bringing:
- Improved performance through better memory locality
- Reduced memory footprint
- Fewer memory leaks
- Simpler memory management patterns when working in C

**Herb String Migration**
Complete migration to the new `hb_string_T` struct across the entire codebase for more efficient string handling and reduced allocation overhead.

**Prism Node Integration**
Optional exposure of Prism AST nodes alongside Herb's HTML parsing, enabling more sophisticated Ruby code analysis within templates for advanced linter rules and refactoring tools.

**ActionView Tag Helper Transformation**
Optional transformation of Rails tag helpers (like `link_to`, `form_with`) into their equivalent HTML element nodes, enabling consistent linting and formatting regardless of whether templates use raw HTML or Rails helpers.

### CLI Improvements

**Unified Herb CLI**
A shared CLI tool that brings together all Herb functionality, parsing, linting, formatting, and analysis, under a single, cohesive command-line interface.

**Standalone CLI Distribution**
A standalone binary distribution that doesn't require Node.js installation, making it easier to integrate Herb into any development workflow or CI/CD pipeline.

### Native JRuby and TruffleRuby Support

We already brought Herb's capabilities to the Java ecosystem with the Herb v0.8 release. However, this doesn't automatically make the `herb` gem compatible with JRuby and TruffleRuby. We are looking to integrate with these runtimes to ensure Herb can become the universal HTML+ERB toolkit across all major Ruby implementations.

### Migration Tools

**Haml → HTML+ERB**
Automated migration tools to convert Haml templates to HTML+ERB, making it easier for teams to adopt or transition between template languages while preserving functionality.

**Slim → HTML+ERB**
Similar migration tooling for Slim templates, providing a smooth path for teams looking to consolidate on HTML+ERB or explore different templating options.

---

We're excited about this roadmap and invite you to get involved! Check out the [open issues](https://github.com/marcoroth/herb/issues) or reach out if you'd like to help shape Herb's future.

If you have an idea on how Herb could help with improving the developer experience in your current workflow, please [**open an issue on GitHub**](https://github.com/marcoroth/herb/issues/new/choose) and let's discuss.

## Strategic Partnerships

As Herb and ReActionView continue to mature, it’s becoming clear that these projects have the potential to reshape how Rails applications, and Ruby web frameworks in general, approach the view layer.

To make that vision sustainable, I’m opening up **Strategic Company Partnerships**.

These partnerships are intended for companies who rely on the Rails and Hotwire ecosystem, care deeply about strong developer experience, are eager to build ambitious, server-side rendered applications, and want to support the next generation of Ruby web tooling built around modern, server-side rendering.

Strategic partners will:

* Directly support the ongoing development of **Herb**, **ReActionView**, and the wider **Herb Tools** ecosystem.
* Be recognized with their **company logo** on the Herb website, in the README, and in all upcoming **talks and keynote slides** at conferences and meetups on the topic.
* Have a direct line of communication to provide **early feedback**, **shape priorities**, and **collaborate on long-term goals**.

This is a way to support the long-term evolution of Ruby’s view layer and the tools that power it, and take part in building the next generation of Ruby web tooling for the Ruby Community.

If your company is interested in becoming a strategic partner, feel free to reach out to me (Marco) via [email](mailto:marco.roth@hey.com?subject=Herb%20Strategic%20Partnership) or through any of the socials listed on [my website](https://marcoroth.dev).

Let’s build the future of the Rails view layer together!

## Acknowledgments

The Herb project has been a labor of love and is served as an open source gift to the Ruby community. It has been built openly, iterated in public, and shaped by everyone who tested early builds, opened issues, contributed fixes, or simply shared feedback and encouragement along the way.

Seeing how far Herb has come in just half a year since its first public release in April 2025 is incredible. It wouldn’t have been possible without the enthusiasm, curiosity, and support of the Ruby community. I also learned such much that I wouldn't have learned if it wasn't for Herb.

I especially want to give a big thanks to all the conference and meetup organizers who gave me the opportunity to share what I have to say. I also want to give a heartfelt thank you to all contributors, sponsors, and supporters who helped make Herb what it is today.

To support the development of Herb, consider [sponsoring the project on GitHub](https://github.com/sponsors/marcoroth).

Your input, time, and belief in the project continue to drive its progress and make the ecosystem better for everyone. Thank you, and happy hacking!

~ Marco

---

P.S: If you are attending the [San Francisco Ruby Conference](https://sfruby.com) next week, come say hi. I will be [keynoting](https://sfruby.com/schedule/#reaction-view) and sharing some of the advancements mentioned in this post live on stage. I hope to see you there!
