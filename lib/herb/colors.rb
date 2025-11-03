# frozen_string_literal: true
# typed: true

module Herb
  module Colors
    module_function

    def enabled?
      return false if ENV["NO_COLOR"]
      return false if defined?(IRB)
      return false if defined?(Minitest)

      $stdout.tty?
    end

    def white(string)
      return string unless enabled?

      "\e[37m#{string}\e[0m"
    end

    def yellow(string)
      return string unless enabled?

      "\e[33m#{string}\e[0m"
    end

    def green(string)
      return string unless enabled?

      "\e[32m#{string}\e[0m"
    end

    def red(string)
      return string unless enabled?

      "\e[31m#{string}\e[0m"
    end

    def magenta(string)
      return string unless enabled?

      "\e[35m#{string}\e[0m"
    end

    def cyan(string)
      return string unless enabled?

      "\e[36m#{string}\e[0m"
    end

    def bright_magenta(string)
      return string unless enabled?

      "\e[95m#{string}\e[0m"
    end

    def dimmed(string)
      return string unless enabled?

      "\e[2m#{string}\e[0m"
    end

    def bold(string)
      return string unless enabled?

      "\e[1m#{string}\e[0m"
    end
  end
end
