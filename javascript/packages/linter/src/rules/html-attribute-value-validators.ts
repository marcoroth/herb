import type { AttributeValueRule } from "./html-attribute-value-types.js"

export interface ValidationResult {
  valid: boolean
  message?: string
  warning?: string
}

export function validateAttributeValue(
  value: string | null,
  rule: AttributeValueRule,
  elementName: string,
  attributeName: string
): ValidationResult {
  if (rule.type === "boolean") {
    if (value === null || value === "" || value === attributeName.toLowerCase()) {
      return { valid: true }
    }

    return {
      valid: false,
      message: `Boolean attribute \`${attributeName}\` on \`<${elementName}>\` should not have a value. Use \`${attributeName}\` or omit the attribute.`
    }
  }

  if (rule.type === "url" && value === "") {
    return validateUrl(value, rule, elementName, attributeName)
  }

  if (value === null || value === "") {
    if (rule.allowEmpty !== false) {
      return { valid: true }
    }
    return {
      valid: false,
      message: `Attribute \`${attributeName}\` on \`<${elementName}>\` requires a value.`
    }
  }

  switch (rule.type) {
    case "string":
      return validateString(value, rule, elementName, attributeName)

    case "number":
      return validateNumber(value, rule, elementName, attributeName)

    case "url":
      return validateUrl(value, rule, elementName, attributeName)

    case "email":
      return validateEmail(value, rule, elementName, attributeName)

    case "color":
      return validateColor(value, rule, elementName, attributeName)

    case "datetime":
      return validateDatetime(value, rule, elementName, attributeName)

    case "language":
      return validateLanguage(value, rule, elementName, attributeName)

    case "mime-type":
      return validateMimeType(value, rule, elementName, attributeName)

    case "enum":
      return validateEnum(value, rule, elementName, attributeName)

    case "space-separated":
      return validateSpaceSeparated(value, rule, elementName, attributeName)

    case "comma-separated":
      return validateCommaSeparated(value, rule, elementName, attributeName)

    case "pattern":
      return validatePattern(value, rule, elementName, attributeName)

    case "id-reference":
      return validateIdReference(value, rule, elementName, attributeName)

    case "class-list":
      return validateClassList(value, rule, elementName, attributeName)

    default:
      return { valid: true }
  }
}

function validateString(value: string, rule: AttributeValueRule, elementName: string, attributeName: string): ValidationResult {
  if (rule.pattern && !rule.pattern.test(value)) {
    return {
      valid: false,
      message: `Invalid format for \`${attributeName}\` on \`<${elementName}>\`. Value "${value}" does not match the required pattern.`
    }
  }

  return { valid: true }
}

function validateNumber(value: string, rule: AttributeValueRule, elementName: string, attributeName: string): ValidationResult {
  const number = parseFloat(value)

  if (isNaN(number)) {
    return {
      valid: false,
      message: `Invalid number for \`${attributeName}\` on \`<${elementName}>\`. Expected a number, got "${value}".`
    }
  }

  if (rule.min !== undefined && number < rule.min) {
    return {
      valid: false,
      message: `Value for \`${attributeName}\` on \`<${elementName}>\` must be at least \`${rule.min}\`, got \`${number}\`.`
    }
  }

  if (rule.max !== undefined && number > rule.max) {
    return {
      valid: false,
      message: `Value for \`${attributeName}\` on \`<${elementName}>\` must be at most \`${rule.max}\`, got \`${number}\`.`
    }
  }

  return { valid: true }
}

function validateUrl(value: string, _rule: AttributeValueRule, elementName: string, attributeName: string): ValidationResult {
  try {
    if (value === '') {
      if (attributeName === 'href') {
        return {
          valid: true,
          warning: `Empty \`href\` attribute on \`<${elementName}>\`. This will reload the current page. Consider using \`href="#"\` for a placeholder or provide a valid URL.`
        }
      }

      return { valid: true }
    }

    if (value === '.' || value === '?') {
      return { valid: true }
    }

    if (value.startsWith('/') || value.startsWith('./') || value.startsWith('../')) {
      return { valid: true }
    }

    if (value.startsWith('#')) {
      return { valid: true }
    }

    if (value.startsWith('?')) {
      return { valid: true }
    }

    if (value.startsWith('//')) {
      return { valid: true }
    }

    if (value.startsWith('mailto:') || value.startsWith('tel:') || value.startsWith('sms:') ||
        value.startsWith('data:') || value.startsWith('javascript:')) {
      return { valid: true }
    }


    if (!value.includes(':') && !value.includes(' ')) {
      return { valid: true }
    }

    new URL(value)

    return { valid: true }
  } catch {
    return {
      valid: false,
      message: `Invalid URL for \`${attributeName}\` on \`<${elementName}>\`. "${value}" is not a valid URL.`
    }
  }
}

