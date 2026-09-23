# ERB Syntax

ERB tags put Ruby into a template. This page covers the ERB every Rails template uses, and the few rules HTML+ERB adds on top. None of it is specific to Herb, so it applies to any `.html.erb` file.

## Displaying data

`<%= %>` runs a Ruby expression and writes the result into the page.

::: code-group
```erb [app/views/messages/show.html.erb]
<h1><%= @message.author %></h1>
<p>Posted <%= time_ago_in_words(@message.created_at) %> ago</p>
```
:::

The result is escaped, so a message body containing `<script>` is shown as text and never runs. Herb escapes for the place the tag sits, which matters inside attributes and `<script>` tags. [Escaping follows the context](/language/templates#escaping-follows-the-context) has the details.

### Unescaped output

`<%== %>` writes the result without escaping it, and so do `raw` and `.html_safe`.

::: code-group
```erb [app/views/messages/show.html.erb]
<div class="body"><%== @message.rendered_body %></div>
```
:::

Use it only for markup your app produced and trusts, such as HTML rendered from Markdown by a sanitizing renderer. Anything that came from a user has to go through `<%= %>`. The linter flags `raw` and `html_safe` in templates with [`erb-no-unsafe-raw`](/linter/rules/erb-no-unsafe-raw).

## Running Ruby

`<% %>` runs Ruby and writes nothing. It is how a template assigns a variable or opens a conditional, a loop or a block.

::: code-group
```erb [app/views/messages/index.html.erb]
<% unread = @messages.count(&:unread?) %>
<p><%= unread %> unread</p>
```
:::

## Comments

`<%# %>` is a comment. Nothing inside it reaches the output, and nothing inside it runs.

::: code-group
```erb [app/views/messages/index.html.erb]
<%# The list below is also rendered by the mobile layout %>
<ul>
</ul>
```
:::

A comment ends at the first `%>`, so it cannot contain one. An HTML comment, `<!-- -->`, is different, since it is sent to the browser and anyone can read it with View Source.

## Conditionals

`if`, `elsif`, `else` and `unless` each take their own tag, and `end` closes them.

::: code-group
```erb [app/views/messages/_message.html.erb]
<% if message.pinned? %>
  <span class="badge">Pinned</span>
<% elsif message.unread? %>
  <span class="dot"></span>
<% else %>
  <span class="read">Read</span>
<% end %>

<% unless message.author == current_user.name %>
  <button>Reply</button>
<% end %>
```
:::

A `case` works the same way, with `case` and each `when` in their own tags.

::: code-group
```erb [app/views/messages/_status.html.erb]
<% case message.status %>
<% when "sent" %>
  <span>Sent</span>
<% when "failed" %>
  <strong>Failed to send</strong>
<% else %>
  <em>Sending</em>
<% end %>
```
:::

To choose an attribute value, put the condition inside the attribute instead of around the element.

::: code-group
```erb [app/views/messages/_message.html.erb]
<li class="message <%= "unread" if message.unread? %>">
  <%= message.body %>
</li>
```
:::

## Loops

A loop is a block. The opening tag runs `each`, the markup in between repeats, and `end` closes it.

::: code-group
```erb [app/views/messages/index.html.erb]
<ul>
  <% @messages.each do |message| %>
    <li><%= message.body %></li>
  <% end %>
</ul>

<ol>
  <% @messages.each_with_index do |message, index| %>
    <li value="<%= index + 1 %>"><%= message.body %></li>
  <% end %>
</ol>
```
:::

`render` with a collection is often shorter, as in `<%= render @messages %>`, and it renders `_message.html.erb` once for each record.

## Blocks

A helper that takes a block, such as `form_with` or `content_tag`, uses `<%= %>` on the opening tag because the helper returns the markup to write. `<% end %>` closes it.

::: code-group
```erb [app/views/messages/_form.html.erb]
<%= form_with model: @message do |form| %>
  <%= form.label :body %>
  <%= form.text_area :body %>
  <%= form.submit "Send" %>
<% end %>
```
:::

A block that only runs Ruby, such as `content_for`, uses `<% %>`, since its output is stored for later instead of written where it stands.

::: code-group
```erb [app/views/messages/index.html.erb]
<% content_for :title do %>
  Messages
<% end %>
```
:::

## Whitespace

A `<% %>` or `<%# %>` tag alone on its line is trimmed. The indentation before it and the newline after it do not reach the output, which keeps the rendered HTML as tidy as the template. `-%>` drops the newline after any tag, including `<%= %>`. [Whitespace trimming](/projects/engine#whitespace-trimming) has the details.

## Writing a literal `<%`

`<%%` writes the text `<%` into the output, and `<%%=` writes `<%=`. That is how a template shows ERB in a code sample, or how a generator template writes out another ERB file.

::: code-group
```erb [app/views/docs/erb.html.erb]
<pre><code><%%= @message.body %></code></pre>
```
:::

## What HTML+ERB adds

HTML+ERB reads the HTML and the ERB as one document, so a few things ERB allows are errors in Herb.

An element that opens inside a conditional or a loop closes inside it too. Opening a `<div>` in one branch and closing it after `<% end %>` is a parse error, and [Elements must close in the same scope](/language/templates#elements-must-close-in-the-same-scope) shows how to rewrite it.

ERB output cannot stand in for an attribute name or sit in the middle of an open tag, as in `<div <%= attrs %>>`, because no escaping makes that safe. Build the attributes with a helper such as `tag.div` instead.

A `%>` inside a Ruby string ends the tag early. Build the text from pieces, `"%" + ">"`, or write the HTML entities `&percnt;&gt;` when it goes straight to the output.

## Related

- [Templates](/language/templates) for file extensions and everything Herb rejects
- [Strict locals](/language/strict-locals) for the `<%# locals: (...) %>` comment a partial declares its locals with
- [Whitespace trimming](/projects/engine#whitespace-trimming) for how trimming compiles
