#!/bin/sh
# FD-65 e2e: stands in for npx. It refuses anything but the pinned, read-only doctor the app must run.
[ "$1" = "--yes" ] && [ "$2" = "@passioncode-ai/passioncode@0.2.2" ] && [ "$3" = "doctor" ] && [ "$4" = "--json" ] && [ -z "$5" ] || { echo "unexpected arguments: $*" >&2; exit 2; }
cat "$(dirname "$0")/doctor-failing.json"
exit 1
