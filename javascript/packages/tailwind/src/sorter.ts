/**
 * Tailwind CSS class sorting functionality
 * Uses direct imports from prettier-plugin-tailwindcss for optimal performance
 */

// Cache for prettier with tailwind to avoid repeated loading
let prettierWithTailwindCache: any = null

/**
 * Load Prettier with the Tailwind plugin for sorting
 */
async function loadPrettierWithTailwind(): Promise<any | null> {
  if (prettierWithTailwindCache) {
    return prettierWithTailwindCache
  }

  try {
    // Use dynamic imports to avoid build issues
    const [prettier, tailwindPlugin] = await Promise.all([
      import('prettier').catch(() => null),
      import('prettier-plugin-tailwindcss').catch(() => null)
    ])

    if (!prettier || !tailwindPlugin) {
      return null
    }

    prettierWithTailwindCache = { 
      prettier: prettier.default || prettier, 
      plugin: tailwindPlugin 
    }
    
    return prettierWithTailwindCache
  } catch (error) {
    console.warn('Failed to load Prettier with Tailwind plugin:', error)
    return null
  }
}


/**
 * Sort Tailwind CSS classes using Prettier with the Tailwind plugin
 */
export async function sortTailwindClasses(classString: string): Promise<string> {
  if (!classString?.trim()) {
    return classString || ''
  }

  try {
    const prettierWithTailwind = await loadPrettierWithTailwind()

    if (!prettierWithTailwind) {
      // If dependencies aren't available, return original string
      return classString
    }

    const { prettier, plugin } = prettierWithTailwind

    // Create a simple HTML snippet with the class attribute
    const htmlSnippet = `<div class="${classString}"></div>`

    // Format using Prettier with the Tailwind plugin
    const formatted = await prettier.format(htmlSnippet, {
      parser: 'html',
      plugins: [plugin],
      printWidth: 1000, // Use a large width to prevent wrapping
      singleQuote: false,
      tabWidth: 2
    })

    // Extract the sorted classes from the formatted result
    const match = formatted.match(/class="([^"]*)"/)
    if (match && match[1]) {
      return match[1]
    }
    
    return classString
    
  } catch (error) {
    // If sorting fails, return original string
    console.warn('Failed to sort Tailwind classes:', error)
    return classString
  }
}

/**
 * Sort an array of Tailwind CSS classes
 */
export async function sortTailwindClassArray(classArray: string[]): Promise<string[]> {
  if (!Array.isArray(classArray) || classArray.length === 0) {
    return classArray
  }

  try {
    const classString = classArray.join(' ')
    const sortedString = await sortTailwindClasses(classString)
    return sortedString.split(/\s+/).filter(Boolean)
    
  } catch (error) {
    console.warn('Failed to sort Tailwind class array:', error)
    return classArray
  }
}

/**
 * Check if a class string likely contains Tailwind classes
 */
export function containsTailwindClasses(classString: string): boolean {
  if (!classString || typeof classString !== 'string') {
    return false
  }

  // Common Tailwind patterns
  const tailwindPatterns = [
    /\b(w|h|m|p|mx|my|px|py|mt|mr|mb|ml|pt|pr|pb|pl)-\d+/,
    /\b(text|bg|border)-(red|blue|green|yellow|purple|pink|gray|indigo|teal|orange)-\d{3}/,
    /\b(flex|grid|block|inline|hidden)/,
    /\b(hover|focus|active|visited):/,
    /\b(sm|md|lg|xl|2xl):/,
    /\b(space-[xy]|gap)-\d+/,
    /\b(rounded|shadow|opacity|z)-/,
  ]

  return tailwindPatterns.some(pattern => pattern.test(classString))
}