import { describe, test, expect } from "vitest"

import { helperExists, viewHelperExists, getHelpersByReceiver } from "../src/action-view-helpers.js"

describe("viewHelperExists", () => {
  test("accepts helpers callable without a receiver in a template", () => {
    expect(viewHelperExists("link_to")).toBe(true)
    expect(viewHelperExists("image_tag")).toBe(true)
    expect(viewHelperExists("label")).toBe(true)
  })

  test("accepts helper aliases", () => {
    expect(viewHelperExists("path_to_asset")).toBe(true)
    expect(viewHelperExists("checkbox")).toBe(true)
  })

  test("rejects helpers that only exist on the form builder", () => {
    expect(viewHelperExists("button")).toBe(false)
    expect(viewHelperExists("submit")).toBe(false)
  })

  test("rejects unknown names", () => {
    expect(viewHelperExists("title")).toBe(false)
    expect(viewHelperExists("")).toBe(false)
  })

  test("accepts internal helpers, which are still view-callable", () => {
    expect(viewHelperExists("error_message")).toBe(true)
  })

  test("covers every form builder helper", () => {
    for (const helper of getHelpersByReceiver("form_builder")) {
      expect(helperExists(helper.name)).toBe(true)
      expect(viewHelperExists(helper.name)).toBe(false)
    }
  })
})

describe("helperExists", () => {
  test("stays plain registry membership, including form builder helpers", () => {
    expect(helperExists("button")).toBe(true)
    expect(helperExists("submit")).toBe(true)
    expect(helperExists("link_to")).toBe(true)
    expect(helperExists("title")).toBe(false)
  })
})
