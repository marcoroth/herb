export const ANSI_ESCAPE = "\x1b"

// eslint-disable-next-line no-control-regex
export const ANSI_REGEX = /\x1b\[[0-9;]*m/g

// eslint-disable-next-line no-control-regex
export const ANSI_REGEX_START = /^\x1b\[[0-9;]*m/

// eslint-disable-next-line no-control-regex
export const ANSI_REGEX_CAPTURE = /(\x1b\[[0-9;]*m)/g

export const visibleWidth = (text: string): number => text.replace(ANSI_REGEX, "").length
