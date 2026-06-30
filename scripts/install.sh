#!/usr/bin/env bash
# Cross-platform installer wrapper (macOS / Linux).
# Delegates to the Node installer so logic stays in one place.
set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec node "$DIR/install.mjs" "$@"
