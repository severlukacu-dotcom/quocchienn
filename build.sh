#!/usr/bin/env bash
set -e

echo "=============================="
echo "Building Sileo Repository"
echo "=============================="

rm -f Packages Packages.gz Packages.bz2 Release
rm -rf .tmp_repo
mkdir -p .tmp_repo

VALID=0

if [ -d debs ]; then
    echo "Scanning packages..."

    for pkg in debs/*.deb
    do
        [ -f "$pkg" ] || continue

        echo "Checking $(basename "$pkg")"

        if dpkg-deb --info "$pkg" >/dev/null 2>&1
        then
            echo "✓ Valid"

            cp "$pkg" .tmp_repo/

            VALID=$((VALID+1))
        else
            echo "✗ Invalid (Skipped)"
        fi
    done
fi

if [ "$VALID" -gt 0 ]
then
    dpkg-scanpackages -m .tmp_repo /dev/null \
    | sed 's#Filename: .tmp_repo/#Filename: debs/#g' \
    > Packages
else
    touch Packages
fi

gzip -9 -kf Packages
bzip2 -9 -kf Packages

cat > Release <<EOF
Origin: QuocChien Repo
Label: QuocChien
Suite: stable
Version: 1.0
Codename: stable
Architectures: iphoneos-arm iphoneos-arm64 iphoneos-arm64e
Components: main
Description: QuocChien Sileo Repository
Date: $(date -Ru)
EOF

echo
echo "Packages: $VALID"
echo "Done."