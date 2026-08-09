# Linter Rule: Prefer explicit route helpers over implicit polymorphic URLs

**Rule:** `actionview-no-implicit-polymorphic-url`

## Description

Prefer using explicit Rails route helpers (e.g., `profile_path(@profile)`) over passing model objects, or Arrays of route parts, directly to `link_to`, which relies on implicit polymorphic routing to generate the URL.

## Rationale

When you pass a model object directly to `link_to` (e.g., `<%= link_to "Profile", @profile %>`), Rails uses `polymorphic_path` behind the scenes to infer the URL. While convenient, this implicit behavior makes it unclear what URL will be generated, a reader must know the model's class and routing conventions to determine the target path.

The same goes for an Array of route parts, as in `<%= link_to "User", [:admin, @user] %>`, which Rails resolves the same way: it joins the parts into a route name and calls it. The route it lands on, `admin_user_path`, is spelled out nowhere in the template, even though every part of the name is right there in the Array.

The template stops describing what it renders. `<%= link_to "Profile", @profile %>` and `<%= link_to "Profile", profile_path(@profile) %>` produce the same `<a href>`, but only the second one says so. With the first, the rendered output depends on a class the template never names, so answering "where does this link go?" means leaving the template and reconstructing the model's class and the routes it maps to.

Implicit routing also depends on the model's class name matching a route, so renaming a model, using STI, or introducing namespaced routes can silently break the generated URL. Explicit route helpers like `profile_path` are easy to grep for across the codebase, making it straightforward to find all links to a given resource. They make the developer's intent unambiguous, reducing the chance of subtle routing bugs.

Using explicit route helpers also enables better static analysis. Tools like Herb can determine the target path from the helper name alone without needing to resolve the model's class at runtime, making it possible to detect broken links, analyze navigation structure, and provide more accurate diagnostics. That is the difference between output that can be traced back to the template and output that can only be observed by rendering it: the helper name is a fact about the template, while the model's class is a fact about the request that produced it.

## Notes

This rule applies to the URL argument of `link_to`, which is the argument Rails resolves through `polymorphic_path`. That is the second argument for `link_to "Profile", @profile`, and the first one for `link_to @profile` and for `link_to @profile do ... end`, where the same argument doubles as the link text or the block supplies it. Three shapes are reported there: a variable, an Array of route parts, and a model read off another object with a method call.

For an Array, the suggested route helper is built from the parts themselves, the same way Rails builds the route name: every part contributes a segment, and the model objects among them become the arguments. `[:admin, @user]` becomes `admin_user_path(@user)`, `[@post, @comment]` becomes `post_comment_path(@post, @comment)`, `[@post, :comments]` becomes `post_comments_path(@post)`, and a Symbol is read the same way wherever it sits, so `[@user, :blog, @post]` becomes `user_blog_post_path(@user, @post)`.

Only Symbols, Strings and plain variables carry a name the route can be built from. An Array holding anything else is still reported, but without a suggested helper, since the alternative would be guessing at the route name: `[:admin, @user.account]` and `[*@parents, @user]` say nothing about where they land, and `[:admin, User]` routes through `User.model_name.route_key`, which means pluralizing a class name. What the report has to offer there is `polymorphic_path`, which at least says in the template that the route is resolved from the model.

A String is reported even though Rails raises an `ArgumentError` for it and asks for a Symbol, since `["admin", @user]` names the same route the working version does, and `admin_user_path(@user)` is the fix for both problems at once. A method call in the URL argument is reported the same way an Array of unnamed parts is, without a suggested helper: `<%= link_to "Account", @user.account %>` says nothing about the route it resolves to beyond the name of the reader, and `account_path` is a guess this rule would rather not make.

Rails compacts the Array before it resolves the route, so `nil` is dropped from it and `[nil, @user]` still routes to `user_path(@user)`. An Array with nothing left after that raises `ArgumentError: Nil location provided. Can't build URI.`, so `<%= link_to "User", [] %>` and `<%= link_to "User", [nil] %>` are reported at the `error` severity: this is not a link that renders a surprising URL, it is a link that takes the page down with it, and the template says so on its own.

The reported method calls are the ones that read like a model: a call on a receiver, taking no arguments and no block, as in `@user.account`, `user.account`, `@user&.account` or `@post.author.profile`. A call taking arguments could be anything, `params[:return_to]` and `request.referer` hold a URL rather than a model, and a bare `current_user` is indistinguishable from a helper that returns a String, so none of those are reported.

