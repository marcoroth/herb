# Linter Rule: Disallow ERB silent tags in HTML attribute names

**Rule:** `erb-no-silent-tag-in-attribute-name`

## Description

Disallow the use of ERB silent tags (`<% ... %>`) inside HTML attribute names. These tags introduce Ruby logic that does not output anything, and placing them in attribute names leads to malformed HTML or completely unpredictable rendering.

## Rationale

HTML attribute names, ideally, must be valid, statically defined strings. Placing ERB silent tags (`<% ... %>`) that don't output anything inside attribute names might result in invalid HTML and is confusing. These cases are rarely intentional and almost always indicate a mistake or misuse of ERB templating.

## Examples

### ✅ Good

```erb
<div data-<%= key %>-target="value"></div>
<div <%= data_attributes_for(user) %>></div>
```

### 🚫 Bad

```erb
<div data-<% key %>-id="value"></div>

<div data-<%# key %>-id="thing"></div>

<div data-<%- key -%>-id="thing"></div>
```

## References

\-
