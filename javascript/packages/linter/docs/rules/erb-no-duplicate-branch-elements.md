# Linter Rule: Disallow duplicate elements across conditional branches

**Rule:** `erb-no-duplicate-branch-elements`

## Description

Disallow the same HTML elements wrapping content in every branch of an ERB conditional (`if/elsif/else`, `unless/else`, `case/when/else`). When all branches share identical wrapper elements, those elements should be hoisted outside the conditional. Only flags when all branches are covered (i.e., an `else` clause is present).

Elements that are byte-for-byte identical in every branch can always be moved out, and are reported as warnings. A shared tag whose *content* differs between branches can only be extracted by wrapping the entire conditional in it, so it is reported as a hint, and only when that rewrite is available: every branch must consist of nothing but shared elements, and only one of them may differ in content. Anything else would require splitting the conditional into several, which duplicates the condition instead of the markup, so it is not reported.

`pre`, `textarea`, `script`, and `style` are never used as the wrapper. Moving the conditional inside them would put the branch markup on its own indented lines, which changes the text they render or submit. They are still hoisted out of the conditional when they are identical in every branch, since that moves the element whole and leaves its content untouched.

## Autofix

Hoisting an identical element out of the conditional, and wrapping the conditional in a shared tag, are both safe and are applied by `--fix`.

When *every* branch is identical the whole conditional is redundant, and removing it deletes the condition along with it. That fix is only applied by `--fix-unsafely`, because the condition may do more than pick a branch:

```erb
<% if (result = compute) %>
  <div>Same</div>
<% else %>
  <div>Same</div>
<% end %>

<%= result %>
```

Removing the conditional here drops the assignment and leaves `result` undefined. The same applies to a condition that calls a method for its side effects.

## Rationale

Duplicated wrapper elements across all branches of a conditional are unnecessary repetition. Moving them outside the conditional reduces template size, makes the structure clearer, and avoids the risk of branches getting out of sync when one is updated but others are forgotten.

## Examples

### ✅ Good

Elements hoisted outside the conditional:

```erb
<div class="wrapper">
  <% if condition %>
    Hello World
  <% else %>
    Goodbye World
  <% end %>
</div>
```

Branches with different elements:

```erb
<% if condition %>
  <div>Hello World</div>
<% else %>
  <span>World</span>
<% end %>
```

Same tag name but different attributes:

```erb
<% if condition %>
  <div class="a">Hello World</div>
<% else %>
  <div class="b">World</div>
<% end %>
```

Incomplete branch coverage:

```erb
<% if condition %>
  <div>Hello World</div>
<% end %>
```

A shared tag with differing content alongside a sibling that has to stay inside the conditional. Wrapping the conditional in `<p>` would move the links inside it too:

```erb
<% if condition %>
  <p class="mt-3">Hello World</p>
  <%= link_to "Hello", hello_path %>
<% else %>
  <p class="mt-3">Goodbye World</p>
  <%= link_to "Goodbye", goodbye_path %>
<% end %>
```

More than one shared tag with differing content, where no single tag can wrap the conditional:

```erb
<% if condition %>
  <h1>Hello</h1>
  <p>Hello World</p>
<% else %>
  <h1>Goodbye</h1>
  <p>Goodbye World</p>
<% end %>
```

A shared tag whose content is whitespace-sensitive. Wrapping the conditional in `<pre>` would change the text it renders:

```erb
<% if condition %>
  <pre>Hello World</pre>
<% else %>
  <pre>Goodbye World</pre>
<% end %>
```

### 🚫 Bad

```erb
<% if condition %>
  <div>Hello World</div>
<% else %>
  <div>Goodbye World</div>
<% end %>
```

```erb
<% if condition %>
  <div>Hello World</div>
<% elsif other %>
  <div>Goodbye World</div>
<% else %>
  <div>Default</div>
<% end %>
```

```erb
<% case value %>
<% when "a" %>
  <div>Hello World</div>
<% when "b" %>
  <div>Goodbye World</div>
<% else %>
  <div>Default</div>
<% end %>
```

```erb
<% if condition %>
  <div><p>Hello World</p></div>
<% else %>
  <div><p>Goodbye World</p></div>
<% end %>
```

## References

\-
