import dedent from "dedent"

export function dom(strings: TemplateStringsArray | string, ...values: unknown[]): HTMLElement {
  const template = document.createElement("template")

  template.innerHTML = dedent(strings as TemplateStringsArray, ...values)

  const container = document.createElement("div")

  container.append(template.content)
  document.body.append(container)

  return container
}

export function element(strings: TemplateStringsArray | string, ...values: unknown[]): Element {
  return dom(strings, ...values).firstElementChild!
}

export function resetDOM(): void {
  document.body.innerHTML = ""
}
