---
outline: deep
---

# HTML+ERB Specification

This document provides a comprehensive specification of ERB syntax patterns supported by Herb, categorized by their semantic meaning and usage context.

## Core ERB Tag Types

### Execution Tag (`<% %>`)

Executes Ruby code without outputting the result to the rendered template.

::: code-group
```html [ERB]
<% user_name = "John Doe" %>
<% if user.admin? %>
```

```json [AST]
{
  "type": "erb-content",
  "tag_opening": "<%",
  "content": " user_name = \"John Doe\" ",
  "tag_closing": "%>",
  "analyzed_ruby": {
    // Prism AST for Ruby code
  }
}
```
:::

### Output Tag (`<%=`)

Executes Ruby code and outputs the result (with HTML escaping by default).

::: code-group
```html [ERB]
<%= user.name %>
<%= "Hello World" %>
```

```json [AST]
{
  "type": "erb-content",
  "tag_opening": "<%=",
  "content": " user.name ",
  "tag_closing": "%>",
  "analyzed_ruby": {
    // Prism AST for Ruby code
  }
}
```
:::

### Raw Output Tag (`<%==`)

Executes Ruby code and outputs the result without HTML escaping.

::: code-group
```html [ERB]
<%== raw_html_content %>
<%== "<strong>Bold</strong>" %>
```

```json [AST]
{
  "type": "erb-content",
  "tag_opening": "<%==",
  "content": " raw_html_content ",
  "tag_closing": "%>",
  "analyzed_ruby": {
    // Prism AST for Ruby code
  }
}
```
:::

### Comment Tag (`<%#`)

ERB comments that are not included in the rendered output.

::: code-group
```html [ERB]
<%# This is a comment %>
<%# 
  Multi-line comment
  with additional notes
%>
```

```json [AST]
{
  "type": "erb-content",
  "tag_opening": "<%#",
  "content": " This is a comment ",
  "tag_closing": "%>",
  "analyzed_ruby": null
}
```
:::

### Whitespace Control Tags

Control whitespace around ERB tags using `-` modifier.

#### Leading Whitespace Suppression (`<%-`)

::: code-group
```html [ERB]
    <%- "content" %>
<!-- Suppresses leading whitespace -->
```

```json [AST]
{
  "type": "erb-content",
  "tag_opening": "<%-",
  "content": " \"content\" ",
  "tag_closing": "%>",
  "analyzed_ruby": {
    // Prism AST for Ruby code
  }
}
```
:::

#### Trailing Whitespace Suppression (`-%>`)

::: code-group
```html [ERB]
<%= "content" -%>
    <!-- Suppresses trailing whitespace -->
```

```json [AST]
{
  "type": "erb-content",
  "tag_opening": "<%=",
  "content": " \"content\" ",
  "tag_closing": "-%>",
  "analyzed_ruby": {
    // Prism AST for Ruby code
  }
}
```
:::

### Literal ERB Tag (`<%% %>`)

Outputs literal ERB syntax without processing.

::: code-group
```html [ERB]
<%% user.name %%>
<!-- Outputs: <% user.name %> -->
```

```json [AST]
{
  "type": "erb-content",
  "tag_opening": "<%%",
  "content": " user.name ",
  "tag_closing": "%%>",
  "analyzed_ruby": null
}
```
:::

## Control Flow Constructs

### Conditional Statements

#### If/Elsif/Else Structure

::: code-group
```html [ERB]
<% if user.admin? %>
  <p>Admin panel</p>
<% elsif user.moderator? %>
  <p>Moderator tools</p>
<% else %>
  <p>User content</p>
<% end %>
```

```json [AST]
{
  "type": "erb-if",
  "tag_opening": "<%",
  "content": " if user.admin? ",
  "tag_closing": "%>",
  "statements": [
    {
      "type": "html-text",
      "content": "\n  "
    },
    {
      "type": "html-element",
      "tag_name": "p",
      "body": [
        {
          "type": "html-text",
          "content": "Admin panel"
        }
      ]
    }
  ],
  "subsequent": {
    "type": "erb-else",
    // ... else clause structure
  },
  "end_node": {
    "type": "erb-end",
    "tag_opening": "<%",
    "content": " end ",
    "tag_closing": "%>"
  }
}
```
:::

