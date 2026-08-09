# Linter Rule: Disallow calling `.html_safe` on String literals

**Rule:** `actionview-no-unnecessary-html-safe`

## Description

Disallow ERB output tags that consist of nothing but a String literal with `.html_safe` called on it, like `<%= "<strong>Sale</strong>".html_safe %>`.

## Rationale

Calling `.html_safe` on a String literal only tells Action View to skip escaping content that is already spelled out in the template. Writing that content directly produces byte-for-byte the same output, without the ERB tag, the String allocation and the `ActiveSupport::SafeBuffer` wrapper.

Because the content is static, `.html_safe` is not protecting anything either. There is no dynamic value involved that escaping could ever apply to, so the call is pure overhead. It does make the template look like it deliberately opts out of Rails' escaping, which makes the `.html_safe` calls that *are* worth reviewing harder to spot.

Note that dropping just the `.html_safe` call is not equivalent, since Action View escapes the remaining literal: `<%= "<strong>Sale</strong>" %>` renders as `&lt;strong&gt;Sale&lt;/strong&gt;`. The content has to move out of the ERB tag for the output to stay the same.

## Examples

### ✅ Good

```erb
<div style="display: none;"></div>
```

```erb
<p><strong>Sale</strong></p>
```

```erb
&copy; 2026
```

### 🚫 Bad

```erb
<div <%= 'style="display: none;"'.html_safe %>></div>
```

```erb
<p><%= "<strong>Sale</strong>".html_safe %></p>
```

```erb
<%= "&copy; 2026".html_safe %>
```

## References

* [Rails `String#html_safe` API](https://api.rubyonrails.org/classes/String.html#method-i-html_safe)
* [Rails `ActiveSupport::SafeBuffer` API](https://api.rubyonrails.org/classes/ActiveSupport/SafeBuffer.html)
* [Rails Security Guide: Cross-Site Scripting (XSS)](https://guides.rubyonrails.org/security.html#cross-site-scripting-xss)
