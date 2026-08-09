(() => {
  if (!("highlights" in CSS)) return

  const priorities = { error: 4, warning: 3, info: 2, hint: 1 }
  const rangesBySeverity = new Map()

  const rangeForColumns = (line, start, end) => {
    const walker = document.createTreeWalker(line, NodeFilter.SHOW_TEXT, {
      acceptNode: (node) =>
        node.parentElement.closest(".herb-annotation-message") ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT,
    })

    let offset = 0
    let startNode = null
    let startOffset = 0
    let endNode = null
    let endOffset = 0

    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const length = node.data.length

      if (startNode === null && start < offset + length) {
        startNode = node
        startOffset = start - offset
      }

      if (end <= offset + length) {
        endNode = node
        endOffset = end - offset
        break
      }

      offset += length
    }

    if (startNode === null || endNode === null) return null

    const range = new Range()
    range.setStart(startNode, startOffset)
    range.setEnd(endNode, endOffset)

    return range
  }

  for (const line of document.querySelectorAll(".herb-line[data-herb-markers]")) {
    let markers

    try {
      markers = JSON.parse(line.getAttribute("data-herb-markers"))
    } catch {
      continue
    }

    for (const [start, end, severity] of markers) {
      const range = rangeForColumns(line, start, end)

      if (range === null) continue

      if (!rangesBySeverity.has(severity)) rangesBySeverity.set(severity, [])

      rangesBySeverity.get(severity).push(range)
    }
  }

  for (const [severity, ranges] of rangesBySeverity) {
    const highlight = new Highlight(...ranges)

    highlight.priority = priorities[severity] ?? 0

    CSS.highlights.set(`herb-marker-${severity}`, highlight)
  }
})()
