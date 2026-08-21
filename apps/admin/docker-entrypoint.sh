#!/bin/sh
set -e

# ---------------------------------------------------------------------------
# Runtime replacement of NEXT_PUBLIC_API_BASE_URL.
#
# Next.js inlines NEXT_PUBLIC_* values at build time. To allow runtime
# configuration in Kubernetes we build with a deterministic placeholder string
# and replace it here before starting the server.
# ---------------------------------------------------------------------------

SEARCH_DIR="/app/apps/admin"

replace_placeholder() {
  local PLACEHOLDER="$1"
  local VALUE="$2"

  if [ -z "$VALUE" ]; then
    return
  fi

  # Escape special sed characters in the replacement value
  ESCAPED_VALUE=$(printf '%s\n' "$VALUE" | sed 's/[&/\]/\\&/g')

  find "$SEARCH_DIR" -type f \( -name '*.js' -o -name '*.html' -o -name '*.json' \) \
    -exec grep -l "$PLACEHOLDER" {} + 2>/dev/null | while read -r file; do
      sed -i "s|${PLACEHOLDER}|${ESCAPED_VALUE}|g" "$file"
    done
}

echo "[ADMIN] Applying runtime environment variables..."

replace_placeholder "__RUNTIME_NEXT_PUBLIC_API_BASE_URL__" "${NEXT_PUBLIC_API_BASE_URL}"

echo "[ADMIN] Starting Next.js server..."

if [ -f apps/admin/server.js ]; then
  exec node apps/admin/server.js
elif [ -f server.js ]; then
  exec node server.js
else
  echo "No standalone server.js found" >&2
  exit 1
fi
