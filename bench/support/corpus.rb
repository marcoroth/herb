# frozen_string_literal: true

require "fileutils"
require "open3"

module Bench
  # Manages a local checkout of https://github.com/marcoroth/herb-corpus that
  # the benchmark scripts run against. Cached under bench/tmp/herb-corpus/;
  # cloned on first use, never committed.
  module Corpus
    REPO_URL = "https://github.com/marcoroth/herb-corpus.git"
    BENCH_ROOT = File.expand_path("..", __dir__)
    CORPUS_PATH = File.join(BENCH_ROOT, "tmp", "herb-corpus")
    ERB_DIR = File.join(CORPUS_PATH, "erb")

    module_function

    # Ensures the corpus is available locally. Clones (blobless, shallow) if
    # missing. Returns the absolute path to the erb/ directory.
    def ensure!
      if File.directory?(ERB_DIR)
        return ERB_DIR
      end

      FileUtils.mkdir_p(File.dirname(CORPUS_PATH))

      warn "==> Cloning #{REPO_URL} into #{relative(CORPUS_PATH)} ..."
      warn "    (blobless partial clone; ~57 MB, one-time)"

      cmd = [
        "git", "clone",
        "--depth", "1",
        "--filter=blob:none",
        REPO_URL,
        CORPUS_PATH,
      ]

      _out, err, status = Open3.capture3(*cmd)

      unless status.success?
        raise "Failed to clone herb-corpus: #{err}"
      end

      unless File.directory?(ERB_DIR)
        raise "Corpus cloned but erb/ directory missing at #{ERB_DIR}"
      end

      warn "==> Corpus ready at #{relative(ERB_DIR)}"
      ERB_DIR
    end

    # Returns a sorted list of every .erb / .rhtml / .herb file in the corpus.
    def files(extensions: %w[erb rhtml herb])
      root = ensure!
      pattern = "**/*.{#{extensions.join(",")}}"
      Dir.glob(pattern, base: root).sort.map { |rel| File.join(root, rel) }
    end

    def relative(path)
      path.sub("#{BENCH_ROOT}/", "bench/")
    end
  end
end
