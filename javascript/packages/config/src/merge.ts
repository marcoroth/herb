type DeepPartial<T> = T extends object ? {
  [P in keyof T]?: DeepPartial<T[P]>;
} : T;

function isObject(item: unknown): item is Record<string, any> {
  return item !== null && typeof item === 'object' && !Array.isArray(item)
}

/**
 * Deep merge two objects
 * @param target - The base object (defaults)
 * @param source - The object to merge in (user config)
 * @returns Merged object
 */
export function deepMerge<T extends Record<string, any>>(target: T, source: DeepPartial<T>): T {
  const output = { ...target }

  for (const key in source) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      const sourceValue = source[key]
      const targetValue = target[key]

      if (sourceValue === undefined) {
        continue
      }

      if (Array.isArray(sourceValue)) {
        if (key === 'include' && Array.isArray(targetValue)) {
          ;(output as any)[key] = [...targetValue, ...sourceValue]
        } else {
          ;(output as any)[key] = [...sourceValue]
        }
        continue
      }

      if (isObject(sourceValue) && isObject(targetValue)) {
        ;(output as any)[key] = deepMerge(targetValue, sourceValue)

        continue
      }

      ;(output as any)[key] = sourceValue
    }
  }

  return output
}
