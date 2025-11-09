# 📥 MarkText 下载页面（修复版）

> 包含关闭文件时错误保存提示问题的修复版本

---

## 🚀 快速下载

### macOS

#### Intel Mac (x64)
[![Download DMG](https://img.shields.io/badge/Download-DMG-blue?style=for-the-badge&logo=apple)](https://github.com/stevenchenUCD/marktext/releases/latest/download/marktext-x64.dmg)
[![Download ZIP](https://img.shields.io/badge/Download-ZIP-lightgrey?style=for-the-badge&logo=apple)](https://github.com/stevenchenUCD/marktext/releases/latest/download/marktext-x64-mac.zip)

```bash
# 命令行下载
curl -L -o marktext.dmg https://github.com/stevenchenUCD/marktext/releases/latest/download/marktext-x64.dmg
```

#### Apple Silicon Mac (arm64)
[![Download DMG](https://img.shields.io/badge/Download-DMG-blue?style=for-the-badge&logo=apple)](https://github.com/stevenchenUCD/marktext/releases/latest/download/marktext-arm64.dmg)
[![Download ZIP](https://img.shields.io/badge/Download-ZIP-lightgrey?style=for-the-badge&logo=apple)](https://github.com/stevenchenUCD/marktext/releases/latest/download/marktext-arm64-mac.zip)

```bash
# 命令行下载
curl -L -o marktext.dmg https://github.com/stevenchenUCD/marktext/releases/latest/download/marktext-arm64.dmg
```

---

### Windows

#### 安装器（推荐）
[![Download EXE](https://img.shields.io/badge/Download-Installer-blue?style=for-the-badge&logo=windows)](https://github.com/stevenchenUCD/marktext/releases/latest/download/marktext-setup.exe)

#### 便携版
- [64位 ZIP](https://github.com/stevenchenUCD/marktext/releases/latest/download/marktext-x64-win.zip)
- [32位 ZIP](https://github.com/stevenchenUCD/marktext/releases/latest/download/marktext-ia32-win.zip)

```powershell
# PowerShell 下载
Invoke-WebRequest -Uri "https://github.com/stevenchenUCD/marktext/releases/latest/download/marktext-setup.exe" -OutFile "marktext-setup.exe"
```

---

### Linux

#### AppImage（通用，推荐）
[![Download AppImage](https://img.shields.io/badge/Download-AppImage-orange?style=for-the-badge&logo=linux)](https://github.com/stevenchenUCD/marktext/releases/latest/download/marktext-x86_64.AppImage)

```bash
# 下载并运行
curl -L -o MarkText.AppImage https://github.com/stevenchenUCD/marktext/releases/latest/download/marktext-x86_64.AppImage
chmod +x MarkText.AppImage
./MarkText.AppImage
```

#### Debian/Ubuntu (.deb)
```bash
wget https://github.com/stevenchenUCD/marktext/releases/latest/download/marktext-amd64.deb
sudo dpkg -i marktext-amd64.deb
```

#### RedHat/Fedora (.rpm)
```bash
wget https://github.com/stevenchenUCD/marktext/releases/latest/download/marktext-x86_64.rpm
sudo rpm -i marktext-x86_64.rpm
```

#### 压缩包 (.tar.gz)
```bash
wget https://github.com/stevenchenUCD/marktext/releases/latest/download/marktext-x64.tar.gz
tar -xzf marktext-x64.tar.gz
```

---

## 📦 包管理器安装

### Homebrew (macOS)

#### 方法 1: 从自定义 Tap 安装
```bash
brew tap stevenchenUCD/marktext
brew install --cask mark-text
```

#### 方法 2: 覆盖官方 Cask
```bash
brew edit --cask mark-text
# 修改 URL 指向: https://github.com/stevenchenUCD/marktext/...
brew reinstall --cask mark-text
```

详细说明请查看：[HOMEBREW_INSTALL_CN.md](HOMEBREW_INSTALL_CN.md)

---

### Chocolatey (Windows)

```bash
# 暂不支持，请使用直接下载
```

### Winget (Windows)

```bash
# 暂不支持，请使用直接下载
```

---

## 🎯 安装指南

### macOS 安装步骤

1. **下载 DMG 文件**
   - Intel Mac 下载 `marktext-x64.dmg`
   - Apple Silicon Mac 下载 `marktext-arm64.dmg`

2. **打开 DMG**
   ```bash
   open marktext.dmg
   ```

3. **拖拽安装**
   - 将 `MarkText.app` 拖拽到 `Applications` 文件夹

4. **首次运行**
   - 如果提示"无法打开"，前往 `系统偏好设置 → 安全性与隐私 → 通用`
   - 点击"仍要打开"

或使用命令行移除隔离属性：
```bash
xattr -cr /Applications/MarkText.app
```

---

### Windows 安装步骤

1. **下载 EXE 安装器**
   ```
   marktext-setup.exe
   ```

2. **运行安装器**
   - 双击运行
   - 选择安装位置
   - 完成安装

3. **启动应用**
   - 开始菜单搜索 "MarkText"
   - 或从桌面快捷方式启动

---

### Linux 安装步骤

#### AppImage 方式（推荐）

1. **下载 AppImage**
   ```bash
   curl -L -o MarkText.AppImage \
     https://github.com/stevenchenUCD/marktext/releases/latest/download/marktext-x86_64.AppImage
   ```

2. **添加执行权限**
   ```bash
   chmod +x MarkText.AppImage
   ```

3. **运行**
   ```bash
   ./MarkText.AppImage
   ```

4. **（可选）集成到系统**
   ```bash
   # 移动到用户程序目录
   mkdir -p ~/.local/bin
   mv MarkText.AppImage ~/.local/bin/marktext

   # 添加到 PATH（如果还没有）
   echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc
   source ~/.bashrc

   # 现在可以直接运行
   marktext
   ```

---

## 📊 文件大小和校验

### 文件大小（约）

| 平台 | 文件 | 大小 |
|------|------|------|
| macOS | marktext-x64.dmg | ~180 MB |
| macOS | marktext-arm64.dmg | ~175 MB |
| macOS | marktext-x64-mac.zip | ~170 MB |
| macOS | marktext-arm64-mac.zip | ~165 MB |
| Windows | marktext-setup.exe | ~120 MB |
| Windows | marktext-x64-win.zip | ~115 MB |
| Windows | marktext-ia32-win.zip | ~110 MB |
| Linux | marktext-x86_64.AppImage | ~160 MB |
| Linux | marktext-amd64.deb | ~110 MB |
| Linux | marktext-x86_64.rpm | ~115 MB |
| Linux | marktext-x64.tar.gz | ~105 MB |

### SHA256 校验和

构建完成后，可在以下位置查看校验和：
- [GitHub Actions 构建日志](https://github.com/stevenchenUCD/marktext/actions)
- [Releases 页面](https://github.com/stevenchenUCD/marktext/releases)

验证下载文件：

**macOS/Linux**:
```bash
shasum -a 256 marktext-x64.dmg
```

**Windows (PowerShell)**:
```powershell
Get-FileHash marktext-setup.exe -Algorithm SHA256
```

---

## 🔄 更新

### 检查更新

应用内置自动更新检查功能。当有新版本时，会提示下载。

### 手动更新

重新下载最新版本并覆盖安装即可。

### 使用包管理器更新

**Homebrew**:
```bash
brew update
brew upgrade --cask mark-text
```

---

## ✨ 此版本包含的修复

### 🐛 Bug 修复

1. **关闭文件时错误提示保存**
   - 问题：即使没有修改文件，关闭时也会提示保存
   - 修复：区分外部文件改变和本地编辑，只在真正有未保存改动时提示

### ✅ 已有功能说明

2. **多窗口支持**
   - 使用方法：`File → New Window` 或 `Ctrl+Shift+N` / `Cmd+Shift+N`
   - 可以同时打开多个窗口查看不同文档

3. **PDF 导出**
   - 使用方法：`File → Export → PDF`
   - 支持自定义页面、字体、主题等

详细说明请查看：[USAGE_GUIDE_CN.md](USAGE_GUIDE_CN.md)

---

## 📋 系统要求

### macOS
- **版本**: macOS 10.13 (High Sierra) 或更高
- **架构**: Intel (x64) 或 Apple Silicon (arm64)
- **磁盘空间**: 至少 500 MB

### Windows
- **版本**: Windows 7 或更高
- **架构**: 32位或64位
- **磁盘空间**: 至少 300 MB

### Linux
- **架构**: x86_64
- **依赖**:
  - libsecret-1-0
  - libx11-xcb1
  - libxkbfile1
  - libfontconfig1
- **磁盘空间**: 至少 400 MB

---

## 🔗 相关链接

- **源代码**: https://github.com/stevenchenUCD/marktext
- **问题反馈**: https://github.com/stevenchenUCD/marktext/issues
- **所有版本**: https://github.com/stevenchenUCD/marktext/releases
- **构建状态**: https://github.com/stevenchenUCD/marktext/actions

---

## 📖 文档

- [使用指南](USAGE_GUIDE_CN.md) - 功能说明和使用方法
- [Mac 构建指南](MAC_BUILD_GUIDE_CN.md) - 如何自己构建应用
- [仓库安装指南](INSTALL_FROM_REPO_CN.md) - 从源码安装
- [Homebrew 安装](HOMEBREW_INSTALL_CN.md) - Homebrew 安装说明

---

## 🆘 需要帮助？

### 常见问题

**Q: macOS 提示"应用已损坏"**
```bash
xattr -cr /Applications/MarkText.app
```

**Q: Windows 提示"Windows 已保护你的电脑"**
- 点击"更多信息"
- 点击"仍要运行"

**Q: Linux 无法运行 AppImage**
```bash
# 安装 FUSE
sudo apt install fuse libfuse2  # Debian/Ubuntu
sudo dnf install fuse fuse-libs  # Fedora
```

### 获取支持

- 提交 Issue: https://github.com/stevenchenUCD/marktext/issues
- 查看文档: [USAGE_GUIDE_CN.md](USAGE_GUIDE_CN.md)

---

## 📜 许可证

MarkText 使用 [MIT 许可证](LICENSE)。

---

## 🌟 支持项目

如果这个修复版本对你有帮助，请：
- ⭐ Star 这个仓库
- 🐛 报告 Bug
- 💡 提出建议

---

**最后更新**: 2024-11-09
**版本**: v0.17.2-bugfix

---

## 🎉 立即下载

选择你的平台，立即开始使用修复版 MarkText！

- [macOS Intel](#macos)
- [macOS Apple Silicon](#macos)
- [Windows](#windows)
- [Linux](#linux)
