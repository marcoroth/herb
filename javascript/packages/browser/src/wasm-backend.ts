import { name, version } from "../package.json"

import { HerbBackend } from "@herb-tools/core"

export class HerbBackendWASM extends HerbBackend {
  lexFile(): never {
    throw new Error("File system operations are not supported in the browser.")
  }

  parseFile(): never {
    throw new Error("File system operations are not supported in the browser.")
  }

  backendVersion(): string {
    return `${name}@${version}`
  }
}
