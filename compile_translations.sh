#!/bin/bash
set -e

PO_DIR="po"
LOCALE_DIR="locale"

# Make sure gettext compile tool is available
if ! command -v msgfmt &> /dev/null; then
    echo "ERROR: 'msgfmt' command not found. Please install the 'gettext' package."
    exit 1
fi

echo "Compiling PO translation source files..."

for po_file in "$PO_DIR"/*.po; do
    [ -e "$po_file" ] || continue
    lang=$(basename "$po_file" .po)
    
    target_dir="$LOCALE_DIR/$lang/LC_MESSAGES"
    mkdir -p "$target_dir"
    
    echo "  $lang: compiling $po_file -> $target_dir/namaz-vakti-gnome.mo"
    msgfmt "$po_file" -o "$target_dir/namaz-vakti-gnome.mo"
done

echo "SUCCESS: All translation catalogs compiled successfully."
