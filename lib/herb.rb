# frozen_string_literal: true
# typed: false

require_relative "herb/colors"
require_relative "herb/range"
require_relative "herb/position"
require_relative "herb/location"

require_relative "herb/token"
require_relative "herb/token_list"

require_relative "herb/result"
require_relative "herb/lex_result"
require_relative "herb/parser_options"
require_relative "herb/parse_result"

require_relative "herb/ast"
require_relative "herb/ast/node"
require_relative "herb/ast/nodes"
require_relative "herb/ast/helpers"

require_relative "herb/errors"
require_relative "herb/warnings"

require_relative "herb/cli"
require_relative "herb/project"
require_relative "herb/configuration"

require_relative "herb/version"

require_relative "herb/visitor"
require_relative "herb/engine"

begin
  major, minor, _patch = RUBY_VERSION.split(".") #: [String, String, String]

  if RUBY_PATCHLEVEL == -1
    require_relative "herb/herb"
  else
    begin
      require_relative "herb/#{major}.#{minor}/herb"
    rescue LoadError
      require_relative "herb/herb"
    end
  end
rescue LoadError => e
  raise LoadError, <<~MESSAGE
    Failed to load the Herb native extension.

    Tried to load: #{e.message.split(" -- ").last}

    This can happen when:
      1. You're using a preview/development version of Ruby (RUBY_PATCHLEVEL=#{RUBY_PATCHLEVEL})
      2. The native extension wasn't compiled during gem installation
      3. Required build tools (C compiler) were missing during installation

    To fix, try reinstalling with source compilation:
      gem install herb --platform ruby

    If compilation fails, install a C compiler first:
      - macOS:          xcode-select --install
      - Ubuntu/Debian:  apt-get install build-essential
      - Fedora/RHEL:    dnf install make gcc
      - Alpine:         apk add build-base
  MESSAGE
end

module Herb
  class << self
    def configuration(project_path = nil)
      @configuration ||= Configuration.load(project_path)
    end

    def configure(project_path = nil)
      @configuration = Configuration.load(project_path)
    end

    def reset_configuration!
      @configuration = nil
    end
  end
end
