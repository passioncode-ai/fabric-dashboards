#!/bin/bash
# FD-37: a Linux .deb on a clean system — run inside a fresh ubuntu:24.04 container by packages.yml:
#   docker run --rm -v "$PWD:/w:ro" ubuntu:24.04 bash /w/scripts/deb-smoke.sh /w/release/<name>.deb
# It installs with its own dependencies into a path without a space (Chromium's zygote cannot start from
# one), the app finds every library it links, and — as an ordinary user, never root, so a folder left
# 0700 shows — the installed MCP launcher answers `initialize` and the app itself starts under Xvfb and
# logs `started <version>`. Then `apt remove` takes it away.
set -euo pipefail
deb=$1
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq "$deb" xvfb xauth > /tmp/apt.log || { tail -30 /tmp/apt.log; exit 1; }
app=/opt/fabric-dashboards
[ -x "$app/fabric-dashboards" ] || { echo "::error::the .deb did not install $app/fabric-dashboards"; exit 1; }
missing=$(ldd "$app/fabric-dashboards" | grep 'not found' || true)
[ -z "$missing" ] || { echo "::error::the installed app lacks: $missing"; exit 1; }
version=$(dpkg-query -W -f='${Version}' fabric-dashboards)

useradd -m smoke
as_smoke() { su smoke -s /bin/bash -c "$1"; }

answer=$(as_smoke "mkdir -p /tmp/svc-smoke && printf '%s\n' '{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"initialize\",\"params\":{}}' | FABRIC_SERVICES_DIR=/tmp/svc-smoke timeout 30 $app/resources/bin/fabric-dashboards-mcp | head -1")
case $answer in *'"serverInfo"'*) ;; *) echo "::error::the installed MCP server did not answer an ordinary user: $answer"; exit 1 ;; esac

# The app, as that user, on a virtual display; its main.log is $XDG_STATE_HOME/fabric-dashboards/main.log (PL-06).
as_smoke "export XDG_STATE_HOME=/tmp/smoke-state XDG_DATA_HOME=/tmp/smoke-data FABRIC_SERVICES_DIR=/tmp/svc-smoke; \
  xvfb-run -a /usr/bin/fabric-dashboards > /tmp/smoke-app.out 2>&1 & echo \$! > /tmp/smoke-app.pid"
log=/tmp/smoke-state/fabric-dashboards/main.log
for _ in $(seq 1 90); do
  if grep -q "started $version" "$log" 2>/dev/null; then break; fi
  sleep 1
done
started=$(grep -c "started $version" "$log" 2>/dev/null || true)
pkill -u smoke -f fabric-dashboards || true
pkill -u smoke Xvfb || true
if [ "${started:-0}" -lt 1 ]; then
  echo "::error::the installed app did not start under Xvfb as an ordinary user within 90 s"
  tail -40 /tmp/smoke-app.out || true
  tail -20 "$log" 2>/dev/null || true
  exit 1
fi

apt-get remove -y -qq fabric-dashboards > /dev/null
[ ! -e "$app" ] || { echo "::error::apt remove left $app"; exit 1; }
echo "installed at $app, every library found, as an ordinary user the MCP server answered and the app started ($version), removed cleanly"
