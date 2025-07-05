export const stripAnsiColors = (text: string): string => {
  return text.replace(/\x1b\[[0-9;]*m/g, "")
}
