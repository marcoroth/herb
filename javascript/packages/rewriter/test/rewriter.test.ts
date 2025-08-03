import { describe, it, expect, beforeAll } from 'vitest'
import { Rewriter, RewriterOptions, RewriterResult } from '../src/rewriter.js'
import { Herb } from '@herb-tools/node-wasm'
import { Node, Token } from '@herb-tools/core'

// Create a test rewriter for testing the abstract base class
class TestRewriter extends Rewriter {
  public processCallCount = 0
  public lastProcessedNode: Node | Token | null = null

  protected processNode(node: Node | Token): boolean {
    this.processCallCount++
    this.lastProcessedNode = node
    this.statistics.total++
    
    // Simulate some processing logic
    if (node instanceof Node && node.kind === 'Element') {
      this.statistics.modified++
      return true
    }
    
    this.statistics.skipped++
    return false
  }
}

describe('Rewriter Base Class', () => {
  beforeAll(async () => {
    await Herb.load()
  })

  describe('constructor and options', () => {
    it('should create with default options', () => {
      const rewriter = new TestRewriter()
      expect(rewriter.isEnabled()).toBe(true)
    })

    it('should create with custom options', () => {
      const options: RewriterOptions = {
        enabled: false,
        verbose: true
      }
      const rewriter = new TestRewriter(options)
      expect(rewriter.isEnabled()).toBe(false)
    })

    it('should merge partial options with defaults', () => {
      const rewriter = new TestRewriter({ verbose: true })
      expect(rewriter.isEnabled()).toBe(true)
    })
  })

  describe('isEnabled method', () => {
    it('should return true when enabled', () => {
      const rewriter = new TestRewriter({ enabled: true })
      expect(rewriter.isEnabled()).toBe(true)
    })

    it('should return false when disabled', () => {
      const rewriter = new TestRewriter({ enabled: false })
      expect(rewriter.isEnabled()).toBe(false)
    })
  })

  describe('process method', () => {
    it('should return early when disabled', () => {
      const rewriter = new TestRewriter({ enabled: false })
      const source = '<div>test</div>'
      const parseResult = Herb.parse(source)
      
      if (parseResult.failed) {
        throw new Error('Parse failed')
      }

      const result = rewriter.process(parseResult.value)
      
      expect(result.modified).toBe(false)
      expect(result.statistics.total).toBe(0)
      expect(result.statistics.modified).toBe(0)
      expect(result.statistics.skipped).toBe(0)
      expect(rewriter.processCallCount).toBe(0)
    })

    it('should process node when enabled', () => {
      const rewriter = new TestRewriter({ enabled: true })
      const source = '<div>test</div>'
      const parseResult = Herb.parse(source)
      
      if (parseResult.failed) {
        throw new Error('Parse failed')
      }

      const result = rewriter.process(parseResult.value)
      
      expect(rewriter.processCallCount).toBe(1)
      expect(rewriter.lastProcessedNode).toBe(parseResult.value)
      expect(typeof result.modified).toBe('boolean')
      expect(result.statistics.total).toBeGreaterThan(0)
    })

    it('should reset statistics between calls', () => {
      const rewriter = new TestRewriter({ enabled: true })
      const source = '<div>test</div>'
      const parseResult = Herb.parse(source)
      
      if (parseResult.failed) {
        throw new Error('Parse failed')
      }

      // First call
      const result1 = rewriter.process(parseResult.value)
      const stats1 = { ...result1.statistics }

      // Second call
      const result2 = rewriter.process(parseResult.value)
      const stats2 = { ...result2.statistics }

      // Statistics should be the same (reset between calls)
      expect(stats1).toEqual(stats2)
      expect(rewriter.processCallCount).toBe(2)
    })

    it('should handle token inputs', () => {
      const rewriter = new TestRewriter({ enabled: true })
      
      // Create a simple token for testing
      const source = 'text'
      const parseResult = Herb.parse(source)
      
      if (parseResult.failed) {
        throw new Error('Parse failed')
      }

      const result = rewriter.process(parseResult.value)
      
      expect(rewriter.processCallCount).toBe(1)
      expect(typeof result.modified).toBe('boolean')
      expect(result.statistics.total).toBeGreaterThan(0)
    })
  })

  describe('statistics', () => {
    it('should track processing statistics correctly', () => {
      const rewriter = new TestRewriter({ enabled: true })
      const source = '<div><span>content</span></div>'
      const parseResult = Herb.parse(source)
      
      if (parseResult.failed) {
        throw new Error('Parse failed')
      }

      const result = rewriter.process(parseResult.value)
      
      expect(result.statistics.total).toBeGreaterThan(0)
      expect(result.statistics.modified).toBeGreaterThanOrEqual(0)
      expect(result.statistics.skipped).toBeGreaterThanOrEqual(0)
      expect(result.statistics.total).toBe(result.statistics.modified + result.statistics.skipped)
    })
  })

  describe('return types', () => {
    it('should return proper RewriterResult structure', () => {
      const rewriter = new TestRewriter({ enabled: true })
      const source = '<div>test</div>'
      const parseResult = Herb.parse(source)
      
      if (parseResult.failed) {
        throw new Error('Parse failed')
      }

      const result: RewriterResult = rewriter.process(parseResult.value)
      
      expect(typeof result.modified).toBe('boolean')
      expect(typeof result.statistics).toBe('object')
      expect(typeof result.statistics.total).toBe('number')
      expect(typeof result.statistics.modified).toBe('number')
      expect(typeof result.statistics.skipped).toBe('number')
    })
  })
})