# MarkText - 修复版本

> 本仓库包含 MarkText 的 bug 修复版本

[![Build Status](https://github.com/stevenchenUCD/marktext/actions/workflows/release.yml/badge.svg)](https://github.com/stevenchenUCD/marktext/actions)
[![GitHub release](https://img.shields.io/github/v/release/stevenchenUCD/marktext)](https://github.com/stevenchenUCD/marktext/releases/latest)
[![Downloads](https://img.shields.io/github/downloads/stevenchenUCD/marktext/total)](https://github.com/stevenchenUCD/marktext/releases)

---

## 🐛 已修复的问题

### 1. 关闭文件时错误提示保存 ✅
**问题描述**：即使没有修改 Markdown 文件，关闭时也会提示保存文档。

**修复说明**：
- 修改了 `src/renderer/store/editor.js` 文件
- 区分了"外部文件改变"和"本地编辑改动"
- 只在真正有未保存改动时才提示保存

**影响文件**：`src/renderer/store/editor.js` (line 1169-1195)

---

## ✨ 功能说明

### 2. 多窗口显示 ✅（已存在）
**使用方法**：
- 菜单：`File → New Window`
- 快捷键：`Ctrl+Shift+N` (Windows/Linux) 或 `Cmd+Shift+N` (macOS)

**功能**：
- 可以同时打开多个独立窗口
- 每个窗口显示不同的文档或标签页
- 窗口可以并排放置以对比文档

---

### 3. PDF 导出 ✅（已存在）
**使用方法**：
- 菜单：`File → Export → PDF`

**功能**：
- 自定义页面大小（A3, A4, A5, Letter 等）
- 页面方向（纵向/横向）
- 边距设置
- 字体、字号、行高自定义
- 页眉页脚
- 自动生成目录
- 多种主题（Academic, GitHub, Liber）

---

## 📥 下载安装

### 快速下载

**[📥 完整下载页面](DOWNLOAD_CN.md)**

| 平台 | 下载链接 |
|------|---------|
| macOS (Intel) | [DMG](https://github.com/stevenchenUCD/marktext/releases/latest/download/marktext-x64.dmg) \| [ZIP](https://github.com/stevenchenUCD/marktext/releases/latest/download/marktext-x64-mac.zip) |
| macOS (Apple Silicon) | [DMG](https://github.com/stevenchenUCD/marktext/releases/latest/download/marktext-arm64.dmg) \| [ZIP](https://github.com/stevenchenUCD/marktext/releases/latest/download/marktext-arm64-mac.zip) |
| Windows | [安装器](https://github.com/stevenchenUCD/marktext/releases/latest/download/marktext-setup.exe) \| [64位ZIP](https://github.com/stevenchenUCD/marktext/releases/latest/download/marktext-x64-win.zip) |
| Linux | [AppImage](https://github.com/stevenchenUCD/marktext/releases/latest/download/marktext-x86_64.AppImage) \| [DEB](https://github.com/stevenchenUCD/marktext/releases/latest/download/marktext-amd64.deb) \| [RPM](https://github.com/stevenchenUCD/marktext/releases/latest/download/marktext-x86_64.rpm) |

### Homebrew (macOS)

```bash
# 方法 1: 从自定义 tap 安装
brew tap stevenchenUCD/marktext
brew install --cask mark-text

# 方法 2: 覆盖官方 cask
brew edit --cask mark-text
# 修改 URL 后
brew reinstall --cask mark-text
```

详细说明：[HOMEBREW_INSTALL_CN.md](HOMEBREW_INSTALL_CN.md)

---

## 📚 文档

- **[📖 使用指南](USAGE_GUIDE_CN.md)** - 详细的功能说明和使用方法
- **[🍺 Homebrew 安装](HOMEBREW_INSTALL_CN.md)** - Homebrew Cask 安装和覆盖方法
- **[📥 下载页面](DOWNLOAD_CN.md)** - 所有平台的下载链接和安装步骤
- **[🛠️ Mac 构建指南](MAC_BUILD_GUIDE_CN.md)** - 如何在 Mac 上构建应用
- **[🔧 仓库安装指南](INSTALL_FROM_REPO_CN.md)** - 从源码安装的多种方法

---

## 🚀 快速开始

### macOS
```bash
# Intel Mac
curl -L -o marktext.dmg https://github.com/stevenchenUCD/marktext/releases/latest/download/marktext-x64.dmg
open marktext.dmg

# Apple Silicon Mac
curl -L -o marktext.dmg https://github.com/stevenchenUCD/marktext/releases/latest/download/marktext-arm64.dmg
open marktext.dmg
```

### Windows
```powershell
# PowerShell
Invoke-WebRequest -Uri "https://github.com/stevenchenUCD/marktext/releases/latest/download/marktext-setup.exe" -OutFile "marktext-setup.exe"
.\marktext-setup.exe
```

### Linux
```bash
# AppImage
curl -L -o MarkText.AppImage https://github.com/stevenchenUCD/marktext/releases/latest/download/marktext-x86_64.AppImage
chmod +x MarkText.AppImage
./MarkText.AppImage
```

---

## 🔨 自己构建

如果你想自己构建应用：

```bash
# 克隆仓库
git clone https://github.com/stevenchenUCD/marktext.git
cd marktext

# 切换到修复分支
git checkout claude/scan-project-011CUx3rfp8ZPjuF8R7KMzJi

# 安装依赖
yarn install --frozen-lockfile

# 构建
yarn run release:mac    # macOS
yarn run release:win    # Windows
yarn run release:linux  # Linux
```

详细构建说明：[MAC_BUILD_GUIDE_CN.md](MAC_BUILD_GUIDE_CN.md)

---

## 📋 系统要求

| 平台 | 最低版本 | 推荐版本 |
|------|---------|---------|
| macOS | 10.13 (High Sierra) | 11.0 (Big Sur) 或更高 |
| Windows | Windows 7 | Windows 10/11 |
| Linux | Ubuntu 18.04, Fedora 30 | Ubuntu 22.04, Fedora 38 |

---

## 🔄 自动构建

本仓库配置了 GitHub Actions，推送到以下分支会自动构建：
- `release-v*`
- `claude/*`

查看构建状态：
```
https://github.com/stevenchenUCD/marktext/actions
```

---

## 🐛 问题反馈

如果你发现 bug 或有建议：
1. 查看[已知问题](https://github.com/stevenchenUCD/marktext/issues)
2. [提交新问题](https://github.com/stevenchenUCD/marktext/issues/new)

---

## 📜 变更日志

### v0.17.2-bugfix (2024-11-09)

#### 修复
- ✅ 修复关闭未修改文件时错误提示保存的问题
- ✅ 改进文件监听器行为
- ✅ 区分外部文件改变和本地编辑

#### 文档
- ✨ 添加中文使用指南
- ✨ 添加 Mac 构建指南
- ✨ 添加 Homebrew 安装说明
- ✨ 添加完整下载页面

#### 基于版本
- 基于 MarkText v0.17.1
- 上游仓库：https://github.com/marktext/marktext

---

## 🙏 致谢

本项目基于 [MarkText](https://github.com/marktext/marktext) 开发。

感谢原项目的所有贡献者！

---

## 📄 许可证

[MIT License](LICENSE)

---

## 🌟 支持项目

如果这个修复版本对你有帮助：
- ⭐ Star 这个仓库
- 🐛 报告发现的问题
- 💡 分享给其他人

---

**仓库**: https://github.com/stevenchenUCD/marktext
**原始项目**: https://github.com/marktext/marktext
**最后更新**: 2024-11-09
