/**
 * The POSIX path operations this package needs, as plain string handling.
 *
 * Node's `path.posix` would do the same job, but importing it would put a Node
 * built-in into a package that is meant to run in a browser too. Every path this
 * package sees comes from a document URI, so it is always POSIX and always
 * absolute, which is why these can stay this small.
 */

export function basename(filePath: string): string {
  const index = filePath.lastIndexOf("/")

  return index === -1 ? filePath : filePath.slice(index + 1)
}

export function dirname(filePath: string): string {
  const index = filePath.lastIndexOf("/")

  if (index === -1) return "."
  if (index === 0) return "/"

  return filePath.slice(0, index)
}

export function join(...parts: string[]): string {
  const joined = parts.filter(part => part !== "").join("/")
  const absolute = joined.startsWith("/")
  const segments: string[] = []

  for (const segment of joined.split("/")) {
    if (segment === "" || segment === ".") continue

    if (segment === ".." && segments.length > 0 && segments[segments.length - 1] !== "..") {
      segments.pop()
      continue
    }

    segments.push(segment)
  }

  const trailing = joined.endsWith("/") && segments.length > 0
  const path = segments.join("/") + (trailing ? "/" : "")

  if (absolute) return `/${path}`

  return path === "" ? "." : path
}

export function relative(from: string, to: string): string {
  const fromSegments = from.split("/").filter(Boolean)
  const toSegments = to.split("/").filter(Boolean)

  let shared = 0

  while (shared < fromSegments.length && shared < toSegments.length && fromSegments[shared] === toSegments[shared]) {
    shared += 1
  }

  const up = fromSegments.slice(shared).map(() => "..")

  return [...up, ...toSegments.slice(shared)].join("/")
}
