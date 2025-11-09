# Homebrew 安装 MarkText（修复版）

本指南说明如何使用 Homebrew 安装包含最新修复的 MarkText 版本。

---

## 方法一：本地覆盖官方 Cask（推荐）

### 步骤 1: 编辑本地 Cask

```bash
brew edit --cask mark-text
```

### 步骤 2: 修改下载 URL

在打开的编辑器中，找到 `url` 行并修改为：

```ruby
cask "mark-text" do
  version "0.17.2"

  # 修改这一行 - 指向你的修复版本
  on_intel do
    sha256 "YOUR_X64_SHA256_HERE"
    url "https://github.com/stevenchenUCD/marktext/releases/download/v#{version}/marktext-x64.dmg"
  end

  on_arm do
    sha256 "YOUR_ARM64_SHA256_HERE"
    url "https://github.com/stevenchenUCD/marktext/releases/download/v#{version}/marktext-arm64.dmg"
  end

  name "MarkText"
  desc "Next generation markdown editor"
  homepage "https://github.com/stevenchenUCD/marktext"

  livecheck do
    url :url
    strategy :github_latest
  end

  app "MarkText.app"

  zap trash: [
    "~/Library/Application Support/marktext",
    "~/Library/Preferences/com.github.marktext.marktext.plist",
    "~/Library/Saved Application State/com.github.marktext.marktext.savedState",
  ]
end
```

### 步骤 3: 获取 SHA256 校验和

等待 GitHub Actions 构建完成后，查看 Actions 日志中的 "Calculate checksums" 步骤，或者手动计算：

```bash
# 下载文件后计算
shasum -a 256 marktext-x64.dmg
shasum -a 256 marktext-arm64.dmg
```

### 步骤 4: 更新 SHA256

将步骤 3 获得的校验和填入 Cask 文件的 `sha256` 字段。

### 步骤 5: 安装或重新安装

```bash
# 如果已安装，先卸载
brew uninstall --cask mark-text

# 重新安装（使用你修改的版本）
brew install --cask mark-text

# 或者直接重新安装
brew reinstall --cask mark-text
```

---

## 方法二：创建自定义 Homebrew Tap

### 步骤 1: 创建 Tap 仓库

在 GitHub 上创建一个新仓库，名称为 `homebrew-marktext`

### 步骤 2: 添加 Cask 定义

在仓库中创建目录和文件：

```bash
mkdir -p Casks
```

创建 `Casks/mark-text.rb`：

```ruby
cask "mark-text" do
  version "0.17.2"

  on_intel do
    sha256 "YOUR_X64_SHA256_HERE"
    url "https://github.com/stevenchenUCD/marktext/releases/download/v#{version}/marktext-x64.dmg"
  end

  on_arm do
    sha256 "YOUR_ARM64_SHA256_HERE"
    url "https://github.com/stevenchenUCD/marktext/releases/download/v#{version}/marktext-arm64.dmg"
  end

  name "MarkText"
  desc "Next generation markdown editor (with bug fixes)"
  homepage "https://github.com/stevenchenUCD/marktext"

  livecheck do
    url :url
    strategy :github_latest
  end

  app "MarkText.app"

  zap trash: [
    "~/Library/Application Support/marktext",
    "~/Library/Preferences/com.github.marktext.marktext.plist",
    "~/Library/Saved Application State/com.github.marktext.marktext.savedState",
  ]
end
```

### 步骤 3: 提交到 GitHub

```bash
git add Casks/mark-text.rb
git commit -m "Add MarkText cask with bug fixes"
git push
```

### 步骤 4: 用户安装

用户可以这样安装：

```bash
# 添加你的 tap
brew tap stevenchenUCD/marktext

# 安装
brew install --cask stevenchenUCD/marktext/mark-text
```

---

## 方法三：直接指定 URL 安装（临时方案）

如果只想快速测试，可以直接从 URL 安装：

```bash
# Intel Mac
brew install --cask https://github.com/stevenchenUCD/marktext/releases/download/v0.17.2/marktext-x64.dmg

# Apple Silicon Mac
brew install --cask https://github.com/stevenchenUCD/marktext/releases/download/v0.17.2/marktext-arm64.dmg
```

**注意**：这种方法不会自动更新。

---

## 方法四：手动安装（最简单）

```bash
# 下载对应架构的 DMG
curl -L -o ~/Downloads/marktext.dmg \
  https://github.com/stevenchenUCD/marktext/releases/latest/download/marktext-x64.dmg

# 打开 DMG
open ~/Downloads/marktext.dmg

# 拖拽到 Applications 文件夹
```

