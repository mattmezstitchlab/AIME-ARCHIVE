#!/usr/bin/env bash
set -u

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ARCHIVES="$ROOT/archives"
EXTRACTED="$ROOT/extracted"
ANALYSIS="$ROOT/analysis"
LOG="$ANALYSIS/extraction-errors.log"

mkdir -p "$EXTRACTED" "$ANALYSIS"
: > "$LOG"

printf '%s\n' "AIME ARCHIVE — extraction" "========================="

ok=0
failed=0

while IFS= read -r -d '' zipfile; do
  filename="$(basename "$zipfile")"
  name="${filename%.*}"
  dest="$EXTRACTED/$name"
  mkdir -p "$dest"
  echo "→ $filename"

  # LC_ALL=C prevents macOS locale conversion from aborting on legacy ZIP filenames.
  if LC_ALL=C unzip -q -o "$zipfile" -d "$dest"; then
    ok=$((ok + 1))
  else
    failed=$((failed + 1))
    printf '%s\n' "$filename" >> "$LOG"
    echo "  ⚠ extraction issue — continuing (see analysis/extraction-errors.log)"
  fi
done < <(find "$ARCHIVES" -type f -iname '*.zip' -print0)

# Remove generated/dependency directories that add noise and huge volume.
find "$EXTRACTED" \( -type d \( -name node_modules -o -name .git -o -name dist -o -name build -o -name .cache -o -name .next \) \) -prune -exec rm -rf {} + 2>/dev/null || true

{
  echo "# AIME Archive — Inventory"
  echo
  echo "Generated: $(date '+%Y-%m-%d %H:%M:%S')"
  echo
  echo "## Extraction summary"
  echo "- Archives processed: $((ok + failed))"
  echo "- Successful: $ok"
  echo "- With extraction issues: $failed"
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
echo "Done. $ok successful, $failed with issues."
echo "Inventory: $ANALYSIS/inventory.md"
if [ "$failed" -gt 0 ]; then
  echo "Issues: $LOG"
fi
