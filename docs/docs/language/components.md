# Components <Badge type="tip" text="^0.11.0" /> <Badge type="warning" text="experimental" />

Herb has four built-in component tags. Each one compiles away into ordinary HTML and slots, so the browser never sees the tag itself.

| Component    | Does                                                                    |
|--------------|-------------------------------------------------------------------------|
| `<Fragment>` | Shows a fallback while server-rendered content catches up with a state change |
| `<Async>`    | Leaves its content out of the first response and loads it right after the page |
| `<Lazy>`     | Leaves its content out of the first response and loads it when it nears the viewport |
| `<Fallback>` | The markup a component shows in place of content that is stale or not there yet |

Components need [slots](/language/slots). In a template without a `herb:slots` directive the tags are left in the HTML, and the browser renders them as unknown elements.

## `<Fragment>`

Wraps content the server renders from a state, and shows its `<Fallback>` while that content is out of date.

```erb notwoslash
<Fragment delay="ms" hold="ms" on="state state">
  content
  <Fallback>markup</Fallback>
</Fragment>
```

::: code-group
```erb [app/views/weather/_lookup.html.erb]
<%# herb:slots client %>
<%# herb:state (city: "Zurich") %>

<input value="<%= city %>">
<Fragment delay="100" hold="600">
  <p><%= Geo.locate(city) %></p>
  <Fallback><p>Looking it up</p></Fallback>
</Fragment>
```
:::

The first response renders the content. When `city` changes, `Geo.locate(city)` has to run on the server again. The client shows the fallback in its place until the new content arrives.

| Attribute | Takes              | Does                                                         |
|-----------|--------------------|--------------------------------------------------------------|
| `delay`   | milliseconds       | How long to wait before the fallback appears, so a fast answer never shows it |
| `hold`    | milliseconds       | How long the fallback stays once it appears, so it does not flicker away |
| `on`      | state names        | The states whose writes show the fallback                   |

## `<Async>`

Leaves its content out of the first response. The client requests it as soon as the page loads, so slow content loads alongside the page instead of holding it up.

```erb notwoslash
<Async delay="ms" hold="ms" poll="ms">
  content
  <Fallback>markup</Fallback>
</Async>
```

::: code-group
```erb [app/views/dashboard/show.html.erb]
<%# herb:slots client %>

<Async>
  <%= render "dashboard/revenue_chart" %>
  <Fallback><p>Loading revenue</p></Fallback>
</Async>
```
:::

## `<Lazy>`

Leaves its content out of the first response. The client requests it when the block nears the viewport, and never requests content the reader does not scroll to.

```erb notwoslash
<Lazy delay="ms" hold="ms" poll="ms">
  content
  <Fallback>markup</Fallback>
</Lazy>
```

::: code-group
```erb [app/views/posts/show.html.erb]
<%# herb:slots client %>

<Lazy poll="30000">
  <%= render "comments/list" %>
  <Fallback><p>Loading comments</p></Fallback>
</Lazy>
```
:::

`<Async>` and `<Lazy>` take the same attributes.

| Attribute | Takes              | Does                                                         |
|-----------|--------------------|--------------------------------------------------------------|
| `delay`   | milliseconds       | How long to wait before the fallback appears                 |
| `hold`    | milliseconds       | How long the fallback stays once it appears                  |
| `poll`    | milliseconds       | How often to request the content again once it has loaded    |

An `<Async>` or `<Lazy>` cannot sit inside a collection.

## `<Fallback>`

The markup its component shows while the content is stale or still loading.

A `<Fallback>` is a direct child of a `<Fragment>`, `<Async>` or `<Lazy>`, and anywhere else it is a compile error. A component holds one `<Fallback>`, and a second one is a compile error too. It takes no attributes, so style the markup inside it.

## Compile errors

| Cause                                              | Message begins                                                  |
|----------------------------------------------------|-----------------------------------------------------------------|
| Two `<Fallback>` elements in one component         | ``A `<Fragment>` holds 2 `<Fallback>` elements``                |
| A `<Fallback>` that is not a direct child          | ``` `<Fallback>` sits outside a `<Fragment>` ```                |
| An attribute the component does not take           | ``` `<Fragment>` only takes `delay` and `hold` and `on`.```     |
| A timing attribute that is not whole milliseconds  | ``` `delay` on a `<Fragment>` takes a whole number of milliseconds.``` |
| `<Async>` or `<Lazy>` inside a collection          | ``A `<Lazy>` sits inside a collection``                         |
| A capitalized tag that is not a component          | ``` `<Widget>` is not a component Herb knows.```                |

## Related rules

- [`herb-component-requires-slots`](/linter/rules/herb-component-requires-slots)
- [`herb-slots-valid-components`](/linter/rules/herb-slots-valid-components)
