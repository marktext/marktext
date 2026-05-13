#!/bin/bash
set -e

echo "Installing dependencies (skipping native builds)..."
npm install --ignore-scripts

echo "Applying patches..."
npx patch-package

echo "Rebuilding native modules..."
npm rebuild

echo "✓ Setup complete!"
