import { herbNative, type HerbModule } from './lib/herb.js';

// Create the wrapper with proper typings
const herb: HerbModule = {
  parse(source: string) {
    if (typeof source !== 'string') {
      throw new TypeError('Source must be a string');
    }
    return herbNative.parse(source);
  },

  lex(source: string) {
    if (typeof source !== 'string') {
      throw new TypeError('Source must be a string');
    }
    return herbNative.lex(source);
  },

  parseFile(path: string) {
    if (typeof path !== 'string') {
      throw new TypeError('Path must be a string');
    }
    return herbNative.parseFile(path);
  },

  lexFile(path: string) {
    if (typeof path !== 'string') {
      throw new TypeError('Path must be a string');
    }
    return herbNative.lexFile(path);
  },

  lexToJson(source: string) {
    if (typeof source !== 'string') {
      throw new TypeError('Source must be a string');
    }
    return herbNative.lexToJson(source);
  },

  extractRuby(source: string) {
    if (typeof source !== 'string') {
      throw new TypeError('Source must be a string');
    }
    return herbNative.extractRuby(source);
  },

  extractHtml(source: string) {
    if (typeof source !== 'string') {
      throw new TypeError('Source must be a string');
    }
    return herbNative.extractHtml(source);
  },

  version() {
    return herbNative.version();
  }
};

export { herb as Herb };
