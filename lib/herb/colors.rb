# frozen_string_literal: true
# typed: true

# rbs_inline: enabled

module Herb
  module Colors
    HIDE_CURSOR = "\e[?25l"
    SHOW_CURSOR = "\e[?25h"
    CLEAR_SCREEN = "\e[2J\e[H"

    module_function

    #: () -> bool
    def enabled?
      return false if ENV["NO_COLOR"]
      return false if defined?(IRB)
      return false if defined?(Minitest)

      $stdout.tty?
    end

    #: (String) -> String
    def white(string)
      return string unless enabled?

      "\e[37m#{string}\e[0m"
    end

    #: (String) -> String
    def yellow(string)
      return string unless enabled?

      "\e[33m#{string}\e[0m"
    end

    #: (String) -> String
    def green(string)
      return string unless enabled?

      "\e[32m#{string}\e[0m"
    end

    #: (String) -> String
    def red(string)
      return string unless enabled?

      "\e[31m#{string}\e[0m"
    end

    #: (String) -> String
    def magenta(string)
      return string unless enabled?

      "\e[35m#{string}\e[0m"
    end

    #: (String) -> String
    def cyan(string)
      return string unless enabled?

      "\e[36m#{string}\e[0m"
    end

    #: (String) -> String
    def bright_magenta(string)
      return string unless enabled?

      "\e[95m#{string}\e[0m"
    end

    #: (String) -> String
    def dimmed(string)
      return string unless enabled?

      "\e[2m#{string}\e[0m"
    end

    #: (String) -> String
    def bold(string)
      return string unless enabled?

      "\e[1m#{string}\e[0m"
    end

    #: (String, Integer) -> String
    def fg(string, color)
      return string unless enabled?

      "\e[38;5;#{color}m#{string}\e[0m"
    end

    #: (String, Integer, Integer) -> String
    def fg_bg(string, foreground, background)
      return string unless enabled?

      "\e[38;5;#{foreground};48;5;#{background}m#{string}\e[0m"
    end
  end
end
