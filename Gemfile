# frozen_string_literal: true

source "https://rubygems.org"

gemspec

gem "prism", github: "ruby/prism", tag: "v1.4.0"

gem "actionview", "~> 8.0"
gem "lz_string"
gem "maxitest"
gem "minitest-difftastic", "~> 0.2"
gem "rake", "~> 13.2"
gem "rake-compiler", "~> 1.2"
gem "rake-compiler-dock", "~> 1.9"
gem "reline", "~> 0.6"
gem "rubocop", "~> 1.71"

group :development do
  gem "rbs-inline", require: false, github: "marcoroth/rbs-inline", branch: "prism"
  gem "sorbet"
  gem "steep", "~> 1.10"
end
