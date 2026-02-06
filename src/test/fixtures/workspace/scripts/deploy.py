#!/usr/bin/env python3
# Deploy to production environment

import sys

if __name__ == "__main__":
    env = sys.argv[1] if len(sys.argv) > 1 else "staging"
    print(f"Deploying to {env}")
