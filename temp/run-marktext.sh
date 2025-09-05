#!/bin/bash

# MarkText Launcher Script
# This script runs the built MarkText application with Mermaid v11 support

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Change to project directory
cd "$PROJECT_DIR"

# Check if built version exists
if [ ! -d "dist/electron" ]; then
    echo "Error: Built version not found. Please run 'yarn build:dev' first."
    exit 1
fi

# Run the application
echo "Starting MarkText with Mermaid v11 support..."
npx electron dist/electron