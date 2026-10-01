const DIGEST_PATTERN = /-[0-9a-f]{8,64}(\.\w+)$/

export async function refreshStylesheets(): Promise<number> {
  const response = await fetch(window.location.href, { headers: { Accept: "text/html" } })

  if (!response.ok) {
    return 0
  }

  const fresh = new DOMParser().parseFromString(await response.text(), "text/html")
  const links = [...fresh.querySelectorAll('link[rel="stylesheet"]')]

  let swapped = 0

  for (const link of links) {
    const href = link.getAttribute("href")

    if (!href) {
      continue
    }

    const live = currentLink(href)

    if (!live || live.getAttribute("href") === href) {
      continue
    }

    await swap(live, href)

    swapped += 1
  }

  return swapped
}

function currentLink(href: string): HTMLLinkElement | null {
  const logical = logicalName(href)

  for (const link of document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')) {
    if (logicalName(link.getAttribute("href") ?? "") === logical) {
      return link
    }
  }

  return null
}

function logicalName(href: string): string {
  return href.split("?")[0].replace(DIGEST_PATTERN, "$1")
}

function swap(live: HTMLLinkElement, href: string): Promise<void> {
  return new Promise((resolve) => {
    const next = live.cloneNode() as HTMLLinkElement

    next.setAttribute("href", href)

    next.onload = () => {
      live.remove()
      resolve()
    }

    next.onerror = () => {
      next.remove()
      resolve()
    }

    live.after(next)
  })
}
