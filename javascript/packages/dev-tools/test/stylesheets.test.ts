import { describe, test, expect, afterEach, vi } from "vitest"

import { refreshStylesheets } from "../src/dev-server/stylesheets"

function liveLink(href: string): HTMLLinkElement {
  const link = document.createElement("link")

  link.rel = "stylesheet"
  link.setAttribute("href", href)
  document.head.appendChild(link)

  return link
}

function pageWith(href: string): Response {
  return new Response(`<html><head><link rel="stylesheet" href="${href}"></head><body></body></html>`, {
    status: 200,
    headers: { "Content-Type": "text/html" },
  })
}

afterEach(() => {
  document.querySelectorAll('link[rel="stylesheet"]').forEach((link) => link.remove())
  vi.unstubAllGlobals()
})

describe("refreshStylesheets", () => {
  test("swaps a stylesheet whose digest moved and drops the stale link", async () => {
    const old = liveLink("/src/base.css?v=old")

    vi.stubGlobal("fetch", vi.fn(async () => pageWith("/src/base.css?v=new")))

    expect(await refreshStylesheets()).toBe(1)
    expect(old.isConnected).toBe(false)
    expect(document.querySelector('link[href="/src/base.css?v=new"]')).not.toBeNull()
  })

  test("leaves an unchanged stylesheet alone", async () => {
    const link = liveLink("/src/base.css?v=old")

    vi.stubGlobal("fetch", vi.fn(async () => pageWith("/src/base.css?v=old")))

    expect(await refreshStylesheets()).toBe(0)
    expect(link.isConnected).toBe(true)
  })

  test("matches links by logical name across digests, and a failed load keeps the old rules", async () => {
    const old = liveLink("/assets/application-aaaaaaaa.css")

    vi.stubGlobal("fetch", vi.fn(async () => pageWith("/assets/application-bbbbbbbb.css")))

    expect(await refreshStylesheets()).toBe(1)
    expect(old.isConnected).toBe(true)
    expect(document.querySelector('link[href="/assets/application-bbbbbbbb.css"]')).toBeNull()
  })

  test("ignores a stylesheet the page does not hold", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => pageWith("/assets/other-bbbbbbbb.css")))

    expect(await refreshStylesheets()).toBe(0)
  })
})
