import { describe, test } from "vitest"
import { HTMLNoAbstractRolesRule } from "../../src/rules/html-no-abstract-roles.js"
import { createLinterTest } from "../helpers/linter-test-helper.js"

const { expectNoOffenses, expectError, assertOffenses } = createLinterTest(HTMLNoAbstractRolesRule)

describe("html-no-abstract-roles", () => {
  test("passes for valid role attribute", () => {
    expectNoOffenses('<div role="button">Push it</div>')
  })

  test("passes for valid landmark role", () => {
    expectNoOffenses('<nav role="navigation">Menu</nav>')
  })

  test("passes for multiple valid roles", () => {
    expectNoOffenses('<div role="button"></div><div role="alert"></div>')
  })

  test("passes for element without role", () => {
    expectNoOffenses('<div>Hello</div>')
  })

  test("fails for abstract role: command", () => {
    expectError('The `role` attribute must not use abstract ARIA role `command`. Abstract roles are not meant to be used directly.')

    assertOffenses('<div role="command">Content</div>')
  })

  test("fails for abstract role: composite", () => {
    expectError('The `role` attribute must not use abstract ARIA role `composite`. Abstract roles are not meant to be used directly.')

    assertOffenses('<div role="composite">Content</div>')
  })

  test("fails for abstract role: input", () => {
    expectError('The `role` attribute must not use abstract ARIA role `input`. Abstract roles are not meant to be used directly.')

    assertOffenses('<div role="input">Content</div>')
  })

  test("fails for abstract role: landmark", () => {
    expectError('The `role` attribute must not use abstract ARIA role `landmark`. Abstract roles are not meant to be used directly.')

    assertOffenses('<div role="landmark">Content</div>')
  })

  test("fails for abstract role: range", () => {
    expectError('The `role` attribute must not use abstract ARIA role `range`. Abstract roles are not meant to be used directly.')

    assertOffenses('<div role="range">Content</div>')
  })

  test("fails for abstract role: roletype", () => {
    expectError('The `role` attribute must not use abstract ARIA role `roletype`. Abstract roles are not meant to be used directly.')

    assertOffenses('<div role="roletype">Content</div>')
  })

  test("fails for abstract role: section", () => {
    expectError('The `role` attribute must not use abstract ARIA role `section`. Abstract roles are not meant to be used directly.')

    assertOffenses('<div role="section">Content</div>')
  })

  test("fails for abstract role: sectionhead", () => {
    expectError('The `role` attribute must not use abstract ARIA role `sectionhead`. Abstract roles are not meant to be used directly.')

    assertOffenses('<div role="sectionhead">Content</div>')
  })

  test("fails for abstract role: select", () => {
    expectError('The `role` attribute must not use abstract ARIA role `select`. Abstract roles are not meant to be used directly.')

    assertOffenses('<div role="select">Content</div>')
  })

  test("fails for abstract role: structure", () => {
    expectError('The `role` attribute must not use abstract ARIA role `structure`. Abstract roles are not meant to be used directly.')

    assertOffenses('<div role="structure">Content</div>')
  })

  test("fails for abstract role: widget", () => {
    expectError('The `role` attribute must not use abstract ARIA role `widget`. Abstract roles are not meant to be used directly.')

    assertOffenses('<div role="widget">Content</div>')
  })

  test("fails for abstract role: window", () => {
    expectError('The `role` attribute must not use abstract ARIA role `window`. Abstract roles are not meant to be used directly.')

    assertOffenses('<div role="window">Hello, world!</div>')
  })

  test("handles uppercase abstract role", () => {
    expectError('The `role` attribute must not use abstract ARIA role `WINDOW`. Abstract roles are not meant to be used directly.')

    assertOffenses('<div role="WINDOW">Content</div>')
  })

  test("handles mixed case abstract role", () => {
    expectError('The `role` attribute must not use abstract ARIA role `Widget`. Abstract roles are not meant to be used directly.')

    assertOffenses('<div role="Widget">Content</div>')
  })
})
