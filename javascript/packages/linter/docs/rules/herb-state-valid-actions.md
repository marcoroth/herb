# Linter Rule: Validate `data-herb-*` action attributes

**Rule:** `herb-state-valid-actions`

## Description

Validates the declarative action attributes `data-herb-set`, `data-herb-toggle`, `data-herb-increment`, `data-herb-decrement`, `data-herb-reset` and `data-herb-by`. Clause syntax must parse, quotes must balance, a named state must be declared in a scope enclosing the element, the operation must match the state's declared kind, and a `set` value must parse to that kind.

## Rationale

An action attribute is wiring the browser executes, so a typo in it fails silently at runtime. The client runtime reports these same problems as diagnostics when the page runs in debug mode. This rule reports them in the editor, using the same messages, before the page runs at all.

Type checks come from the declaration. `toggle` needs a boolean, `increment` and `decrement` need an integer, and a `set` value is read as whatever the state was declared to hold, so `attempts=lots` against `attempts: 0` can never parse. A state seeded from an expression has no static kind and is exempt.

The scope check follows the runtime's resolution. A name resolves through the scopes enclosing the element, the loop body for an item-scoped state and the template for a region-scoped one. When the template declares no states at all the rule stays quiet, since the states an element writes may be declared by an enclosing template.

## Examples

### ✅ Good

```erb
<%# herb:slots client %>
<%# herb:state (open: false, attempts: 0, sort: "name", draft: "") %>

<button data-herb-toggle="open">Details</button>
<button data-herb-set="open=true,sort=date">Both</button>
<button data-herb-increment="attempts" data-herb-by="2">More</button>
<select data-herb-set="change->sort=$value"></select>
<input data-herb-reset="blur->draft" autocomplete="off">
<button data-herb-set="draft='hello, world'">Quote</button>
```

### 🚫 Bad

```erb
<%# herb:slots client %>
<%# herb:state (open: false, attempts: 0, sort: "name") %>

<button data-herb-toggle="missing">Details</button>
<button data-herb-toggle="sort">Sort</button>
<button data-herb-set="open">Send</button>
<button data-herb-set="attempts=lots">More</button>
<button data-herb-increment="attempts" data-herb-by="two">More</button>
<button data-herb-set="sort='oops">Sort</button>
```

## References

\-
