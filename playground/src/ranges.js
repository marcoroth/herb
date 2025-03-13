/**
 * Finds the range that contains a specific position
 *
 * @param {Array<Array<number>>} ranges - Array of ranges, each [startLine, startColumn, endLine, endColumn]
 * @param {number} line - Line number to search for
 * @param {number} column - Column number to search for
 * @returns {Array<number>|null} - The matching range or null if no match found
 */
export function findRangeContainingPosition(ranges, line, column) {
  if (!ranges || !ranges.length) {
    return null
  }

  for (const range of ranges) {
    const [startLine, startColumn, endLine, endColumn] = range

    if (line < startLine) {
      continue
    }

    if (line > endLine) {
      continue
    }

    if (line === startLine && column < startColumn) {
      continue
    }

    if (line === endLine && column > endColumn) {
      continue
    }

    return range
  }

  return null
}

/**
 * Find all ranges that contain a specific position
 * (useful when ranges can overlap)
 *
 * @param {Array<Array<number>>} ranges - Array of ranges, each [startLine, startColumn, endLine, endColumn]
 * @param {number} line - Line number to search for
 * @param {number} column - Column number to search for
 * @returns {Array<Array<number>>} - Array of matching ranges
 */
export function findAllRangesContainingPosition(ranges, line, column) {
  if (!ranges || !ranges.length) {
    return []
  }

  return ranges.filter((range) => {
    const [startLine, startColumn, endLine, endColumn] = range

    if (line < startLine || line > endLine) {
      return false
    }

    if (line === startLine && column < startColumn) {
      return false
    }

    if (line === endLine && column > endColumn) {
      return false
    }

    return true
  })
}

/**
 * Finds the smallest range that contains a specific position
 * (useful when you have nested elements)
 *
 * @param {Array<Array<number>>} ranges - Array of ranges, each [startLine, startColumn, endLine, endColumn]
 * @param {number} line - Line number to search for
 * @param {number} column - Column number to search for
 * @returns {Array<number>|null} - The smallest matching range or null if no match found
 */
export function findSmallestRangeContainingPosition(ranges, line, column) {
  const matchingRanges = findAllRangesContainingPosition(ranges, line, column)

  if (!matchingRanges.length) {
    return null
  }

  return matchingRanges.sort((a, b) => {
    const sizeA = calculateRangeSize(a)
    const sizeB = calculateRangeSize(b)
    return sizeA - sizeB
  })[0]
}

/**
 * Calculate the size of a range in characters
 *
 * @param {Array<number>} range - [startLine, startColumn, endLine, endColumn]
 * @returns {number} - Size in characters (approximate)
 */
export function calculateRangeSize(range) {
  const [startLine, startColumn, endLine, endColumn] = range

  if (startLine === endLine) {
    return endColumn - startColumn
  }

  const lineCount = endLine - startLine
  return lineCount * 80 + (endColumn - startColumn)
}

export function findTreeLocationItemWithSmallestRangeFromPosition(
  treeLocations,
  line,
  column,
) {
  const allLocations = treeLocations.map(({ location }) => location)

  const smallestRange = findSmallestRangeContainingPosition(
    allLocations,
    line,
    column,
  )

  if (!smallestRange) {
    return null
  }

  return treeLocations.find(({ location }) => {
    return (
      location[0] === smallestRange[0] &&
      location[1] === smallestRange[1] &&
      location[2] === smallestRange[2] &&
      location[3] === smallestRange[3]
    )
  })
}
