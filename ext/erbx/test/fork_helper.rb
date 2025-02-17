# frozen_string_literal: true

require "timeout"

class Minitest::Spec
  TIMEOUT_THRESHOLD = ENV["UPDATE_SNAPSHOTS"].nil? ? 0.1 : 5 # seconds

  puts "Using fork_helper with timeout: #{TIMEOUT_THRESHOLD} seconds"

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

      sleep 1 # Give it time to exit

      begin
        Process.kill("KILL", pid)
      rescue StandardError
        nil
      end

      self.fail "Test '#{name}' exceeded timeout of #{TIMEOUT_THRESHOLD} seconds"
    ensure
      reader.close
    end
  end
end
