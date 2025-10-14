# frozen_string_literal: true

require "timeout"

class Minitest::Spec
  TIMEOUT_THRESHOLD = ENV["UPDATE_SNAPSHOTS"].nil? ? 5 : 60 # seconds

  puts "Using fork_helper with timeout: #{TIMEOUT_THRESHOLD} seconds"

  def run
    result = Tempfile.new

    pid = fork do
      data = Marshal.dump(super)

      result.write(data)
      result.rewind

      exit!
    end

    begin
      Timeout.timeout(TIMEOUT_THRESHOLD) do
        Process.wait(pid) # Wait for the test to finish
      end

      Marshal.load(result.read) # Retrieve test result
    rescue Timeout::Error, Timeout::ExitException
      Process.kill("TERM", pid) # Gracefully terminate

      sleep 1 # Give it time to exit

      begin
        Process.kill("KILL", pid)
      rescue StandardError
        nil
      end

      self.fail "Test '#{name}' exceeded timeout of #{TIMEOUT_THRESHOLD} seconds"
    ensure
      result.unlink
    end
  end
end
