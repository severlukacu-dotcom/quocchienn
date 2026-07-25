#!/usr/bin/env bash

echo "=================================="
echo "Building Sileo Repository"
echo "=================================="

rm -f Packages Packages.gz Packages.bz2 Release
mkdir -p .tmp_repo

VALID=0

if [ -d "debs" ]; then

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
    dpkg-scanpackages -m .tmp_repo /dev/null > Packages
else
    touch Packages
fi

gzip -kf Packages
bzip2 -kf Packages

cat > Release <<EOF
Origin: Sileo Repo
Label: Sileo
Suite: stable
Version: 1.0
Codename: sileo
Architectures: iphoneos-arm iphoneos-arm64
Components: main
Description: Modern Sileo Repository
Date: $(date -Ru)
EOF

echo "Done."
exit 0
