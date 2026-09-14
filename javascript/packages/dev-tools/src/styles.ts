export function injectStyle(name: string, css: string): HTMLStyleElement {
  const element = document.createElement('style')

  element.setAttribute('data-herb-dev-tools', name)
  element.textContent = css

  document.head.appendChild(element)

  return element
}
