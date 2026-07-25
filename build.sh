#!/usr/bin/env bash
set -e

echo "Building repository..."

rm -f Packages Packages.gz Packages.bz2 Release
rm -rf .tmp_repo

mkdir .tmp_repo

VALID=0

for f in debs/*.deb
do
    [ -f "$f" ] || continue

    if dpkg-deb --info "$f" >/dev/null 2>&1
    then
        cp "$f" .tmp_repo/
        VALID=$((VALID+1))
    else
        echo "Skip invalid: $f"
    fi
done

if [ "$VALID" -gt 0 ]
then
    dpkg-scanpackages -m .tmp_repo /dev/null \
    | sed 's#Filename: .tmp_repo/#Filename: debs/#g' \
    > Packages
else
    touch Packages
fi

gzip -kf Packages
bzip2 -kf Packages

cat > Release <<EOF
Origin: QuocChien Repo
Label: QuocChien
Suite: stable
Version: 1.0
Codename: stable
Architectures: iphoneos-arm iphoneos-arm64 iphoneos-arm64e
Components: main
Description: QuocChien Repository
Date: $(date -Ru)
EOF

echo "Done."