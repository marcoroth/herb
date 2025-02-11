$LOAD_PATH.unshift File.expand_path('../lib', __dir__)

require "erbx"
require "maxitest/autorun"

class Minitest::Spec
  class << self
    alias_method :test, :it
    alias_method :xtest, :xit
  end
end
