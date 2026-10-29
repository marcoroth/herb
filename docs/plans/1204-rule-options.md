# Plan: Per-rule custom configuration options (#1204)

GitHub issue: https://github.com/marcoroth/herb/issues/1204

Allow linter rules to define custom configuration options beyond the built-in
`enabled`, `severity`, `frameworks`, `autoCorrect`, `include`, `only`, `exclude`,
and `environments` keys.

## Decisions (locked)

- **YAML shape: flat keys.** Option keys sit directly under the rule name, next
  to the built-in keys, exactly as the issue proposes and how erb_lint does it.

  ```yaml
  linter:
    rules:
      html-allowed-script-type:
        enabled: true
        allowedTypes:
          - text/javascript
          - application/json
        allowBlank: true
  ```

- **Validation: per-rule zod schema.** Rules optionally declare
  `static optionsSchema = z.object({...}).strict()`. The linter validates merged
  user options when instantiating rules. Strict schemas mean a typo like
  `allowdTypes` is a reported error, not silently ignored.

- **Reserved keys:** `enabled`, `severity`, `frameworks`, `autoCorrect`,
  `include`, `only`, `exclude`, `environments`. Built-in keys win; they are
  stripped before option merging. A rule whose `defaultOptions` contains a
  reserved key is a programming error — enforced by a dev-time test that
  iterates all registered rules, and documented.

- **Naming convention:** camelCase option keys (`allowedTypes`, `allowBlank`),
  matching `failLevel`/`indentWidth`. Documented so future rules stay
  consistent.

- **Error severity:** invalid option values are a **hard error in the CLI**
  (print errors, exit 1, consistent with existing `exitOnError` config
  behavior) and a **warning diagnostic in the language server**. On validation
  failure the rule falls back to its `defaultOptions` for that run, so a bad
  config never crashes a lint.

- **`all` pseudo-rule:** option keys under `all` are meaningless and ignored.

## Background: how config flows today

- `.herb.yml` → `Config.load`/`readAndValidateConfig`
  (`javascript/packages/config/src/config.ts`) validates with zod but keeps the
  **raw parsed object**, so unknown keys already survive at runtime; they are
  just untyped and unvalidated.
- `RuleConfigBaseSchema` (`config-schema.ts:30`) is a plain `z.object` — it
  silently ignores unknown keys today.
- `RuleConfig` (`config.ts:107`) is a hand-written closed type that must be
  updated in parallel with the zod schema.
- `Linter` receives a `Config` instance and reads
  `this.config?.linter?.rules?.[ruleName]` for built-in keys.
- Rules are instantiated with `new ruleClass()` at 5 sites in
  `javascript/packages/linter/src/linter.ts` (~lines 621, 851, 895, 1009,
  1082) and have no way to receive config today.
- `html-allowed-script-type.ts` has a `// NOTE: Rules are not configurable for
  now, See #1204` with hardcoded `ALLOW_BLANK`/`ALLOWED_TYPES` constants — the
  pilot rule.

## Phase 1 — `@herb-tools/config`: accept and expose option keys

Files: `javascript/packages/config/src/config-schema.ts`, `config.ts`,
`config-template.yml`.

1. `RuleConfigBaseSchema` → `z.looseObject({...})` (zod v4), keeping built-in
   key validation but passing unknown keys through. Keep `.strict()` everywhere
   else.
2. `RuleConfig` type gets an index signature `[option: string]: unknown`
   alongside the known keys.
3. Add and export `BUILT_IN_RULE_CONFIG_KEYS` (the 8 reserved keys) and
   `Config.getRuleOptions(ruleName): Record<string, unknown>` which returns the
   rule's config minus the reserved keys.
4. `config-template.yml`: add a commented example of a rule with custom
   options.

Runtime behavior is unchanged (the raw object is already kept); this phase is
types + schema acceptance.

## Phase 2 — `@herb-tools/linter`: rule options API (`src/types.ts`)

Add to `ParserRule`, `LexerRule`, and `SourceRule` (second generic param keeps
existing `ParserRule<MyAutofixContext>` usages compiling):