---

## 🔄 自动更新脚本

创建一个更新脚本 `update-marktext.sh`：

```bash
#!/bin/bash

REPO="stevenchenUCD/marktext"
ARCH=$(uname -m)

echo "检查最新版本..."

# 获取最新版本号
LATEST_VERSION=$(curl -s https://api.github.com/repos/$REPO/releases/latest | grep '"tag_name"' | sed -E 's/.*"([^"]+)".*/\1/')

echo "最新版本: $LATEST_VERSION"

# 确定下载文件名
if [[ "$ARCH" == "arm64" ]]; then
    DMG_NAME="marktext-arm64.dmg"
else
    DMG_NAME="marktext-x64.dmg"
fi

# 下载
echo "下载 $DMG_NAME ..."
curl -L -o /tmp/marktext.dmg \
    "https://github.com/$REPO/releases/latest/download/$DMG_NAME"

# 卸载旧版本（如果存在）
if [ -d "/Applications/MarkText.app" ]; then
    echo "删除旧版本..."
    rm -rf "/Applications/MarkText.app"
fi

# 挂载并安装
echo "安装新版本..."
hdiutil attach /tmp/marktext.dmg -nobrowse -quiet
cp -R "/Volumes/MarkText/MarkText.app" /Applications/
hdiutil detach "/Volumes/MarkText" -quiet
rm /tmp/marktext.dmg

echo "✅ MarkText 已更新到 $LATEST_VERSION"
echo "可以在 Applications 文件夹中找到"
```

使用方法：

```bash
chmod +x update-marktext.sh
./update-marktext.sh
```

---

## 🎯 推荐方案对比

| 方法 | 优点 | 缺点 | 推荐度 |
|------|------|------|--------|
| 方法一：覆盖 Cask | 使用 brew 管理 | 需要手动维护 | ⭐⭐⭐⭐ |
| 方法二：自定义 Tap | 专业，可共享 | 需要维护仓库 | ⭐⭐⭐⭐⭐ |
| 方法三：直接 URL | 最快 | 不能管理更新 | ⭐⭐ |
| 方法四：手动安装 | 最简单 | 手动更新 | ⭐⭐⭐ |

---

## 📝 版本管理

### 更新 Cask 版本

当你发布新版本时，更新 Cask 文件：

```ruby
cask "mark-text" do
  version "0.17.3"  # 更新版本号

  # 更新 SHA256
  on_intel do
    sha256 "新的SHA256"
    url "https://github.com/stevenchenUCD/marktext/releases/download/v#{version}/marktext-x64.dmg"
  end

  # ...
end
```

### 通知用户更新

用户可以这样更新：

```bash
# 更新 Homebrew
brew update

# 升级 MarkText
brew upgrade --cask mark-text
```

---

## 🔍 验证安装

```bash
# 检查安装位置
ls -la /Applications/MarkText.app

# 查看版本信息
/Applications/MarkText.app/Contents/MacOS/MarkText --version

# 打开应用
open -a MarkText
```

---

## ⚠️ 常见问题

### 1. 提示"应用已损坏"

```bash
# 移除隔离属性
xattr -cr /Applications/MarkText.app
```

### 2. Homebrew 找不到 Cask

```bash
# 更新 Homebrew
brew update

# 清除缓存
brew cleanup
```

### 3. SHA256 校验失败

确保：
1. 下载链接正确
2. SHA256 是从实际文件计算的
3. 版本号匹配

重新下载文件并计算：
```bash
curl -L -o marktext.dmg \
  https://github.com/stevenchenUCD/marktext/releases/latest/download/marktext-x64.dmg
shasum -a 256 marktext.dmg
```

---

## 📚 相关链接

- **GitHub Releases**: https://github.com/stevenchenUCD/marktext/releases
- **Actions 构建状态**: https://github.com/stevenchenUCD/marktext/actions
- **Homebrew Cask 文档**: https://docs.brew.sh/Cask-Cookbook

---

## 🎉 快速开始

**最简单的方法（推荐新手）**：

```bash
# 1. 下载
curl -L -o ~/Downloads/marktext.dmg \
  https://github.com/stevenchenUCD/marktext/releases/latest/download/marktext-x64.dmg

# 2. 打开并安装
open ~/Downloads/marktext.dmg
```

**最专业的方法（推荐进阶用户）**：

```bash
# 1. 添加自定义 tap
brew tap stevenchenUCD/marktext

# 2. 安装
brew install --cask mark-text
```

选择适合你的方法即可！✨
