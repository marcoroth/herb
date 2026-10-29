import { describe, test, expect, beforeAll } from "vitest"

import { Herb } from "@herb-tools/node-wasm"
import { Config } from "@herb-tools/config"

import { Linter } from "../src/linter.js"
import { HTMLAllowedScriptTypeRule } from "../src/rules/html-allowed-script-type.js"

describe("per-rule custom options (#1204)", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  describe("resolveOptions", () => {
    test("user options override defaultOptions", () => {
      const rule = new HTMLAllowedScriptTypeRule()

      rule.resolveOptions({ allowBlank: false })

      expect(rule.options.allowBlank).toBe(false)
      expect(rule.options.allowedTypes).toEqual(rule.defaultOptions.allowedTypes)
      expect(rule.optionsErrors).toEqual([])
    })

    test("array options are replaced, not concatenated", () => {
      const rule = new HTMLAllowedScriptTypeRule()

      rule.resolveOptions({ allowedTypes: ["text/javascript"] })

      expect(rule.options.allowedTypes).toEqual(["text/javascript"])
    })

    test("reserved built-in keys in a rule's config are not treated as options", () => {
      const rule = new HTMLAllowedScriptTypeRule()

      rule.resolveOptions({
        enabled: false,
        severity: "warning",
        include: ["app/views/**/*"],
      })

      expect(rule.options).toEqual(rule.defaultOptions)
      expect(rule.optionsErrors).toEqual([])
    })

    test("an optionsSchema validation failure keeps the rule on its defaultOptions", () => {
      const rule = new HTMLAllowedScriptTypeRule()

      rule.resolveOptions({ allowBlank: "yes" })

      expect(rule.options).toEqual(rule.defaultOptions)
      expect(rule.optionsErrors).toHaveLength(1)
      expect(rule.optionsErrors[0].key).toBe("allowBlank")
    })
  })

  describe("Linter.validateRuleOptions", () => {
    test("returns errors with the rule name for bad option values", () => {
      const config = Config.fromObject({
        linter: {
          rules: {
            "html-allowed-script-type": { allowBlank: "yes" },
          },
        },
      })

      const errors = Linter.validateRuleOptions(config, [HTMLAllowedScriptTypeRule])

      expect(errors).toHaveLength(1)
      expect(errors[0].ruleName).toBe("html-allowed-script-type")
      expect(errors[0].key).toBe("allowBlank")
    })

    test("returns errors for unknown option keys against the strict schema", () => {
      const config = Config.fromObject({
        linter: {
          rules: {
            "html-allowed-script-type": { allowdTypes: ["text/javascript"] },
          },
        },
      })

      const errors = Linter.validateRuleOptions(config, [HTMLAllowedScriptTypeRule])

      expect(errors).toHaveLength(1)
      expect(errors[0].ruleName).toBe("html-allowed-script-type")
      expect(errors[0].message).toMatch(/allowdTypes/)
    })

    test("returns no errors for valid options", () => {
      const config = Config.fromObject({
        linter: {
          rules: {
            "html-allowed-script-type": {
              allowedTypes: ["text/javascript"],
              allowBlank: false,
            },
          },
        },
      })

      expect(Linter.validateRuleOptions(config, [HTMLAllowedScriptTypeRule])).toEqual([])
    })
  })

  describe("Linter.lint", () => {
    test("honors options from a Config built with Config.fromObject", () => {
      const config = Config.fromObject({
        linter: {
          rules: {
            "html-allowed-script-type": {
              allowedTypes: ["text/javascript"],
              allowBlank: false,
            },
          },
        },
      })

      const linter = new Linter(Herb, [HTMLAllowedScriptTypeRule], config)
      const { offenses } = linter.lint('<script type="module"></script>')

      expect(offenses).toHaveLength(1)
      expect(offenses[0].message).toBe(
        "Avoid using `module` as the `type` attribute for the `<script>` tag. Must be one of: `text/javascript`."
      )
    })

    test("falls back to the rule's defaultOptions for the run when options are invalid", () => {
      const config = Config.fromObject({
        linter: {
          rules: {
            "html-allowed-script-type": { allowedTypes: "text/javascript" },
          },
        },
      })

      const linter = new Linter(Herb, [HTMLAllowedScriptTypeRule], config)
      const { offenses } = linter.lint('<script type="module"></script>')

      expect(offenses).toHaveLength(0)
    })
  })
})
