#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PROJECT_DIR="$ROOT/assets/godot/godot-files/main"
PACK_PATH="$ROOT/assets/godot/main.pck"
GODOT_VERSION="${GODOT_VERSION:-4.5.1-stable}"
GODOT_CACHE_DIR="${GODOT_CACHE_DIR:-$ROOT/.godot-bin}"

find_godot() {
  if [[ -n "${GODOT_BIN:-}" ]]; then
    printf '%s\n' "$GODOT_BIN"
    return
  fi

  if command -v godot >/dev/null 2>&1; then
    command -v godot
    return
  fi

  if command -v godot4 >/dev/null 2>&1; then
    command -v godot4
    return
  fi

  mkdir -p "$GODOT_CACHE_DIR"

  case "$(uname -s)" in
    Linux)
      local zip_name="Godot_v${GODOT_VERSION}_linux.x86_64.zip"
      local executable="$GODOT_CACHE_DIR/Godot_v${GODOT_VERSION}_linux.x86_64"
      ;;
    Darwin)
      local zip_name="Godot_v${GODOT_VERSION}_macos.universal.zip"
      local executable="$GODOT_CACHE_DIR/Godot.app/Contents/MacOS/Godot"
      ;;
    *)
      echo "Unsupported OS for automatic Godot download: $(uname -s)" >&2
      exit 1
      ;;
  esac

  if [[ ! -x "$executable" ]]; then
    local zip_path="$GODOT_CACHE_DIR/$zip_name"
    local url="https://github.com/godotengine/godot/releases/download/${GODOT_VERSION}/${zip_name}"

    curl -L --fail --retry 3 -o "$zip_path" "$url"
    unzip -oq "$zip_path" -d "$GODOT_CACHE_DIR"
    chmod +x "$executable"
  fi

  printf '%s\n' "$executable"
}

if [[ ! -f "$PROJECT_DIR/project.godot" ]]; then
  echo "Missing Godot project at $PROJECT_DIR/project.godot" >&2
  exit 1
fi

GODOT="$(find_godot)"
EXPORT_PRESETS="$PROJECT_DIR/export_presets.cfg"
BACKUP_PRESETS=""

if [[ -f "$EXPORT_PRESETS" ]]; then
  BACKUP_PRESETS="$(mktemp)"
  cp "$EXPORT_PRESETS" "$BACKUP_PRESETS"
fi

cleanup() {
  if [[ -n "$BACKUP_PRESETS" ]]; then
    cp "$BACKUP_PRESETS" "$EXPORT_PRESETS"
    rm -f "$BACKUP_PRESETS"
  else
    rm -f "$EXPORT_PRESETS"
  fi
}
trap cleanup EXIT

cat > "$EXPORT_PRESETS" <<'CFG'
[preset.0]

name="Pack"
platform="iOS"
runnable=false
advanced_options=false
dedicated_server=false
custom_features=""
export_filter="all_resources"
include_filter=""
exclude_filter=""
export_path="../../main.pck"
encryption_include_filters=""
encryption_exclude_filters=""
encrypt_pck=false
encrypt_directory=false
script_export_mode=1
script_encryption_key=""

[preset.0.options]
application/export_project_only=true
CFG

rm -f "$PACK_PATH"
"$GODOT" --headless --path "$PROJECT_DIR" --import
"$GODOT" --headless --path "$PROJECT_DIR" --export-pack "Pack" "$PACK_PATH"

if [[ ! -s "$PACK_PATH" ]]; then
  echo "Godot pack was not created at $PACK_PATH" >&2
  exit 1
fi
