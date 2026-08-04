import { expect } from "vitest"
import { spawn } from "child_process"
import { resolve } from "path"

export type ExecResult = {
  stdout: string
  stderr: string
  plainStdout: string
  exitCode: number
}

const ANSI_PATTERN = /\x1b\[[0-9;]*m|\x1b\]8;;.*?\x1b\\/g

export const stripAnsi = (text: string): string => text.replace(ANSI_PATTERN, "")

export type ExecOptions = {
  cwd?: string
  stdin?: "pipe" | "ignore"
}

export const expectExitCode = (result: ExecResult, expectedCode: number) => {
  if (result.exitCode !== expectedCode) {
    const errorInfo = {
      expectedExitCode: expectedCode,
      actualExitCode: result.exitCode,
      stdout: result.stdout,
      stderr: result.stderr
    }

    expect.fail(`Exit code mismatch:\n${JSON.stringify(errorInfo, null, 2)}`)
  }
}

export const execBinary = (args: string[] = [], input?: string, options: ExecOptions = {}): Promise<ExecResult> => {
  const binary = resolve(process.cwd(), "bin/herb-format")

  return new Promise((resolvePromise) => {
    const child = spawn("node", [binary, ...args], {
      cwd: options.cwd,
      stdio: [options.stdin || "pipe", "pipe", "pipe"]
    })

    let stdout = ""
    let stderr = ""

    const timeout = setTimeout(() => {
      child.kill()
      resolvePromise({ stdout, stderr, plainStdout: stripAnsi(stdout), exitCode: 1 })
    }, 5000)

    child.stdout.on("data", (data) => {
      stdout += data.toString()
    })

    child.stderr.on("data", (data) => {
      stderr += data.toString()
    })

    child.on("close", (code) => {
      clearTimeout(timeout)
      resolvePromise({ stdout, stderr, plainStdout: stripAnsi(stdout), exitCode: code || 0 })
    })

    if (child.stdin) {
      if (input) {
        child.stdin.write(input)
      }

      child.stdin.end()
    }
  })
}