#### Unless Statement

::: code-group
```html [ERB]
<% unless user.banned? %>
  <p>Welcome back!</p>
<% end %>
```

```json [AST]
{
  "type": "erb-unless",
  "tag_opening": "<%",
  "content": " unless user.banned? ",
  "tag_closing": "%>",
  "statements": [
    // ... HTML content
  ],
  "end_node": {
    "type": "erb-end",
    "tag_opening": "<%",
    "content": " end ",
    "tag_closing": "%>"
  }
}
```
:::

### Case Statements

#### Traditional Case/When

::: code-group
```html [ERB]
<% case user.role %>
<% when 'admin' %>
  <p>Administrator</p>
<% when 'moderator' %>
  <p>Moderator</p>
<% else %>
  <p>Regular user</p>
<% end %>
```

```json [AST]
{
  "type": "erb-case",
  "tag_opening": "<%",
  "content": " case user.role ",
  "tag_closing": "%>",
  "conditions": [
    {
      "type": "erb-when",
      "tag_opening": "<%",
      "content": " when 'admin' ",
      "tag_closing": "%>",
      "statements": [
        // ... HTML content for admin case
      ]
    }
  ],
  "else_clause": {
    "type": "erb-else",
    // ... else structure
  },
  "end_node": {
    "type": "erb-end",
    "tag_opening": "<%",
    "content": " end ",
    "tag_closing": "%>"
  }
}
```
:::

#### Pattern Matching Case/In

::: code-group
```html [ERB]
<% case data %>
<% in { type: 'user', name: String } %>
  <p>User: <%= name %></p>
<% in { type: 'admin' } %>
  <p>Administrator</p>
<% else %>
  <p>Unknown type</p>
<% end %>
```

```json [AST]
{
  "type": "erb-case-match",
  "tag_opening": "<%",
  "content": " case data ",
  "tag_closing": "%>",
  "conditions": [
    {
      "type": "erb-in",
      "tag_opening": "<%",
      "content": " in { type: 'user', name: String } ",
      "tag_closing": "%>",
      "statements": [
        // ... HTML content for pattern match
      ]
    }
  ],
  "else_clause": {
    "type": "erb-else",
    // ... else structure
  },
  "end_node": {
    "type": "erb-end"
  }
}
```
:::

## Loop Constructs

### Each Loops

::: code-group
```html [ERB]
<% users.each do |user| %>
  <li><%= user.name %></li>
<% end %>
```

```json [AST]
{
  "type": "erb-block",
  "tag_opening": "<%",
  "content": " users.each do |user| ",
  "tag_closing": "%>",
  "body": [
    {
      "type": "html-text",
      "content": "\n  "
    },
    {
      "type": "html-element",
      "tag_name": "li",
      "body": [
        {
          "type": "erb-content",
          "tag_opening": "<%=",
          "content": " user.name ",
          "tag_closing": "%>"
        }
      ]
    }
  ],
  "end_node": {
    "type": "erb-end"
  }
}
```
:::

### While Loops

::: code-group
```html [ERB]
<% counter = 0 %>
<% while counter < 5 %>
  <p>Count: <%= counter %></p>
  <% counter += 1 %>
<% end %>
```

```json [AST]
{
  "type": "erb-while",
  "tag_opening": "<%",
  "content": " while counter < 5 ",
  "tag_closing": "%>",
  "statements": [
    // ... loop body content
  ],
  "end_node": {
    "type": "erb-end"
  }
}
```
:::

### Until Loops

::: code-group
```html [ERB]
<% counter = 0 %>
<% until counter == 5 %>
  <p>Count: <%= counter %></p>
  <% counter += 1 %>
<% end %>
```

```json [AST]
{
  "type": "erb-until",
  "tag_opening": "<%",
  "content": " until counter == 5 ",
  "tag_closing": "%>",
  "statements": [
    // ... loop body content
  ],
  "end_node": {
    "type": "erb-end"
  }
}
```
:::

### For Loops

::: code-group
```html [ERB]
<% for item in collection %>
  <div><%= item %></div>
<% end %>
```

```json [AST]
{
  "type": "erb-for",
  "tag_opening": "<%",
  "content": " for item in collection ",
  "tag_closing": "%>",
  "statements": [
    // ... loop body content
  ],
  "end_node": {
    "type": "erb-end"
  }
}
```
:::

