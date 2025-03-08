import { LibHerb } from './libherb.js'
import { Herb } from '../lib/herb.js'
import type { LibHerbBackend } from '../lib/backend.js'

const backend: LibHerbBackend = LibHerb
const herb = new Herb(backend)

export {
  herb as Herb
}
