# Cross-platform installer wrapper (Windows PowerShell).
# Delegates to the Node installer so logic stays in one place.
$ErrorActionPreference = 'Stop'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
& node (Join-Path $here 'install.mjs') @args
exit $LASTEXITCODE
