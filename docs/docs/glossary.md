# Glossary

## Action

An HTML attribute such as `data-herb-toggle` that writes a state when an event fires. See [Actions](/language/actions).

## Binding

A `state:` option on a `render` call that makes a partial's state and a state of the caller one state. See [Binding a partial's state](/language/state#binding-a-partial-s-state).

## Collection

A loop in a template compiled with slots. Its rows are matched across updates by their key. See [Keys and collections](/language/keys).

## Component

One of the built-in capitalized tags `<Fragment>`, `<Async>`, `<Lazy>` and `<Fallback>`, which compile into ordinary HTML and slots. See [Components](/language/components).

## Derived state

A state whose default reads other states, such as `busy: pending || failed`. The client recomputes it whenever one of those changes, and nothing can write it. See [Derived states](/language/state#derived-states).

## Diagnostic

A finding about a template, with a location, a message and often a suggestion. Parse errors, engine validators and linter rules all produce diagnostics.

## Directive

An ERB comment that Herb reads as an instruction, such as `<%# herb:state (...) %>`, `<%# herb:key ... %>` or `<%# herb:slots %>`. Any other ERB engine sees an ordinary comment.

## ERB tag

A Ruby tag inside a template, such as `<% %>`, `<%= %>` or `<%# %>`. See [ERB tags](/language/templates#erb-tags).

## Fallback

The markup a component shows while its content is stale or still loading. See [`<Fallback>`](/language/components#fallback).

## HTML+ERB

HTML with embedded Ruby, read as one language where elements, attributes and ERB tags belong to the same tree. Plain ERB treats the HTML as text. See [Templates](/language/templates).

## Key

The value that identifies a row in a collection, given with `<%# herb:key %>`, a `herb-key` attribute or a dynamic `id`. See [`herb:key`](/language/keys#herb-key).

## Kind

The type of value a state holds, decided by its default. The kinds are Boolean, Integer, String, Symbol, Nil and Seeded. See [Kinds](/language/state#kinds).

## Overlay

The panel ReActionView shows on the page in development when a template has an error, in place of a stack trace.

## Parser option

A setting that changes how the parser reads a template, such as `strict` or `html`. See [Parser options](/parser-options).

## Region

One rendering of one template in the page, marked by `herb-region` comments. A partial rendered three times makes three regions.

## Scoped style

A `<style scoped>` block whose CSS applies only to the markup in the same file. See [Scoped styles](/language/scoped-styles).

## Slot

A place in the rendered page that holds something dynamic, marked so the client can find it and update only that part. See [Slots](/language/slots).

## State

A value the browser owns, declared with `<%# herb:state (...) %>`. The server renders it with its default, and the client updates every part of the page that reads it. See [State](/language/state).

## Strict locals

A Rails magic comment, `<%# locals: (...) %>`, that declares which locals a partial takes. See [Strict locals](/language/strict-locals).

## Syntax tree

The structure the parser builds from a template, with a node for every element, attribute, text and ERB tag. Every Herb tool works on it.
