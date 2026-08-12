export const DOCS_BASE_URL = "https://herb-tools.dev"
export const DOCS_LINTER_BASE_URL = `${DOCS_BASE_URL}/linter/rules`
export const RULE_CONFIGURATION_DOCUMENTATION_URL = `${DOCS_BASE_URL}/configuration#setting-the-default-for-all-rules`

export function ruleDocumentationUrl(ruleId: string): string {
  return `${DOCS_LINTER_BASE_URL}/${ruleId}`
}
