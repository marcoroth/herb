import {
  BaseRuleVisitor,
  AttributeVisitorMixin,
  getAttributeName,
  getStaticAttributeValue,
  forEachAttribute,
  ParserRule
} from "@herb-tools/linter"

import type { Project, RegisteredController } from "stimulus-parser"
import type { ParseResult, HTMLOpenTagNode, Location } from "@herb-tools/core"
import { DEFAULT_STIMULUS_LINT_CONTEXT } from "../types.js"
import type { StimulusLintContext } from "../types.js"

export * from "@herb-tools/linter"

/**
 * Base visitor class that provides Stimulus-specific functionality
 */
export abstract class StimulusRuleVisitor extends BaseRuleVisitor {
  protected stimulusProject?: Project
  protected stimulusContext: StimulusLintContext

  constructor(ruleName: string, context?: Partial<StimulusLintContext>) {
    super(ruleName, context)
    this.stimulusContext = { ...DEFAULT_STIMULUS_LINT_CONTEXT, ...context }
    this.stimulusProject = this.stimulusContext.stimulusProject
  }

  protected get registeredControllers(): RegisteredController[] {
    if (!this.stimulusProject?.registeredControllers) return []

    return this.stimulusProject?.registeredControllers
  }

  protected get registeredControllerIdentifiers(): string[] {
    return this.registeredControllers.map(controller => controller.identifier)
  }

  /**
   * Check if a controller identifier exists in the project
   */
  protected isControllerAvailable(identifier: string): boolean {
    return this.registeredControllerIdentifiers.includes(identifier)
  }

  /**
   * Validates if a controller identifier exists in the project and adds an offense if not
   */
  protected validateControllerIdentifier(identifier: string, location: Location): boolean {
    if (!this.isControllerAvailable(identifier)) {
      const suggestion = didyoumean(identifier, this.registeredControllerIdentifiers)

      this.addOffense(
        `Unknown Stimulus controller \`${identifier}\`. Make sure the controller is defined in your project.${suggestion}`,
        location,
        "error"
      )

      return true
    }

    return false
  }

  /**
   * Get all data attributes from a node
   */
  protected getDataAttributes(node: HTMLOpenTagNode): Map<string, string | null> {
    const dataAttributes = new Map<string, string | null>()

    forEachAttribute(node, (attributeNode) => {
      const name = getAttributeName(attributeNode)
      if (name?.startsWith("data-")) {
        const value = getStaticAttributeValue(attributeNode)
        dataAttributes.set(name, value)
      }
    })

    return dataAttributes
  }

  /**
   * Get Stimulus controller identifiers from data-controller attribute
   */
  protected getControllerIdentifiers(value: string): string[] {
    return value.split(/\s+/).filter(id => id.length > 0)
  }

