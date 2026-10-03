# Linter Rule: Require a format in template file names

**Rule:** `erb-require-template-format`

## Description

Requires every `.erb` template to name its format in the file name, as in `home.html.erb` instead of `home.erb`. Herb templates are exempt, since the `.herb` extension already means HTML.

## Rationale

An ERB template can produce anything: HTML, plain text, JSON, a shell script. The only place that says which one is the file name, and `home.erb` says nothing. Herb can only treat an ERB template as HTML when its name says so, and the same goes for editors and other tools deciding how to read the file.

The framework rendering the template relies on the format too. Rails reads it from the file name, and a template without one is treated as a match for every format, so the same `home.erb` answers HTML, JSON and XML requests alike. Other frameworks such as Roda and Sinatra can render formatted names as well, through Roda's `engine: "html.erb"` option or Sinatra's `erb :"index.html"`.

## Examples

### ✅ Good

```erb [app/views/pages/home.html.erb]
<h1>Welcome</h1>
```

```erb [app/views/cards/_card.html.erb]
<div class="card"><%= card.title %></div>
```

```erb [app/views/pages/home.html+phone.erb]
<h1>Welcome</h1>
```

```erb [app/views/posts/index.turbo_stream.erb]
<%= turbo_stream.append "posts", @post %>
```

```erb [app/views/pages/home.herb]
<h1>Welcome</h1>
```

### 🚫 Bad

```erb [app/views/pages/home.erb]
<h1>Welcome</h1>
```

```erb [app/views/pages/home+phone.erb]
<h1>Welcome</h1>
```

```erb [views/index.erb]
<h1>Welcome</h1>
```

### Notes

::: tip Which files are checked
The rule checks every `.erb` file the linter processes, wherever it lives. The default `files.include` patterns only match formatted ERB templates such as `**/*.html.erb`, so `herb-lint` only checks a bare `home.erb` when a pattern in your own `files.include` matches it, such as `**/*.erb`.
:::

::: tip What counts as a format
Any segment between the name and the handler counts as a format, so `model.rb.erb` and `nginx.conf.erb` pass. A locale on its own also passes, even though Rails reads `home.de.erb` as a German template with no format.
:::

## References

- [Action View - Templates](https://guides.rubyonrails.org/action_view_overview.html#templates)
