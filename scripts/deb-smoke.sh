#!/bin/bash
# FD-37: a Linux .deb on a clean system — run inside a fresh ubuntu:24.04 container by packages.yml:
#   docker run --rm -v "$PWD:/w:ro" ubuntu:24.04 bash /w/scripts/deb-smoke.sh /w/release/<name>.deb
# It installs with its own dependencies, the app finds every library it links, the installed MCP
# launcher answers `initialize`, and `apt remove` takes the app away.
set -euo pipefail
deb=$1
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq "$deb" > /tmp/apt.log || { tail -30 /tmp/apt.log; exit 1; }
app="/opt/Fabric Dashboards"
missing=$(ldd "$app/fabric-dashboards" | grep 'not found' || true)
[ -z "$missing" ] || { echo "::error::the installed app lacks: $missing"; exit 1; }
mkdir -p /tmp/svc
answer=$(printf '%s\n' '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}' \
  | FABRIC_SERVICES_DIR=/tmp/svc timeout 30 "$app/resources/bin/fabric-dashboards-mcp" | head -1)
case $answer in *'"serverInfo"'*) ;; *) echo "::error::the installed MCP server did not answer: $answer"; exit 1 ;; esac
apt-get remove -y -qq fabric-dashboards > /dev/null
[ ! -e "$app" ] || { echo "::error::apt remove left $app"; exit 1; }
echo "installed, every library found, answered initialize, removed cleanly"
