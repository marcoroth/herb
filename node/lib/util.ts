export function ensureString(object: any): string {
  if (typeof object === 'string') {
    return object
  }

  throw new TypeError('Argument must be a string')
}
