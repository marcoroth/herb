# typed: false

module Parallel
  def self.map(source, in_processes: nil, in_threads: nil, &block); end
  def self.processor_count; end
end
