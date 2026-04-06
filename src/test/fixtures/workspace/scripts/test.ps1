<#
.SYNOPSIS
    Run all test suites

.PARAMETER TestSuite
    The test suite to run

.PARAMETER Verbose
    Enable verbose logging
#>

# @param TestSuite The suite to run (default: unit)
# @param
# @param Timeout Max seconds to wait
# Regular comment that is not a param
# Another regular comment

param(
    $TestSuite = "unit",
    $Timeout,
    $Verbose
)

# This is a regular comment
Write-Host "Running $TestSuite tests with timeout $Timeout"