function validateEmail(value: string, _rule: AttributeValueRule, elementName: string, attributeName: string): ValidationResult {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

  if (!emailRegex.test(value)) {
    return {
      valid: false,
      message: `Invalid email address for \`${attributeName}\` on \`<${elementName}>\`. "${value}" is not a valid email.`
    }
  }

  return { valid: true }
}

function validateColor(value: string, _rule: AttributeValueRule, elementName: string, attributeName: string): ValidationResult {
  const hexRegex = /^#([0-9A-F]{3}){1,2}$/i

  const namedColors = new Set([
    'black', 'silver', 'gray', 'white', 'maroon', 'red', 'purple', 'fuchsia',
    'green', 'lime', 'olive', 'yellow', 'navy', 'blue', 'teal', 'aqua'
  ])

  if (hexRegex.test(value) || namedColors.has(value.toLowerCase()) ||
      value.startsWith('rgb(') || value.startsWith('rgba(') ||
      value.startsWith('hsl(') || value.startsWith('hsla(')) {

    return { valid: true }
  }

  return {
    valid: false,
    message: `Invalid color value for \`${attributeName}\` on \`<${elementName}>\`. "${value}" is not a valid color.`
  }
}

function validateDatetime(value: string, _rule: AttributeValueRule, elementName: string, attributeName: string): ValidationResult {
  const datetimeRegex = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2})?(\.\d{3})?(Z|[+-]\d{2}:\d{2})?)?$/

  if (!datetimeRegex.test(value)) {
    return {
      valid: false,
      message: `Invalid datetime format for \`${attributeName}\` on \`<${elementName}>\`. Expected format: \`YYYY-MM-DD\` or \`YYYY-MM-DDTHH:MM:SS\`.`
    }
  }

  return { valid: true }
}

function validateLanguage(value: string, _rule: AttributeValueRule, elementName: string, attributeName: string): ValidationResult {
  const languageRegex = /^[a-z]{2,3}(-[A-Z]{2})?(-[a-z]{2,8})*$/i

  if (!languageRegex.test(value)) {
    return {
      valid: false,
      message: `Invalid language code for \`${attributeName}\` on \`<${elementName}>\`. Expected format: \`en\`, \`en-US\`, etc.`
    }
  }

  return { valid: true }
}

function validateMimeType(value: string, _rule: AttributeValueRule, elementName: string, attributeName: string): ValidationResult {
  const mimeRegex = /^[a-zA-Z][a-zA-Z0-9][a-zA-Z0-9!#$&\-\^_]*\/[a-zA-Z0-9][a-zA-Z0-9!#$&\-\^_.]*$/

  if (!mimeRegex.test(value)) {
    return {
      valid: false,
      message: `Invalid MIME type for \`${attributeName}\` on \`<${elementName}>\`. Expected format: \`text/html\`, \`image/png\`, etc.`
    }
  }

  return { valid: true }
}

function validateEnum(value: string, rule: AttributeValueRule, elementName: string, attributeName: string): ValidationResult {
  if (!rule.enum) {
    return { valid: true }
  }

  const checkValue = rule.caseSensitive === false ? value.toLowerCase() : value
  const validValues = rule.caseSensitive === false
    ? rule.enum.map(v => v.toLowerCase())
    : rule.enum

  if (!validValues.includes(checkValue)) {
    return {
      valid: false,
      message: `Invalid value "${value}" for \`${attributeName}\` on \`<${elementName}>\`. Must be one of: ${rule.enum.map(v => `\`${v}\``).join(', ')}.`
    }
  }

  return { valid: true }
}

function validateSpaceSeparated(value: string, rule: AttributeValueRule, elementName: string, attributeName: string): ValidationResult {
  if (!rule.enum) {
    return { valid: true }
  }

  const values = value.split(/\s+/).filter(v => v.length > 0)
  const validValues = rule.caseSensitive === false
    ? rule.enum.map(v => v.toLowerCase())
    : rule.enum

  for (const val of values) {
    const checkValue = rule.caseSensitive === false ? val.toLowerCase() : val
    if (!validValues.includes(checkValue)) {
      return {
        valid: false,
        message: `Invalid value "${val}" in \`${attributeName}\` on \`<${elementName}>\`. Must be one of: ${rule.enum.map(v => `\`${v}\``).join(', ')}.`
      }
    }
  }

  return { valid: true }
}

function validateCommaSeparated(value: string, rule: AttributeValueRule, elementName: string, attributeName: string): ValidationResult {
  if (!rule.enum) {
    return { valid: true }
  }

  const values = value.split(',').map(v => v.trim()).filter(v => v.length > 0)
  const validValues = rule.caseSensitive === false
    ? rule.enum.map(v => v.toLowerCase())
    : rule.enum

  for (const val of values) {
    const checkValue = rule.caseSensitive === false ? val.toLowerCase() : val
    if (!validValues.includes(checkValue)) {
      return {
        valid: false,
        message: `Invalid value "${val}" in \`${attributeName}\` on \`<${elementName}>\`. Must be one of: ${rule.enum.map(v => `\`${v}\``).join(', ')}.`
      }
    }
  }

  return { valid: true }
}

function validatePattern(value: string, rule: AttributeValueRule, elementName: string, attributeName: string): ValidationResult {
  if (!rule.pattern) {
    return { valid: true }
  }

  if (!rule.pattern.test(value)) {
    return {
      valid: false,
      message: `Invalid format for \`${attributeName}\` on \`<${elementName}>\`. Value "${value}" does not match the required pattern.`
    }
  }

  return { valid: true }
}

