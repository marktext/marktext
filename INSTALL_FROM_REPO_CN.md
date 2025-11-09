# 从仓库直接安装 MarkText - 中文指南

本指南介绍如何直接从 GitHub 仓库获取和安装 MarkText，**无需手动构建**。

---

## 🚀 方法一：自动构建并发布（推荐）

### 触发自动构建

项目已配置 GitHub Actions，会自动构建并发布到 GitHub Releases。

#### 步骤：

1. **创建发布分支**
```bash
# 在本地创建 release 分支
git checkout -b release-v0.17.2-fix

# 推送到 GitHub
git push -u origin release-v0.17.2-fix
```

2. **GitHub Actions 会自动：**
   - ✅ 构建 macOS 版本 (Intel + Apple Silicon)
   - ✅ 构建 Windows 版本
   - ✅ 构建 Linux 版本
   - ✅ 发布到 GitHub Releases
   - ✅ 计算文件校验和

3. **等待构建完成**（约 15-30 分钟）

4. **下载安装包**
   - 访问: `https://github.com/你的用户名/marktext/releases`
   - 下载对应平台的安装包

### 构建触发条件

根据 `.github/workflows/release.yml` 配置：

```yaml
on:
  push:
    branches:
      - 'release-v*'
```

**只要推送到以 `release-v` 开头的分支，就会自动构建！**

---

## 🍺 方法二：使用 Homebrew 安装（仅 macOS）

### 从你的 fork 安装

如果你想让用户直接从你的仓库安装，可以创建一个 Homebrew Cask：

#### 步骤 1: 创建 Homebrew Tap 仓库

```bash
# 创建一个新仓库，名称必须是 homebrew-<name>
# 例如: homebrew-marktext

# 在仓库中创建 Casks 目录
mkdir -p Casks
```

#### 步骤 2: 创建 Cask 文件

在 `Casks/marktext.rb` 中：

```ruby
cask "marktext" do
  version "0.17.1"
  sha256 "你的文件SHA256校验和"

  url "https://github.com/你的用户名/marktext/releases/download/v#{version}/marktext-x64.dmg"
  name "MarkText"
  desc "Next generation markdown editor"
  homepage "https://github.com/你的用户名/marktext"

  app "MarkText.app"
end
```

#### 步骤 3: 用户安装

```bash
# 添加你的 tap
brew tap 你的用户名/marktext

# 安装
brew install --cask marktext
```

---

## 📦 方法三：直接从 GitHub Releases 下载

### 自动发布流程

1. **创建发布分支并推送**
```bash
git checkout -b release-v0.17.2
git push origin release-v0.17.2
```

2. **GitHub Actions 自动构建**

   构建产物：
   - `marktext-x64.dmg` - Intel Mac
   - `marktext-arm64.dmg` - Apple Silicon Mac
   - `marktext-x64-mac.zip` - Intel Mac 压缩包
   - `marktext-arm64-mac.zip` - Apple Silicon Mac 压缩包
   - `marktext-setup.exe` - Windows 安装器
   - `marktext-x86_64.AppImage` - Linux AppImage
   - `marktext-*.deb` - Debian/Ubuntu 包
   - `marktext-*.rpm` - RedHat/Fedora 包

3. **下载安装**
```bash
# macOS 用户
curl -L -o marktext.dmg https://github.com/你的用户名/marktext/releases/latest/download/marktext-x64.dmg

# 安装
open marktext.dmg
```

---

## 🔄 方法四：一键安装脚本

### 创建安装脚本

创建 `install.sh`：

```bash
#!/bin/bash

# MarkText 一键安装脚本

REPO="你的用户名/marktext"
VERSION="latest"

echo "正在安装 MarkText..."

if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    ARCH=$(uname -m)
    if [[ "$ARCH" == "arm64" ]]; then
        DMG_NAME="marktext-arm64.dmg"
    else
        DMG_NAME="marktext-x64.dmg"
    fi

    # 下载
    curl -L -o /tmp/marktext.dmg \
        "https://github.com/$REPO/releases/$VERSION/download/$DMG_NAME"

    # 挂载并安装
    hdiutil attach /tmp/marktext.dmg
    cp -R "/Volumes/MarkText/MarkText.app" /Applications/
    hdiutil detach "/Volumes/MarkText"
    rm /tmp/marktext.dmg

    echo "✅ MarkText 已安装到 /Applications/MarkText.app"

elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    # Linux - 使用 AppImage
    curl -L -o ~/MarkText.AppImage \
        "https://github.com/$REPO/releases/$VERSION/download/marktext-x86_64.AppImage"

    chmod +x ~/MarkText.AppImage

    echo "✅ MarkText 已下载到 ~/MarkText.AppImage"
    echo "运行: ~/MarkText.AppImage"

else
    echo "❌ 不支持的操作系统: $OSTYPE"
    exit 1
fi
```

### 使用方法

```bash
# 下载并运行
curl -sSL https://raw.githubusercontent.com/你的用户名/marktext/分支名/install.sh | bash
```

---

## 🎯 方法五：修改现有 Homebrew Cask（最简单）

### 选项 A: Fork 官方 Homebrew Cask

```bash
# 1. Fork homebrew-cask 仓库
# https://github.com/Homebrew/homebrew-cask

# 2. 修改 Casks/m/mark-text.rb
cask "mark-text" do
  version "0.17.2"  # 你的版本

  # 改成你的下载链接
  url "https://github.com/你的用户名/marktext/releases/download/v#{version}/marktext-x64.dmg"

  # ... 其他配置
end

# 3. 提交到你的 fork
git add Casks/m/mark-text.rb
git commit -m "Update MarkText to 0.17.2"
git push
```

