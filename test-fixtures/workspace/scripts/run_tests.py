#!/usr/bin/env python3
"""Run the test suite."""

import argparse

def main():
    parser = argparse.ArgumentParser(description="Run tests")
    parser.add_argument('--verbose', help='Enable verbose output')
    parser.add_argument('--filter', help='Filter tests by pattern')
    args = parser.parse_args()
    print(f"Running tests: verbose={args.verbose}, filter={args.filter}")

if __name__ == "__main__":
    main()
