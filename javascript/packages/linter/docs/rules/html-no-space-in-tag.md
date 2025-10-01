# Disallow spaces in html tags

## Rule: `html-no-space-in-tag`

Disallow spaces in html tags

## Examples

### ❌ Incorrect

```erb
<div  class="foo"></div>
<div class="foo"></div >
<div class="foo"  data-x="bar"></div>
<div
   class="foo"
    data-x="bar"
>
foo
</div>
```

### ✅ Correct

```erb
<div class="foo"></div>
<div class="foo"></div>
<div class="foo" data-x="bar"></div>
<div
  class="foo"
  data-x="bar"
>
foo
</div>
```

## Configuration

This rule has no configuration options.
