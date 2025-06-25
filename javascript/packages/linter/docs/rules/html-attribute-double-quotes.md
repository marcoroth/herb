# Linter Rule: Prefer double quotes for HTML Attribute values

### Rule: `html-attribute-double-quotes`

##### Description

Prefer using double quotes (`"`) around HTML attribute values instead of single quotes (`'`).

##### Rationale

Double quotes are the most widely used and expected style for HTML attributes. Consistent use of double quotes improves readability, reduces visual noise when mixing with embedded Ruby (which often uses single quotes), and avoids escaping conflicts when embedding attribute values that contain single quotes.

#### Examples

###### ✅ Good

```html+erb
<input type="text" value="Username">
<a href="/profile" title="User Profile">Profile</a>
<div data-controller="dropdown" data-action="click->dropdown#toggle"></div>
```


###### 🚫 Bad

```html+erb
<input type='text' value='Username'>
<a href='/profile' title='User Profile'>Profile</a>
<div data-controller='dropdown' data-action='click->dropdown#toggle'></div>
```

#### References

* [HTML Living Standard - Attributes](https://html.spec.whatwg.org/multipage/syntax.html#attributes-2)
