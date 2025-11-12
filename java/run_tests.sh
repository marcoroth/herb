#!/usr/bin/env bash

# Simple test script for Java bindings

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "Running Java binding tests..."
echo

TEST_FILE="snapshots/test.html.erb"

echo "Test 1: Version command"

./bin/herb-java version
echo "✓ Version test passed"
echo

echo "Test 2: Lex command"

OUTPUT=$(./bin/herb-java lex "$TEST_FILE")
EXPECTED=$(cat snapshots/test.lex.txt)

if [ "$OUTPUT" = "$EXPECTED" ]; then
  echo "✓ Lex test passed"
else
  echo "✗ Lex test failed"
  echo "Expected:"
  echo "$EXPECTED"
  echo "Got:"
  echo "$OUTPUT"
  exit 1
fi
echo

echo "Test 3: Parse command"

OUTPUT=$(./bin/herb-java parse "$TEST_FILE")
EXPECTED=$(cat snapshots/test.parse.txt)

if [ "$OUTPUT" = "$EXPECTED" ]; then
  echo "✓ Parse test passed"
else
  echo "✗ Parse test failed"
  echo "Expected:"
  echo "$EXPECTED"
  echo "Got:"
  echo "$OUTPUT"
  exit 1
fi
echo

echo "Test 4: Extract Ruby"

OUTPUT=$(./bin/herb-java ruby "$TEST_FILE")
EXPECTED=$(cat snapshots/test.ruby.txt)

if [ "$OUTPUT" = "$EXPECTED" ]; then
  echo "✓ Extract Ruby test passed"
else
  echo "✗ Extract Ruby test failed"
  echo "Expected:"
  echo "$EXPECTED"
  echo "Got:"
  echo "$OUTPUT"
  exit 1
fi
echo

echo "Test 5: Extract HTML"

OUTPUT=$(./bin/herb-java html "$TEST_FILE")
EXPECTED=$(cat snapshots/test.html.txt)

if [ "$OUTPUT" = "$EXPECTED" ]; then
  echo "✓ Extract HTML test passed"
else
  echo "✗ Extract HTML test failed"
  echo "Expected:"
  echo "$EXPECTED"
  echo "Got:"
  echo "$OUTPUT"
  exit 1
fi
echo

echo "All Java tests passed! ✓"
