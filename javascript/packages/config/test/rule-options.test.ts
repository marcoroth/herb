import { describe, test, expect } from "vitest"

import { Config } from "../src/config.js"

describe("per-rule custom options (#1204)", () => {
  test("accepts unknown option keys under linter.rules", () => {
    const config = Config.fromObject({
      linter: {
        rules: {
          "html-allowed-script-type": {
            allowedTypes: ["text/javascript", "application/json"],
            allowBlank: true,
          },
        },
      },
    })

    expect(config.getRuleOptions("html-allowed-script-type")).toEqual({
      allowedTypes: ["text/javascript", "application/json"],
      allowBlank: true,
    })
  })

  test("still validates the built-in keys", () => {
    expect(() =>
      Config.fromObject({
        linter: {
          rules: {
            "html-allowed-script-type": {
              // Intentionally invalid to prove the built-in keys are still validated
              severity: "bogus" as any,
            },
          },
        },
      })
    ).toThrow(/Configuration validation error/)
  })

  test("getRuleOptions returns the user option keys minus the reserved built-in keys", () => {
    const config = Config.fromObject({
      linter: {
        rules: {
          "html-allowed-script-type": {
            enabled: true,
            severity: "warning",
            include: ["app/views/**/*"],
            allowedTypes: ["text/javascript"],
          },
        },
      },
    })

    expect(config.getRuleOptions("html-allowed-script-type")).toEqual({
      allowedTypes: ["text/javascript"],
    })
  })

  test("getRuleOptions returns {} for the all pseudo rule, ignoring its option keys", () => {
    const config = Config.fromObject({
      linter: {
        rules: {
          all: {
            enabled: false,
            allowedTypes: ["text/javascript"],
          },
        },
      },
    })

    expect(config.getRuleOptions("all")).toEqual({})
  })

  test("getRuleOptions returns {} for an unconfigured rule", () => {
    const config = Config.fromObject({})

    expect(config.getRuleOptions("html-allowed-script-type")).toEqual({})
  })
})
