#!/bin/bash
# .deb post-remove: undo after-install.sh. The person's data (~/.local/share/fabric-dashboards,
# ~/.local/state/fabric-dashboards, ~/.config/autostart/fabric-dashboards.desktop) is the app's
# own Settings → Uninstall to remove (ADR-0015), never apt's.
rm -f /usr/bin/fabric-dashboards
if command -v update-desktop-database >/dev/null 2>&1; then update-desktop-database -q /usr/share/applications || true; fi
exit 0
