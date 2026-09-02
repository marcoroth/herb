import { ACTION_SELECTOR } from "../grammar/attributes"

import { report } from "./report"

import type { Slots } from "../slots/slots"

const NAVIGATION_EVENT = "turbo:load"

export function watchCoverage(slots: Slots): () => void {
  const check = (): void => {
    if (slots.regions().length > 0) {
      return
    }

    if (!document.querySelector(ACTION_SELECTOR)) {
      return
    }

    report({
      template: window.location.href,
      message: "This page has `data-herb-*` attributes but no slot regions, so nothing on it is interactive.",
      code: "herb-no-regions",
      severity: "warning",
      suggestion: "add `<%# herb:slots client %>` to the template that wrote them",
    })
  }

  check()

  if (typeof document === "undefined") {
    return () => {}
  }

  document.addEventListener(NAVIGATION_EVENT, check)

  return () => document.removeEventListener(NAVIGATION_EVENT, check)
}
