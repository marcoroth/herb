InlineFormatVisitor Class Structure

interface AtomicUnit {
  content: string           // Rendered output
  visualLength: number      // For line length calculation
  semanticType: UnitType    // text | inline-element | wbr | br-hr | erb
  breakBehavior: BreakBehavior // can-break-after | break-opportunity | must-break-after
  breakPriority: number     // Higher = prefer to break here (0-10)
  sourceElement?: HTMLElementNode
  isWhitespace?: boolean    // For space handling
}

enum UnitType {
  TEXT = 'text',
  INLINE_ELEMENT = 'inline-element',
  WORD_BREAK_OPPORTUNITY = 'wbr',
  FORCE_LINE_BREAK = 'br-hr',
  ERB_CONTENT = 'erb',
  OPENING_TAG = 'opening-tag',
  CLOSING_TAG = 'closing-tag'
}

enum BreakBehavior {
  CAN_BREAK_AFTER = 'can-break-after',
  BREAK_OPPORTUNITY = 'break-opportunity',   // <wbr>
  MUST_BREAK_AFTER = 'must-break-after',    // <br>, <hr>
  NO_BREAK = 'no-break',                    // Inside words
  CAN_BREAK_BEFORE = 'can-break-before'     // Closing tags
}

class InlineFormatVisitor {
  constructor(
    private printer: FormatPrinter,
    private maxLineLength: number,
    private currentIndent: string
  ) {}

  formatInlineContent(children: Node[], parentElement: HTMLElementNode): string {
    const units = this.collectAtomicUnits(children)
    return this.layoutUnits(units, parentElement)
  }

Atomic Unit Collection

private collectAtomicUnits(children: Node[]): AtomicUnit[] {
  const units: AtomicUnit[] = []

  for (const child of children) {
    if (isNode(child, HTMLTextNode)) {
      units.push(...this.processTextNode(child))
    }
    else if (isNode(child, HTMLElementNode)) {
      units.push(...this.processElement(child))
    }
    else if (isNode(child, ERBContentNode)) {
      units.push(this.processERBNode(child))
    }
  }

  return units
}

private processTextNode(node: HTMLTextNode): AtomicUnit[] {
  const text = node.content
  const units: AtomicUnit[] = []

  // Split on word boundaries, keeping separators
  const parts = text.split(/(\s+)/)

  for (const part of parts) {
    if (part.length === 0) continue

    const isSpace = /^\s+$/.test(part)

    units.push({
      content: part,
      visualLength: part.length,
      semanticType: UnitType.TEXT,
      breakBehavior: isSpace ? BreakBehavior.CAN_BREAK_AFTER : BreakBehavior.CAN_BREAK_AFTER,
      breakPriority: isSpace ? 8 : 3, // Prefer breaking at spaces
      isWhitespace: isSpace
    })
  }

  return units
}

private processElement(element: HTMLElementNode): AtomicUnit[] {
  const tagName = getTagName(element)

  // Handle special elements
  if (tagName === 'wbr') {
    return [{
      content: '<wbr>',
      visualLength: 0,
      semanticType: UnitType.WORD_BREAK_OPPORTUNITY,
      breakBehavior: BreakBehavior.BREAK_OPPORTUNITY,
      breakPriority: 9, // Very high priority for breaking
      sourceElement: element
    }]
  }

  if (tagName === 'br') {
    return [{
      content: '<br>',
      visualLength: 0,
      semanticType: UnitType.FORCE_LINE_BREAK,
      breakBehavior: BreakBehavior.MUST_BREAK_AFTER,
      breakPriority: 10, // Maximum priority - must break
      sourceElement: element
    }]
  }

  if (tagName === 'hr') {
    return [{
      content: this.printer.renderElement(element),
      visualLength: 0,
      semanticType: UnitType.FORCE_LINE_BREAK,
      breakBehavior: BreakBehavior.MUST_BREAK_AFTER,
      breakPriority: 10,
      sourceElement: element
    }]
  }
  // Regular inline element - render as single unit
if (this.printer.isInlineElement(tagName)) {
  const rendered = this.printer.renderElement(element)
  const visualLength = this.calculateVisualLength(rendered)

  return [{
    content: rendered,
    visualLength: visualLength,
    semanticType: UnitType.INLINE_ELEMENT,
    breakBehavior: BreakBehavior.CAN_BREAK_AFTER,
    breakPriority: 5, // Medium priority - after complete elements
    sourceElement: element
  }]
}

// For complex elements, might need to break into open/content/close
return this.processComplexElement(element)
}

Layout Algorithm

private layoutUnits(units: AtomicUnit[], parent: HTMLElementNode): string {
const lines: LineInfo[] = []
let currentLine: AtomicUnit[] = []
let currentLength = this.currentIndent.length

for (let i = 0; i < units.length; i++) {
  const unit = units[i]

  // Handle mandatory breaks
  if (unit.breakBehavior === BreakBehavior.MUST_BREAK_AFTER) {
    currentLine.push(unit)
    lines.push(this.createLine(currentLine, true)) // Force break after
    currentLine = []
    currentLength = this.currentIndent.length
    continue
  }

  // Check if unit fits on current line
  const projectedLength = currentLength + unit.visualLength

  if (projectedLength <= this.maxLineLength || currentLine.length === 0) {
    // Fits or must fit (first item)
    currentLine.push(unit)
    currentLength = projectedLength
  } else {
    // Need to break - find optimal break point
    const breakPoint = this.findOptimalBreak(currentLine, unit, i, units)

    if (breakPoint.canBreak) {
      // Break at found point
      lines.push(this.createLine(breakPoint.lineUnits, false))
      currentLine = [...breakPoint.remainingUnits, unit]
      currentLength = this.currentIndent.length + this.calculateLineLength(currentLine)
    } else {
      // No good break point - force onto new line
      lines.push(this.createLine(currentLine, false))
      currentLine = [unit]
      currentLength = this.currentIndent.length + unit.visualLength
    }
  }
}

if (currentLine.length > 0) {
  lines.push(this.createLine(currentLine, false))
}

return this.renderLines(lines)
}

Break Point Selection

interface BreakPoint {
canBreak: boolean
lineUnits: AtomicUnit[]
remainingUnits: AtomicUnit[]
breakPriority: number
}

private findOptimalBreak(
currentLine: AtomicUnit[],
newUnit: AtomicUnit,
currentIndex: number,
allUnits: AtomicUnit[]
): BreakPoint {

let bestBreak: BreakPoint | null = null

// Look for break opportunities in current line (right to left)
for (let i = currentLine.length - 1; i >= 0; i--) {
  const unit = currentLine[i]

  const breakCandidate: BreakPoint = {
    canBreak: this.canBreakAfter(unit),
    lineUnits: currentLine.slice(0, i + 1),
    remainingUnits: currentLine.slice(i + 1),
    breakPriority: unit.breakPriority
  }

  if (breakCandidate.canBreak) {
    // Found a valid break point
    if (!bestBreak || breakCandidate.breakPriority > bestBreak.breakPriority) {
      bestBreak = breakCandidate
    }

    // If we found a high-priority break (space or wbr), use it immediately
    if (unit.breakPriority >= 8) {
      break
    }
  }
}

return bestBreak || {
  canBreak: false,
  lineUnits: currentLine,
  remainingUnits: [],
  breakPriority: 0
}
}

private canBreakAfter(unit: AtomicUnit): boolean {
return unit.breakBehavior === BreakBehavior.CAN_BREAK_AFTER ||
       unit.breakBehavior === BreakBehavior.BREAK_OPPORTUNITY
}

Example Processing


