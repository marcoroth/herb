import { Herb } from '../lib/herb.js'
import { ensureLibHerbBackend } from '../lib/backend.js';

import type { LibHerbBackend } from '../lib/backend.js';

const LibHerbBrowser: LibHerbBackend = {
  lex: (source: string): any => {
    console.log("lex", source)
    return null
  },

  lexFile: (_path: string): any => {
    throw new Error("File system operations are not supported in the browser.");
  },

  lexToJson: (source: string): any => {
    console.log("lexToJson", source)
    return null
  },

  parse: (source: string): any => {
    console.log("parse", source)
    return null
  },

  parseFile: (_path: string): any => {
    throw new Error("File system operations are not supported in the browser.");
  },

  extractRuby: (source: string) => {
    console.log("extractRuby", source)
    return source
  },

  extractHtml: (source: string) => {
    console.log("extractHtml", source)
    return source
  },

  version: () => {
    console.log("version")
    return "TODO"
  }
};

const herb = new Herb(ensureLibHerbBackend(LibHerbBrowser))

export {
  herb as Herb
}
