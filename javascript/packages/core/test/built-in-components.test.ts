import { describe, test, expect } from "vitest"

import { BUILT_IN_COMPONENTS, COMPONENT_DEFINITIONS, DEFERRED_COMPONENTS, componentAttribute, isBuiltInComponent, isComponentTagName } from "../src/built-in-components.js"

describe("BUILT_IN_COMPONENTS", () => {
  test("holds every component the config defines", () => {
    expect(BUILT_IN_COMPONENTS.length).toBeGreaterThan(0)
  })

  test("gives every component a definition keyed by its own name", () => {
    for (const component of BUILT_IN_COMPONENTS) {
      expect(COMPONENT_DEFINITIONS[component].name).toBe(component)
    }
  })

  test("defers only components it knows", () => {
    for (const component of DEFERRED_COMPONENTS) {
      expect(isBuiltInComponent(component)).toBe(true)
    }
  })

  test("names only components it knows as a parent", () => {
    for (const component of BUILT_IN_COMPONENTS) {
      for (const parent of COMPONENT_DEFINITIONS[component].parents ?? []) {
        expect(isBuiltInComponent(parent)).toBe(true)
      }
    }
  })

  test("describes every component and every attribute it takes", () => {
    for (const component of BUILT_IN_COMPONENTS) {
      const definition = COMPONENT_DEFINITIONS[component]

      expect(definition.description.length).toBeGreaterThan(0)

      for (const attribute of definition.attributes) {
        expect(attribute.description.length).toBeGreaterThan(0)
        expect(["milliseconds", "state_list"]).toContain(attribute.type)
      }
    }
  })
})

describe("componentAttribute", () => {
  test("answers the attribute a component takes", () => {
    expect(componentAttribute("Fragment", "on")?.type).toBe("state_list")
    expect(componentAttribute("Async", "poll")?.type).toBe("milliseconds")
  })

  test("answers nothing for an attribute the component does not take", () => {
    expect(componentAttribute("Async", "on")).toBeUndefined()
    expect(componentAttribute("Fallback", "delay")).toBeUndefined()
  })
})

describe("isBuiltInComponent", () => {
  test("recognizes every built-in component", () => {
    for (const component of BUILT_IN_COMPONENTS) {
      expect(isBuiltInComponent(component)).toBe(true)
    }
  })

  test("does not recognize a differently cased spelling", () => {
    expect(isBuiltInComponent("async")).toBe(false)
    expect(isBuiltInComponent("ASYNC")).toBe(false)
    expect(isBuiltInComponent("fragment")).toBe(false)
  })

  test("does not recognize another component or an HTML element", () => {
    expect(isBuiltInComponent("MyWidget")).toBe(false)
    expect(isBuiltInComponent("div")).toBe(false)
  })

  test("handles a missing tag name", () => {
    expect(isBuiltInComponent(null)).toBe(false)
    expect(isBuiltInComponent(undefined)).toBe(false)
    expect(isBuiltInComponent("")).toBe(false)
  })
})

describe("isComponentTagName", () => {
  test("recognizes a capitalized tag name carrying a lowercase character", () => {
    expect(isComponentTagName("Fragment")).toBe(true)
    expect(isComponentTagName("MyWidget")).toBe(true)
    expect(isComponentTagName("Card2")).toBe(true)
  })

  test("does not recognize an uppercased HTML tag name", () => {
    expect(isComponentTagName("DIV")).toBe(false)
  })

  test("does not recognize a lowercase or hyphenated tag name", () => {
    expect(isComponentTagName("div")).toBe(false)
    expect(isComponentTagName("My-Widget")).toBe(false)
  })

  test("handles a missing tag name", () => {
    expect(isComponentTagName(null)).toBe(false)
    expect(isComponentTagName(undefined)).toBe(false)
    expect(isComponentTagName("")).toBe(false)
  })
})
