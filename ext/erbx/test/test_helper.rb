$LOAD_PATH.unshift File.expand_path("../lib", __dir__)

require "erbx"
require "maxitest/autorun"
require "timeout"

class Minitest::Spec
  TIMEOUT_THRESHOLD = 0.1 # seconds

  class << self
    alias_method :test, :it
    alias_method :xtest, :xit
  end

  def run
    reader, writer = IO.pipe

    pid = fork do
      reader.close
      result = super
      writer.write(Marshal.dump(result)) # Serialize result back to parent
      writer.close
      exit! # Avoid running at_exit hooks
    end

    writer.close

    begin
      Timeout.timeout(TIMEOUT_THRESHOLD) do
        Process.wait(pid) # Wait for the test to finish
      end

      result = Marshal.load(reader.read) # Retrieve test result
      result

    rescue Timeout::Error, Timeout::ExitException
      Process.kill("TERM", pid) # Gracefully terminate

      sleep TIMEOUT_THRESHOLD # Give it time to exit

      Process.kill("KILL", pid) rescue nil # Force kill if needed

      self.fail "Test exceeded timeout of #{TIMEOUT_THRESHOLD} seconds"
    ensure
      reader.close
    end
  end
end
