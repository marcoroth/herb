import { describe, test, expect, afterEach, vi } from "vitest"

import { Runtime } from "../src/runtime"
import { transitionMutation } from "../src/shared/transitions"

type StartViewTransition = ((update: () => void) => unknown) | undefined

const documentWithVT = document as unknown as { startViewTransition?: StartViewTransition }
const native = documentWithVT.startViewTransition

interface FakeTransition {
  ready: Promise<void>
  finished: Promise<void>
  updateCallbackDone: Promise<void>
  skipTransition(): void
}

function stub(): { calls: number; names: string[][] } {
  const seen = { calls: 0, names: [] as string[][] }

  documentWithVT.startViewTransition = (update: () => void): FakeTransition => {
    seen.calls += 1
    update()
    seen.names.push([...document.querySelectorAll<HTMLElement>("[data-herb-transition]")].map((el) => el.style.viewTransitionName))

    return {
      ready: Promise.resolve(),
      finished: Promise.resolve(),
      updateCallbackDone: Promise.resolve(),
      skipTransition: () => {},
    }
  }

  return seen
}

afterEach(() => {
  documentWithVT.startViewTransition = native
  document.body.innerHTML = ""
})

describe("content security policy", () => {
  test("the injected style element carries the page's csp nonce", async () => {
    document.head.innerHTML = `<meta name="csp-nonce" content="abc123">`
    document.body.innerHTML = `<div data-herb-transition><p id="content">before</p></div>`

    let nonce: string | null = null

    documentWithVT.startViewTransition = ((update: () => void) => {
      nonce = document.querySelector("style")?.nonce ?? null
      update()

      return { ready: Promise.resolve(), finished: Promise.resolve(), updateCallbackDone: Promise.resolve(), skipTransition() {} }
    }) as StartViewTransition

    await transitionMutation(() => {
      document.getElementById("content")!.textContent = "after"
    })

    document.head.innerHTML = ""

    expect(nonce).toBe("abc123")
  })
})

describe("a start that throws", () => {
  test("still runs the mutation, removes the style, and stays unwedged", async () => {
    document.body.innerHTML = `<div data-herb-transition><p id="content">before</p></div>`

    documentWithVT.startViewTransition = (() => {
      throw new TypeError("boom")
    }) as StartViewTransition

    await transitionMutation(() => {
      document.getElementById("content")!.textContent = "after"
    })

    expect(document.getElementById("content")!.textContent).toBe("after")
    expect(document.querySelector("style")).toBeNull()

    documentWithVT.startViewTransition = ((update: () => void) => {
      update()

      return { ready: Promise.resolve(), finished: Promise.resolve(), updateCallbackDone: Promise.resolve(), skipTransition() {} }
    }) as StartViewTransition

    await transitionMutation(() => {
      document.getElementById("content")!.textContent = "again"
    })

    expect(document.getElementById("content")!.textContent).toBe("again")
  })
})

