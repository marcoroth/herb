export * from "./linter.js"
export * from "./rules/index.js"
export * from "./types.js"

export { ruleDocumentationUrl } from "./urls.js"
export { rules } from "./rules.js"

export {
  findAttributeByName,
  getAttribute,
  getAttributeName,
  getAttributes,
  getAttributeValue,
  getAttributeValueNodes,
  getAttributeValueQuoteType,
  getCombinedAttributeNameString,
  getStaticAttributeValue,
  getStaticAttributeValueContent,
  getTagName,
  hasAttribute,
  hasAttributeValue,
  hasDynamicAttributeName,
  hasDynamicAttributeValue,
  hasStaticAttributeValue,
  hasStaticAttributeValueContent,
  isAttributeValueQuoted,
} from "@herb-tools/core"
