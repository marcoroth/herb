#!/bin/bash

set -e

echo "Setting up test fixtures..."

if [ -d "test/fixtures/project-v3" ]; then
  echo "Installing dependencies for project-v3..."
  cd test/fixtures/project-v3
  yarn install --frozen-lockfile --non-interactive
  cd ../../..
fi

if [ -d "test/fixtures/project-v4" ]; then
  echo "Installing dependencies for project-v4..."
  cd test/fixtures/project-v4
  yarn install --frozen-lockfile --non-interactive
  cd ../../..
fi

echo "Fixture setup complete!"
