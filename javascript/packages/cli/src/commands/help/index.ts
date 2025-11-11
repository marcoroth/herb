import pc from 'picocolors'
import type { Arg } from '../../utils/args.js'
import { UI, header, highlight, indent, println, wordWrap } from '../../utils/renderer.js'

export function help({
  invalid,
  usage,
  commands,
  options,
}: {
  invalid?: string
  usage?: string[]
  commands?: Record<string, string>
  options?: Arg
}) {
  let width = process.stdout.columns

  println(header() + pc.dim(' 🌿 Powerful and seamless HTML-aware ERB parsing and tooling.'))

  if (invalid) {
    println()
    println(`${pc.dim('Invalid command:')} ${pc.red(invalid)}`)
  }

  if (usage && usage.length > 0) {
    println()
    println(pc.dim('Usage:'))
    for (let [idx, example] of usage.entries()) {
      let command = example.slice(0, example.indexOf('['))
      let options = example.slice(example.indexOf('['))

      options = options.replace(/\[.*?\]/g, (option) => pc.dim(option))

      let space = 1

      let lines = wordWrap(options, width - UI.indent - command.length - space)

      if (lines.length > 1 && idx !== 0) {
        println()
      }

      println(indent(`${command}${lines.shift()}`))
      for (let line of lines) {
        println(indent(line, command.length))
      }
    }
  }

  if (commands) {
    println()
    println(pc.dim('Commands:'))

    let maxCommandLength = 0
    for (let command of Object.keys(commands)) {
      maxCommandLength = Math.max(maxCommandLength, command.length)
    }

    for (let [command, description] of Object.entries(commands)) {
      let dotsNeeded = maxCommandLength - command.length + 8
      let spaces = 2
      let availableWidth = width - maxCommandLength - 8 - spaces - UI.indent

      let lines = wordWrap(description, availableWidth)

      println(
        indent(`${pc.blue(command)} ${pc.dim(pc.gray('\u00B7')).repeat(dotsNeeded)} ${lines.shift()}`)
      )

      for (let line of lines) {
        println(indent(`${' '.repeat(maxCommandLength + 8 + spaces)}${line}`))
      }
    }
  }

  if (options) {
    let maxAliasLength = 0
    for (let { alias } of Object.values(options)) {
      if (alias) {
        maxAliasLength = Math.max(maxAliasLength, alias.length)
      }
    }

    let optionStrings: string[] = []

    let maxOptionLength = 0

    for (let [flag, { alias, values }] of Object.entries(options)) {
      if (values?.length) {
        flag += `[=${values.join(', ')}]`
      }

      let option = [
        alias ? `${alias.padStart(maxAliasLength)}` : alias,
        alias ? flag : ' '.repeat(maxAliasLength + 2 /* `, `.length */) + flag,
      ]
        .filter(Boolean)
        .join(', ')

      optionStrings.push(option)
      maxOptionLength = Math.max(maxOptionLength, option.length)
    }

    println()
    println(pc.dim('Options:'))

    let minimumGap = 8

    for (let { description, default: defaultValue = null } of Object.values(options)) {
      let option = optionStrings.shift() as string
      let dotCount = minimumGap + (maxOptionLength - option.length)
      let spaces = 2
      let availableWidth = width - option.length - dotCount - spaces - UI.indent

      let lines = wordWrap(
        defaultValue !== null
          ? `${description} ${pc.dim(`[default:\u202F${highlight(`${defaultValue}`)}]`)}`
          : description,
        availableWidth,
      )

      println(
        indent(`${pc.blue(option)} ${pc.dim(pc.gray('\u00B7')).repeat(dotCount)} ${lines.shift()}`),
      )

      for (let line of lines) {
        println(indent(`${' '.repeat(option.length + dotCount + spaces)}${line}`))
      }
    }
  }
}