describe("typed transitions", () => {
  test("passes types through the config form of startViewTransition", async () => {
    document.body.innerHTML = `<div data-herb-transition="panel"><p id="content">before</p></div>`

    let received: string[] | null = null

    documentWithVT.startViewTransition = ((config: { update: () => void; types: string[] } | (() => void)) => {
      if (typeof config === "function") {
        config()
      } else {
        received = config.types
        config.update()
      }

      return { ready: Promise.resolve(), finished: Promise.resolve(), updateCallbackDone: Promise.resolve(), skipTransition() {} }
    }) as StartViewTransition

    await transitionMutation(() => {
      document.getElementById("content")!.textContent = "after"
    }, document, { type: "forward" })

    expect(received).toEqual(["forward"])
    expect(document.getElementById("content")!.textContent).toBe("after")
  })

  test("falls back to the callback form when the config form throws", async () => {
    document.body.innerHTML = `<div data-herb-transition="panel"><p id="content">before</p></div>`

    let calls = 0

    documentWithVT.startViewTransition = ((config: { update: () => void } | (() => void)) => {
      calls += 1

      if (typeof config !== "function") {
        throw new TypeError("callback expected")
      }

      config()

      return { ready: Promise.resolve(), finished: Promise.resolve(), updateCallbackDone: Promise.resolve(), skipTransition() {} }
    }) as StartViewTransition

    await transitionMutation(() => {
      document.getElementById("content")!.textContent = "after"
    }, document, { type: "forward" })

    expect(calls).toBe(2)
    expect(document.getElementById("content")!.textContent).toBe("after")
  })

  test("a typed swap leaves unnamed marks unnamed, so they ride the parent snapshot", async () => {
    document.body.innerHTML = `<div data-herb-transition="panel"><p data-herb-transition id="plain">before</p></div>`

    let named: string | null = null
    let unnamed: string | null = null

    documentWithVT.startViewTransition = ((config: { update: () => void; types: string[] } | (() => void)) => {
      const update = typeof config === "function" ? config : config.update

      update()

      named = document.querySelector<HTMLElement>("[data-herb-transition=panel]")!.style.viewTransitionName || null
      unnamed = document.getElementById("plain")!.style.viewTransitionName || null

      return { ready: Promise.resolve(), finished: Promise.resolve(), updateCallbackDone: Promise.resolve(), skipTransition() {} }
    }) as StartViewTransition

    await transitionMutation(() => {
      document.getElementById("plain")!.textContent = "after"
    }, document, { type: "backward" })

    expect(named).toBe("panel")
    expect(unnamed).toBeNull()
  })
})

describe("transitionMutation", () => {
  test("a marked element runs the mutation inside a view transition and names itself", async () => {
    document.body.innerHTML = `<div data-herb-transition><p id="content">before</p></div>`

    const seen = stub()
    const mutate = vi.fn(() => {
      document.getElementById("content")!.textContent = "after"
    })

    await transitionMutation(mutate)

    expect(seen.calls).toBe(1)
    expect(mutate).toHaveBeenCalledTimes(1)
    expect(document.body.innerHTML).toContain("after")
    expect(seen.names[0]).toEqual(["match-element"])

    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(document.querySelector<HTMLElement>("[data-herb-transition]")!.style.viewTransitionName).toBe("")
  })

  test("a valued attribute names the transition for user CSS", async () => {
    document.body.innerHTML = `<div data-herb-transition="side panel"></div>`

    const seen = stub()

    await transitionMutation(() => {})

    expect(seen.names[0]).toEqual(["side-panel"])
  })

  test("CSS turning every marked element off skips the transition", async () => {
    document.body.innerHTML = `<style>#off { view-transition-name: none !important }</style><div id="off" data-herb-transition><p id="content">before</p></div>`

    const seen = stub()

    await transitionMutation(() => {
      document.getElementById("content")!.textContent = "after"
    })

    expect(document.getElementById("content")!.textContent).toBe("after")
    expect(seen.calls).toBe(0)
    expect(document.getElementById("off")!.style.viewTransitionName).toBe("")
  })

  test("one live marked element keeps the transition despite a vetoed sibling", async () => {
    document.body.innerHTML = `<style>#off { view-transition-name: none !important }</style><div id="off" data-herb-transition></div><div data-herb-transition></div>`

    const seen = stub()

    await transitionMutation(() => {})

    expect(seen.calls).toBe(1)
  })

  test("a hidden document mutates without a transition", async () => {
    document.body.innerHTML = `<div data-herb-transition><p id="content">before</p></div>`

    const seen = stub()

    Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true })

    try {
      await transitionMutation(() => {
        document.getElementById("content")!.textContent = "after"
      })
    } finally {
      Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true })
    }

    expect(document.getElementById("content")!.textContent).toBe("after")
    expect(seen.calls).toBe(0)
  })

  test("a page without marked elements mutates without a transition", async () => {
    document.body.innerHTML = `<div><p id="content">before</p></div>`

    const seen = stub()

    await transitionMutation(() => {
      document.getElementById("content")!.textContent = "after"
    })

    expect(seen.calls).toBe(0)
    expect(document.body.innerHTML).toContain("after")
  })

  test("an open modal dialog skips the transition and keeps the mutation", async () => {
    document.body.innerHTML = `<div data-herb-transition></div><dialog id="modal"><p>open</p></dialog>`
    document.querySelector<HTMLDialogElement>("#modal")!.showModal()

    const seen = stub()
    const mutate = vi.fn()

    await transitionMutation(mutate)

    document.querySelector<HTMLDialogElement>("#modal")!.close()

    expect(seen.calls).toBe(0)
    expect(mutate).toHaveBeenCalledTimes(1)
  })

  test("a browser without the API mutates without a transition", async () => {
    document.body.innerHTML = `<div data-herb-transition><p id="content">before</p></div>`

    documentWithVT.startViewTransition = undefined

    await transitionMutation(() => {
      document.getElementById("content")!.textContent = "after"
    })

    expect(document.body.innerHTML).toContain("after")
  })

  test("concurrent mutations batch into one following transition", async () => {
    document.body.innerHTML = `<div data-herb-transition></div>`

    const seen = stub()
    const order: number[] = []

    await Promise.all([
      transitionMutation(() => order.push(1)),
      transitionMutation(() => order.push(2)),
      transitionMutation(() => order.push(3)),
    ])

    expect(order).toEqual([1, 2, 3])
    expect(seen.calls).toBeLessThanOrEqual(2)
  })

  test("naming stays scoped to the mutation's own subtree", async () => {
    document.body.innerHTML = `<div id="mine" data-herb-transition="mine"></div><div data-herb-transition="other"></div>`

    const seen = stub()

    await transitionMutation(() => {}, document.getElementById("mine")!)

    expect(seen.names[0]).toEqual(["mine", ""])
  })

  test("elements added by the mutation get named before the new capture", async () => {
    document.body.innerHTML = `<div id="host" data-herb-transition></div>`

    const seen = stub()

    await transitionMutation(() => {
      document.getElementById("host")!.insertAdjacentHTML("afterend", `<div data-herb-transition="fresh"></div>`)
    })

    expect(seen.names[0]).toEqual(["match-element", "fresh"])
  })
})