  For <p>Em<em>pha</em>sis</p>:

  // Atomic units generated:
  [
    { content: '<p>', visualLength: 0, semanticType: 'opening-tag', breakPriority: 6 },
    { content: 'Em', visualLength: 2, semanticType: 'text', breakPriority: 3 },
    { content: '<em>pha</em>', visualLength: 3, semanticType: 'inline-element', breakPriority: 5 },
    { content: 'sis', visualLength: 3, semanticType: 'text', breakPriority: 3 },
    { content: '</p>', visualLength: 0, semanticType: 'closing-tag', breakPriority: 6 }
  ]

  // Layout decision:
  // Total length: 8 characters + indentation
  // If fits: <p>Em<em>pha</em>sis</p>
  // If too long, break after <p> (priority 6):
  //   <p>
  //     Em<em>pha</em>sis
  //   </p>

  For Very<wbr>long<wbr>word text:

  // Atomic units:
  [
    { content: 'Very', visualLength: 4, semanticType: 'text', breakPriority: 3 },
    { content: '<wbr>', visualLength: 0, semanticType: 'wbr', breakPriority: 9 },
    { content: 'long', visualLength: 4, semanticType: 'text', breakPriority: 3 },
    { content: '<wbr>', visualLength: 0, semanticType: 'wbr', breakPriority: 9 },
    { content: 'word', visualLength: 4, semanticType: 'text', breakPriority: 3 },
    { content: ' ', visualLength: 1, semanticType: 'text', breakPriority: 8 },
    { content: 'text', visualLength: 4, semanticType: 'text', breakPriority: 3 }
  ]

  // If line too long, break at space (priority 8) or <wbr> (priority 9)
  // Result: Very<wbr>long<wbr>word<wbr> text (stays inline with break opportunities)

  This system gives us complete control over inline formatting while respecting semantic boundaries!
