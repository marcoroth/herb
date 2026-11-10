#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
exec ruby -e 'require "./lib/herb/bootstrap"; puts Herb::Bootstrap.build_ffi_library'
