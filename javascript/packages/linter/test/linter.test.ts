import dedent from "dedent"
import { describe, test, expect, beforeAll } from "vitest"

import { Herb } from "@herb-tools/node-wasm"
import { Location } from "@herb-tools/core"
import { Linter } from "../src/linter.js"
import { Config } from "@herb-tools/config"

import { HTMLTagNameLowercaseRule } from "../src/rules/html-tag-name-lowercase.js"
import { HTMLAttributeDoubleQuotesRule } from "../src/rules/html-attribute-double-quotes.js"
import { HTMLAttributeValuesRequireQuotesRule } from "../src/rules/html-attribute-values-require-quotes.js"
import { ParserRule, SourceRule } from "../src/types.js"

import type { UnboundLintOffense, LintContext, FullRuleConfig } from "../src/types.js"
import type { ParseResult } from "@herb-tools/core"

describe("@herb-tools/linter", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  describe("Linter", () => {
    test("is defined", () => {
      expect(Linter).toBeDefined()
    })

    test("can be instantiated", () => {
      const linter = new Linter(Herb)
      expect(linter).toBeInstanceOf(Linter)
    })

    test("can be instantiated with custom rules", () => {
      const linter = new Linter(Herb, [HTMLTagNameLowercaseRule])
      expect(linter).toBeInstanceOf(Linter)
    })
  })

  describe("Linter functionality", () => {
    test("can lint a document with default rules", () => {
      const html = '<div><span>Hello</span></div>'
      const linter = new Linter(Herb)
      const lintResult = linter.lint(html)

      expect(lintResult).toHaveProperty('offenses')
      expect(lintResult).toHaveProperty('errors')
      expect(lintResult).toHaveProperty('warnings')
      expect(Array.isArray(lintResult.offenses)).toBe(true)
    })

    test("returns correct error and warning counts", () => {
      const html = '<DIV><SPAN>Hello</SPAN></DIV>\n'
      const linter = new Linter(Herb)
      const lintResult = linter.lint(html)

      expect(lintResult.errors).toBe(4)
      expect(lintResult.warnings).toBe(0)
      expect(lintResult.offenses).toHaveLength(4)

      const allErrors = lintResult.offenses.every(offense => offense.severity === "error")
      expect(allErrors).toBe(true)
    })

    test("can run with no rules", () => {
      const html = '<DIV><SPAN>Hello</SPAN></DIV>'
      const linter = new Linter(Herb, [])
      const lintResult = linter.lint(html)

      expect(lintResult.errors).toBe(0)
      expect(lintResult.warnings).toBe(0)
      expect(lintResult.offenses).toHaveLength(0)
    })

    test("processes complex ERB templates", () => {
      const html = dedent`
        <div class="<%= classes %>">
          <% items.each do |item| %>
            <span><%= item.name %></span>
          <% end %>
        </div>
      ` + '\n'

      const linter = new Linter(Herb)
      const lintResult = linter.lint(html)

      expect(lintResult.errors).toBe(0)
    })
  })

  describe("Rule enablement", () => {
    class EnabledParserRule extends ParserRule {
      static ruleName = "enabled-parser-rule"
      static introducedIn = "0.1.0"

      get defaultConfig() {
        return { enabled: true, severity: "error" as const }
      }

      check(_result: ParseResult): UnboundLintOffense[] {
        return [{
          message: "Test offense",
          location: Location.from(1, 1, 1, 1),
          rule: this.ruleName,
          code: this.ruleName,
          source: "linter"
        }]
      }
    }

    class DisabledParserRule extends ParserRule {
      static ruleName = "disabled-parser-rule"
      static introducedIn = "0.1.0"

      get defaultConfig() {
        return { enabled: true, severity: "error" as const }
      }

      isEnabled(): boolean {
        return false
      }

      check(_result: ParseResult): UnboundLintOffense[] {
        return [{
          message: "This should never appear",
          location: Location.from(1, 1, 1, 1),
          rule: this.ruleName,
          code: this.ruleName,
          source: "linter"
        }]
      }
    }

    class FileBasedRule extends SourceRule {
      static ruleName = "file-based-rule"
      static introducedIn = "0.1.0"

      get defaultConfig() {
        return { enabled: true, severity: "info" as const }
      }

      isEnabled(_source: string, context?: Partial<LintContext>): boolean {
        return context?.fileName?.endsWith('.erb') || false
      }

      check(_source: string): UnboundLintOffense[] {
        return [{
          message: "ERB file detected",
          location: Location.from(1, 1, 1, 1),
          rule: this.ruleName,
          code: this.ruleName,
          source: "linter"
        }]
      }
    }

    class ContentBasedRule extends ParserRule {
      static ruleName = "content-based-rule"
      static introducedIn = "0.1.0"

      get defaultConfig() {
        return { enabled: true, severity: "info" as const }
      }

      isEnabled(result: ParseResult): boolean {
        return JSON.stringify(result.value).includes('"value":"div"')
      }

      check(_result: ParseResult): UnboundLintOffense[] {
        return [{
          message: "Div found",
          location: Location.from(1, 1, 1, 1),
          rule: this.ruleName,
          code: this.ruleName,
          source: "linter"
        }]
      }
    }

    test("runs enabled rules", () => {
      const html = '<div>test</div>'
      const linter = new Linter(Herb, [EnabledParserRule])
      const lintResult = linter.lint(html)

      expect(lintResult.offenses).toHaveLength(1)
      expect(lintResult.offenses[0].rule).toBe("enabled-parser-rule")
    })

    test("skips disabled rules", () => {
      const html = '<div>test</div>'
      const linter = new Linter(Herb, [DisabledParserRule])
      const lintResult = linter.lint(html)

      expect(lintResult.offenses).toHaveLength(0)
    })

    test("file-based enablement works", () => {
      const html = '<div>test</div>'
      const linter = new Linter(Herb, [FileBasedRule])

      const result1 = linter.lint(html, { fileName: 'test.html' })
      expect(result1.offenses).toHaveLength(0)

      const result2 = linter.lint(html, { fileName: 'test.erb' })
      expect(result2.offenses).toHaveLength(1)
      expect(result2.offenses[0].rule).toBe("file-based-rule")
    })

    test("content-based enablement works", () => {
      const linter = new Linter(Herb, [ContentBasedRule])

      const result1 = linter.lint('<span>test</span>')
      expect(result1.offenses).toHaveLength(0)

      const result2 = linter.lint('<div>test</div>')
      expect(result2.offenses).toHaveLength(1)
      expect(result2.offenses[0].rule).toBe("content-based-rule")
    })

    test("can disable a rule with a comment", () => {
      const html = dedent`
        <DIV>test</DIV> <%# herb:disable html-tag-name-lowercase %>
      `

      const linter = new Linter(Herb, [HTMLTagNameLowercaseRule])
      const lintResult = linter.lint(html)

      expect(lintResult.offenses).toHaveLength(0)
      expect(lintResult.ignored).toBe(2)
    })

    test("can disable multiple rules with a comment", () => {
      const html = dedent`
        <DIV id='1' class=<%= "hello" %>>test</DIV><%# herb:disable html-tag-name-lowercase, html-attribute-double-quotes %>
      `

      const linter = new Linter(
        Herb,
        [
          HTMLTagNameLowercaseRule,
          HTMLAttributeDoubleQuotesRule,
          HTMLAttributeValuesRequireQuotesRule,
        ],
      )

      const lintResult = linter.lint(html)

      expect(lintResult.offenses).toHaveLength(1)
      expect(lintResult.ignored).toBe(3)
    })

    test("can disable multiple rules with a comment and whitespace between comma and rules", () => {
      const html = dedent`
        <DIV id='1' class=<%= "hello" %>>test</DIV><%# herb:disable html-tag-name-lowercase,  html-attribute-double-quotes %>
        <DIV id='1' class=<%= "hello" %>>test</DIV><%# herb:disable html-tag-name-lowercase  ,html-attribute-double-quotes %>
        <DIV id='1' class=<%= "hello" %>>test</DIV><%# herb:disable  html-tag-name-lowercase  ,  html-attribute-double-quotes %>
      `

      const linter = new Linter(
        Herb,
        [
          HTMLTagNameLowercaseRule,
          HTMLAttributeDoubleQuotesRule,
          HTMLAttributeValuesRequireQuotesRule,
        ],
      )

      const lintResult = linter.lint(html)

      expect(lintResult.offenses).toHaveLength(3)
      expect(lintResult.ignored).toBe(9)
    })

    test("can disable all rules with a comment", () => {
      const html = dedent`
        <DIV id='1' class=<%= "hello" %>>test</DIV> <%# herb:disable all %>
      `

      const linter = new Linter(
        Herb,
        [
          HTMLTagNameLowercaseRule,
          HTMLAttributeDoubleQuotesRule,
          HTMLAttributeValuesRequireQuotesRule
        ],
      )

      const lintResult = linter.lint(html)

      expect(lintResult.offenses).toHaveLength(0)
      expect(lintResult.ignored).toBe(4)
    })
  })

  describe("ignoreDisableComments option", () => {
    test("reports offenses even when suppressed with herb:disable comment", () => {
      const html = dedent`
        <DIV>test</DIV> <%# herb:disable html-tag-name-lowercase %>
      `

      const linter = new Linter(Herb, [HTMLTagNameLowercaseRule])
      const lintResult = linter.lint(html, { ignoreDisableComments: true })

      expect(lintResult.offenses).toHaveLength(2)
      expect(lintResult.ignored).toBe(0)
      expect(lintResult.errors).toBe(2)
    })

    test("reports multiple rule offenses even when suppressed", () => {
      const html = dedent`
        <DIV id='1' class=<%= "hello" %>>test</DIV><%# herb:disable html-tag-name-lowercase, html-attribute-double-quotes %>
      `

      const linter = new Linter(
        Herb,
        [
          HTMLTagNameLowercaseRule,
          HTMLAttributeDoubleQuotesRule,
          HTMLAttributeValuesRequireQuotesRule,
        ],
      )

      const lintResult = linter.lint(html, { ignoreDisableComments: true })

      expect(lintResult.offenses).toHaveLength(4)
      expect(lintResult.ignored).toBe(0)
    })

    test("reports all offenses even when disabled with 'all'", () => {
      const html = dedent`
        <DIV id='1' class=<%= "hello" %>>test</DIV> <%# herb:disable all %>
      `

      const linter = new Linter(
        Herb,
        [
          HTMLTagNameLowercaseRule,
          HTMLAttributeDoubleQuotesRule,
          HTMLAttributeValuesRequireQuotesRule
        ],
      )

      const lintResult = linter.lint(html, { ignoreDisableComments: true })

      expect(lintResult.offenses).toHaveLength(4)
      expect(lintResult.ignored).toBe(0)
    })

    test("respects ignoreDisableComments:false (default behavior)", () => {
      const html = dedent`
        <DIV>test</DIV> <%# herb:disable html-tag-name-lowercase %>
      `

      const linter = new Linter(Herb, [HTMLTagNameLowercaseRule])
      const lintResult = linter.lint(html, { ignoreDisableComments: false })

      expect(lintResult.offenses).toHaveLength(0)
      expect(lintResult.ignored).toBe(2)
    })

    test("default behavior without option still honors disable comments", () => {
      const html = dedent`
        <DIV>test</DIV> <%# herb:disable html-tag-name-lowercase %>
      `

      const linter = new Linter(Herb, [HTMLTagNameLowercaseRule])
      const lintResult = linter.lint(html)

      expect(lintResult.offenses).toHaveLength(0)
      expect(lintResult.ignored).toBe(2)
    })
  })

  describe("Linter.from() config-based API", () => {
    test("can create linter with Linter.from()", () => {
      const linter = Linter.from(Herb)
      expect(linter).toBeInstanceOf(Linter)
    })

    test("can create linter with config", () => {
      const config = Config.fromObject({
        linter: {
          enabled: true,
          rules: {}
        }
      })
      const linter = Linter.from(Herb, config)
      expect(linter).toBeInstanceOf(Linter)
    })

    test("filters rules based on default config", () => {
      class EnabledByDefaultRule extends ParserRule {
        static ruleName = "enabled-by-default-rule"
        static introducedIn = "0.1.0"

        get defaultConfig(): FullRuleConfig {
          return {
            enabled: true,
            severity: "error"
          }
        }

        check(_result: ParseResult): UnboundLintOffense[] {
          return [{
            message: "Enabled rule triggered",
            location: Location.from(1, 1, 1, 1),
            rule: this.ruleName,
            code: this.ruleName,
            source: "linter"
          }]
        }
      }

      class DisabledByDefaultRule extends ParserRule {
        static ruleName = "disabled-by-default-rule"
        static introducedIn = "0.1.0"

        get defaultConfig(): FullRuleConfig {
          return {
            enabled: false,
            severity: "error"
          }
        }

        check(_result: ParseResult): UnboundLintOffense[] {
          return [{
            message: "This should not appear",
            location: Location.from(1, 1, 1, 1),
            rule: this.ruleName,
            code: this.ruleName,
            source: "linter"
          }]
        }
      }

      const html = `<div>test</div>`
      const { enabled: filteredRules } = Linter.filterRulesByConfig([EnabledByDefaultRule, DisabledByDefaultRule])
      const linter = new Linter(Herb, filteredRules)
      const lintResult = linter.lint(html)

      expect(lintResult.offenses).toHaveLength(1)
      expect(lintResult.offenses[0].rule).toBe("enabled-by-default-rule")
    })

    test("user config can enable a disabled-by-default rule", () => {
      class DisabledByDefaultRule extends ParserRule {
        static ruleName = "disabled-by-default-rule"
        static introducedIn = "0.1.0"

        get defaultConfig(): FullRuleConfig {
          return {
            enabled: false,
            severity: "error"
          }
        }

        check(_result: ParseResult): UnboundLintOffense[] {
          return [{
            message: "Rule enabled by user",
            location: Location.from(1, 1, 1, 1),
            rule: this.ruleName,
            code: this.ruleName,
            source: "linter"
          }]
        }
      }

      const html = '<div>test</div>'
      const config = Config.fromObject({
        linter: {
          rules: {
            "disabled-by-default-rule": {
              enabled: true
            }
          }
        }
      })

      const { enabled: filteredRules } = Linter.filterRulesByConfig([DisabledByDefaultRule], config.linter?.rules)
      const linter = new Linter(Herb, filteredRules, config)
      const lintResult = linter.lint(html)

      expect(lintResult.offenses).toHaveLength(1)
      expect(lintResult.offenses[0].rule).toBe("disabled-by-default-rule")
    })

    test("user config can disable an enabled-by-default rule", () => {
      const html = '<DIV>test</DIV>'
      const config = Config.fromObject({
        linter: {
          rules: {
            "html-tag-name-lowercase": {
              enabled: false
            }
          }
        }
      })

      const { enabled: filteredRules } = Linter.filterRulesByConfig([HTMLTagNameLowercaseRule], config.linter?.rules)
      const linter = new Linter(Herb, filteredRules, config)
      const lintResult = linter.lint(html)

      expect(lintResult.offenses).toHaveLength(0)
    })

    test("applies severity overrides automatically", () => {
      const html = '<DIV>test</DIV>'
      const config = Config.fromObject({
        linter: {
          rules: {
            "html-tag-name-lowercase": {
              enabled: true,
              severity: "warning"
            }
          }
        }
      })

      const linter = new Linter(Herb, [HTMLTagNameLowercaseRule], config)
      const lintResult = linter.lint(html)

      expect(lintResult.offenses).toHaveLength(2)
      expect(lintResult.offenses[0].severity).toBe("warning")
      expect(lintResult.offenses[1].severity).toBe("warning")
      expect(lintResult.errors).toBe(0)
      expect(lintResult.warnings).toBe(2)
    })

    test("applies multiple severity overrides", () => {
      const html = '<DIV id=\'1\' class=<%= "hello" %>>test</DIV>'
      const config = Config.fromObject({
        linter: {
          rules: {
            "html-tag-name-lowercase": {
              severity: "warning"
            },
            "html-attribute-double-quotes": {
              severity: "info"
            },
            "html-attribute-values-require-quotes": {
              severity: "hint"
            }
          }
        }
      })

      const linter = new Linter(
        Herb,
        [
          HTMLTagNameLowercaseRule,
          HTMLAttributeDoubleQuotesRule,
          HTMLAttributeValuesRequireQuotesRule
        ],
        config
      )
      const lintResult = linter.lint(html)

      expect(lintResult.offenses).toHaveLength(4)
      expect(lintResult.errors).toBe(0)
      expect(lintResult.warnings).toBe(2)
      expect(lintResult.info).toBe(1)
      expect(lintResult.hints).toBe(1)
    })

    test("Linter.from() with config enables and overrides severity", () => {
      class TestRule extends ParserRule {
        static ruleName = "test-rule"
        static introducedIn = "0.1.0"

        get defaultConfig(): FullRuleConfig {
          return {
            enabled: false,
            severity: "error"
          }
        }

        check(_result: ParseResult): UnboundLintOffense[] {
          return [{
            message: "Test offense",
            location: Location.from(1, 1, 1, 1),
            rule: this.ruleName,
            code: this.ruleName,
            source: "linter"
          }]
        }
      }

      const html = '<div>test</div>'
      const config = Config.fromObject({
        linter: {
          rules: {
            "test-rule": {
              enabled: true,
              severity: "warning"
            }
          }
        }
      })

      const { enabled: filteredRules } = Linter.filterRulesByConfig([TestRule], config.linter?.rules)
      const linter = new Linter(Herb, filteredRules, config)
      const lintResult = linter.lint(html)

      expect(lintResult.offenses).toHaveLength(1)
      expect(lintResult.offenses[0].severity).toBe("warning")
      expect(lintResult.errors).toBe(0)
      expect(lintResult.warnings).toBe(1)
    })

    test("config with no rules uses default enabled rules", () => {
      const html = '<DIV>test</DIV>'
      const config = Config.fromObject({
        linter: {
          enabled: true
        }
      })

      const linter = Linter.from(Herb, config)
      const lintResult = linter.lint(html)

      expect(lintResult.offenses.length).toBeGreaterThan(0)
    })

    test("Linter.filterRulesByConfig with empty config returns default enabled", () => {
      class EnabledRule extends ParserRule {
        static ruleName = "enabled-rule"
        static introducedIn = "0.1.0"

        get defaultConfig(): FullRuleConfig {
          return { enabled: true, severity: "error" }
        }

        check(): UnboundLintOffense[] { return [] }
      }

      class DisabledRule extends ParserRule {
        static ruleName = "disabled-rule"
        static introducedIn = "0.1.0"

        get defaultConfig(): FullRuleConfig {
          return { enabled: false, severity: "error" }
        }

        check(): UnboundLintOffense[] { return [] }
      }

      const { enabled: filtered } = Linter.filterRulesByConfig([EnabledRule, DisabledRule])

      expect(filtered).toHaveLength(1)
      expect(filtered[0].ruleName).toBe("enabled-rule")
    })

    test("Linter.filterRulesByConfig respects user config", () => {
      class EnabledRule extends ParserRule {
        static ruleName = "enabled-rule"
        static introducedIn = "0.1.0"

        get defaultConfig(): FullRuleConfig {
          return { enabled: true, severity: "error" }
        }

        check(): UnboundLintOffense[] { return [] }
      }

      class DisabledRule extends ParserRule {
        static ruleName = "disabled-rule"
        static introducedIn = "0.1.0"

        get defaultConfig(): FullRuleConfig {
          return { enabled: false, severity: "error" }
        }

        check(): UnboundLintOffense[] { return [] }
      }

      const config = {
        "enabled-rule": { enabled: false },
        "disabled-rule": { enabled: true }
      }

      const { enabled: filtered } = Linter.filterRulesByConfig([EnabledRule, DisabledRule], config)

      expect(filtered).toHaveLength(1)
      expect(filtered[0].ruleName).toBe("disabled-rule")
    })
  })

  describe("Version-gated rule filtering", () => {
    class OldRule extends ParserRule {
      static ruleName = "old-rule"
      static introducedIn = "0.4.0" as const

      get defaultConfig(): FullRuleConfig {
        return { enabled: true, severity: "error" }
      }

      check(): UnboundLintOffense[] { return [] }
    }

    class NewRule extends ParserRule {
      static ruleName = "new-rule"
      static introducedIn = "0.9.0" as const

      get defaultConfig(): FullRuleConfig {
        return { enabled: true, severity: "error" }
      }

      check(_result: ParseResult): UnboundLintOffense[] {
        return [{
          message: "New rule triggered",
          location: Location.from(1, 1, 1, 1),
          rule: this.ruleName,
          code: this.ruleName,
          source: "linter"
        }]
      }
    }

    class NewerRule extends ParserRule {
      static ruleName = "newer-rule"
      static introducedIn = "0.9.1" as const

      get defaultConfig(): FullRuleConfig {
        return { enabled: true, severity: "warning" }
      }

      check(): UnboundLintOffense[] { return [] }
    }

    class DisabledNewRule extends ParserRule {
      static ruleName = "disabled-new-rule"
      static introducedIn = "0.9.0" as const

      get defaultConfig(): FullRuleConfig {
        return { enabled: false, severity: "error" }
      }

      check(): UnboundLintOffense[] { return [] }
    }

    test("includes all rules when no configVersion is provided", () => {
      const { enabled, skippedByVersion } = Linter.filterRulesByConfig([OldRule, NewRule, NewerRule])

      expect(enabled).toHaveLength(3)
      expect(skippedByVersion).toHaveLength(0)
    })

    test("skips rules introduced after the config version", () => {
      const { enabled, skippedByVersion } = Linter.filterRulesByConfig(
        [OldRule, NewRule, NewerRule],
        undefined,
        "0.8.0"
      )

      expect(enabled).toHaveLength(1)
      expect(enabled[0].ruleName).toBe("old-rule")

      expect(skippedByVersion).toHaveLength(2)
      expect(skippedByVersion[0].ruleName).toBe("new-rule")
      expect(skippedByVersion[0].introducedIn).toBe("0.9.0")
      expect(skippedByVersion[1].ruleName).toBe("newer-rule")
      expect(skippedByVersion[1].introducedIn).toBe("0.9.1")
    })

    test("includes rules matching the config version exactly", () => {
      const { enabled, skippedByVersion } = Linter.filterRulesByConfig(
        [OldRule, NewRule, NewerRule],
        undefined,
        "0.9.0"
      )

      expect(enabled).toHaveLength(2)
      expect(enabled[0].ruleName).toBe("old-rule")
      expect(enabled[1].ruleName).toBe("new-rule")

      expect(skippedByVersion).toHaveLength(1)
      expect(skippedByVersion[0].ruleName).toBe("newer-rule")
    })

    test("includes all rules when config version matches latest", () => {
      const { enabled, skippedByVersion } = Linter.filterRulesByConfig(
        [OldRule, NewRule, NewerRule],
        undefined,
        "0.9.1"
      )

      expect(enabled).toHaveLength(3)
      expect(skippedByVersion).toHaveLength(0)
    })

    test("user explicitly enabling a rule overrides version gating", () => {
      const userConfig = {
        "new-rule": { enabled: true }
      }

      const { enabled, skippedByVersion } = Linter.filterRulesByConfig(
        [OldRule, NewRule, NewerRule],
        userConfig,
        "0.8.0"
      )

      expect(enabled).toHaveLength(2)

      const enabledNames = enabled.map(rule => rule.ruleName)
      expect(enabledNames).toContain("new-rule")
      expect(enabledNames).toContain("old-rule")

      expect(skippedByVersion).toHaveLength(1)
      expect(skippedByVersion[0].ruleName).toBe("newer-rule")
    })

    test("user explicitly disabling a rule is respected regardless of version", () => {
      const userConfig = {
        "old-rule": { enabled: false }
      }

      const { enabled } = Linter.filterRulesByConfig(
        [OldRule, NewRule],
        userConfig,
        "0.9.0"
      )

      expect(enabled).toHaveLength(1)
      expect(enabled[0].ruleName).toBe("new-rule")
    })

    test("disabled-by-default rules are not included in skippedByVersion", () => {
      const { enabled, skippedByVersion } = Linter.filterRulesByConfig(
        [OldRule, DisabledNewRule],
        undefined,
        "0.8.0"
      )

      expect(enabled).toHaveLength(1)
      expect(enabled[0].ruleName).toBe("old-rule")

      expect(skippedByVersion).toHaveLength(0)
    })

    test("Linter.from() applies version gating from config", () => {
      const config = Config.fromObject({
        linter: { enabled: true }
      }, { configVersion: "0.8.0" })

      const linter = Linter.from(Herb, config)

      expect(linter.rulesSkippedByVersion.length).toBeGreaterThan(0)
    })

    test("Linter.from() includes all released rules when config version is current", () => {
      const config = Config.fromObject({
        linter: { enabled: true }
      })

      const linter = Linter.from(Herb, config)

      const releasedSkipped = linter.rulesSkippedByVersion.filter(
        rule => rule.introducedIn !== "unreleased"
      )

      expect(releasedSkipped).toHaveLength(0)
    })

    test("includes unreleased rules when configVersion is undefined (no .herb.yml)", () => {
      const { enabled, skippedByVersion } = Linter.filterRulesByConfig(
        [OldRule, NewRule, NewerRule],
        undefined,
        undefined
      )

      expect(enabled).toHaveLength(3)
      expect(skippedByVersion).toHaveLength(0)
    })

    test("includes unreleased rules when .herb.yml has no explicit version", () => {
      const config = Config.fromObject({
        linter: { enabled: true }
      })

      expect(config.configVersion).toBeUndefined()

      const { enabled, skippedByVersion } = Linter.filterRulesByConfig(
        [OldRule, NewRule, NewerRule],
        config.linter?.rules,
        config.configVersion
      )

      expect(enabled).toHaveLength(3)
      expect(skippedByVersion).toHaveLength(0)
    })

    test("Linter.from() enables unreleased rules when configVersion is undefined", () => {
      const config = Config.fromObject({
        linter: { enabled: true }
      })

      expect(config.configVersion).toBeUndefined()

      const linter = Linter.from(Herb, config)

      expect(linter.rulesSkippedByVersion).toHaveLength(0)
    })

    test("version-gated rules do not produce offenses", () => {
      const config = Config.fromObject({
        linter: { enabled: true }
      }, { configVersion: "0.8.0" })

      const filteredRules = Linter.filterRulesByConfig(
        [OldRule, NewRule],
        config.linter?.rules,
        config.configVersion
      )

      const linter = new Linter(Herb, filteredRules.enabled, config)
      const result = linter.lint("<div>test</div>")

      const ruleNames = result.offenses.map(offense => offense.rule)
      expect(ruleNames).not.toContain("new-rule")
    })
  })
})
