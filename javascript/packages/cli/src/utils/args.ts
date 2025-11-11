import parse from 'mri'

export type Arg = {
  [key: `--${string}`]: {
    type: keyof Types
    description: string
    alias?: `-${string}`
    default?: Types[keyof Types]
    values?: string[]
  }
}

type Types = {
  boolean: boolean
  number: number | null
  string: string | null
  'boolean | string': boolean | string | null
  'number | string': number | string | null
  'boolean | number': boolean | number | null
  'boolean | number | string': boolean | number | string | null
}

export type Result<T extends Arg> = {
  [K in keyof T]: T[K] extends { type: keyof Types; default?: any }
    ? undefined extends T[K]['default']
      ? Types[T[K]['type']]
      : NonNullable<Types[T[K]['type']]>
    : never
} & {
  _: string[]
}

export function args<const T extends Arg>(options: T, argv = process.argv.slice(2)): Result<T> {
  for (let [idx, value] of argv.entries()) {
    if (value === '-') {
      argv[idx] = '__IO_DEFAULT_VALUE__'
    }
  }

  let parsed = parse(argv)

  for (let key in parsed) {
    if (parsed[key] === '__IO_DEFAULT_VALUE__') {
      parsed[key] = '-'
    }
  }

  let result: { _: string[]; [key: string]: unknown } = {
    _: parsed._,
  }

  for (let [
    flag,
    { type, alias, default: defaultValue = type === 'boolean' ? false : null },
  ] of Object.entries(options)) {
    result[flag] = defaultValue

    if (alias) {
      let key = alias.slice(1)
      if (parsed[key] !== undefined) {
        result[flag] = convert(parsed[key], type)
      }
    }

    {
      let key = flag.slice(2)
      if (parsed[key] !== undefined) {
        result[flag] = convert(parsed[key], type)
      }
    }
  }

  return result as Result<T>
}

type ArgumentType = string | boolean

function convert<T extends keyof Types>(value: string | boolean, type: T) {
  switch (type) {
    case 'string':
      return convertString(value)
    case 'boolean':
      return convertBoolean(value)
    case 'number':
      return convertNumber(value)
    case 'boolean | string':
      return convertBoolean(value) ?? convertString(value)
    case 'number | string':
      return convertNumber(value) ?? convertString(value)
    case 'boolean | number':
      return convertBoolean(value) ?? convertNumber(value)
    case 'boolean | number | string':
      return convertBoolean(value) ?? convertNumber(value) ?? convertString(value)
    default:
      throw new Error(`Unhandled type: ${type}`)
  }
}

function convertBoolean(value: ArgumentType) {
  if (value === true || value === false) {
    return value
  }

  if (value === 'true') {
    return true
  }

  if (value === 'false') {
    return false
  }
}

function convertNumber(value: ArgumentType) {
  if (typeof value === 'number') {
    return value
  }

  {
    let valueAsNumber = Number(value)
    if (!Number.isNaN(valueAsNumber)) {
      return valueAsNumber
    }
  }
}

function convertString(value: ArgumentType) {
  return `${value}`
}
