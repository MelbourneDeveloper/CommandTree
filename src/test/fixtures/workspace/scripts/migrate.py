"""
Database migration tool.
Handles schema updates and data transforms.
"""
import sys

if __name__ == "__main__":
    direction = sys.argv[1] if len(sys.argv) > 1 else "up"
    print(f"Migrating {direction}")
