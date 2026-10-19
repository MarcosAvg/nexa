#!/usr/bin/env bash
# Validates the app icon set: exact sizes, alpha rules and maskable safe zone.
set -euo pipefail

cd "$(dirname "$0")/.."

status=0
ok() { printf 'OK    %s\n' "$*"; }
fail() { printf 'FAIL  %s\n' "$*"; status=1; }

check_size() {
  local file="$1" expected="$2" w h
  read -r w h < <(magick identify -format '%w %h\n' "$file")
  if [[ "$w" == "$expected" && "$h" == "$expected" ]]; then
    ok "$file ${w}x${h}"
  else
    fail "$file is ${w}x${h}, expected ${expected}x${expected}"
  fi
}

check_opaque() {
  local file="$1" expected="$2" opaque
  opaque="$(magick identify -format '%[opaque]' "$file" | tr '[:upper:]' '[:lower:]')"
  if [[ "$opaque" == "$expected" ]]; then
    ok "$file opaque=$opaque"
  else
    fail "$file opaque=$opaque, expected $expected"
  fi
}

check_size public/pwa-192x192.png 192
check_size public/pwa-512x512.png 512
check_size public/maskable-icon-512x512.png 512
check_size public/monochrome-icon-512x512.png 512
check_size public/apple-touch-icon.png 180
check_size public/pwa-1024x1024.png 1024

# "any" icons keep transparent corners for rounded-square presentation.
check_opaque public/pwa-192x192.png false
check_opaque public/pwa-512x512.png false

# Maskable and Apple icons must be fully opaque.
check_opaque public/maskable-icon-512x512.png true
check_opaque public/apple-touch-icon.png true

# Monochrome must keep a transparent background (the system tints the glyph).
check_opaque public/monochrome-icon-512x512.png false

# Maskable safe zone: the glyph must stay inside the central 80% circle.
maskable="public/maskable-icon-512x512.png"
read -r gw gh gx gy < <(
  magick "$maskable" -fuzz 8% -fill black +opaque white -trim -format '%w %h %X %Y\n' info:
)
if [[ -z "${gw:-}" || -z "${gx:-}" ]]; then
  fail "could not measure maskable glyph bbox"
else
  center_x=$((gx + gw / 2))
  center_y=$((gy + gh / 2))
  max_radius=$(( gw > gh ? gw : gh ))
  max_radius=$(( max_radius / 2 ))
  if [[ $((center_x - 256)) -le 2 && $((256 - center_x)) -le 2 &&
        $((center_y - 256)) -le 2 && $((256 - center_y)) -le 2 &&
        "$max_radius" -le 204 ]]; then
    ok "$maskable glyph ${gw}x${gh} centered, radius ${max_radius}px <= 204px safe radius"
  else
    fail "$maskable glyph ${gw}x${gh} at +${gx}+${gy} exceeds the 80% safe circle"
  fi
fi

# favicon.ico must contain 16, 32 and 48 px frames.
frames="$(magick identify -format '%w\n' public/favicon.ico | sort -n | paste -sd, -)"
if [[ "$frames" == '16,32,48' ]]; then
  ok "public/favicon.ico frames ${frames}px"
else
  fail "public/favicon.ico frames are '${frames}', expected 16,32,48"
fi

if [[ "$status" -ne 0 ]]; then
  echo
  echo "Icon check failed."
  exit 1
fi

echo
echo "All icon checks passed."
