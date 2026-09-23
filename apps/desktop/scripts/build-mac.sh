#!/bin/bash
# Wraps `electron-builder --mac` with a python shim.
#
# Why: electron-builder's DMG step invokes `python` (not `python3`) for
# plistlib. On macOS with Homebrew Python 3.14, `plistlib` imports fail
# because pyexpat is dynamically linked against a newer libexpat than
# what ships with macOS. Xcode's /usr/bin/python3 (3.9) has a working
# plistlib, so we point `python` at that.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)"
DESKTOP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
SHIM_DIR="$DESKTOP_DIR/.python-shim"

if ! python -c "import plistlib" >/dev/null 2>&1; then
  if ! [ -x /usr/bin/python3 ]; then
    echo "[build-mac] no working python found. Install Xcode Command Line Tools:" >&2
    echo "            xcode-select --install" >&2
    exit 1
  fi
  mkdir -p "$SHIM_DIR"
  cat > "$SHIM_DIR/python" <<'PYSHIM'
#!/bin/bash
exec /usr/bin/python3 "$@"
PYSHIM
  chmod +x "$SHIM_DIR/python"
  export PATH="$SHIM_DIR:$PATH"
  echo "[build-mac] using python shim at $SHIM_DIR (system python was missing plistlib)"
fi

exec bunx electron-builder --mac "$@"
