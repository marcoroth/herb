# frozen_string_literal: true

source "https://rubygems.org"

gemspec

gem "prism", github: "ruby/prism", tag: "v1.9.0"

gem "actionview", "~> 8.0"
gem "digest", "~> 3.2"
gem "erubi"
gem "lz_string"
gem "maxitest", "~> 6.0"
gem "minitest-difftastic", "~> 0.2"
gem "rake", "~> 13.2"
gem "rake-compiler", "~> 1.3"
gem "rake-compiler-dock", "~> 1.11"
gem "rbs-inline", "~> 0.12"
gem "reline", "~> 0.6"
gem "rubocop", "~> 1.71"
gem "sorbet"
gem "steep", "~> 1.10"

# TODO: remove once it's fixed in RBS
# ❯ bundle exec rbs-inline --opt-out --output=sig/ lib/
# /Users/marcoroth/Development/herb/vendor/bundle/ruby/4.0.0/gems/rbs-3.10.0/lib/rbs.rb:11: warning: tsort was loaded from the standard library, but will no longer be part of the default gems starting from Ruby 4.1.0
# You can add tsort to your Gemfile or gemspec to silence this warning.
# 🎉 Generated 0 RBS files under sig/
gem "tsort", "~> 0.2.0"

gem "irb", "~> 1.16"
