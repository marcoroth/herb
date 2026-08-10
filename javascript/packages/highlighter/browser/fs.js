export function readFileSync() {
  throw new Error("File system access is not available in this environment")
}