### 选项 B: 本地覆盖 Cask

```bash
# 编辑本地 Cask 定义
brew edit --cask mark-text

# 修改 URL 指向你的仓库
url "https://github.com/你的用户名/marktext/releases/download/v0.17.2/marktext-x64.dmg"

# 保存后重新安装
brew reinstall --cask mark-text
```

---

## 🤖 方法六：设置持续集成自动发布

### 完整自动化流程

#### 1. 修改 GitHub Actions 工作流

在 `.github/workflows/release.yml` 中已经配置好了，只需：

```bash
# 推送到 release 分支
git checkout -b release-v0.17.2
git push origin release-v0.17.2
```

#### 2. 自动创建 GitHub Release

工作流会自动：
- ✅ 编译所有平台的应用
- ✅ 创建 GitHub Release
- ✅ 上传所有构建产物
- ✅ 计算 SHA256 校验和

#### 3. 用户安装

**macOS (Homebrew)**:
```bash
brew install --cask mark-text
```

**macOS (手动)**:
```bash
# Intel Mac
curl -L -o marktext.dmg https://github.com/你的用户名/marktext/releases/latest/download/marktext-x64.dmg
open marktext.dmg

# Apple Silicon Mac
curl -L -o marktext.dmg https://github.com/你的用户名/marktext/releases/latest/download/marktext-arm64.dmg
open marktext.dmg
```

**Windows**:
```bash
# PowerShell
Invoke-WebRequest -Uri "https://github.com/你的用户名/marktext/releases/latest/download/marktext-setup.exe" -OutFile "marktext-setup.exe"
.\marktext-setup.exe
```

**Linux**:
```bash
# AppImage
curl -L -o MarkText.AppImage https://github.com/你的用户名/marktext/releases/latest/download/marktext-x86_64.AppImage
chmod +x MarkText.AppImage
./MarkText.AppImage

# Debian/Ubuntu
wget https://github.com/你的用户名/marktext/releases/latest/download/marktext-amd64.deb
sudo dpkg -i marktext-amd64.deb
```

---

## 📋 快速对比

| 方法 | 需要构建 | 自动更新 | 复杂度 | 推荐度 |
|------|---------|---------|--------|--------|
| 1. 自动构建发布 | ❌ (CI) | ❌ | 低 | ⭐⭐⭐⭐⭐ |
| 2. Homebrew Tap | ❌ (CI) | ✅ | 中 | ⭐⭐⭐⭐ |
| 3. GitHub Releases | ❌ (CI) | ❌ | 低 | ⭐⭐⭐⭐⭐ |
| 4. 一键脚本 | ❌ | ❌ | 低 | ⭐⭐⭐ |
| 5. 覆盖 Cask | ❌ (CI) | ✅ | 低 | ⭐⭐⭐⭐ |
| 6. CI 自动发布 | ❌ (CI) | ✅ | 低 | ⭐⭐⭐⭐⭐ |

---

## 🎯 最推荐方案

### 对于你（开发者）

**推荐：方法一 + 方法三**

1. **推送到发布分支触发自动构建**
```bash
git checkout -b release-v0.17.2-fix
git push origin release-v0.17.2-fix
```

2. **等待 GitHub Actions 完成**（约 20-30 分钟）

3. **分享下载链接给用户**
```
https://github.com/你的用户名/marktext/releases/latest
```

### 对于用户

**macOS 用户**：
```bash
# 下载 DMG
curl -L -o marktext.dmg https://github.com/你的用户名/marktext/releases/latest/download/marktext-x64.dmg
open marktext.dmg
```

**或者使用 Homebrew**（需要先创建 Tap）：
```bash
brew tap 你的用户名/marktext
brew install --cask marktext
```

---

## ⚡ 立即开始

### 现在就触发自动构建

在当前分支基础上创建发布分支：

```bash
# 1. 确保你在最新的代码上
git checkout claude/scan-project-011CUx3rfp8ZPjuF8R7KMzJi
git pull

# 2. 创建发布分支
git checkout -b release-v0.17.2-bugfix

# 3. 推送触发构建
git push -u origin release-v0.17.2-bugfix
```

### 监控构建进度

访问：
```
https://github.com/你的用户名/marktext/actions
```

构建完成后，在这里找到安装包：
```
https://github.com/你的用户名/marktext/releases
```

---

## 📝 注意事项

1. **GitHub Token**: GitHub Actions 会自动使用 `GITHUB_TOKEN`，无需额外配置

2. **发布权限**: 确保你的仓库有 Actions 权限
   - Settings → Actions → General → Workflow permissions
   - 选择 "Read and write permissions"

3. **分支命名**: 必须以 `release-v` 开头才会触发发布工作流

4. **构建时间**:
   - macOS: ~15-20 分钟
   - Linux: ~10-15 分钟
   - Windows: ~15-20 分钟
   - 总计: ~30-45 分钟（并行执行）

5. **存储空间**: GitHub Releases 文件没有大小限制，但建议每个文件 < 2GB

---

## 🆘 故障排查

### 构建失败

1. 查看 Actions 日志：`https://github.com/你的用户名/marktext/actions`
2. 常见问题：
   - Node.js 版本错误（需要 v16）
   - 依赖安装失败（网络问题）
   - 测试失败（跳过测试：在工作流中注释掉测试步骤）

### 发布没有创建

确保：
1. 分支名以 `release-v` 开头
2. Actions 有写入权限
3. 没有同名的 tag 或 release

### 下载链接 404

等待几分钟，GitHub Actions 需要时间上传文件到 Releases。

---

希望这个指南能帮到你！🎉