## Exception Handling

### Begin/Rescue/Ensure/End

::: code-group
```html [ERB]
<% begin %>
  <%= risky_operation %>
<% rescue StandardError => e %>
  <p>Error: <%= e.message %></p>
<% ensure %>
  <p>Cleanup completed</p>
<% end %>
```

```json [AST]
{
  "type": "erb-begin",
  "tag_opening": "<%",
  "content": " begin ",
  "tag_closing": "%>",
  "statements": [
    // ... main content
  ],
  "rescue_clause": {
    "type": "erb-rescue",
    "tag_opening": "<%",
    "content": " rescue StandardError => e ",
    "tag_closing": "%>",
    "statements": [
      // ... rescue content
    ]
  },
  "ensure_clause": {
    "type": "erb-ensure",
    "tag_opening": "<%",
    "content": " ensure ",
    "tag_closing": "%>",
    "statements": [
      // ... ensure content
    ]
  },
  "end_node": {
    "type": "erb-end"
  }
}
```
:::

## HTML Integration Patterns

### ERB in HTML Attributes

#### Dynamic Attribute Values

::: code-group
```html [ERB]
<article id="<%= dom_id(article) %>" class="<%= article.css_class %>">
  Content
</article>
```

```json [AST]
{
  "type": "html-element",
  "open_tag": {
    "type": "html-open-tag",
    "tag_name": "article",
    "children": [
      {
        "type": "html-attribute",
        "name": {
          "type": "html-attribute-name",
          "name": "id"
        },
        "value": {
          "type": "html-attribute-value",
          "quoted": true,
          "children": [
            {
              "type": "erb-content",
              "tag_opening": "<%=",
              "content": " dom_id(article) ",
              "tag_closing": "%>"
            }
          ]
        }
      }
    ]
  },
  "body": [
    {
      "type": "html-text",
      "content": "\n  Content\n"
    }
  ]
}
```
:::

#### Mixed Static and Dynamic Content

::: code-group
```html [ERB]
<div class="base-class <%= additional_classes %> suffix-class">
  Content
</div>
```

```json [AST]
{
  "type": "html-element",
  "open_tag": {
    "type": "html-open-tag",
    "tag_name": "div",
    "children": [
      {
        "type": "html-attribute",
        "name": {
          "type": "html-attribute-name",
          "name": "class"
        },
        "value": {
          "type": "html-attribute-value",
          "quoted": true,
          "children": [
            {
              "type": "html-text",
              "content": "base-class "
            },
            {
              "type": "erb-content",
              "tag_opening": "<%=",
              "content": " additional_classes ",
              "tag_closing": "%>"
            },
            {
              "type": "html-text",
              "content": " suffix-class"
            }
          ]
        }
      }
    ]
  }
}
```
:::

### Conditional Attributes

::: code-group
```html [ERB]
<input type="text" 
  <% if required? %>required<% end %>
  <% if disabled? %>disabled<% end %>>
```

```json [AST]
{
  "type": "html-self-close-tag",
  "tag_name": "input",
  "attributes": [
    {
      "type": "html-attribute",
      "name": {
        "type": "html-attribute-name",
        "name": "type"
      },
      "value": {
        "type": "html-attribute-value",
        "quoted": true,
        "children": [
          {
            "type": "html-text",
            "content": "text"
          }
        ]
      }
    }
  ],
  "children": [
    {
      "type": "whitespace",
      "value": "\n  "
    },
    {
      "type": "erb-if",
      "tag_opening": "<%",
      "content": " if required? ",
      "tag_closing": "%>",
      "statements": [
        {
          "type": "html-text",
          "content": "required"
        }
      ],
      "end_node": {
        "type": "erb-end"
      }
    }
  ]
}
```
:::

## Rails Helper Integration

### Content Tag Helpers

::: code-group
```html [ERB]
<%= content_tag(:div, "Content", class: "container") %>
```

```json [AST]
{
  "type": "erb-content",
  "tag_opening": "<%=",
  "content": " content_tag(:div, \"Content\", class: \"container\") ",
  "tag_closing": "%>",
  "analyzed_ruby": {
    // Prism AST showing method call
  }
}
```
:::

### Tag Builders