const FILE = "app/views/chat/panel.html.erb"

function panelPage(marked: boolean): string {
  return (
    `<!--herb-region:${FILE}:aaaaaaaa:0-->` +
    `<!--herb-slot:0:conditional--><!--herb-branch:0:1--><!--/herb-slot:0-->` +
    `<template data-herb-region="${FILE}:aaaaaaaa">` +
    `<!--herb-branch:0:0--><div id="panel"${marked ? ' data-herb-transition="panel"' : ""}>opened</div>` +
    `<!--herb-branch:0:1-->` +
    `</template>` +
    `<!--/herb-region:${FILE}-->` +
    `<template data-herb-dependencies>${JSON.stringify({
      state: {},
      states: {
        [FILE]: {
          version: "aaaaaaaa",
          declarations: [{ name: "open", kind: "boolean", default: "false", value: false, scope: "region" }],
          reads: {},
          conditionals: { 0: { arms: [{ branch: 0, condition: ["open", null] }], else: 1 } },
          presence: {},
          computed: {},
          server: { branches: {}, reads: {} },
        },
      },
    })}</template>`
  )
}

describe("marked branch flips", () => {
  let runtime: Runtime | null = null

  afterEach(() => {
    runtime?.stop()
    runtime = null
    document.body.innerHTML = ""
  })

  test("mounting into unmarked surroundings stays synchronous", () => {
    document.body.innerHTML = panelPage(true)

    const seen = stub()

    runtime = Runtime.start({ state: { refetch: "off" } })
    runtime.state.setState({ open: true })

    expect(document.body.innerHTML).toContain("opened")
    expect(seen.calls).toBe(0)
  })

  test("flipping away from visible marked content runs a view transition", async () => {
    document.body.innerHTML = panelPage(true)

    const seen = stub()

    runtime = Runtime.start({ state: { refetch: "off" } })
    runtime.state.setState({ open: true })

    expect(document.body.innerHTML).toContain("opened")

    runtime.state.setState({ open: false })

    await vi.waitFor(() => {
      if (document.body.innerHTML.includes("opened")) {
        throw new Error("still waiting")
      }
    })

    expect(seen.calls).toBe(1)
  })

  test("an unmarked branch flips synchronously", () => {
    document.body.innerHTML = panelPage(false)

    const seen = stub()

    runtime = Runtime.start({ state: { refetch: "off" } })
    runtime.state.setState({ open: true })

    expect(document.body.innerHTML).toContain("opened")
    expect(seen.calls).toBe(0)
  })
})

