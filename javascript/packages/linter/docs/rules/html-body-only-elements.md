# Linter Rule: Require content elements inside `<body>`

**Rule:** `html-body-only-elements`

## Description

Enforce that specific HTML elements are only placed within the `<body>` tag.

## Rationale

According to the HTML specification, certain elements are meant to contain content and should only appear within the `<body>` section of an HTML document. Placing content-bearing or interactive elements in the `<head>` section or outside the HTML structure can lead to:

- Unpredictable browser rendering behavior
- Accessibility issues for screen readers and assistive technologies
- SEO problems as search engines may not properly index misplaced content
- Validation errors and non-compliant HTML

This rule enforces proper document structure by ensuring semantic and content elements are correctly placed within the `<body>` element.

## Examples

### ✅ Good

```erb
<html>
  <head>
    <title>Page Title</title>
    <meta charset="utf-8">
  </head>

  <body>
    <header>
      <h1>Welcome</h1>
      <nav>
        <ul>
          <li>Home</li>
        </ul>
      </nav>
    </header>

    <main>
      <article>
        <section>
          <p>This is valid content.</p>
          <table>
            <tr><td>Data</td></tr>
          </table>
        </section>
      </article>
      <aside>
        <form>
          <input type="text" autocomplete="on">
        </form>
      </aside>
    </main>

    <footer>
      <h2>Footer</h2>
    </footer>
  </body>
</html>
```

### 🚫 Bad

```erb
<html>
  <head>
    <title>Page Title</title>
    <h1>Welcome</h1>

    <p>This should not be here.</p>

  </head>

  <body>
    <main>Valid content</main>
  </body>
</html>
```

```erb
<html>
  <head>
    <nav>Navigation</nav>

    <form>Form</form>

  </head>

  <body>
  </body>
</html>
```

## Across call sites

This rule also considers where a file is rendered. When the linter runs over a whole project it resolves the HTML ancestors that each call site places a file inside, following `render` calls and each template's conventional layout `yield`.

A partial holding body-only elements is reported when every call site renders it inside `<head>`, and left alone when every call site renders it inside `<body>`.

Action View helpers that render an element count as ancestors, so a `content_tag`, `tag.div` or `link_to` block nests what it wraps just like the equivalent HTML would.

The rule stays quiet whenever there is not enough information to be sure. A file nothing renders, and a chain that never reaches a layout, are both left alone. When only some call sites place the file in the wrong section, the offense is still reported and the call chain points at one that does.

Layout resolution follows Rails' naming convention and cannot see a controller declaring `layout "..."` or `layout false`.

## References

- [HTML Living Standard - The `body` element](https://html.spec.whatwg.org/multipage/sections.html#the-body-element)
- [MDN: HTML `document` structure](https://developer.mozilla.org/en-US/docs/Learn/HTML/Introduction_to_HTML/Document_and_website_structure)