function validateIdReference(value: string, _rule: AttributeValueRule, elementName: string, attributeName: string): ValidationResult {
  const idRegex = /^[a-zA-Z][\w-]*$/

  if (!idRegex.test(value)) {
    return {
      valid: false,
      message: `Invalid ID reference for \`${attributeName}\` on \`<${elementName}>\`. "${value}" is not a valid element ID.`
    }
  }

  return { valid: true }
}

function validateClassList(value: string, _rule: AttributeValueRule, elementName: string, attributeName: string): ValidationResult {
  const classes = value.split(/\s+/).filter(c => c.length > 0)
  const standardClassRegex = /^\\?!?-?[_a-zA-Z]+[_a-zA-Z0-9.-]*$/
  const tailwindArbitraryRegex = /^\\?!?-?[_a-zA-Z]+[_a-zA-Z0-9.-]*-\[[^\]]+\]$/
  const tailwindModifierRegex = /^([a-zA-Z0-9_-]+(\[[^\]]*\])?:)+\\?!?-?[_a-zA-Z]+[_a-zA-Z0-9.-]*(-\[[^\]]*\])?|\[[^\]]*\]:\\?!?[_a-zA-Z]+[_a-zA-Z0-9.-]*$/
  const tailwindOpacityRegex = /^\\?!?-?[_a-zA-Z]+[_a-zA-Z0-9.-]*\/[0-9]+$/
  const tailwindModifierOpacityRegex = /^([a-zA-Z0-9_-]+(\[[^\]]*\])?:)+\\?!?-?[_a-zA-Z]+[_a-zA-Z0-9.-]*\/[0-9]+|\[[^\]]*\]:\\?!?[_a-zA-Z]+[_a-zA-Z0-9.-]*\/[0-9]+$/
  const tailwindArbitraryPseudoRegex = /^\[[^\]]*\]:\\?!?[_a-zA-Z]+[_a-zA-Z0-9.-]*$/

  for (const className of classes) {
    const isStandardClass = standardClassRegex.test(className)
    const isTailwindArbitrary = tailwindArbitraryRegex.test(className)
    const isTailwindModifier = tailwindModifierRegex.test(className)
    const isTailwindOpacity = tailwindOpacityRegex.test(className)
    const isTailwindModifierOpacity = tailwindModifierOpacityRegex.test(className)
    const isTailwindArbitraryPseudo = tailwindArbitraryPseudoRegex.test(className)

    if (!isStandardClass && !isTailwindArbitrary && !isTailwindModifier && !isTailwindOpacity && !isTailwindModifierOpacity && !isTailwindArbitraryPseudo) {
      return {
        valid: false,
        message: `Invalid CSS class name "${className}" in \`${attributeName}\` on \`<${elementName}>\`. Class names must be valid CSS identifiers.`
      }
    }
  }

  return { valid: true }
}