  /**
   * Get Stimulus action descriptors from data-action attribute
   * Action descriptor format: [event->][controller#]action
   */
  protected parseActionDescriptor(descriptor: string): {
    event?: string
    controller?: string
    action: string
  } | null {
    const match = descriptor.match(/^(?:(.+?)->)?(?:(.+?)#)?(.+)$/)
    if (!match) return null

    const [, event, controller, action] = match
    return {
      event,
      controller,
      action
    }
  }

  /**
   * Get Stimulus target descriptors from data-*-target attributes
   */
  protected getTargetDescriptors(node: HTMLOpenTagNode): Map<string, string[]> {
    const targets = new Map<string, string[]>()

    const dataAttributes = this.getDataAttributes(node)

    for (const [name, value] of dataAttributes) {
      const match = name.match(/^data-(.+?)-target$/)

      if (match && value) {
        const controller = match[1]
        const targetNames = value.split(/\s+/).filter(t => t.length > 0)
        targets.set(controller, targetNames)
      }
    }

    return targets
  }

  /**
   * Get Stimulus value definitions from data-*-*-value attributes
   */
  protected getValueDescriptors(node: HTMLOpenTagNode): Map<string, Map<string, string>> {
    const values = new Map<string, Map<string, string>>()

    const dataAttributes = this.getDataAttributes(node)

    for (const [name, value] of dataAttributes) {
      const match = name.match(/^data-(.+?)-(.+?)-value$/)

      if (match && value !== null) {
        const [, controller, valueName] = match

        if (!values.has(controller)) {
          values.set(controller, new Map())
        }

        values.get(controller)!.set(valueName, value)
      }
    }

    return values
  }

  /**
   * Get Stimulus class definitions from data-*-*-class attributes
   */
  protected getClassDescriptors(node: HTMLOpenTagNode): Map<string, Map<string, string>> {
    const classes = new Map<string, Map<string, string>>()

    const dataAttributes = this.getDataAttributes(node)
    for (const [name, value] of dataAttributes) {
      const match = name.match(/^data-(.+?)-(.+?)-class$/)
      if (match && value !== null) {
        const [, controller, className] = match
        if (!classes.has(controller)) {
          classes.set(controller, new Map())
        }
        classes.get(controller)!.set(className, value)
      }
    }

    return classes
  }

  /**
   * Get Stimulus outlet definitions from data-*-outlet attributes
   */
  protected getOutletDescriptors(node: HTMLOpenTagNode): Map<string, string[]> {
    const outlets = new Map<string, string[]>()

    const dataAttributes = this.getDataAttributes(node)

    for (const [name, value] of dataAttributes) {
      const match = name.match(/^data-(.+?)-(.+?)-outlet$/)

      if (match && value) {
        const [, controller] = match
        const outletNames = value.split(/\s+/).filter(o => o.length > 0)

        outlets.set(controller, outletNames)
      }
    }

    return outlets
  }
}

/**
 * Attribute visitor mixin that provides Stimulus-specific attribute checking
 */
export abstract class StimulusAttributeVisitor extends AttributeVisitorMixin {
  protected stimulusProject?: Project
  protected stimulusContext: StimulusLintContext

  constructor(ruleName: string, context?: Partial<StimulusLintContext>) {
    super(ruleName, context)

    this.stimulusContext = { ...DEFAULT_STIMULUS_LINT_CONTEXT, ...context }
    this.stimulusProject = this.stimulusContext.stimulusProject
  }
}

export abstract class HerbParserRule extends ParserRule {
  isEnabled(_result: ParseResult, context?: Partial<StimulusLintContext>): boolean {
    if (!context || !context.stimulusProject) return false

    return true
  }
}

export function getSuggestion(input: string, candidates: string[]): string | null {
  for (const candidate of candidates) {
    if (levenshteinDistance(input.toLowerCase(), candidate.toLowerCase()) <= 2) {
      return candidate
    }
  }

  return null
}

export function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = []

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i]
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1]
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        )
      }
    }
  }

  return matrix[b.length][a.length]
}

export function didyoumean(input: string, candidates: string[]): string | null {
  const suggestion = getSuggestion(input, candidates)

  return suggestion ? ` Did you mean \`${suggestion}\`?` : ""
}

// [event->]controller#method[:options]
export function parseActionDescriptor(action: string) {
  const parts = action.split('->')
  let event = 'click'
  let controllerAndMethod = action

  if (parts.length > 1) {
    event = parts[0]
    controllerAndMethod = parts[1]
  }

  const hashIndex = controllerAndMethod.indexOf('#')
  if (hashIndex === -1) {
    return { event, identifier: null, methodName: null, valid: false }
  }

  const identifier = controllerAndMethod.substring(0, hashIndex)
  const methodPart = controllerAndMethod.substring(hashIndex + 1)
  const colonIndex = methodPart.indexOf(':')
  const methodName = colonIndex === -1 ? methodPart : methodPart.substring(0, colonIndex)

  return {
    event,
    identifier: identifier || null,
    methodName: methodName || null,
    valid: identifier && methodName
  }
}
