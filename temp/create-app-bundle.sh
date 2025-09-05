#!/bin/bash

# Create a macOS .app bundle for MarkText
# This script creates a distributable MarkText.app

echo "Creating MarkText.app bundle..."

# Create app structure
mkdir -p MarkText.app/Contents/{MacOS,Resources,Frameworks}

# Copy base Electron structure
cp -r ../node_modules/electron/dist/Electron.app/* MarkText.app/

# Copy built application files
cp -r ../dist/electron MarkText.app/Contents/Resources/app

# Copy package.json for app identification
cat > MarkText.app/Contents/Resources/app/package.json << 'EOF'
{
  "name": "marktext",
  "version": "0.17.1-mermaid11",
  "description": "A simple and elegant markdown editor with Mermaid v11 support",
  "main": "main.js",
  "author": "MarkText Contributors"
}
EOF

# Copy icon files
cp ../resources/icons/icon.icns MarkText.app/Contents/Resources/ 2>/dev/null || echo "Icon not found"

# Create Info.plist
cat > MarkText.app/Contents/Info.plist << 'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>CFBundleDisplayName</key>
	<string>MarkText</string>
	<key>CFBundleExecutable</key>
	<string>Electron</string>
	<key>CFBundleIconFile</key>
	<string>icon.icns</string>
	<key>CFBundleIdentifier</key>
	<string>com.github.marktext.marktext</string>
	<key>CFBundleInfoDictionaryVersion</key>
	<string>6.0</string>
	<key>CFBundleName</key>
	<string>MarkText</string>
	<key>CFBundlePackageType</key>
	<string>APPL</string>
	<key>CFBundleShortVersionString</key>
	<string>0.17.1-mermaid11</string>
	<key>CFBundleVersion</key>
	<string>0.17.1</string>
	<key>LSMinimumSystemVersion</key>
	<string>10.11.0</string>
	<key>NSHighResolutionCapable</key>
	<true/>
	<key>NSSupportsAutomaticGraphicsSwitching</key>
	<true/>
	<key>CFBundleDocumentTypes</key>
	<array>
		<dict>
			<key>CFBundleTypeName</key>
			<string>Markdown</string>
			<key>CFBundleTypeExtensions</key>
			<array>
				<string>md</string>
				<string>markdown</string>
				<string>mmd</string>
				<string>mdown</string>
				<string>mdtxt</string>
				<string>mdtext</string>
				<string>mdx</string>
			</array>
			<key>CFBundleTypeRole</key>
			<string>Editor</string>
		</dict>
	</array>
</dict>
</plist>
EOF

echo "MarkText.app created successfully!"
echo "You can now drag MarkText.app to your Applications folder."
echo ""
echo "To run: double-click MarkText.app or run: open MarkText.app"