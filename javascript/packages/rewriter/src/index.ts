/**
 * @herb-tools/rewriter - Code rewriters for HTML+ERB templates
 * 
 * This package provides a flexible architecture for rewriting HTML+ERB AST nodes,
 * with built-in rewriters for common transformations like Tailwind CSS class sorting.
 */

// Base rewriter architecture
export { Rewriter, RewriterOptions, RewriterResult } from "./rewriter.js"

// Built-in rewriters
export { 
  TailwindClassSorter, 
  TailwindClassSorterOptions,
  // Convenience functions
  sortTailwindClassesInAST
} from "./rewriters/tailwind-class-sorter/index.js"

// Direct utility functions (for cases where you don't need the full rewriter)
export { 
  sortTailwindClasses, 
  sortTailwindClassArray, 
  containsTailwindClasses 
} from "./rewriters/tailwind-class-sorter/sorter.js"