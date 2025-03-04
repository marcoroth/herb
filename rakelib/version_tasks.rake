# frozen_string_literal: true
#
# Credit:
# https://github.com/flavorjones/ruby-c-extensions-explained/blob/8d5cdae81bbde48ab572c3963c972c3bf9bd37ef/precompiled/Rakefile#L76-L97
#

desc "Temporarily set VERSION to a unique timestamp"
task "set-version-to-timestamp" do
  # this task is used by bin/test-gem-build
  # to test building, packaging, and installing a precompiled gem
  version_constant_re = /^\s*VERSION\s*=\s*["'](.*)["']$/

  version_file_path = File.join(__dir__, "../lib/erbx/version.rb")
  version_file_contents = File.read(version_file_path)

  current_version_string = version_constant_re.match(version_file_contents)[1].split(".test.").first
  current_version = Gem::Version.new(current_version_string)

  fake_version = Gem::Version.new(
    format(
      "%<current_version>s.test.%<timestamp>s",
      current_version: current_version,
      timestamp: Time.now.strftime("%Y%m%d%H%M%S")
    )
  )

  unless version_file_contents.gsub!(version_constant_re, "  VERSION = \"#{fake_version}\"")
    raise("Could not hack the VERSION constant")
  end

  File.write(version_file_path, version_file_contents)

  puts %(NOTE: wrote version as "#{fake_version}")
end
