import path from 'path';

export function resolvePath(relativePath: string): string {
  let basePath: string;

  // Check if we're in ESM or CJS context
  if (typeof __dirname !== 'undefined') {
    // CommonJS environment
    basePath = __dirname;
  } else {
    // ESM environment - need to use import.meta.url
    // This needs to be in a try/catch for bundlers and environments that don't support it
    try {
      const { fileURLToPath } = require('url');
      const currentFileUrl = import.meta.url;
      basePath = path.dirname(fileURLToPath(currentFileUrl));
    } catch (error) {
      // Fallback for environments where neither is available
      basePath = process.cwd();
    }
  }

  return path.join(basePath, relativePath);
}
