#!/bin/bash
# .deb post-install (scripts/dist-other.mjs builderConfig): `fabric-dashboards` on PATH, the app folder
# readable by everyone, and the Chromium sandbox helper setuid root — always. electron-builder's own
# script leaves it 0755 when root can create a user namespace, but Ubuntu 24.04 forbids that to ordinary
# users (apparmor_restrict_unprivileged_userns), so the app then aborts for them: "The SUID sandbox
# helper binary was found, but is not configured correctly" (FD-37 clean-Ubuntu check, 2026-10-10).
set -e
APP_DIR='/opt/fabric-dashboards'
chmod 755 "$APP_DIR"
ln -sf "$APP_DIR/fabric-dashboards" /usr/bin/fabric-dashboards
if [ -f "$APP_DIR/chrome-sandbox" ]; then
  chown root:root "$APP_DIR/chrome-sandbox"
  chmod 4755 "$APP_DIR/chrome-sandbox"
fi
if command -v update-desktop-database >/dev/null 2>&1; then update-desktop-database -q /usr/share/applications || true; fi
exit 0
