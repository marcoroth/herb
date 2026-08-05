# Linter Rule: Prefer explicit route helpers over implicit polymorphic URLs

**Rule:** `actionview-no-implicit-polymorphic-url`

## Description

Prefer using explicit Rails route helpers (e.g., `profile_path(@profile)`) over passing model objects directly to `link_to`, which relies on implicit polymorphic routing to generate the URL.

## Rationale

When you pass a model object directly to `link_to` (e.g., `<%= link_to "Profile", @profile %>`), Rails uses `polymorphic_path` behind the scenes to infer the URL. While convenient, this implicit behavior makes it unclear what URL will be generated, a reader must know the model's class and routing conventions to determine the target path.

The template stops describing what it renders. `<%= link_to "Profile", @profile %>` and `<%= link_to "Profile", profile_path(@profile) %>` produce the same `<a href>`, but only the second one says so. With the first, the rendered output depends on a class the template never names, so answering "where does this link go?" means leaving the template and reconstructing the model's class and the routes it maps to.

Implicit routing also depends on the model's class name matching a route, so renaming a model, using STI, or introducing namespaced routes can silently break the generated URL. Explicit route helpers like `profile_path` are easy to grep for across the codebase, making it straightforward to find all links to a given resource. They make the developer's intent unambiguous, reducing the chance of subtle routing bugs.

Using explicit route helpers also enables better static analysis. Tools like Herb can determine the target path from the helper name alone without needing to resolve the model's class at runtime, making it possible to detect broken links, analyze navigation structure, and provide more accurate diagnostics. That is the difference between output that can be traced back to the template and output that can only be observed by rendering it: the helper name is a fact about the template, while the model's class is a fact about the request that produced it.

## Notes

This rule only applies when an instance variable is passed as the URL argument to `link_to`, which is the argument Rails resolves through `polymorphic_path`. That is the second argument for `link_to "Profile", @profile`, and the first one for `link_to @profile` and for `link_to @profile do ... end`, where the same argument doubles as the link text or the block supplies it.

Using `link_to` with an explicit named route helper like `articles_path`, with a Hash of URL options, or with a hardcoded String path like `"/articles"` is perfectly fine and will not trigger this rule. Passing a model object to a route helper, as in `post_path(@post)`, is the suggested form and is never reported.

Calling `polymorphic_path(@profile)` or `polymorphic_url(@profile)` yourself is fine too. What this rule is about is the routing being implicit, not polymorphic routing itself, and there are cases where resolving the route from the model is exactly what you want, such as a partial rendered for several model types. Naming the helper says so in the template, keeps the call greppable, and leaves the reader with a route to look up rather than a class to infer.

Instance variables named after a URL are skipped, because they usually hold one already rather than a model to route from. `<%= link_to @url, @url %>` and `<%= link_to "Edit", @edit_card_url %>` are common in mailer templates, where the mailer builds the absolute URL itself and there is no route helper to reach for. The same applies to a Hash of URL options behind a name like `@link_options`. Names are matched per underscore-separated segment, so `@start_url_ial1` is skipped while `@security` and `@burlington` are not. Since only the name is available to the parser, a model genuinely named `@url_shortener` is skipped too, which is the cheaper of the two mistakes.

## Configuration

This rule reports at the `info` severity, so it never fails a run under the default `failLevel` of `error`. That reflects what the rule can and cannot see: whether an instance variable holds a model or a String is not knowable from the template, so a small share of reports will be about a value that was already a URL. To raise or lower it, or to turn the rule off, add to your [`.herb.yml`](/configuration):

```yaml [.herb.yml]
linter:
  rules:
    actionview-no-implicit-polymorphic-url:
      severity: warning
```

## Examples

### ✅ Good

```erb
<%= link_to "Profile", profile_path(@profile) %>
```

```erb
<%= link_to "Edit Profile", edit_profile_path(@profile) %>
```

```erb
<%= link_to @user.name, user_path(@user) %>
```

```erb
<%= link_to "View Post", post_path(@post), class: "btn" %>
```

```erb
<%= link_to "Articles", articles_path %>
```

```erb
<%= link_to "Articles", "/articles" %>
```

```erb
<%= link_to "Profile", polymorphic_path(@profile) %>
```

```erb
<%= link_to "Profile", polymorphic_url(@profile) %>
```

### 🚫 Bad

```erb
<%= link_to @profile %>
```

```erb
<%= link_to "Profile", @profile %>
```

```erb
<%= link_to @user.name, @user %>
```

```erb
<%= link_to "View Post", @post, class: "btn" %>
```

## References

* [Rails `link_to` helper documentation](https://api.rubyonrails.org/classes/ActionView/Helpers/UrlHelper.html#method-i-link_to)
* [Rails `polymorphic_path` documentation](https://api.rubyonrails.org/classes/ActionDispatch/Routing/PolymorphicRoutes.html)
