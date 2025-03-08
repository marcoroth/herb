# HTML Parser and language parser in one AST

```js
{
  type: "element",
  tagName: "div",
  properties: {
    className: ["foo"],
    id: "some-id"
  },
  children: [
    {
      type: "element",
      tagName: "span",
      properties: {},
      children: [
        {
          type: "ruby",
          value: "some text"
        }
      ]
    },
    {
      type: "element",
      tagName: "span",
      properties: {},
      children: [
        {
          type: "erb-loud",
          value: { // Prism parse result
            type: "InstanceVariableReadNode",
            location: [[1,0],[1,6]]
            name: "@posts",
          }
        }
      ]
    },
    {
      type: "erb-silent",
      location: [[1,0],[1,6]],
      value: {
      },
      children: [
        {
          type: "element",
          tagName: "h1",
          properties: {},
          children: [
            {
              type: "erb-loud",
              value: {}
            }
          ]
        }
      ]
    },
    {
      type: "element",
      tagName: "span",
      properties: {
        id: "1",
      },
      dynamic_properties: [
        {
          type: "erb-silent",
          children: [
            {
              type: "html-attr",
              key: "class",
              value: []
              value: {
                type: "composed",
                children: [
                  {
                    type: "text",
                    value: "mt-2 "
                  },
                  {
                    type: "erb-loud",
                    value: {
                      // prism return value
                    }
                  }
                ]
              }
            }
          ]
        }
      ]
    }
  ]
}
```

```html
<span
  id="1"
  <% if post.title.length < 10 %>
    class="mt-2 bg-red-200 border-t-[<%= post.read_percentage %>%]"
  <% else %>
    class="mt-0"
    <%=  %>
  <% end %>
>
  <%= post.description %>
</span>


<span id="1" <% if true %> class="mt-2 <%= post.title %>" <% end %> >
  <%= post.description %>
</span>

<% @posts.each do |post| %>
  <h1>
    <%= post.title %>
  </h1>
<% end %>
```

```ruby
Parser.parse_html_erb("<html><%= 'Hello' %></html>")
Parser.parse_html_ejs("<html><% console.log('Hello') %></html>")
Parser.parse_html_blade("<html>{{ $message }}</html>")
```

```html
<div data-controller="autocomplete-works">
  <%= @posts %>
  <%= tag.div "Click", data: { controller: "autocomplete-doesnt-work"} %>
  <%= content_tag(:span, "Click", data: { controller: "autocomplete-doesnt-work"} %>
</div>
```

# HTML parser and lang node to send to lang parser. (only has html ast)

any lang node would be send and the lang AST would be separate for that node

```js
{
  type: "element",
  tagName: "div",
  properties: {
    className: ["foo"],
    id: "some-id"
  },
  children: [
    {
      type: "element",
      tagName: "span",
      properties: {},
      children: [
        {
          type: "InstanceVariableReadNode",
          location: [[1,0],[1,6]]
          type: "text",
          value: "<%= @posts %>"
        },
        {
          type: "InstanceVariableReadNode",
          location: [[1,0],[1,6]]
          type: "text",
          value: "<%= @posts %>"
        }
      ]
    },
  ]
}
```

```erb
<span <% if true %> class="mt-2 <%= post.title %>" <% end %> >
  <%= post.description %>
</span>

<% @posts.each do |post| %>
  <h1>
    <%= post.title %> -- <%= post.description %>
  </h1>
<% end %>
```
