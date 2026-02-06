#!/usr/bin/env python3
"""Build the project with specified configuration."""
# @param config Build configuration (default: debug)
# @param output Output directory (default: dist)

import sys

if __name__ == "__main__":
    config = sys.argv[1] if len(sys.argv) > 1 else "debug"
    output = sys.argv[2] if len(sys.argv) > 2 else "dist"
    print(f"Building with config={config}, output={output}")
