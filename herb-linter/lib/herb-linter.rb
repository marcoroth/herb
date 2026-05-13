# frozen_string_literal: true

require "herb"
require_relative "herb/linter/version"

if Herb::VERSION != Herb::Linter::VERSION
  raise "herb-linter #{Herb::Linter::VERSION} requires herb #{Herb::Linter::VERSION}, but herb #{Herb::VERSION} is loaded. " \
        "Make sure both gems are the same version."
end
require_relative "herb/linter/backend"
require_relative "herb/linter/offense"
require_relative "herb/linter/lint_result"
require_relative "herb/linter/rule"
require_relative "herb/linter/runner"

begin
  require_relative "herb/linter/herb_linter"
rescue LoadError => e
  warn "herb-linter: native extension not loaded: #{e.message}"
end
