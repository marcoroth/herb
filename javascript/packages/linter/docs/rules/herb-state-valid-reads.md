# Linter Rule: Validate how declared states are read

**Rule:** `herb-state-valid-reads`

## Description

Validates every read of a declared state. A state is read bare (`<%= attempts %>`, `<% if pending %>`, `<% unless pending %>`), as a predicate on a boolean (`pending?`), compared to a literal of its own type (`sort == "name"`), or switched over with literal `when` arms. A boolean attribute accepts the same read shapes, since its presence is a two-arm conditional (`disabled="<%= draft == "" %>"`). Anything else, a computed expression, a predicate on a non-boolean, or a comparison against a non-literal or a mismatched literal, is flagged.

## Rationale

The client resolves state reads itself, without the server. That works because every allowed shape is a lookup or a comparison both languages compute identically. A computed read (`attempts + 1`, `attempts > 3`) would need a Ruby evaluator in JavaScript, so the engine rejects it at compile time. An `unless` reads like an `if` with its arms inverted, so every `if` shape works there too.

The engine raises all of these as compile errors when the template renders. This rule reports the same findings in the editor first.

## Examples

### ✅ Good

```erb
<%# herb:slots client %>
<%# herb:state (pending: false, attempts: 0, sort: "name") %>

<p><%= attempts %></p>

<% if pending? %>Sending<% else %>Sent<% end %>

<% if sort == "name" %>By name<% elsif sort == "date" %>By date<% end %>

<% case sort %>
<% when "name" %>By name
<% when "date" %>By date
<% end %>
```

```erb
<%# herb:slots client %>
<%# herb:state (draft: "") %>

<input value="<%= draft %>" autocomplete="off">
<button disabled="<%= draft == "" %>">Send</button>
```

### 🚫 Bad

```erb
<%# herb:slots client %>
<%# herb:state (pending: false, attempts: 0, sort: "name") %>

<p><%= attempts + 1 %></p>

<% if attempts > 3 %>Too many<% end %>


<% if attempts? %>Tried<% end %>

<% if sort == params[:sort] %>Current<% end %>

<% if sort == 3 %>Odd<% end %>
```

## Limits

The rule matches state names by token, so an expression that merely contains a declared name is flagged as computing with it. With a state named `sort`, both `t("sort.by")` and `f.text_field :sort` draw the offense. The engine rejects the same expressions at compile time, so the linter mirrors it. Short generic state names collide easily; a more specific name avoids the whole class.

A conditional whose first arm reads no state compiles as a server conditional, and a state read in a later arm is silently inert at runtime. The rule stays quiet on that shape today, matching the engine. Put the state arm first when the client should drive the branch.

## References

\-
