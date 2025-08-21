import path from 'path'
import { describe, it, expect } from 'vitest'
import { sortTailwindClasses } from '../src/index'

const configPath = path.join(__dirname, 'fixtures', 'tailwind.config.js')

describe('sortTailwindClasses with custom config', () => {
  it('sorts custom color classes correctly', async () => {
    const input = 'px-4 bg-custom-primary text-white bg-blue-500 text-custom-secondary'
    const result = await sortTailwindClasses(input, {
      tailwindConfig: configPath
    })

    expect(result).toBe('bg-blue-500 bg-custom-primary px-4 text-custom-secondary text-white')
  })

  it('sorts custom brand colors with variants', async () => {
    const input = 'p-4 bg-brand-dark text-brand-light border-brand hover:bg-brand'
    const result = await sortTailwindClasses(input, {
      tailwindConfig: configPath
    })

    expect(result).toBe('border-brand bg-brand-dark p-4 text-brand-light hover:bg-brand')
  })

  it('sorts custom accent colors with numeric variants', async () => {
    const input = 'bg-accent-900 text-accent-50 border-accent-100 bg-accent-500'
    const result = await sortTailwindClasses(input, {
      tailwindConfig: configPath
    })

    expect(result).toBe('border-accent-100 bg-accent-500 bg-accent-900 text-accent-50')
  })

  it('sorts custom spacing values correctly', async () => {
    const input = 'p-88 m-18 p-4 m-2'
    const result = await sortTailwindClasses(input, {
      tailwindConfig: configPath
    })

    expect(result).toBe('m-18 m-2 p-4 p-88')
  })

  it('sorts custom font sizes with standard classes', async () => {
    const input = 'text-custom-xl text-sm text-custom-sm text-base'
    const result = await sortTailwindClasses(input, {
      tailwindConfig: configPath
    })

    expect(result).toBe('text-base text-custom-sm text-custom-xl text-sm')
  })

  it('mixes custom and standard utilities correctly', async () => {
    const input = 'flex items-center bg-custom-primary text-brand-light p-88 hover:bg-blue-600 rounded-lg shadow-md'
    const result = await sortTailwindClasses(input, {
      tailwindConfig: configPath
    })

    expect(result).toBe('flex items-center rounded-lg bg-custom-primary p-88 text-brand-light shadow-md hover:bg-blue-600')
  })

  it('handles config file that does not exist gracefully', async () => {
    const originalWarn = console.warn
    console.warn = () => {}

    const input = 'px-4 bg-blue-500 text-white'
    const result = await sortTailwindClasses(input, {
      tailwindConfig: './non-existent-config.js'
    })

    expect(result).toBe('bg-blue-500 px-4 text-white')

    console.warn = originalWarn
  })

  it('treats custom config colors differently than unknown classes', async () => {
    const input = 'px-4 bg-custom-primary bg-blue-500 unknown-class'

    const resultWithoutConfig = await sortTailwindClasses(input)
    const resultWithConfig = await sortTailwindClasses(input, {
      tailwindConfig: configPath
    })

    expect(resultWithoutConfig).toBe('bg-custom-primary unknown-class bg-blue-500 px-4')
    expect(resultWithConfig).toBe('unknown-class bg-blue-500 bg-custom-primary px-4')
  })
})
