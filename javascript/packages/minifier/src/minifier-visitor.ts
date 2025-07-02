export interface MinifierOptions {
  collapseWhitespace?: boolean
  collapseMultipleSpaces?: boolean
  collapseMultipleNewlines?: boolean
  preserveLineBreaks?: boolean
  preserveTags?: string[]
  trimTextNodes?: boolean
}

export const DEFAULT_MINIFIER_OPTIONS: MinifierOptions = {
  collapseWhitespace: true,
  collapseMultipleSpaces: true,
  collapseMultipleNewlines: true,
  preserveLineBreaks: false,
  preserveTags: ["pre", "code", "script", "style", "textarea"],
  trimTextNodes: true
}
