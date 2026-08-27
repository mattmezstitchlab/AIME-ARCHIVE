#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ARCHIVES="$ROOT/archives"
EXTRACTED="$ROOT/extracted"
ANALYSIS="$ROOT/analysis"

mkdir -p "$EXTRACTED" "$ANALYSIS"

printf '%s\n' "AIME ARCHIVE — extraction" "========================="

find "$ARCHIVES" -type f -iname '*.zip' -print0 | while IFS= read -r -d '' zipfile; do
  filename="$(basename "$zipfile")"
  name="${filename%.*}"
  # Stable filesystem-safe destination while preserving readable names.
  dest="$EXTRACTED/$name"
  mkdir -p "$dest"
  echo "→ $filename"
  unzip -q -o "$zipfile" -d "$dest"
done

# Remove generated/dependency directories that add noise and huge volume.
find "$EXTRACTED" \( -type d \( -name node_modules -o -name .git -o -name dist -o -name build -o -name .cache -o -name .next \) \) -prune -exec rm -rf {} + 2>/dev/null || true

{
  echo "# AIME Archive — Inventory"
  echo
  echo "Generated: $(date '+%Y-%m-%d %H:%M:%S')"
  echo
  echo "## Archives"
  find "$ARCHIVES" -type f -iname '*.zip' -print | sed "s#^$ROOT/##" | sort
  echo
  echo "## Extracted projects"
  find "$EXTRACTED" -mindepth 1 -maxdepth 1 -type d -print | sed "s#^$ROOT/##" | sort
  echo
  echo "## File counts by extension"
  find "$EXTRACTED" -type f | sed 's/.*\.//' | tr '[:upper:]' '[:lower:]' | sort | uniq -c | sort -nr | head -100
} > "$ANALYSIS/inventory.md"

echo
printf '%s\n' "Done." "Extracted projects: $EXTRACTED" "Inventory: $ANALYSIS/inventory.md"
