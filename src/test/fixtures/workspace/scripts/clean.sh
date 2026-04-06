#!/bin/bash
# Clean build artifacts and temporary files
# @param target Target directory to clean (default: ./dist)

rm -rf "${1:-./dist}"
echo "Cleaned"
