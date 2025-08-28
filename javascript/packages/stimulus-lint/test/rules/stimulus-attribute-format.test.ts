import { Herb } from '@herb-tools/node-wasm'
import { beforeAll, describe, it, expect } from 'vitest'
import { StimulusLinter } from "../../src/linter.js"
import { StimulusAttributeFormatRule } from '../../src/rules/stimulus-attribute-format.js'

describe('StimulusAttributeFormatRule', () => {
  const herb = Herb

  beforeAll(async () => {
    await Herb.load()
  })

  describe('valid attribute formats', () => {
    it('should not report offenses for properly formatted attributes', () => {
      const linter = new StimulusLinter(herb, [StimulusAttributeFormatRule])

      const html = `
        <div data-controller="hello-world"
             data-action="click->hello-world#greet"
             data-hello-world-target="name"
             data-hello-world-name-value="World"
             data-hello-world-active-class="active"
             data-hello-world-modal-outlet="#modal">
        </div>
      `
      const result = linter.lint(html)
      expect(result.offenses).toHaveLength(0)
    })

    it('should not report offenses for standard HTML attributes', () => {
      const linter = new StimulusLinter(herb, [StimulusAttributeFormatRule])

      const html = '<div class="myClass" id="myId" onClick="handler()"></div>'

      const result = linter.lint(html)
      expect(result.offenses).toHaveLength(0)
    })
  })

  describe('camelCase target attributes', () => {
    it('should report camelCase in target attributes', () => {
      const linter = new StimulusLinter(herb, [StimulusAttributeFormatRule])

      const html = '<div data-hello-myTarget-target="element"></div>'
      const result = linter.lint(html)
      expect(result.offenses).toHaveLength(1)
      expect(result.offenses[0].message).toBe('The `target name` `myTarget` should be dasherized. Did you mean `my-target`?')
      expect(result.offenses[0].severity).toBe('error')
    })

    it('should report camelCase controller identifier in target', () => {
      const linter = new StimulusLinter(herb, [StimulusAttributeFormatRule])

      const html = '<div data-helloWorld-name-target="element"></div>'
      const result = linter.lint(html)
      expect(result.offenses).toHaveLength(1)
      expect(result.offenses[0].message).toBe('The `controller identifier` `helloWorld` should be dasherized. Did you mean `hello-world`?')
      expect(result.offenses[0].severity).toBe('error')
    })
  })

  describe('camelCase value attributes', () => {
    it('should report camelCase in value attributes', () => {
      const linter = new StimulusLinter(herb, [StimulusAttributeFormatRule])

      const html = '<div data-hello-userName-value="John"></div>'
      const result = linter.lint(html)
      expect(result.offenses).toHaveLength(1)
      expect(result.offenses[0].message).toBe('The `value name` `userName` should be dasherized. Did you mean `user-name`?')
      expect(result.offenses[0].severity).toBe('error')
    })

    it('should report camelCase controller identifier in value', () => {
      const linter = new StimulusLinter(herb, [StimulusAttributeFormatRule])

      const html = '<div data-helloWorld-name-value="John"></div>'
      const result = linter.lint(html)
      expect(result.offenses).toHaveLength(1)
      expect(result.offenses[0].message).toBe('The `controller identifier` `helloWorld` should be dasherized. Did you mean `hello-world`?')
      expect(result.offenses[0].severity).toBe('error')
    })
  })

  describe('camelCase class attributes', () => {
    it('should report camelCase in class attributes', () => {
      const linter = new StimulusLinter(herb, [StimulusAttributeFormatRule])

      const html = '<div data-hello-activeClass-class="highlight"></div>'
      const result = linter.lint(html)
      expect(result.offenses).toHaveLength(1)
      expect(result.offenses[0].message).toBe('The `class name` `activeClass` should be dasherized. Did you mean `active-class`?')
      expect(result.offenses[0].severity).toBe('error')
    })
  })

  describe('camelCase outlet attributes', () => {
    it('should report camelCase in outlet attributes', () => {
      const linter = new StimulusLinter(herb, [StimulusAttributeFormatRule])

      const html = '<div data-hello-modalOutlet-outlet="#modal"></div>'
      const result = linter.lint(html)
      expect(result.offenses).toHaveLength(1)
      expect(result.offenses[0].message).toBe('The `outlet name` `modalOutlet` should be dasherized. Did you mean `modal-outlet`?')
      expect(result.offenses[0].severity).toBe('error')
    })
  })

  describe('general camelCase data attributes', () => {
    it('should report any camelCase data attributes', () => {
      const linter = new StimulusLinter(herb, [StimulusAttributeFormatRule])

      const html = '<div data-myCustomAttribute="value"></div>'
      const result = linter.lint(html)
      expect(result.offenses).toHaveLength(1)
      expect(result.offenses[0].message).toBe('Attribute `data-myCustomAttribute` should use dasherized format. Did you mean `data-my-custom-attribute`?')
      expect(result.offenses[0].severity).toBe('error')
    })
  })

  describe('multiple violations', () => {
    it('should report multiple format violations in same element', () => {
      const linter = new StimulusLinter(herb, [StimulusAttributeFormatRule])

      const html = `
        <div data-helloWorld-myTarget-target="element"
             data-hello-userName-value="John"
             data-myCustomAttribute="value">
        </div>
      `
      const result = linter.lint(html)
      expect(result.offenses).toHaveLength(4)
      expect(result.offenses[0].message).toBe('The `controller identifier` `helloWorld` should be dasherized. Did you mean `hello-world`?')
      expect(result.offenses[1].message).toBe('The `target name` `myTarget` should be dasherized. Did you mean `my-target`?')
      expect(result.offenses[2].message).toBe('The `value name` `userName` should be dasherized. Did you mean `user-name`?')
      expect(result.offenses[3].message).toBe('Attribute `data-myCustomAttribute` should use dasherized format. Did you mean `data-my-custom-attribute`?')
    })
  })

  describe('dasherize functionality', () => {
    it('should properly convert camelCase to dasherized', () => {
      const testCases = [
        { input: '<div data-myAttribute="val"></div>', expected: 'Attribute `data-myAttribute` should use dasherized format. Did you mean `data-my-attribute`?' },
        { input: '<div data-myLongAttributeName="val"></div>', expected: 'Attribute `data-myLongAttributeName` should use dasherized format. Did you mean `data-my-long-attribute-name`?' },
        { input: '<div data-XMLHttpRequest="val"></div>', expected: 'Attribute `data-XMLHttpRequest` should use dasherized format. Did you mean `data--x-m-l-http-request`?' }
      ]

      testCases.forEach(({ input, expected }) => {
        const linter = new StimulusLinter(herb, [StimulusAttributeFormatRule])

        const result = linter.lint(input)
        expect(result.offenses).toHaveLength(1)
        expect(result.offenses[0].message).toBe(expected)
      })
    })
  })

  describe('edge cases', () => {
    it('should handle attributes with numbers', () => {
      const linter = new StimulusLinter(herb, [StimulusAttributeFormatRule])

      const html = '<div data-item1Value-target="element"></div>'
      const result = linter.lint(html)
      expect(result.offenses).toHaveLength(1)
      expect(result.offenses[0].message).toBe('Attribute `data-item1Value-target` should use dasherized format. Did you mean `data-item1-value-target`?')
    })

    it('should not report on already dasherized attributes', () => {
      const linter = new StimulusLinter(herb, [StimulusAttributeFormatRule])

      const html = '<div data-my-long-controller-name-target="element"></div>'
      const result = linter.lint(html)
      expect(result.offenses).toHaveLength(0)
    })

    it('should handle empty attribute values', () => {
      const linter = new StimulusLinter(herb, [StimulusAttributeFormatRule])

      const html = '<div data-myAttribute=""></div>'
      const result = linter.lint(html)
      expect(result.offenses).toHaveLength(1)
      expect(result.offenses[0].message).toBe('Attribute `data-myAttribute` should use dasherized format. Did you mean `data-my-attribute`?')
    })
  })
})
