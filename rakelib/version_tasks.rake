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

  version_file_path = File.join(__dir__, "../lib/herb/version.rb")
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

namespace :version do
  desc "Set C and Ruby version"
  task :set, [:version, :dry_run] do |_t, args|
    dry_run = args[:dry_run] == "true"

    if dry_run
      puts "DRY RUN: Setting version to #{args[:version]}"
    else
      puts "NOTE: Setting version to #{args[:version]}"
    end

    version_constant_re = /^\s*VERSION\s*=\s*["'](.*)["']$/

    version_file_path = File.join(__dir__, "../lib/herb/version.rb")
    version_file_contents = File.read(version_file_path)

    new_version = args[:version].gsub("-", ".")
    unless version_file_contents.gsub!(version_constant_re, "  VERSION = \"#{new_version}\"")
      raise("Could not update the VERSION constant in lib/herb/version.rb")
    end

    if dry_run
      puts %(DRY RUN: would write version in lib/herb/version.rb as "#{new_version}")
      puts %(DRY RUN: would add lib/herb/version.rb to git)
    else
      puts %(NOTE: wrote version in lib/herb/version.rb as "#{new_version}")
      File.write(version_file_path, version_file_contents)

      `git add lib/herb/version.rb`

      puts %(NOTE: added lib/herb/version.rb to git)
    end

    puts

    version_file_path = File.join(__dir__, "../src/include/version.h")
    version_file_contents = File.read(version_file_path)

    version_constant_re = /^#define HERB_VERSION "(.*)"$/

    new_version = args[:version]
    unless version_file_contents.gsub!(version_constant_re, "#define HERB_VERSION \"#{new_version}\"")
      raise("Could not update the HERB_VERSION constant in src/include/version.h")
    end

    if dry_run
      puts %(DRY RUN: would write version in src/include/version.h as "#{new_version}")
      puts %(DRY RUN: would add src/include/version.h to git)
    else
      File.write(version_file_path, version_file_contents)

      puts %(NOTE: wrote version in src/include/version.h as "#{new_version}")

      `git add src/include/version.h`

      puts %(NOTE: added src/include/version.h to git)
    end

    puts

    puts "NOTE: running bundle install..."
    `bundle`

    if dry_run
      puts %(DRY RUN: would add Gemfile.lock to git)
    else
      `git add Gemfile.lock`
      puts %(NOTE: added Gemfile.lock to git)
    end
  end
end
