# frozen_string_literal: true

desc "Update the allowed_push_host metadata in the gemspec"
task "update-allowed-push-host", [:host] do |_t, args|
  file_path = "erbx.gemspec"

  unless args[:host]
    puts "Error: Please provide a host. Usage: rake update-allowed-push-host[HOST_URL]"
    exit 1
  end

  content = File.read(file_path)

  updated_content = content.gsub(
    /  spec.metadata\["allowed_push_host"\] = ".*?"/,
    %(  spec.metadata["allowed_push_host"] = "#{args[:host]}")
  )

  File.write(file_path, updated_content)

  puts "Updated allowed_push_host to #{args[:host]} in #{file_path}"
end

desc "Reset the allowed_push_host metadata in the gemspec back to rubygems.org"
task "reset-allowed-push-host" do
  Rake::Task["update-allowed-push-host"].invoke("https://rubygems.org")
end
