import type { Arg } from './utils/args.js'

export interface Command {
  /**
   * Returns the argument definitions for this command
   */
  options(): Arg

  /**
   * Handles the execution of the command
   */
  handle(args: string[]): Promise<void>

  /**
   * Returns help information for this command
   */
  helpInfo(): { description: string; usage: string[] }
}
