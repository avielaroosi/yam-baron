#!/usr/bin/env bash
# Downloads free-license placeholder photos (Unsplash) into assets/img.
# Skips files that already exist. Falls back to a Chrome-rendered dark/gold card if Unsplash fails.
# Run: tools/fetch-placeholders.sh
set -uo pipefail
cd "$(dirname "$0")/.."
mkdir -p assets/img
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

urlenc() { python3 -c 'import sys,urllib.parse;print(urllib.parse.quote(sys.argv[1]))' "$1"; }

fallback() { # name label width height
  local name=$1 label=$2 w=$3 h=$4
  local html="<html><body style='margin:0;width:${w}px;height:${h}px;background:#151515;display:flex;align-items:center;justify-content:center;font:$((w/20))px Georgia,serif;color:#c9a961'>${label}</body></html>"
  "$CHROME" --headless=new --disable-gpu --hide-scrollbars --window-size="${w},${h}" \
    --screenshot="assets/img/${name}.png" "data:text/html;charset=utf-8,$(urlenc "$html")" >/dev/null 2>&1
  sips -s format jpeg -s formatOptions 80 "assets/img/${name}.png" --out "assets/img/${name}.jpg" >/dev/null && rm -f "assets/img/${name}.png"
  echo "fallback $name"
}

fetch() { # name query index orientation width height
  local name=$1 query=$2 idx=$3 orient=$4 w=$5 h=$6
  local out="assets/img/${name}.jpg"
  if [ -s "$out" ]; then echo "skip $name"; return; fi
  local url
  url=$(curl -sf "https://unsplash.com/napi/search/photos?query=$(urlenc "$query")&per_page=15&orientation=${orient}" \
        | jq -r "[.results[] | select((.premium // false) == false and (.plus // false) == false)] | .[$idx].urls.raw // empty")
  if [ -n "$url" ] && curl -sfL "${url}&w=${w}&q=80&fm=jpg&fit=max" -o "$out" && [ -s "$out" ]; then
    echo "ok $name"
  else
    rm -f "$out"; fallback "$name" "$name" "$w" "$h"
  fi
}

fetch hero                  "hair salon interior dark elegant" 0 landscape 1920 1280
fetch service-bridal        "bridal hairstyle updo"            0 portrait  1200 1500
fetch service-straightening "sleek straight hair woman"        0 portrait  1200 1500
fetch service-cut-color     "hair color salon woman"           0 portrait  1200 1500
fetch service-events        "elegant evening hairstyle woman"  2 portrait  1200 1500
fetch gallery-01 "hairstyle woman"        0 portrait 1200 1500
fetch gallery-02 "bride hair"             0 portrait 1200 1500
fetch gallery-03 "long blonde hair"       1 portrait 1200 1500
fetch gallery-04 "hair stylist working"   0 portrait 1200 1500
fetch gallery-05 "braided hairstyle"      0 portrait 1200 1500
fetch gallery-06 "wavy hair woman"        0 portrait 1200 1500
fetch gallery-07 "hair updo wedding"      1 portrait 1200 1500
fetch gallery-08 "hair styling salon"     0 portrait 1200 1500
fetch video-01 "hair salon"        0 portrait 900 1600
fetch video-02 "bridal hair"       1 portrait 900 1600
fetch video-03 "barbershop hairdresser"  1 portrait 900 1600
fetch about    "hairstylist portrait woman" 0 portrait 1200 1500
echo "done: $(ls assets/img/*.jpg | wc -l | tr -d ' ') images"
