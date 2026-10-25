#!/bin/sh
# Builds dist/lane-<version>-macos-arm64.tar.gz: the compiled binary under bin/.
set -eu

cd "$(dirname "$0")/.."
version="$(bun -e 'console.log(require("./package.json").version)')"
name="lane-$version-macos-arm64"
root="build/bundle/$name"

rm -rf build/bundle && mkdir -p "$root/bin" dist
bun run build
cp dist/lane "$root/bin/lane"

tar -C build/bundle -czf "dist/$name.tar.gz" "$name"
(cd dist && shasum -a 256 "$name.tar.gz" > "$name.tar.gz.sha256")

# the unpacked copy must run from another path with an empty environment
check="build/bundle/check"
mkdir -p "$check" && tar -C "$check" -xzf "dist/$name.tar.gz"
env -i HOME="$HOME" PATH=/usr/bin:/bin "$check/$name/bin/lane" --version | grep -qx "$version"
echo "dist/$name.tar.gz"
