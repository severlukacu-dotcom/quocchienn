#!/usr/bin/env bash
set -euo pipefail

echo "======================================="
echo " Building Sileo Repository"
echo "======================================="

# Cleanup
rm -f Packages Packages.gz Packages.bz2 Release
rm -rf .tmp_repo
mkdir -p .tmp_repo

VALID=0
INVALID=0

if [ -d "debs" ]; then
    echo "Scanning .deb packages..."

    shopt -s nullglob

    for pkg in debs/*.deb; do
        echo "Checking: $(basename "$pkg")"

        if dpkg-deb --info "$pkg" >/dev/null 2>&1; then
            echo "  ✓ Valid"
            cp "$pkg" .tmp_repo/
            ((VALID++))
        else
            echo "  ✗ Invalid (Skipped)"
            ((INVALID++))
        fi
    done

    if [ "$VALID" -gt 0 ]; then
        echo ""
        echo "Generating Packages..."

        dpkg-scanpackages -m .tmp_repo /dev/null > Packages

        gzip -9 -kf Packages
        bzip2 -9 -kf Packages
    else
        echo "No valid packages found."
        touch Packages
        gzip -9 -kf Packages
        bzip2 -9 -kf Packages
    fi

else
    echo "debs folder not found."

    touch Packages
    gzip -9 -kf Packages
    bzip2 -9 -kf Packages
fi

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

echo ""
echo "======================================="
echo " Valid Packages  : $VALID"
echo " Invalid Packages: $INVALID"
echo "======================================="
echo "Repository build completed!"
