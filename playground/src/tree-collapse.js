export function makeTreeCollapsible(element) {
  const html = element.innerHTML
  const lines = html.split("\n")

  const processedLines = lines.map((lineHtml, index) => {
    const tempElement = document.createElement("span")
    tempElement.innerHTML = lineHtml
    const plainText = tempElement.textContent || ""
    const depth = getLineDepth(plainText)
    const isNodeLine = lineHtml.includes('class="token node"') || lineHtml.includes('class="token error-class"')

    const toggleHtml = isNodeLine
      ? '<span class="tree-toggle" data-collapsed="false"></span>'
      : ""

    const classes = ["tree-line"]
    if (isNodeLine) classes.push("tree-collapsible")

    return `<span class="${classes.join(" ")}" data-depth="${depth}" data-line-index="${index}">${toggleHtml}${lineHtml}</span>`
  })

  element.innerHTML = processedLines.join("")

  element.querySelectorAll(".tree-toggle").forEach((toggle) => {
    toggle.addEventListener("click", (event) => {
      event.preventDefault()
      event.stopPropagation()
      toggleTreeNode(toggle)
    })
  })

  element.querySelectorAll(".tree-collapsible .token.node, .tree-collapsible .token.error-class").forEach((token) => {
    const name = token.textContent.replace(/^@ /, "")
    token.dataset.name = name
    token.dataset.prefix = "@"

    token.addEventListener("click", (event) => {
      event.preventDefault()
      event.stopPropagation()
      const toggle = token.closest(".tree-collapsible").querySelector(".tree-toggle")
      if (toggle) toggleTreeNode(toggle)
    })
  })
}

export function expandAllNodes(element) {
  element.querySelectorAll(".tree-toggle").forEach((toggle) => {
    if (toggle.dataset.collapsed === "true") {
      toggleTreeNode(toggle)
    }
  })
}

export function collapseAllNodes(element) {
  const toggles = Array.from(element.querySelectorAll(".tree-toggle"))

  toggles.sort((a, b) => {
    const depthA = parseInt(a.closest(".tree-line").dataset.depth)
    const depthB = parseInt(b.closest(".tree-line").dataset.depth)
    return depthB - depthA
  })

  toggles.forEach((toggle) => {
    if (toggle.dataset.collapsed === "false") {
      toggleTreeNode(toggle)
    }
  })

  const rootToggle = toggles.find((toggle) => {
    return parseInt(toggle.closest(".tree-line").dataset.depth) === 0
  })

  if (rootToggle && rootToggle.dataset.collapsed === "true") {
    toggleTreeNode(rootToggle)
  }
}

export function revealTreeLine(element) {
  if (!element) return

  const line = element.closest(".tree-line")
  if (!line) return

  const depth = parseInt(line.dataset.depth)

  let current = line.previousElementSibling
  let currentDepth = depth

  while (current) {
    const siblingDepth = parseInt(current.dataset.depth)

    if (siblingDepth < currentDepth && current.classList.contains("tree-collapsible")) {
      const toggle = current.querySelector(".tree-toggle")
      if (toggle && toggle.dataset.collapsed === "true") {
        toggleTreeNode(toggle)
      }
      currentDepth = siblingDepth
    }

    if (siblingDepth === 0) break
    current = current.previousElementSibling
  }
}

function getLineDepth(plainText) {
  const match = plainText.match(/[A-Za-z@]/)
  if (!match) return 9999
  return Math.floor(match.index / 4)
}

function isBlankTreeLine(treeLine) {
  const plainText = treeLine.textContent.replace(/[\u25BC\u25B6]/g, "")
  return plainText.trim() === "" || /^[\s│├└─]*$/.test(plainText)
}

function toggleTreeNode(toggle) {
  const line = toggle.closest(".tree-line")
  const depth = parseInt(line.dataset.depth)
  const isCollapsed = toggle.dataset.collapsed === "true"

  const children = []
  let sibling = line.nextElementSibling

  while (sibling) {
    const siblingDepth = parseInt(sibling.dataset.depth)
    if (siblingDepth <= depth) break
    children.push(sibling)
    sibling = sibling.nextElementSibling
  }

  if (isCollapsed) {
    for (let index = 0; index < children.length; index++) {
      const child = children[index]
      child.style.display = ""

      if (child.classList.contains("tree-collapsible")) {
        const subToggle = child.querySelector(".tree-toggle")

        if (subToggle && subToggle.dataset.collapsed === "true") {
          const subDepth = parseInt(child.dataset.depth)
          index++

          while (index < children.length && parseInt(children[index].dataset.depth) > subDepth) {
            const nextIndex = index + 1

            if (nextIndex < children.length && parseInt(children[nextIndex].dataset.depth) <= subDepth && isBlankTreeLine(children[index])) {
              children[index].style.display = ""
            }

            index++
          }

          index--
        }
      }
    }
  } else {
    let lastVisibleBlank = -1

    for (let index = children.length - 1; index >= 0; index--) {
      if (isBlankTreeLine(children[index])) {
        lastVisibleBlank = index
        break
      }

      break
    }

    for (let index = 0; index < children.length; index++) {
      if (index === lastVisibleBlank) {
        children[index].style.display = ""
      } else {
        children[index].style.display = "none"
      }
    }
  }

  toggle.dataset.collapsed = isCollapsed ? "false" : "true"
  line.dataset.collapsed = toggle.dataset.collapsed

  const nodeToken = line.querySelector(".token.node, .token.error-class")

  if (nodeToken) {
    nodeToken.dataset.prefix = toggle.dataset.collapsed === "true" ? "-" : "@"
  }
}
