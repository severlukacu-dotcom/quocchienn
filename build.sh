#!/bin/bash
set -e

echo "Building Sileo repository..."

# Generate Packages from debs if present
if [ -d "debs" ]; then
  dpkg-scanpackages -m debs /dev/null > Packages
  bzip2 -f -k Packages
  gzip -f -k Packages
else
  echo "No debs directory. Creating empty Packages."
  echo "" > Packages
fi

# Update Release
cat > Release << EOF
Origin: Sileo Repo
Label: Sileo
Suite: stable
Version: 1.0
Codename: sileo
Architectures: iphoneos-arm iphoneos-arm64
Components: main
Description: Modern Sileo repository
Date: $(date -Ru)
EOF

echo "Build complete."
