import { describe, it, expect } from 'vitest'
import { Location } from '../src/location.js'
import { Position } from '../src/position.js'
import {
  DocumentNode,
  LiteralNode,
  HTMLTextNode,
  ERBContentNode,

} from '../src/nodes.js'

import {
  isDocumentNode,
  isLiteralNode,
  isHTMLTextNode,
  isERBContentNode,
  isHTMLNode,
  isERBNode,
  isAnyOf,
  isNoneOf,
  isNode,
  areAllOfType,
  filterNodes,
  hasChildren,
  NODE_TYPE_GUARDS,
  AST_TYPE_GUARDS,
} from '../src/node-type-guards.js'

describe('Node Type Guards', () => {
  // Helper to create a basic location for nodes
  const createLocation = () => new Location(
    new Position(1, 1),
    new Position(1, 2)
  )

  // Create sample nodes for testing
  const documentNode = new DocumentNode({
    type: 'AST_DOCUMENT_NODE',
    location: createLocation(),
    errors: [],
    children: []
  })

  const literalNode = new LiteralNode({
    type: 'AST_LITERAL_NODE',
    location: createLocation(),
    errors: [],
    content: 'test'
  })

  const htmlTextNode = new HTMLTextNode({
    type: 'AST_HTML_TEXT_NODE',
    location: createLocation(),
    errors: [],
    content: 'text'
  })

  const erbContentNode = new ERBContentNode({
    type: 'AST_ERB_CONTENT_NODE',
    location: createLocation(),
    errors: [],
    tag_opening: null,
    content: null,
    tag_closing: null,
    parsed: false,
    valid: true
  })

  describe('Individual Type Guards', () => {
    it('should correctly identify DocumentNode', () => {
      expect(isDocumentNode(documentNode)).toBe(true)
      expect(isDocumentNode(literalNode)).toBe(false)
      expect(isDocumentNode(htmlTextNode)).toBe(false)
      expect(isDocumentNode(erbContentNode)).toBe(false)
    })

    it('should correctly identify LiteralNode', () => {
      expect(isLiteralNode(documentNode)).toBe(false)
      expect(isLiteralNode(literalNode)).toBe(true)
      expect(isLiteralNode(htmlTextNode)).toBe(false)
      expect(isLiteralNode(erbContentNode)).toBe(false)
    })

    it('should correctly identify HTMLTextNode', () => {
      expect(isHTMLTextNode(documentNode)).toBe(false)
      expect(isHTMLTextNode(literalNode)).toBe(false)
      expect(isHTMLTextNode(htmlTextNode)).toBe(true)
      expect(isHTMLTextNode(erbContentNode)).toBe(false)
    })

    it('should correctly identify ERBContentNode', () => {
      expect(isERBContentNode(documentNode)).toBe(false)
      expect(isERBContentNode(literalNode)).toBe(false)
      expect(isERBContentNode(htmlTextNode)).toBe(false)
      expect(isERBContentNode(erbContentNode)).toBe(true)
    })

    it('should work with both instanceof and type string checks', () => {
      expect(isLiteralNode(literalNode)).toBe(true)

      const mockNode = { type: 'AST_LITERAL_NODE' } as any
      expect(isLiteralNode(mockNode)).toBe(true)
    })
  })

  describe('Category Type Guards', () => {
    it('should correctly identify HTML nodes', () => {
      expect(isHTMLNode(htmlTextNode)).toBe(true)
      expect(isHTMLNode(documentNode)).toBe(false)
      expect(isHTMLNode(literalNode)).toBe(false)
      expect(isHTMLNode(erbContentNode)).toBe(false)
    })

    it('should correctly identify ERB nodes', () => {
      expect(isERBNode(erbContentNode)).toBe(true)
      expect(isERBNode(documentNode)).toBe(false)
      expect(isERBNode(literalNode)).toBe(false)
      expect(isERBNode(htmlTextNode)).toBe(false)
    })
  })

  describe('isNode Function', () => {
    describe('with AST type strings', () => {
      it('should match correct type', () => {
        expect(isNode(literalNode, 'AST_LITERAL_NODE')).toBe(true)
        expect(isNode(htmlTextNode, 'AST_HTML_TEXT_NODE')).toBe(true)
        expect(isNode(erbContentNode, 'AST_ERB_CONTENT_NODE')).toBe(true)
      })

      it('should not match incorrect types', () => {
        expect(isNode(literalNode, 'AST_HTML_TEXT_NODE')).toBe(false)
        expect(isNode(htmlTextNode, 'AST_LITERAL_NODE')).toBe(false)
        expect(isNode(documentNode, 'AST_ERB_CONTENT_NODE')).toBe(false)
      })

      it('should return false for unknown types', () => {
        expect(isNode(literalNode, 'UNKNOWN_TYPE' as any)).toBe(false)
      })
    })

    describe('with node classes', () => {
      it('should match correct classes', () => {
        expect(isNode(literalNode, LiteralNode)).toBe(true)
        expect(isNode(htmlTextNode, HTMLTextNode)).toBe(true)
        expect(isNode(erbContentNode, ERBContentNode)).toBe(true)
      })

      it('should not match incorrect classes', () => {
        expect(isNode(literalNode, HTMLTextNode)).toBe(false)
        expect(isNode(htmlTextNode, LiteralNode)).toBe(false)
        expect(isNode(documentNode, ERBContentNode)).toBe(false)
      })
    })
  })

  describe('isAnyOf Function', () => {
    describe('with AST type strings', () => {
      it('should match single type', () => {
        expect(isAnyOf(literalNode, 'AST_LITERAL_NODE')).toBe(true)
        expect(isAnyOf(literalNode, 'AST_HTML_TEXT_NODE')).toBe(false)
      })

      it('should match multiple types', () => {
        expect(isAnyOf(literalNode, 'AST_LITERAL_NODE', 'AST_HTML_TEXT_NODE')).toBe(true)
        expect(isAnyOf(htmlTextNode, 'AST_LITERAL_NODE', 'AST_HTML_TEXT_NODE')).toBe(true)
        expect(isAnyOf(documentNode, 'AST_LITERAL_NODE', 'AST_HTML_TEXT_NODE')).toBe(false)
      })

      it('should return false for unknown types', () => {
        expect(isAnyOf(literalNode, 'UNKNOWN_TYPE' as any)).toBe(false)
      })
    })

    describe('with node classes', () => {
      it('should match single class', () => {
        expect(isAnyOf(literalNode, LiteralNode)).toBe(true)
        expect(isAnyOf(literalNode, HTMLTextNode)).toBe(false)
      })

      it('should match multiple classes', () => {
        expect(isAnyOf(literalNode, LiteralNode, HTMLTextNode)).toBe(true)
        expect(isAnyOf(htmlTextNode, LiteralNode, HTMLTextNode)).toBe(true)
        expect(isAnyOf(documentNode, LiteralNode, HTMLTextNode)).toBe(false)
      })
    })

    describe('with type guard functions (legacy)', () => {
      it('should work with type guard functions', () => {
        expect(isAnyOf(literalNode, isLiteralNode, isHTMLTextNode)).toBe(true)
        expect(isAnyOf(htmlTextNode, isLiteralNode, isHTMLTextNode)).toBe(true)
        expect(isAnyOf(documentNode, isLiteralNode, isHTMLTextNode)).toBe(false)
      })
    })

    describe('mixed usage', () => {
      it('should work with mixed argument types', () => {
        expect(isAnyOf(literalNode, 'AST_LITERAL_NODE', HTMLTextNode, isERBContentNode)).toBe(true)
        expect(isAnyOf(htmlTextNode, 'AST_LITERAL_NODE', HTMLTextNode, isERBContentNode)).toBe(true)
        expect(isAnyOf(erbContentNode, 'AST_LITERAL_NODE', HTMLTextNode, isERBContentNode)).toBe(true)
        expect(isAnyOf(documentNode, 'AST_LITERAL_NODE', HTMLTextNode, isERBContentNode)).toBe(false)
      })
    })
  })

  describe('isNoneOf Function', () => {
    describe('with AST type strings', () => {
      it('should not match single type', () => {
        expect(isNoneOf(literalNode, 'AST_LITERAL_NODE')).toBe(false)
        expect(isNoneOf(literalNode, 'AST_HTML_TEXT_NODE')).toBe(true)
      })

      it('should not match multiple types', () => {
        expect(isNoneOf(literalNode, 'AST_LITERAL_NODE', 'AST_HTML_TEXT_NODE')).toBe(false)
        expect(isNoneOf(htmlTextNode, 'AST_LITERAL_NODE', 'AST_HTML_TEXT_NODE')).toBe(false)
        expect(isNoneOf(documentNode, 'AST_LITERAL_NODE', 'AST_HTML_TEXT_NODE')).toBe(true)
      })

      it('should return true for unknown types', () => {
        expect(isNoneOf(literalNode, 'UNKNOWN_TYPE' as any)).toBe(true)
      })
    })

    describe('with node classes', () => {
      it('should not match single class', () => {
        expect(isNoneOf(literalNode, LiteralNode)).toBe(false)
        expect(isNoneOf(literalNode, HTMLTextNode)).toBe(true)
      })

      it('should not match multiple classes', () => {
        expect(isNoneOf(literalNode, LiteralNode, HTMLTextNode)).toBe(false)
        expect(isNoneOf(htmlTextNode, LiteralNode, HTMLTextNode)).toBe(false)
        expect(isNoneOf(documentNode, LiteralNode, HTMLTextNode)).toBe(true)
      })
    })

    describe('with type guard functions (legacy)', () => {
      it('should work with type guard functions', () => {
        expect(isNoneOf(literalNode, isLiteralNode, isHTMLTextNode)).toBe(false)
        expect(isNoneOf(htmlTextNode, isLiteralNode, isHTMLTextNode)).toBe(false)
        expect(isNoneOf(documentNode, isLiteralNode, isHTMLTextNode)).toBe(true)
      })
    })

    describe('mixed usage', () => {
      it('should work with mixed argument types', () => {
        expect(isNoneOf(literalNode, 'AST_LITERAL_NODE', HTMLTextNode, isERBContentNode)).toBe(false)
        expect(isNoneOf(htmlTextNode, 'AST_LITERAL_NODE', HTMLTextNode, isERBContentNode)).toBe(false)
        expect(isNoneOf(erbContentNode, 'AST_LITERAL_NODE', HTMLTextNode, isERBContentNode)).toBe(false)
        expect(isNoneOf(documentNode, 'AST_LITERAL_NODE', HTMLTextNode, isERBContentNode)).toBe(true)
      })
    })
  })

  describe('areAllOfType Function', () => {
    const mixedNodes = [literalNode, htmlTextNode, documentNode]
    const literalNodes = [literalNode, literalNode]
    const htmlNodes = [htmlTextNode, htmlTextNode]
    const emptyArray: any[] = []

    describe('with AST type strings', () => {
      it('should return true when all nodes match single type', () => {
        expect(areAllOfType(literalNodes, 'AST_LITERAL_NODE')).toBe(true)
        expect(areAllOfType(htmlNodes, 'AST_HTML_TEXT_NODE')).toBe(true)
      })

      it('should return false when not all nodes match single type', () => {
        expect(areAllOfType(mixedNodes, 'AST_LITERAL_NODE')).toBe(false)
        expect(areAllOfType(mixedNodes, 'AST_HTML_TEXT_NODE')).toBe(false)
      })

      it('should return true when all nodes match any of multiple types', () => {
        expect(areAllOfType(mixedNodes, 'AST_LITERAL_NODE', 'AST_HTML_TEXT_NODE', 'AST_DOCUMENT_NODE')).toBe(true)
        expect(areAllOfType(literalNodes, 'AST_LITERAL_NODE', 'AST_HTML_TEXT_NODE')).toBe(true)
      })

      it('should return false when not all nodes match any of multiple types', () => {
        expect(areAllOfType(mixedNodes, 'AST_LITERAL_NODE', 'AST_HTML_TEXT_NODE')).toBe(false)
      })

      it('should return true for empty array', () => {
        expect(areAllOfType(emptyArray, 'AST_LITERAL_NODE')).toBe(true)
      })

      it('should return false for unknown types', () => {
        expect(areAllOfType(literalNodes, 'UNKNOWN_TYPE' as any)).toBe(false)
      })
    })

    describe('with node classes', () => {
      it('should return true when all nodes match single class', () => {
        expect(areAllOfType(literalNodes, LiteralNode)).toBe(true)
        expect(areAllOfType(htmlNodes, HTMLTextNode)).toBe(true)
      })

      it('should return false when not all nodes match single class', () => {
        expect(areAllOfType(mixedNodes, LiteralNode)).toBe(false)
        expect(areAllOfType(mixedNodes, HTMLTextNode)).toBe(false)
      })

      it('should return true when all nodes match any of multiple classes', () => {
        expect(areAllOfType(mixedNodes, LiteralNode, HTMLTextNode, DocumentNode)).toBe(true)
        expect(areAllOfType(literalNodes, LiteralNode, HTMLTextNode)).toBe(true)
      })

      it('should return false when not all nodes match any of multiple classes', () => {
        expect(areAllOfType(mixedNodes, LiteralNode, HTMLTextNode)).toBe(false)
      })
    })

    describe('with type guard functions (legacy)', () => {
      it('should work with type guard functions', () => {
        expect(areAllOfType(literalNodes, isLiteralNode)).toBe(true)
        expect(areAllOfType(mixedNodes, isLiteralNode, isHTMLTextNode, isDocumentNode)).toBe(true)
        expect(areAllOfType(mixedNodes, isLiteralNode, isHTMLTextNode)).toBe(false)
      })
    })

    describe('mixed usage', () => {
      it('should work with mixed argument types', () => {
        expect(areAllOfType(mixedNodes, 'AST_LITERAL_NODE', HTMLTextNode, isDocumentNode)).toBe(true)
        expect(areAllOfType(mixedNodes, 'AST_LITERAL_NODE', HTMLTextNode)).toBe(false)
      })
    })

    describe('edge cases', () => {
      it('should handle single node arrays', () => {
        expect(areAllOfType([literalNode], LiteralNode)).toBe(true)
        expect(areAllOfType([literalNode], HTMLTextNode)).toBe(false)
      })

      it('should handle large arrays', () => {
        const manyLiterals = new Array({ length: 100 }).fill(literalNode)
        expect(areAllOfType(manyLiterals, LiteralNode)).toBe(true)
        expect(areAllOfType(manyLiterals, HTMLTextNode)).toBe(false)
      })
    })
  })

  describe('filterNodes Function', () => {
    const mixedNodes = [literalNode, htmlTextNode, documentNode, erbContentNode]

    describe('with AST type strings', () => {
      it('should filter nodes matching single type', () => {
        const result = filterNodes(mixedNodes, 'AST_LITERAL_NODE')
        expect(result).toEqual([literalNode])
      })

      it('should filter nodes matching multiple types', () => {
        const result = filterNodes(mixedNodes, 'AST_LITERAL_NODE', 'AST_HTML_TEXT_NODE')
        expect(result).toEqual([literalNode, htmlTextNode])
      })

      it('should return empty array when no nodes match', () => {
        const result = filterNodes(mixedNodes, 'AST_WHITESPACE_NODE')
        expect(result).toEqual([])
      })

      it('should handle empty input array', () => {
        const result = filterNodes([], 'AST_LITERAL_NODE')
        expect(result).toEqual([])
      })
    })

    describe('with node classes', () => {
      it('should filter nodes matching single class', () => {
        const result = filterNodes(mixedNodes, LiteralNode)
        expect(result).toEqual([literalNode])
      })

      it('should filter nodes matching multiple classes', () => {
        const result = filterNodes(mixedNodes, LiteralNode, HTMLTextNode)
        expect(result).toEqual([literalNode, htmlTextNode])
      })

      it('should filter all matching nodes', () => {
        const result = filterNodes(mixedNodes, LiteralNode, HTMLTextNode, DocumentNode, ERBContentNode)
        expect(result).toEqual(mixedNodes)
      })
    })

    describe('with type guard functions (legacy)', () => {
      it('should filter nodes using type guard functions', () => {
        const result = filterNodes(mixedNodes, isLiteralNode, isHTMLTextNode)
        expect(result).toEqual([literalNode, htmlTextNode])
      })
    })

    describe('mixed usage', () => {
      it('should filter nodes with mixed argument types', () => {
        const result = filterNodes(mixedNodes, 'AST_LITERAL_NODE', HTMLTextNode, isERBContentNode)
        expect(result).toEqual([literalNode, htmlTextNode, erbContentNode])
      })
    })

    describe('practical use cases', () => {
      it('should filter only HTML nodes', () => {
        const nodes = [literalNode, htmlTextNode, erbContentNode, documentNode]
        const htmlNodes = filterNodes(nodes, 'AST_HTML_TEXT_NODE')
        expect(htmlNodes).toEqual([htmlTextNode])
      })

      it('should filter text content nodes (literal and HTML text)', () => {
        const nodes = [documentNode, literalNode, htmlTextNode, erbContentNode]
        const textNodes = filterNodes(nodes, LiteralNode, HTMLTextNode)
        expect(textNodes).toEqual([literalNode, htmlTextNode])
      })
    })
  })

  describe('hasChildren Function', () => {
    it('should correctly identify nodes that can have children', () => {
      expect(hasChildren(documentNode)).toBe(true)
      expect(hasChildren(literalNode)).toBe(false)
      expect(hasChildren(htmlTextNode)).toBe(false)
    })
  })

  describe('Maps', () => {
    describe('NODE_TYPE_GUARDS', () => {
      it('should contain guards for all node classes', () => {
        expect(NODE_TYPE_GUARDS.has(DocumentNode)).toBe(true)
        expect(NODE_TYPE_GUARDS.has(LiteralNode)).toBe(true)
        expect(NODE_TYPE_GUARDS.has(HTMLTextNode)).toBe(true)
        expect(NODE_TYPE_GUARDS.has(ERBContentNode)).toBe(true)
      })

      it('should return working type guards', () => {
        const guard = NODE_TYPE_GUARDS.get(LiteralNode)
        expect(guard).toBeDefined()
        expect(guard!(literalNode)).toBe(true)
        expect(guard!(documentNode)).toBe(false)
      })
    })

    describe('AST_TYPE_GUARDS', () => {
      it('should contain guards for all AST type strings', () => {
        expect(AST_TYPE_GUARDS.has('AST_DOCUMENT_NODE')).toBe(true)
        expect(AST_TYPE_GUARDS.has('AST_LITERAL_NODE')).toBe(true)
        expect(AST_TYPE_GUARDS.has('AST_HTML_TEXT_NODE')).toBe(true)
        expect(AST_TYPE_GUARDS.has('AST_ERB_CONTENT_NODE')).toBe(true)
      })

      it('should return working type guards', () => {
        const guard = AST_TYPE_GUARDS.get('AST_LITERAL_NODE')
        expect(guard).toBeDefined()
        expect(guard!(literalNode)).toBe(true)
        expect(guard!(documentNode)).toBe(false)
      })
    })
  })

  describe('Type Narrowing', () => {
    it('should provide proper TypeScript type narrowing with isNode', () => {
      const node: any = literalNode

      if (isNode(node, 'AST_LITERAL_NODE')) {
        expect(node.content).toBeDefined()
      }

      if (isNode(node, LiteralNode)) {
        expect(node.content).toBeDefined()
      }
    })

    it('should provide proper TypeScript type narrowing with isAnyOf', () => {
      const node: any = literalNode

      if (isAnyOf(node, 'AST_LITERAL_NODE', 'AST_HTML_TEXT_NODE')) {
        expect(node.content).toBeDefined()
      }

      if (isAnyOf(node, LiteralNode, HTMLTextNode)) {
        expect(node.content).toBeDefined()
      }
    })

    it('should provide proper TypeScript type narrowing with areAllOfType', () => {
      const nodes: Node[] = [literalNode, literalNode]

      if (areAllOfType(nodes, 'AST_LITERAL_NODE')) {
        expect(nodes[0].content).toBeDefined()
      }

      if (areAllOfType(nodes, LiteralNode)) {
        expect(nodes[0].content).toBeDefined()
      }

      if (areAllOfType(nodes, 'AST_LITERAL_NODE', 'AST_HTML_TEXT_NODE')) {
        expect(nodes[0].content).toBeDefined()
      }
    })

    it('should provide proper TypeScript type narrowing with filterNodes', () => {
      const nodes: Node[] = [literalNode, htmlTextNode, documentNode]

      const filtered1 = filterNodes(nodes, 'AST_LITERAL_NODE')

      if (filtered1.length > 0) {
        expect(filtered1[0].content).toBeDefined()
      }

      const filtered2 = filterNodes(nodes, LiteralNode, HTMLTextNode)
      if (filtered2.length > 0) {
        expect(filtered2[0].content).toBeDefined()
      }
    })
  })

  describe('Performance', () => {
    it('should handle large numbers of checks efficiently', () => {
      const start = performance.now()

      for (let i = 0; i < 10000; i++) {
        isLiteralNode(literalNode)
        isHTMLTextNode(htmlTextNode)
        isERBContentNode(erbContentNode)
        isAnyOf(literalNode, 'AST_LITERAL_NODE', 'AST_HTML_TEXT_NODE')
      }

      const end = performance.now()
      const duration = end - start

      expect(duration).toBeLessThan(100)
    })
  })
})