Rails routes an unsaved record to the collection instead, so `<%= link_to "Save", [:admin, @user] %>` with a new `@user` goes to `admin_users_path`, not to the `admin_user_path(@user)` the report suggests. Whether a record is persisted is a fact about the request, not about the template, so the suggested helper is the one for a persisted record.

Local variables are reported the same way instance variables are, so `<%= link_to user.name, user %>` inside an `each` block is reported and suggests `user_path(user)`. The URL is just as implicit either way, and where the variable came from does not change what Rails does with it.

A bare method call, on the other hand, is not reported: `<%= link_to "Profile", current_user %>` could be a helper that returns a String, and the name of a helper is not the name of a model, so there is nothing worth suggesting. This is also the one place the rule is inconsistent for a reason it cannot help. A partial that takes a `user` local reads it as a method call, since nothing in the template assigns it, so `<%= link_to user.name, user %>` is reported in an `each` block and skipped in `_user.html.erb`.

Using `link_to` with an explicit named route helper like `articles_path`, with a Hash of URL options, or with a hardcoded String path like `"/articles"` is perfectly fine and will not trigger this rule. Passing a model object to a route helper, as in `post_path(@post)`, is the suggested form and is never reported.

Calling `polymorphic_path(@profile)` or `polymorphic_url(@profile)` yourself is fine too. What this rule is about is the routing being implicit, not polymorphic routing itself, and there are cases where resolving the route from the model is exactly what you want, such as a partial rendered for several model types. Naming the helper says so in the template, keeps the call greppable, and leaves the reader with a route to look up rather than a class to infer.

Variables named after a URL are skipped, because they usually hold one already rather than a model to route from. `<%= link_to @url, @url %>` and `<%= link_to "Edit", @edit_card_url %>` are common in mailer templates, where the mailer builds the absolute URL itself and there is no route helper to reach for. The same applies to a Hash of URL options behind a name like `@link_options`. Names are matched per underscore-separated segment, so `@start_url_ial1` is skipped while `@security` and `@burlington` are not. Since only the name is available to the parser, a model genuinely named `@url_shortener` is skipped too, which is the cheaper of the two mistakes.

The same name check applies to local variables and to method calls, so `<%= link_to "Link", link_url %>` and `<%= link_to "Avatar", @user.avatar_url %>` are skipped. It does not apply inside an Array: it exists for a value that already holds a URL, and a route part is never that, so `[:admin, @user_url]` is reported like any other Array.

## Configuration

This rule reports at the `info` severity, so it never fails a run under the default `failLevel` of `error`. That reflects what the rule can and cannot see: whether an instance variable holds a model or a String is not knowable from the template, so a small share of reports will be about a value that was already a URL. To raise or lower it, or to turn the rule off, add to your [`.herb.yml`](/configuration):

```yaml [.herb.yml]
linter:
  rules:
    actionview-no-implicit-polymorphic-url:
      severity: warning
```

The empty Array is the exception. It reports at `error` whatever the rule is configured to, because it is not a heuristic: that template raises when it renders, and the severity should say so. Turning the rule off turns that report off with it.

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
<%= link_to "User", admin_user_path(@user) %>
```

```erb
<%= link_to "Comment", post_comment_path(@post, @comment) %>
```

```erb
<%= link_to "Profile", polymorphic_path(@profile) %>
```

```erb
<%= link_to "User", polymorphic_path([:admin, @user]) %>
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

```erb
<%= link_to "User", [:admin, @user] %>
```

```erb
<%= link_to "Comment", [@post, @comment] %>
```

```erb
<%= link_to "Comments", [@post, :comments] %>
```

```erb
<%= link_to "Users", [:admin, User] %>
```

```erb
<%= link_to "Account", @user.account %>
```

```erb
<%= link_to "User", [] %>
```

```erb
<% @users.each do |user| %>
  <%= link_to user.name, user %>
<% end %>
```

## References

* [Rails `link_to` helper documentation](https://api.rubyonrails.org/classes/ActionView/Helpers/UrlHelper.html#method-i-link_to)
* [Rails `polymorphic_path` documentation](https://api.rubyonrails.org/classes/ActionDispatch/Routing/PolymorphicRoutes.html)
