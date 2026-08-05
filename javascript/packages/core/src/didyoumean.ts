import { levenshtein } from "./levenshtein"

/**
 * Ranked result with item and distance score.
 */
export interface RankedResult {
  item: string
  score: number
}

/**
 * Ranks a list of strings by their Levenshtein distance from the input string.
 * Items are sorted in ascending order by distance, with closer matches first.
 *
 * @param input - The string to compare against
 * @param list - The list of strings to rank
 * @returns An array of objects containing the item and its distance score, sorted by score
 */
function rank(input: string, list: string[]): RankedResult[] {
  return list.map(item => {
    const score = levenshtein(input.toLowerCase(), item.toLowerCase())

    return { item, score }
  }).sort((a, b) => a.score - b.score)
}

/**
 * Finds the closest matching string from a list using Levenshtein distance.
 * Performs case-insensitive comparison.
 *
 * @param input - The string to match against
 * @param list - The list of candidate strings to search
 * @param threshold - Maximum Levenshtein distance to consider a match. If undefined, returns the closest match regardless of distance.
 * @returns The closest matching string from the list, or null if the list is empty or no match is within the threshold
 *
 * @example
 * ```ts
 * didyoumean('speling', ['spelling', 'writing', 'reading']) // Returns 'spelling'
 * didyoumean('test', []) // Returns null
 * didyoumean('speling', ['spelling', 'writing', 'reading'], 2) // Returns 'spelling' (distance: 1)
 * didyoumean('xyz', ['spelling', 'writing', 'reading'], 2) // Returns null (all distances > 2)
 * ```
 */
export function didyoumean(input: string, list: string[], threshold?: number): string | null {
  if (list.length === 0) return null

  const scores = rank(input, list)

  if (scores.length === 0) return null

  const closest = scores[0]

  if (threshold !== undefined && closest.score > threshold) return null

  return closest.item
}

/**
 * Returns all strings from a list ranked by their Levenshtein distance from the input string.
 * Performs case-insensitive comparison. Results are sorted with closest matches first.
 *
 * @param input - The string to match against
 * @param list - The list of candidate strings to rank
 * @param threshold - Maximum Levenshtein distance to include in results. If undefined, returns all ranked results.
 * @returns An array of ranked results with items and scores, or an empty array if the list is empty or no matches are within the threshold
 *
 * @example
 * ```ts
 * didyoumeanRanked('speling', ['spelling', 'writing', 'reading'])
 * // Returns [{ item: 'spelling', score: 1 }, { item: 'reading', score: 5 }, { item: 'writing', score: 6 }]
 *
 * didyoumeanRanked('speling', ['spelling', 'writing', 'reading'], 2)
 * // Returns [{ item: 'spelling', score: 1 }]
 *
 * didyoumeanRanked('test', []) // Returns []
 * ```
 */
export function didyoumeanRanked(input: string, list: string[], threshold?: number): RankedResult[] {
  if (list.length === 0) return []

  const scores = rank(input, list)

  if (threshold !== undefined) {
    return scores.filter(result => result.score <= threshold)
  }

  return scores
}
