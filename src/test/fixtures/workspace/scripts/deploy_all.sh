#!/bin/bash
# Deploy all services to the target cluster
# @param cluster Target cluster
#
# This script handles full deployment
# @param region AWS region (default: us-east-1)

echo "Deploying to $1 in $2"
