#!/bin/bash
# Turns an ambient clip into one that loops without a seam, ready for the site:
# H.264, 8-bit, no audio track.
#
#   bash tools/make-loop.sh <ffmpeg> <source clip> <output.mp4>
#
# A clip whose last frame differs from its first jumps every time it restarts — on
# 01.10 the desktop hero snapped back to its opening every five seconds, and the band of
# light on the phone popped in at the top. The output here opens on the source's LAST
# frame and dissolves, over its first second, into the source played from the start. So
# the frame the loop ends on (the one before the source's last) runs straight into the
# frame it opens on, and whatever differs between the end and the beginning fades in
# instead of appearing.
#
# It can only hide a difference in light or in small movement. If the camera travels
# during the clip, the dissolve shows two framings on top of each other: make the clip
# again with a locked-off camera (give the generator the same picture as first and last
# frame) rather than trying to loop it.
#
# Afterwards take the still from the result's first frame, in the browser's own decoder:
#   cd tools && node video-poster.mjs ../assets/video/<clip>.mp4 ../assets/img/<still>.jpg 0
# and run the checks (cd tools && npm run check): check-design compares the still with
# the clip's first frame, and the step across the seam with the steps beside it.
#
# <ffmpeg>: there is none on this Mac; the README ("סרטוני רקע") says how to get one.
set -euo pipefail
if [ "$#" -ne 3 ]; then sed -n '2,5p' "$0"; exit 2; fi
FF="$1"; SRC="$2"; OUT="$3"
FRAMES=$("$FF" -hide_banner -i "$SRC" -map 0:v:0 -c copy -f null - 2>&1 | grep -o "frame= *[0-9]*" | tail -1 | grep -o "[0-9]*")
LAST=$((FRAMES - 1))
# [rest] is the source's last frame held for a second; [run] is the source without that
# frame. xfade starts on [rest] and ends, one second in, on [run] alone.
"$FF" -hide_banner -loglevel error -y -i "$SRC" -filter_complex \
  "[0:v]fps=24,split=2[a][b];[a]trim=start_frame=${LAST}:end_frame=${FRAMES},setpts=PTS-STARTPTS,loop=loop=23:size=1:start=0,setpts=N/24/TB,fps=24[rest];[b]trim=start_frame=0:end_frame=${LAST},setpts=PTS-STARTPTS,fps=24[run];[rest][run]xfade=transition=fade:duration=1:offset=0,format=yuv420p[v]" \
  -map "[v]" -c:v libx264 -preset slow -crf 23 -pix_fmt yuv420p -profile:v high -movflags +faststart -an "$OUT"
echo "$SRC: $FRAMES frames -> $OUT: $LAST frames, $(du -h "$OUT" | cut -f1 | tr -d ' ')"
