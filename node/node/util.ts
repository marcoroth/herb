import { ensureString } from "../lib/util.js"
import { stat as fileExists } from 'node:fs/promises'

export async function ensureFile(object: any): Promise<string> {
  const string = ensureString(object)

  if (await fileExists(string)) {
    return string
  }

  throw new TypeError('Argument must be a string')
}
