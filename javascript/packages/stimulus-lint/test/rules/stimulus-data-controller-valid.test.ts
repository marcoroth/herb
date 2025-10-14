import { describe, it, expect, beforeAll } from "vitest"
import { Herb } from "@herb-tools/node-wasm"
import { Project } from "stimulus-parser"
import { StimulusLinter } from "../../src/linter.js"
import { StimulusDataControllerValidRule } from "../../src/rules/stimulus-data-controller-valid.js"

describe("StimulusDataControllerValidRule", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  const herb = Herb

  describe("without Stimulus project context", () => {
    it("should not report errors when no project is provided", () => {
      const linter = new StimulusLinter(herb, [StimulusDataControllerValidRule])

      const source = `
        <div data-controller="hello">
          <button data-controller="dropdown">Click me</button>
        </div>
      `

      const result = linter.lint(source)
      expect(result.offenses).toHaveLength(0)
    })
  })

  describe("with Stimulus project context", () => {
    it("should report error for unknown controller", () => {
      const project = new Project("/fake/path")
      const linter = new StimulusLinter(herb, [StimulusDataControllerValidRule], project)

      Object.defineProperty(project, "registeredControllers", {
        get: () => [
          { identifier: "hello" },
          { identifier: "modal" }
        ]
      })

      const source = `
        <div data-controller="hello">
          <button data-controller="unknown-controller">Click me</button>
        </div>
      `

      const result = linter.lint(source)
      expect(result.offenses).toHaveLength(1)
      expect(result.offenses[0].message).toBe("Unknown Stimulus controller `unknown-controller`. Make sure the controller is defined in your project.")
      expect(result.offenses[0].severity).toBe("error")
    })

    it("should validate multiple controllers in single attribute", () => {
      const project = new Project("/fake/path")
      const linter = new StimulusLinter(herb, [StimulusDataControllerValidRule], project)

      Object.defineProperty(project, "registeredControllers", {
        get: () => [
          { identifier: "hello" },
          { identifier: "modal" }
        ]
      })

      const source = `
        <div data-controller="hello modal unknown another-unknown">
          Content
        </div>
      `

      const result = linter.lint(source)
      expect(result.offenses).toHaveLength(2)
      expect(result.offenses[0].message).toBe("Unknown Stimulus controller `unknown`. Make sure the controller is defined in your project.")
      expect(result.offenses[1].message).toBe("Unknown Stimulus controller `another-unknown`. Make sure the controller is defined in your project.")
    })

    it("should handle valid controllers", () => {
      const project = new Project("/fake/path")
      const linter = new StimulusLinter(herb, [StimulusDataControllerValidRule], project)

      Object.defineProperty(project, "registeredControllers", {
        get: () => [
          { identifier: "hello" },
          { identifier: "modal" },
          { identifier: "dropdown" }
        ]
      })

      const source = `
        <div data-controller="hello">
          <button data-controller="modal dropdown">Click me</button>
        </div>
      `

      const result = linter.lint(source)
      expect(result.offenses).toHaveLength(0)
    })

    it("should ignore dynamic ERB content in data-controller", () => {
      const project = new Project("/fake/path")
      const linter = new StimulusLinter(herb, [StimulusDataControllerValidRule], project)

      const source = `
        <div data-controller="<%= controller_name %>">
          Content
        </div>
      `

      const result = linter.lint(source)
      expect(result.offenses).toHaveLength(0)
    })

    it("should ignore mixed static and dynamic content", () => {
      const project = new Project("/fake/path")
      const linter = new StimulusLinter(herb, [StimulusDataControllerValidRule], project)

      Object.defineProperty(project, "registeredControllers", {
        get: () => [
          { identifier: "hello" }
        ]
      })

      const source = `
        <div data-controller="hello <%= additional_controllers %>">
          Content
        </div>
      `

      const result = linter.lint(source)
      expect(result.offenses).toHaveLength(0)
    })

    it("should handle empty data-controller attribute", () => {
      const project = new Project("/fake/path")
      const linter = new StimulusLinter(herb, [StimulusDataControllerValidRule], project)

      const source = `
        <div data-controller="">
          Content
        </div>
      `

      const result = linter.lint(source)
      expect(result.offenses).toHaveLength(0)
    })

    it("should handle whitespace in controller names", () => {
      const project = new Project("/fake/path")
      const linter = new StimulusLinter(herb, [StimulusDataControllerValidRule], project)

      Object.defineProperty(project, "registeredControllers", {
        get: () => [
          { identifier: "hello" }
        ]
      })

      const source = `
        <div data-controller="  hello  ">
          Content
        </div>
      `

      const result = linter.lint(source)
      expect(result.offenses).toHaveLength(0)
    })

    it("should report correct location for offenses", () => {
      const project = new Project("/fake/path")
      const linter = new StimulusLinter(herb, [StimulusDataControllerValidRule], project)

      Object.defineProperty(project, "controllerDefinitions", {
        get: () => []
      })

      const source = `<div data-controller="unknown"></div>`

      const result = linter.lint(source)
      expect(result.offenses).toHaveLength(1)

      const offense = result.offenses[0]
      expect(offense.location).toBeDefined()
      expect(offense.rule).toBe("stimulus-data-controller-valid")
    })
  })

  describe("integration with StimulusLinter", () => {
    it("should count rules correctly", () => {
      const linter = new StimulusLinter(herb, [StimulusDataControllerValidRule])
      expect(linter.getRuleCount()).toBe(1)
    })

    it("should handle file context", () => {
      const project = new Project("/fake/path")
      const linter = new StimulusLinter(herb, [StimulusDataControllerValidRule], project)

      Object.defineProperty(project, "controllerDefinitions", {
        get: () => [
          { guessedIdentifier: "hello" }
        ]
      })

      const source = `
        <div data-controller="unknown">
          Content
        </div>
      `

      const result = linter.lint(source, { fileName: "test.html.erb" })
      expect(result.offenses).toHaveLength(1)
    })
  })
})
