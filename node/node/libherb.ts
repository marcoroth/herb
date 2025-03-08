import { ensureLibHerbBackend } from "../lib/backend.js"
import { resolvePath } from './resolve-path.js';

import type { LibHerbBackend } from "../lib/backend.js"

const libherbpath = resolvePath('../build/Release/herb.node');
const LibHerb: LibHerbBackend = ensureLibHerbBackend(require(libherbpath), libherbpath);

export { LibHerb }
