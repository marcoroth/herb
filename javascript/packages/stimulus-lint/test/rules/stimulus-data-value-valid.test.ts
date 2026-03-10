import { Herb } from '@herb-tools/node-wasm'
import { beforeAll, describe, it, expect } from 'vitest'
import { StimulusDataValueValidRule } from '../../src/rules/stimulus-data-value-valid.js'

import type { Project } from 'stimulus-parser'

describe('StimulusDataValueValidRule', () => {
  let herb = Herb
  const rule = new StimulusDataValueValidRule()

  beforeAll(async () => {
    await Herb.load()
  })

  const parseAndCheck = (html: string, stimulusProject?: Project) => {
    const result = herb.parse(html)
    return rule.check(result, { stimulusProject })
  }

  describe('valid value attributes', () => {
    it('should not report offenses for valid value attributes', () => {
      const html = '<div data-controller="hello" data-hello-name-value="World"></div>'
      const mockProject = {
        registeredControllers: [
          {
            identifier: 'hello',
            controllerDefinition: {
              values: [{ name: 'name', type: 'String' }]
            }
          }
        ]
      } as Project

      const offenses = parseAndCheck(html, mockProject)
      expect(offenses).toHaveLength(0)
    })

    it('should handle JSON value types correctly', () => {
      const html = `
        <div data-controller="hello"
             data-hello-count-value="42"
             data-hello-active-value="true"
             data-hello-items-value='["a", "b"]'
             data-hello-config-value='{"key": "value"}'>
        </div>
      `
      const mockProject = {
        registeredControllers: [
          {
            identifier: 'hello',
            controllerDefinition: {
              values: [
                { name: 'count', type: 'Number' },
                { name: 'active', type: 'Boolean' },
                { name: 'items', type: 'Array' },
                { name: 'config', type: 'Object' }
              ]
            }
          }
        ]
      } as Project

      const offenses = parseAndCheck(html, mockProject)
      expect(offenses).toHaveLength(0)
    })
  })

  describe('unknown controller', () => {
    it('should report unknown controller in value attribute', () => {
      const html = '<div data-unknown-name-value="World"></div>'
      const mockProject = {
        registeredControllers: [
          {
            identifier: 'hello',
            controllerDefinition: {
              values: [{ name: 'name', type: 'String' }]
            }
          }
        ]
      } as Project

      const offenses = parseAndCheck(html, mockProject)
      expect(offenses).toHaveLength(1)
      expect(offenses[0].message).toBe("Unknown Stimulus controller `unknown` in value attribute. Make sure the controller is defined in your project.")
      expect(offenses[0].severity).toBe('error')
    })
  })

  describe('invalid value names', () => {
    it('should report camelCase value names', () => {
      const html = '<div data-controller="hello" data-hello-userName-value="World"></div>'
      const mockProject = {
        registeredControllers: [
          {
            identifier: 'hello',
            controllerDefinition: {
              values: [{ name: 'user-name', type: 'String' }]
            }
          }
        ]
      } as Project

      const offenses = parseAndCheck(html, mockProject)
      expect(offenses).toHaveLength(1)
      expect(offenses[0].message).toBe('Unknown value `username` on controller `hello`. Did you mean `user-name`?')
      expect(offenses[0].severity).toBe('error')
    })

    it('should report PascalCase value names', () => {
      const html = '<div data-controller="hello" data-hello-UserName-value="World"></div>'

      const offenses = parseAndCheck(html)
      expect(offenses).toHaveLength(1)
      expect(offenses[0].message).toBe('Unknown Stimulus controller `hello` in value attribute. Make sure the controller is defined in your project.')
      expect(offenses[0].severity).toBe('error')
    })
  })

  describe('unknown values', () => {
    it('should report unknown value on controller', () => {
      const html = '<div data-controller="hello" data-hello-unknown-value="World"></div>'
      const mockProject = {
        registeredControllers: [
          {
            identifier: 'hello',
            controllerDefinition: {
              values: [{ name: 'name', type: 'String' }]
            }
          }
        ]
      } as Project

      const offenses = parseAndCheck(html, mockProject)
      expect(offenses).toHaveLength(1)
      expect(offenses[0].message).toBe("Unknown value `unknown` on controller `hello`.")
      expect(offenses[0].severity).toBe('error')
    })

    it('should suggest similar value names', () => {
      const html = '<div data-controller="hello" data-hello-nam-value="World"></div>'
      const mockProject = {
        registeredControllers: [
          {
            identifier: 'hello',
            controllerDefinition: {
              values: [{ name: 'name', type: 'String' }]
            }
          }
        ]
      } as Project

      const offenses = parseAndCheck(html, mockProject)
      expect(offenses).toHaveLength(1)
      expect(offenses[0].message).toBe('Unknown value `nam` on controller `hello`. Did you mean `name`?')
      expect(offenses[0].severity).toBe('error')
    })
  })

  describe('type validation', () => {
    it('should report type mismatches', () => {
      const html = '<div data-controller="hello" data-hello-count-value="not-a-number"></div>'
      const mockProject = {
        registeredControllers: [
          {
            identifier: 'hello',
            controllerDefinition: {
              values: [{ name: 'count', type: 'Number' }]
            }
          }
        ]
      } as Project

      const offenses = parseAndCheck(html, mockProject)
      expect(offenses).toHaveLength(1)
      expect(offenses[0].message).toBe('Value `count` on controller `hello` expects type `Number` but received `String`.')
      expect(offenses[0].severity).toBe('error')
    })

    it('should report boolean type mismatches', () => {
      const html = '<div data-controller="hello" data-hello-active-value="yes"></div>'
      const mockProject = {
        registeredControllers: [
          {
            identifier: 'hello',
            controllerDefinition: {
              values: [{ name: 'active', type: 'Boolean' }]
            }
          }
        ]
      } as Project

      const offenses = parseAndCheck(html, mockProject)
      expect(offenses).toHaveLength(1)
      expect(offenses[0].message).toBe('Value `active` on controller `hello` expects type `Boolean` but received `String`.')
      expect(offenses[0].severity).toBe('error')
    })

    it('should report array type mismatches', () => {
      const html = '<div data-controller="hello" data-hello-items-value="not-an-array"></div>'
      const mockProject = {
        registeredControllers: [
          {
            identifier: 'hello',
            controllerDefinition: {
              values: [{ name: 'items', type: 'Array' }]
            }
          }
        ]
      } as Project

      const offenses = parseAndCheck(html, mockProject)
      expect(offenses).toHaveLength(1)
      expect(offenses[0].message).toBe('Value `items` on controller `hello` expects type `Array` but received `String`.')
      expect(offenses[0].severity).toBe('error')
    })
  })

  describe('dynamic content', () => {
    it('should ignore ERB content in value attributes', () => {
      const html = '<div data-controller="hello" data-hello-name-value="<%= @name %>"></div>'

      const offenses = parseAndCheck(html)
      expect(offenses).toHaveLength(0)
    })
  })

  describe('edge cases', () => {
    it('should handle empty value attributes', () => {
      const html = '<div data-controller="hello" data-hello-name-value=""></div>'
      const mockProject = {
        registeredControllers: [
          {
            identifier: 'hello',
            controllerDefinition: {
              values: [{ name: 'name', type: 'String' }]
            }
          }
        ]
      } as Project

      const offenses = parseAndCheck(html, mockProject)
      expect(offenses).toHaveLength(0)
    })

    it('should handle controllers without values defined', () => {
      const html = '<div data-controller="hello" data-hello-name-value="World"></div>'
      const mockProject = {
        registeredControllers: [
          {
            identifier: 'hello',
            controllerDefinition: {
              values: undefined
            }
          }
        ]
      } as Project

      const offenses = parseAndCheck(html, mockProject)
      expect(offenses).toHaveLength(0)
    })
  })
})
