#!/bin/bash
# Build the project with optional configuration
# @param config Build configuration (default: debug)
# @param verbose Enable verbose output

echo "Building with config: ${1:-debug}"
if [ "$2" = "true" ]; then
    echo "Verbose mode enabled"
fi
