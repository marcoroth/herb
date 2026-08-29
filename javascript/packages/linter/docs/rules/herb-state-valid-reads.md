# Linter Rule: Validate how declared states are read

**Rule:** `herb-state-valid-reads`

## Description

Validates every read of a declared state. A state is read bare (`<%= attempts %>`, `<% if pending %>`, `<% unless pending %>`), with a `?` on the end (`pending?`), compared to a literal of its own type (`sort == "name"`, `sort != "date"`), ordered against an Integer literal when it is an Integer (`attempts > 3`), or compared with another state of the same kind (`counter1 > counter2`), or switched over with literal `when` arms. Those conditions also combine with `&&` and `||` (`pending? || failed?`), as long as every side reads a state. A boolean attribute accepts the same read shapes, since its presence is a two-arm conditional (`disabled="<%= draft == "" %>"`). Anything else, a computed expression, a comparison against a non-literal or a mismatched literal, or a combination that mixes a state with server Ruby, is flagged.

`!` negates any of these. It flips a comparison (`!(count > 3)` becomes `count <= 3`), swaps `blank?` and `present?`, and turns a plain read into a falsy check. Negating a whole `&&` or `||` distributes over its parts by De Morgan, so `!(a && b)` compiles as `!a || !b` and nests to any depth. `not` reads the same way.

The `?` spelling reads a state for its truth, exactly as the bare name does, and the compiler drops the `?` from the source it hands the server. It carries no extra meaning on a state that is not a boolean, so `<% if draft? %>` asks the same question as `<% if draft %>`. For "does this string hold anything", reach for `draft.present?`.

Six Ruby predicates are read as the comparison they stand for, each on the state kinds that answer it.

| Predicate  | Reads                              | Resolves as                                  |
|------------|------------------------------------|----------------------------------------------|
| `nil?`     | every state                        | `state == nil`                               |
| `positive?` | an Integer state | `state > 0` |
| `zero?`    | an Integer state                   | `state == 0`                                 |
| `one?`     | an Integer state                   | `state == 1`                                 |
| `empty?`   | a String or a Symbol state         | `state == ""`                                |
| `blank?`   | a Boolean, a String or a Nil state | ActiveSupport blankness, whitespace included |
| `present?` | a Boolean, a String or a Nil state | the opposite of `blank?`                     |

An expression the client can resolve also stands on its own as an output, so `<%= draft == "" %>` and `<%= draft.blank? %>` print `true` or `false` and stay current as the state changes.

`to_s` reads a state of any kind as a String, matching Ruby down to `nil.to_s` being `""`. `length` and `size` read the character count of a String or a Symbol state, either compared to an Integer literal (`draft.length > 3`) or printed on its own (`<%= draft.length %>`). Both spell the same thing, so `size` compiles exactly like `length`.

A transform compares against a literal or against another declared state, so `draft.to_s == filter` works. Only one side of a comparison may carry a transform.

`count` is not supported. Unlike `Array#count`, `String#count` takes a character set (`"hello".count("a-z")`) and raises without one, so there is nothing to resolve on the client.

## Rationale

The client resolves state reads itself, without the server. That works because every allowed shape is a lookup or a comparison both languages compute identically, and a `&&`/`||` combination of those shapes is resolved one condition at a time. A computed read (`attempts + 1`, `attempts * 2 > 3`) would need a Ruby evaluator in JavaScript, so the engine rejects it at compile time. A combination like `pending? && current_user.admin?` has the same problem on its server side, since the client holds no value for it. An `unless` reads like an `if` with its arms inverted, so every `if` shape works there too.

`length` on an Integer is flagged too, and `size` especially. `Integer#size` is the machine byte width, so `count.size` answers `8` rather than a length, which is the kind of quiet wrong answer worth refusing outright. On the client the count is taken by codepoint, matching Ruby, so an emoji counts as one character rather than the two UTF-16 units JavaScript's own `String#length` would report.

A predicate on a state kind that cannot answer it is flagged the same way. `count.empty?` raises `NoMethodError` on an Integer, and `count.blank?` answers `false` for every Integer, so both are mistakes worth catching before the page renders. `one?` is the one predicate the compiler rewrites, since Ruby defines `one?` on Enumerable and not on Integer, so `count.one?` reaches the server as `count == 1`.

The engine raises all of these as compile errors when the template renders. This rule reports the same findings in the editor first.

## Examples

### ✅ Good

```erb
<%# herb:slots client %>
<%# herb:state (pending: false, attempts: 0, sort: "name") %>

<p><%= attempts %></p>

<% if pending? %>Sending<% else %>Sent<% end %>

<% if sort == "name" %>By name<% elsif sort == "date" %>By date<% end %>

<% if pending? || attempts > 3 %>Hold on<% else %>Ready<% end %>

<% if !pending %>Idle<% end %>

<% if !(attempts > 3) %>Room to retry<% end %>

<% if !(pending && attempts > 3) %>Fine<% end %>

<% case sort %>
<% when "name" %>By name
<% when "date" %>By date
<% end %>
```

```erb
<%# herb:slots client %>
<%# herb:state (draft: "", count: 0) %>

<% if draft.blank? %>Nothing to send<% end %>

<% if count.zero? %>No messages<% elsif count.one? %>One message<% end %>

<% if count.positive? %>Some messages<% end %>

<% if draft.length > 280 %>Too long<% end %>

<p><%= draft == "" %></p>
<p><%= draft.length %></p>
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

<% if pending? && current_user.admin? %>Retry as admin<% end %>

<% if sort == params[:sort] %>Current<% end %>

<% if sort == 3 %>Odd<% end %>

<% if attempts.empty? %>None<% end %>

<% if attempts.blank? %>None<% end %>

<% if attempts.length > 3 %>Many<% end %>

<% if sort.count("a") > 1 %>Twice<% end %>
```

## Limits

The rule matches state names by token, so an expression that merely contains a declared name is flagged as computing with it. With a state named `sort`, both `t("sort.by")` and `f.text_field :sort` draw the offense. The engine rejects the same expressions at compile time, so the linter mirrors it. Short generic state names collide easily; a more specific name avoids the whole class.

A conditional whose first arm reads no state compiles as a server conditional, and a state read in a later arm is silently inert at runtime. The rule stays quiet on that shape today, matching the engine. Put the state arm first when the client should drive the branch.

## References

\-
