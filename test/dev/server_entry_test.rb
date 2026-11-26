# frozen_string_literal: true

require_relative "../test_helper"
require_relative "../../lib/herb/dev/server_entry"

module Dev
  class ServerEntryTest < Minitest::Spec
    def entry_path
      File.join(Herb::Dev::ServerEntry::SERVERS_DIR, "#{Process.pid}.json")
    end

    test "a reader never sees a partially written entry" do
      entry = Herb::Dev::ServerEntry.new(pid: Process.pid, port: 65_002, project: "/tmp/project")
      entry.save
      saving = true

      reader = Thread.new do
        partial_reads = 0

        while saving
          partial_reads += 1 unless File.read(entry_path) == entry.to_json
        end

        partial_reads
      end

      begin
        500.times { entry.save }
      ensure
        saving = false
        partial_reads = reader.value
        entry.remove
      end

      assert_equal 0, partial_reads
    end

    test "a save that fails leaves no temporary file behind" do
      entry = Herb::Dev::ServerEntry.new(pid: Process.pid, port: 65_002, project: "/tmp/project")
      FileUtils.mkdir_p(entry_path)

      begin
        assert_raises(SystemCallError) { entry.save }
        assert_empty Dir.glob("#{entry_path}.*")
      ensure
        Dir.rmdir(entry_path)
      end
    end
  end
end
