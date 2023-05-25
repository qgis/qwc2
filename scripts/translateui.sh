#!/bin/sh

if [ $# -lt 2 ]; then
  echo "Usage: $0 form.ui lang1 [lang2 ...]"
  exit 1
fi

UIC=""
LUPDATE=""
if command -v uic && command -v lupdate; then
  UIC="uic"
  LUPDATE="lupdate"
elif command -v uic-qt5 && command -v lupdate-qt5; then
  UIC="uic-qt5"
  LUPDATE="lupdate-qt5"
elif command -v uic-qt6 && command -v lupdate-qt6; then
  UIC="uic-qt6"
  LUPDATE="lupdate-qt6"
else
  echo "Could not find uic and/or lupdate in PATH"
  exit 1
fi

cd $(dirname $1)
ui=$(basename $1)

if [ ! -f "$ui" ]; then
  echo "$1 does not exist"
  exit 1
fi

shift

tsfiles () {
  for i in $@
  do
    echo -n "${ui/.ui/_$i.ts} "
  done
}

$UIC $ui > ui_${ui/.ui/.h}

cat > ${ui/.ui/.pro} <<EOF
SOURCES += ui_${ui/.ui/.h}
TRANSLATIONS += $(tsfiles $@)
EOF

$LUPDATE ${ui/.ui/.pro}

rm ui_${ui/.ui/.h}
rm ${ui/.ui/.pro}
