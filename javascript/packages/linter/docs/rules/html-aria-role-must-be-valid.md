# Linter Rule: ARIA role must be valid

### Rule: `aria-role-must-be-valid`

##### Description

Disallow unknown or invalid values for the `role` attribute. The `role` attribute must match one of the recognized ARIA role values as defined by the WAI-ARIA specification.

##### Rationale

ARIA `role` attributes are used to define the purpose of an element to assistive technologies. Using invalid, misspelled, or non-standard roles results in:

* Screen readers ignoring the role
* Broken accessibility semantics
* False sense of correctness

Validating against the official list of ARIA roles prevents silent accessibility failures.

#### Examples

##### ✅ Good

```html
<div role="button">Click me</div>
<nav role="navigation">...</nav>
<section role="region">...</section>
```

##### 🚫 Bad

```html
<div role="buton">Click me</div>       <!-- typo -->
<nav role="nav">...</nav>              <!-- not a valid role -->
<section role="header">...</section>   <!-- not in the ARIA spec -->
```

#### References

* [ARIA 1.2 Specification - Roles](https://www.w3.org/TR/wai-aria/#roles)
* [MDN: ARIA roles](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Roles)