::: code-group
```html [ERB]
<%= tag.div class: "wrapper" do %>
  <p>Dynamic content</p>
<% end %>
```

```json [AST]
{
  "type": "erb-content",
  "tag_opening": "<%=",
  "content": " tag.div class: \"wrapper\" do ",
  "tag_closing": "%>",
  "analyzed_ruby": {
    // Prism AST for method call with block
  }
}
```
:::

### Form Helpers

::: code-group
```html [ERB]
<%= form_with model: @user do |form| %>
  <%= form.text_field :name %>
<% end %>
```

```json [AST]
{
  "type": "erb-content",
  "tag_opening": "<%=",
  "content": " form_with model: @user do |form| ",
  "tag_closing": "%>",
  "analyzed_ruby": {
    // Prism AST for form_with call
  }
}
```
:::

## Complex Nested Structures

### Nested Control Flow

::: code-group
```html [ERB]
<% if user.present? %>
  <div class="user-info">
    <% case user.status %>
    <% when 'active' %>
      <% user.posts.each do |post| %>
        <article>
          <h2><%= post.title %></h2>
          <% if post.published? %>
            <time><%= post.published_at %></time>
          <% end %>
        </article>
      <% end %>
    <% else %>
      <p>User is not active</p>
    <% end %>
  </div>
<% end %>
```

```json [AST]
{
  "type": "erb-if",
  "statements": [
    {
      "type": "html-element",
      "tag_name": "div",
      "body": [
        {
          "type": "erb-case",
          "conditions": [
            {
              "type": "erb-when",
              "statements": [
                {
                  "type": "erb-block",
                  "body": [
                    {
                      "type": "html-element",
                      "tag_name": "article",
                      "body": [
                        {
                          "type": "html-element",
                          "tag_name": "h2",
                          "body": [
                            {
                              "type": "erb-content",
                              "content": " post.title "
                            }
                          ]
                        },
                        {
                          "type": "erb-if",
                          "statements": [
                            {
                              "type": "html-element",
                              "tag_name": "time",
                              "body": [
                                {
                                  "type": "erb-content",
                                  "content": " post.published_at "
                                }
                              ]
                            }
                          ]
                        }
                      ]
                    }
                  ]
                }
              ]
            }
          ]
        }
      ]
    }
  ]
}
```
:::

## Advanced ERB Patterns

### Yield Statements

::: code-group
```html [ERB]
<% yield :head %>
<% yield :sidebar if content_for?(:sidebar) %>
```

```json [AST]
{
  "type": "erb-yield",
  "tag_opening": "<%",
  "content": " yield :head ",
  "tag_closing": "%>"
}
```
:::

### Capture Blocks

::: code-group
```html [ERB]
<% content_for :title do %>
  <title><%= @page_title %></title>
<% end %>
```

```json [AST]
{
  "type": "erb-block",
  "tag_opening": "<%",
  "content": " content_for :title do ",
  "tag_closing": "%>",
  "body": [
    {
      "type": "html-element",
      "tag_name": "title",
      "body": [
        {
          "type": "erb-content",
          "tag_opening": "<%=",
          "content": " @page_title ",
          "tag_closing": "%>"
        }
      ]
    }
  ],
  "end_node": {
    "type": "erb-end"
  }
}
```
:::

## Discouraged Patterns

While Herb can parse these patterns, they are considered anti-patterns and should be avoided:

### Dynamic Tag Names

::: code-group
```html [ERB - Discouraged]
<<%= tag_name %> class="dynamic">
  Content
</<%= tag_name %>>
```
:::

**Why discouraged**: Makes templates difficult to understand and analyze statically.

### Dynamic Attribute Names

::: code-group
```html [ERB - Discouraged]
<input <%= attribute_name %>="value" type="text">
```
:::

**Why discouraged**: Prevents static analysis and makes templates unpredictable.

### Complex Logic in Templates

::: code-group
```html [ERB - Discouraged]
<%= User.where(active: true).joins(:posts).group(:department).count.map { |dept, count| "#{dept}: #{count}" }.join(", ") %>
```
:::

**Why discouraged**: Business logic should be in controllers or helpers, not templates.

This specification covers the complete range of ERB syntax patterns that Herb supports, providing both the ERB syntax and the corresponding AST representation for each pattern.
