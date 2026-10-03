import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"

import { HerbClient } from "../src/dev-server/client"
import { UnavailableAlert } from "../src/dev-server/unavailable-alert"
import { DEV_SERVER_COMMAND } from "../src/dev-server/types"

const ALERT = "#herbDevServerUnavailableAlert"

function alert(): HTMLElement | null {
  return document.querySelector(ALERT)
}

beforeEach(() => {
  document.body.innerHTML = ""
  UnavailableAlert.reset()
})

afterEach(() => {
  document.body.innerHTML = ""
  UnavailableAlert.reset()
})

describe("the dev server unavailable alert", () => {
  test("names the command that starts the dev server", () => {
    UnavailableAlert.show({ port: 8592, onRetry: () => {} })

    expect(alert()?.querySelector("code")?.textContent).toBe(DEV_SERVER_COMMAND)
    expect(DEV_SERVER_COMMAND).toBe("bundle exec herb dev")
  })

  test("names the port nothing answered on, since a project can move it", () => {
    UnavailableAlert.show({ port: 4000, onRetry: () => {} })

    expect(alert()?.textContent).toContain("port 4000")
  })

  test("draws one alert however often the connection fails again", () => {
    UnavailableAlert.show({ port: 8592, onRetry: () => {} })
    UnavailableAlert.show({ port: 8592, onRetry: () => {} })

    expect(document.querySelectorAll(ALERT)).toHaveLength(1)
  })

  test("retries and takes itself off the page when the button is pressed", () => {
    const onRetry = vi.fn()

    UnavailableAlert.show({ port: 8592, onRetry })

    const retry = Array.from(alert()!.querySelectorAll("button")).find(button => button.textContent === "Retry")

    retry!.click()

    expect(onRetry).toHaveBeenCalledOnce()
    expect(alert()).toBeNull()
  })

  test("stays away once dismissed, so a page nobody is debugging stays quiet", () => {
    UnavailableAlert.show({ port: 8592, onRetry: () => {} })

    const dismiss = Array.from(alert()!.querySelectorAll("button")).find(button => button.textContent !== "Retry")

    dismiss!.click()

    expect(alert()).toBeNull()

    UnavailableAlert.show({ port: 8592, onRetry: () => {} })

    expect(alert()).toBeNull()
  })

  test("comes back after a connection, which makes the next outage news again", () => {
    UnavailableAlert.show({ port: 8592, onRetry: () => {} })

    const dismiss = Array.from(alert()!.querySelectorAll("button")).find(button => button.textContent !== "Retry")

    dismiss!.click()

    UnavailableAlert.reset()
    UnavailableAlert.show({ port: 8592, onRetry: () => {} })

    expect(alert()).not.toBeNull()
  })
})

describe("a client that cannot reach the dev server", () => {
  test("holds the hint back on the first failed attempt, which is usually a restart", () => {
    const client = new HerbClient({ port: 8592 })

    client["onReconnecting"](1, 10, 1000)

    expect(alert()).toBeNull()
  })

  test("shows the hint once the server has stayed silent, without waiting to give up", () => {
    const client = new HerbClient({ port: 8592 })

    client["onReconnecting"](3, 10, 4000)

    expect(alert()?.textContent).toContain(DEV_SERVER_COMMAND)
  })

  test("keeps quiet while a server it already reached is coming back", () => {
    const client = new HerbClient({ port: 8592 })

    client["hasConnectedBefore"] = true
    client["onReconnecting"](5, 10, 4000)

    expect(alert()).toBeNull()
  })

  test("shows the hint once it gives up, even on a server it had reached", () => {
    const client = new HerbClient({ port: 8592 })

    client["hasConnectedBefore"] = true
    client["onGivenUp"]()

    expect(alert()?.textContent).toContain(DEV_SERVER_COMMAND)
  })

  test("takes the hint off the page as soon as the server answers", () => {
    const client = new HerbClient({ port: 8592 })

    client["onGivenUp"]()
    client["onConnect"]()

    expect(alert()).toBeNull()
  })
})