const READ_FILE = "app/views/chat/detail.html.erb"

function detailPage(): string {
  return (
    `<!--herb-region:${READ_FILE}:aaaaaaaa:0-->` +
    `<!--herb-slot:0:conditional--><!--herb-branch:0:1--><!--/herb-slot:0-->` +
    `<template data-herb-region="${READ_FILE}:aaaaaaaa">` +
    `<!--herb-branch:0:0--><div data-herb-transition="detail"><span id="value"><!--herb-slot:1--><!--/herb-slot:1--></span></div>` +
    `<!--herb-branch:0:1-->` +
    `</template>` +
    `<!--/herb-region:${READ_FILE}-->` +
    `<template data-herb-dependencies>${JSON.stringify({
      state: {},
      states: {
        [READ_FILE]: {
          version: "aaaaaaaa",
          declarations: [{ name: "album", kind: "string", default: '""', value: "", scope: "region" }],
          reads: { album: [1] },
          conditionals: { 0: { arms: [{ branch: 0, condition: ["album", null, "present"] }], else: 1 } },
          presence: {},
          computed: {},
          server: { branches: {}, reads: {} },
        },
      },
    })}</template>`
  )
}

describe("reads in a leaving branch", () => {
  let runtime: Runtime | null = null

  afterEach(() => {
    runtime?.stop()
    runtime = null
    document.body.innerHTML = ""
  })

  test("a read inside a leaving branch keeps what it showed", async () => {
    document.body.innerHTML = detailPage()

    let shownAtCapture: string | null = null

    documentWithVT.startViewTransition = (update: () => void): FakeTransition => {
      shownAtCapture = document.getElementById("value")?.textContent ?? null

      update()

      return {
        ready: Promise.resolve(),
        finished: Promise.resolve(),
        updateCallbackDone: Promise.resolve(),
        skipTransition: () => {},
      }
    }

    runtime = Runtime.start({ state: { refetch: "off" } })
    runtime.state.setState({ album: "basel" })

    expect(document.getElementById("value")?.textContent).toBe("basel")

    runtime.state.setState({ album: "" })

    await vi.waitFor(() => {
      if (document.getElementById("value")) {
        throw new Error("still waiting")
      }
    })

    expect(shownAtCapture).toBe("basel")
  })
})

describe("collection appends", () => {
  let runtime: Runtime | null = null

  afterEach(() => {
    runtime?.stop()
    runtime = null
    document.body.innerHTML = ""
  })

  test("an appended item lands inside a view transition when rows are marked", async () => {
    const LIST = "app/views/chat/list.html.erb"

    document.body.innerHTML =
      `<!--herb-region:${LIST}:bbbbbbbb:0--><ul>` +
      `<!--herb-slot:0:collection-->` +
      `<!--herb-item:0:1--><li data-herb-transition data-herb-slot="1:child">one</li><!--/herb-item:0-->` +
      `<!--/herb-slot:0--></ul>` +
      `<template data-herb-region="${LIST}:bbbbbbbb"><!--herb-branch:0:item-->` +
      `<!--herb-item:0:--><li data-herb-transition data-herb-slot="1:child"></li><!--/herb-item:0--></template>` +
      `<!--/herb-region:${LIST}-->`

    const seen = stub()
    const transport = vi.fn(async () => ({
      template: LIST,
      version: "bbbbbbbb",
      occurrence: 0,
      slots: { 0: { items: { 1: { 1: "one" }, 2: { 1: "two" } }, order: ["1", "2"] } },
    }))

    runtime = Runtime.start({ state: { refetchTransport: transport } })

    await runtime.refresh()

    expect(document.body.innerHTML).toContain("two")
    expect(seen.calls).toBe(1)
    expect(document.querySelectorAll("li").length).toBe(2)
  })
})
