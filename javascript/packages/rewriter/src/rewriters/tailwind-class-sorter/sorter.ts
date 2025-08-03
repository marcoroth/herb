/**
 * Tailwind CSS class sorting functionality
 * 
 * This implementation provides a basic Tailwind class sorting algorithm
 * that follows Tailwind's recommended class order.
 */

// Define Tailwind class categories in order of precedence
const TAILWIND_CLASS_ORDER = [
  // Layout
  { pattern: /^(container|static|fixed|absolute|relative|sticky)$/, category: 'layout' },
  { pattern: /^(block|inline-block|inline|flex|inline-flex|grid|inline-grid|hidden)$/, category: 'display' },
  { pattern: /^(float-|clear-)/, category: 'float' },
  { pattern: /^(overflow-|object-)/, category: 'overflow' },
  { pattern: /^(inset-|top-|right-|bottom-|left-)/, category: 'position' },
  
  // Flexbox & Grid
  { pattern: /^(flex-|items-|content-|self-|justify-|order-)/, category: 'flexbox' },
  { pattern: /^(grid-|gap-|col-|row-)/, category: 'grid' },
  
  // Spacing
  { pattern: /^m-\d+/, category: 'margin' },
  { pattern: /^(mx-|my-|mt-|mr-|mb-|ml-)/, category: 'margin' },
  { pattern: /^p-\d+/, category: 'padding' },
  { pattern: /^(px-|py-|pt-|pr-|pb-|pl-)/, category: 'padding' },
  { pattern: /^space-/, category: 'space' },
  
  // Sizing
  { pattern: /^(w-|h-|min-w-|min-h-|max-w-|max-h-)/, category: 'sizing' },
  
  // Typography
  { pattern: /^(font-|text-|leading-|tracking-|whitespace-)/, category: 'typography' },
  
  // Backgrounds
  { pattern: /^bg-/, category: 'background' },
  
  // Borders
  { pattern: /^(border|rounded|ring)/, category: 'border' },
  
  // Effects
  { pattern: /^(opacity-|shadow-|blur-)/, category: 'effects' },
  
  // Transitions
  { pattern: /^(transition|duration|ease|delay)/, category: 'transition' },
  
  // Transforms
  { pattern: /^(transform|translate-|rotate-|scale-|skew-)/, category: 'transform' },
  
  // Interactivity
  { pattern: /^(cursor-|select-|resize-)/, category: 'interactivity' },
  
  // States (should come after base utilities)
  { pattern: /^hover:/, category: 'hover' },
  { pattern: /^focus:/, category: 'focus' },
  { pattern: /^active:/, category: 'active' },
  
  // Responsive (should come last)
  { pattern: /^sm:/, category: 'sm' },
  { pattern: /^md:/, category: 'md' },
  { pattern: /^lg:/, category: 'lg' },
  { pattern: /^xl:/, category: 'xl' },
  { pattern: /^2xl:/, category: '2xl' },
]

/**
 * Get the sort order for a class based on Tailwind categories
 */
function getClassOrder(className: string): number {
  for (let i = 0; i < TAILWIND_CLASS_ORDER.length; i++) {
    if (TAILWIND_CLASS_ORDER[i].pattern.test(className)) {
      return i
    }
  }
  // If no pattern matches, put at the end
  return TAILWIND_CLASS_ORDER.length
}

/**
 * Sort Tailwind CSS classes according to official order
 */
export function sortTailwindClasses(classString: string): string {
  if (!classString?.trim()) {
    return classString || ''
  }

  // Split classes, remove duplicates, and sort
  const classes = classString.trim().split(/\s+/)
  const uniqueClasses = [...new Set(classes)]
  
  // Sort classes based on Tailwind order
  const sortedClasses = uniqueClasses.sort((a, b) => {
    const orderA = getClassOrder(a)
    const orderB = getClassOrder(b)
    
    if (orderA !== orderB) {
      return orderA - orderB
    }
    
    // If same category, sort alphabetically
    return a.localeCompare(b)
  })

  return sortedClasses.join(' ')
}

/**
 * Sort an array of Tailwind CSS classes
 */
export function sortTailwindClassArray(classArray: string[]): string[] {
  if (!Array.isArray(classArray) || classArray.length === 0) {
    return classArray
  }

  try {
    const classString = classArray.join(' ')
    const sortedString = sortTailwindClasses(classString)
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
    /\b(text|bg|border)-(red|blue|green|yellow|purple|pink|gray|indigo|teal|orange)-\d+/,
    /\b(flex|grid|block|inline|hidden)/,
    /\b(hover|focus|active|visited):/,
    /\b(sm|md|lg|xl|2xl):/,
    /\b(space-[xy]|gap)-\d+/,
    /\b(rounded|shadow|opacity|z)-/,
    /\b(font-|text-)/,  // Add broader font and text patterns
  ]

  return tailwindPatterns.some(pattern => pattern.test(classString))
}