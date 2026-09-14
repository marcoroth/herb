# Linter Rule: Disallow calling `.html_safe` on String literals

**Rule:** `actionview-no-unnecessary-html-safe`

## Description

Disallow ERB output tags that consist of nothing but a String literal with `.html_safe` called on it, like `<%= "<strong>Sale</strong>".html_safe %>`.

## Rationale

Calling `.html_safe` on a String literal only tells Action View to skip escaping content that is already spelled out in the template. Writing that content directly produces byte-for-byte the same output, without the ERB tag, the String allocation and the `ActiveSupport::SafeBuffer` wrapper.

Because the content is static, `.html_safe` is not protecting anything either. There is no dynamic value involved that escaping could ever apply to, so the call is pure overhead. It does make the template look like it deliberately opts out of Rails' escaping, which makes the `.html_safe` calls that *are* worth reviewing harder to spot.

Note that dropping just the `.html_safe` call is not equivalent, since Action View escapes the remaining literal: `<%= "<strong>Sale</strong>" %>` renders as `&lt;strong&gt;Sale&lt;/strong&gt;`. The content has to move out of the ERB tag for the output to stay the same.

## Autofix

The offense is autocorrectable whenever the content can move into the template unchanged. In three cases it is reported without a fix, because writing the content directly would leave the template unparseable.

The first is content that is not balanced markup on its own, such as `"<div>"`, `"</div>"` or `"<b>a<i>b</i></b>"` with the tags crossed. Inlining it would change the element nesting of the surrounding document, even though the rendered bytes stay the same. The rule parses the content to decide this, so balanced content like `"<strong>Sale</strong>"`, `"<br>"` or `"<div>a</div><div>b</div>"` is still corrected.

The second is a literal inside an unquoted attribute value, such as `<div id=<%= "a b".html_safe %>>`. The value ends at the first ERB tag, so the content would not stay part of it.

The third is content containing the quote that encloses the attribute value. Note that `.html_safe` skips escaping, so unlike a plain `<%= %>` tag the quote is not turned into `&quot;`. Such a template already renders a broken attribute, and the fix is to escape the quote rather than to inline it.

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

## Configuration

This rule only applies to Action View projects, so it needs `framework` to be set:

```yaml
framework: actionview
```

## References

* [Rails `String#html_safe` API](https://api.rubyonrails.org/classes/String.html#method-i-html_safe)
* [Rails `ActiveSupport::SafeBuffer` API](https://api.rubyonrails.org/classes/ActiveSupport/SafeBuffer.html)
* [Rails Security Guide: Cross-Site Scripting (XSS)](https://guides.rubyonrails.org/security.html#cross-site-scripting-xss)
