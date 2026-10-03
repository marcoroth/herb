import { HERB_ATTRIBUTES } from "@herb-tools/client/directives"
import { COMPONENT_DEFINITIONS, BUILT_IN_COMPONENTS } from "@herb-tools/core"

import type { IHTMLDataProvider } from "vscode-html-languageservice"

const DESCRIPTIONS: Record<string, string> = {
  [HERB_ATTRIBUTES.name]: "Names the slot this element holds, so client code can address it without counting indices.",
  [HERB_ATTRIBUTES.into]: "Makes the form an optimistic send into the keyed collection this names.",
  [HERB_ATTRIBUTES.set]: 'Sets declared states on an event, like `click->open=true,failed=false`.',
  [HERB_ATTRIBUTES.toggle]: "Flips a boolean state on click, or on the event named in the value.",
  [HERB_ATTRIBUTES.increment]: "Increments an integer state, stepping by `data-herb-by`.",
  [HERB_ATTRIBUTES.decrement]: "Decrements an integer state, stepping by `data-herb-by`.",
  [HERB_ATTRIBUTES.reset]: "Returns states to what the server rendered; with no value, every state in scope.",
  [HERB_ATTRIBUTES.by]: "The step for `data-herb-increment` and `data-herb-decrement`.",
}

export const herbHTMLDataProvider: IHTMLDataProvider = {
  getId: () => "herb",
  isApplicable: () => true,
  provideTags: () =>
    BUILT_IN_COMPONENTS.map((component) => {
      const definition = COMPONENT_DEFINITIONS[component]

      return {
        name: definition.name,
        description: { kind: "markdown" as const, value: definition.description },
        attributes: definition.attributes.map((attribute) => ({
          name: attribute.name,
          description: { kind: "markdown" as const, value: attribute.description },
        })),
      }
    }),
  provideAttributes: () =>
    Object.entries(DESCRIPTIONS).map(([name, description]) => ({
      name,
      description: { kind: "markdown", value: description },
    })),
  provideValues: () => [],
}