```ts
abstract class ParserRule<
  TAutofixContext extends BaseAutofixContext = BaseAutofixContext,
  TOptions extends RuleOptions = Record<string, never>
> {
  static optionsSchema?: ZodType            // optional, enables validation
  get defaultOptions(): TOptions            // default: {}
  get options(): TOptions                   // resolved: defaults ⋈ user config
  /** @internal called by Linter after instantiation */
  resolveOptions(userOptions: Record<string, unknown>): void
}
```

- `resolveOptions`: filter user config to non-reserved keys → merge over
  `defaultOptions` (arrays **replaced**, not concatenated — reuse the existing
  `deepMerge` semantics from `@herb-tools/config`; option objects never contain
  `include`/`exclude`) → validate against `optionsSchema` if declared → assign.
- Add `RuleOptions` base type.
- Add zod as a dependency of `@herb-tools/linter` if not already present (for
  the `ZodType` type and validation).
- Dev-time reserved-key collision check: a test that iterates all registered
  rules and asserts no `defaultOptions` key collides with
  `BUILT_IN_RULE_CONFIG_KEYS`.

## Phase 3 — `@herb-tools/linter`: plumbing

Files: `src/linter.ts`, `src/browser/rule.ts` (if it instantiates rules),
`src/cli.ts`, `javascript/packages/language-server/src/linter_service.ts`.

1. Single private `createRuleInstance(ruleClass)` helper on `Linter` that
   instantiates and resolves options via
   `this.config.getRuleOptions(ruleName)`. Replace all 5 `new ruleClass()`
   sites (lint run ~621, autofix ~851/895/1009, source rules ~1082) — including
   autofix paths, since fixes may depend on options. The temp instances in
   `filterRulesByConfig` (~193) only read `defaultConfig` and don't need
   options.
2. New static
   `Linter.validateRuleOptions(config, allRules): RuleOptionError[]`
   (rule name, option key, message). Called by:
   - CLI (`cli.ts`) after `Config.load`: print errors, exit 1.
   - Language server (`linter_service.ts`): surface as warning diagnostics,
     following existing diagnostic patterns in that file.
3. Invalid options → rule falls back to `defaultOptions` for that run.
4. Custom rules (`.herb/rules/**/*.mjs`) get all of this for free since they
   extend the same base classes; `optionsSchema` stays optional for them.

## Phase 4 — Pilot: `html-allowed-script-type`

File: `javascript/packages/linter/src/rules/html-allowed-script-type.ts`.

Convert the hardcoded `ALLOW_BLANK`/`ALLOWED_TYPES` constants to
`defaultOptions` + `static optionsSchema` (`.strict()`), read from
`this.options` in `check`. Remove the NOTE comment referencing #1204. Keep the
existing defaults as the shipped defaults so behavior is unchanged without
user config.

## Phase 5 — Docs & tests

- Rule doc: add an "Options" section to
  `javascript/packages/linter/docs/rules/html-allowed-script-type.md` (option,
  type, default) — the template other rules will follow.
- `docs/docs/configuration.md`: document the flat-key layout, reserved keys,
  camelCase convention, and that `all` ignores option keys.
- Tests:
  - config package: loose schema accepts option keys; built-in keys still
    validated; `getRuleOptions` strips reserved keys; `all` ignores options.
  - linter: merge precedence (defaults ← user), array replacement, schema
    errors → fallback + reported error, options honored in both `check` and
    `autofix`.
  - pilot rule: custom `allowedTypes`/`allowBlank` cases.
- Final gate: full `yarn build`, `yarn typecheck`, and `yarn test` pass.

## Explicitly out of scope (follow-ups once the mechanism lands)

- `erb-no-unused-expressions` side-effect-method list (PR #1586 use case,
  gretel `breadcrumb` helper)
- `erb-no-output-in-attribute-position` helper allow-list (the `test_id`
  helper use case from the issue comments)
- Blocked issues #163, #2041, #1836, #550 — each becomes "define options on a
  rule", no longer infrastructure work
