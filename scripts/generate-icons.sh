#!/usr/bin/env bash
# Regenerates every PWA/app icon from the vector masters in scripts/icons.
# Requires ImageMagick with the librsvg delegate (magick -list format | grep SVG).
set -euo pipefail

cd "$(dirname "$0")/.."

MASTERS="scripts/icons"

render() {
  local src="$1"
  local size="$2"
  local out="$3"
  local format="$4"
  magick -background none "$src" \
    -resize "${size}x${size}" \
    -strip \
    -define png:compression-level=9 \
    "${format}:${out}"
}

# PWA "any" icons: rounded square with transparent corners.
render "$MASTERS/icon.svg" 192 "public/pwa-192x192.png" PNG32
render "$MASTERS/icon.svg" 512 "public/pwa-512x512.png" PNG32

# Maskable icon: full bleed, glyph inside the 80% safe circle.
render "$MASTERS/icon-maskable.svg" 512 "public/maskable-icon-512x512.png" PNG24

# Monochrome icon for Android 13+ themed icons: transparent, single-color glyph.
render "$MASTERS/icon-monochrome.svg" 512 "public/monochrome-icon-512x512.png" PNG32

# iOS touch icon: opaque full bleed (iOS applies its own rounded mask).
render "$MASTERS/icon-full.svg" 180 "public/apple-touch-icon.png" PNG24

# Store / archive icon: opaque full bleed.
render "$MASTERS/icon-full.svg" 1024 "public/pwa-1024x1024.png" PNG24

# Multi-resolution favicon fallback for legacy browsers and Windows.
tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT
# 16 px gets a thicker stroke so the hexagon survives the downscale.
magick -background none "$MASTERS/icon-favicon-16.svg" \
  -resize "16x16" \
  -strip \
  "PNG32:${tmp_dir}/favicon-16.png"
for size in 32 48; do
  magick -background none "public/favicon.svg" \
    -resize "${size}x${size}" \
    -strip \
    "PNG32:${tmp_dir}/favicon-${size}.png"
done
magick "${tmp_dir}/favicon-16.png" "${tmp_dir}/favicon-32.png" "${tmp_dir}/favicon-48.png" \
  -strip "public/favicon.ico"

echo "Icons generated:"
magick identify -format "%f  %wx%h  %[channels]\n" \
  public/pwa-192x192.png \
  public/pwa-512x512.png \
  public/maskable-icon-512x512.png \
  public/monochrome-icon-512x512.png \
  public/apple-touch-icon.png \
  public/pwa-1024x1024.png \
  public/favicon.ico
