export function extractRubyCommentContent(content: string): string | null {
  const match = content.match(/^\s*#\s*(.*)$/)

  return match ? match[1].trim() : null
}

export function looksLikeLocalsDeclaration(content: string): boolean {
  return /^locals?\b/.test(content) && /[(:)]/.test(content)
}
