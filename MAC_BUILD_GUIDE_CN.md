# MarkText Mac 打包指南

本指南将帮助你在 Mac 上构建和打包 MarkText 应用程序。

---

## 📋 前置要求

### 1. 系统要求
- **操作系统**: macOS 10.13 或更高版本
- **架构**: Intel (x64) 或 Apple Silicon (arm64)

### 2. 必需软件

#### Node.js 和 Yarn
```bash
# 安装 Node.js (需要 v16.x 版本)
# 推荐使用 nvm 安装
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# 安装并使用 Node.js 16
nvm install 16
nvm use 16

# 验证版本
node --version  # 应显示 v16.x.x

# 安装 Yarn
npm install -g yarn

# 验证 Yarn
yarn --version
```

#### Python 3
```bash
# macOS 通常已预装 Python 3
python3 --version  # 应显示 3.6 或更高

# 如果没有，使用 Homebrew 安装
brew install python@3.9
```

#### Xcode 命令行工具
```bash
# 安装 Xcode 命令行工具（包含 C++ 编译器）
xcode-select --install
```

---

## 🚀 构建步骤

### 步骤 1: 克隆或更新代码

如果还没有克隆项目：
```bash
git clone https://github.com/stevenchenUCD/marktext.git
cd marktext
```

如果已有项目，确保代码是最新的：
```bash
cd marktext
git checkout claude/scan-project-011CUx3rfp8ZPjuF8R7KMzJi
git pull origin claude/scan-project-011CUx3rfp8ZPjuF8R7KMzJi
```

### 步骤 2: 安装依赖

```bash
# 安装所有依赖（首次构建需要较长时间）
yarn install

# 或者使用锁定的依赖版本（推荐）
yarn install --frozen-lockfile
```

**注意**：
- 首次安装可能需要 5-15 分钟，取决于网络速度
- 安装过程中会编译一些原生模块（如 keytar、fontmanager 等）

### 步骤 3: 构建应用

根据需要选择以下命令之一：

#### 选项 A: 完整打包（推荐）
生成可分发的 DMG 和 ZIP 文件：
```bash
yarn run release:mac
```

**输出位置**: `build/` 目录
- `marktext-x64.dmg` - Intel Mac 的安装文件
- `marktext-arm64.dmg` - Apple Silicon Mac 的安装文件
- `marktext-x64-mac.zip` - Intel Mac 的压缩包
- `marktext-arm64-mac.zip` - Apple Silicon Mac 的压缩包

#### 选项 B: 仅构建应用（不打包）
仅生成 `.app` 文件，不创建安装包：
```bash
yarn run build:bin
```

**输出位置**: `build/mac/MarkText.app`

#### 选项 C: 通用构建命令
根据当前系统自动选择构建目标：
```bash
yarn run build
```

### 步骤 4: 测试应用

#### 测试 .app 文件
```bash
# 打开构建的应用
open build/mac/MarkText.app
```

#### 测试 DMG 文件
```bash
# 挂载 DMG
open build/marktext-x64.dmg  # Intel Mac
# 或
open build/marktext-arm64.dmg  # Apple Silicon Mac

# 然后从挂载的卷中拖拽 MarkText.app 到 Applications 文件夹
```

---

## 🛠️ 开发模式

如果你想在开发模式下运行应用（带热重载）：

```bash
yarn run dev
```

这会启动开发服务器并自动打开应用，代码更改会自动重新加载。

---

## 📦 打包配置说明

打包配置位于 `electron-builder.yml` 文件中，关键配置包括：

### Mac 特定配置
```yaml
mac:
  artifactName: "marktext-${arch}-mac.${ext}"
  icon: "resources/icons/icon.icns"
  darkModeSupport: true
  target:
    - target: dmg
      arch: [x64, arm64]  # 支持 Intel 和 Apple Silicon
    - target: zip
      arch: [x64, arm64]
```

### DMG 配置
- 自动创建应用图标和 Applications 快捷方式
- 窗口布局已预配置

---

## ❗ 常见问题

### 1. 构建失败：`node-gyp` 错误

**问题**: 原生模块编译失败

**解决方案**:
```bash
# 确保安装了 Xcode 命令行工具
xcode-select --install

# 清理并重新安装
yarn clean
rm -rf node_modules
yarn install
```

### 2. 构建失败：Python 版本错误

**问题**: 需要 Python 3.6+

**解决方案**:
```bash
# 检查 Python 版本
python3 --version

# 如果版本过低，使用 Homebrew 安装新版本
brew install python@3.9

# 设置环境变量
export PYTHON=/usr/local/bin/python3
```

### 3. 权限问题

**问题**: 应用无法打开，提示"已损坏"或"来自未识别的开发者"

**解决方案**:
```bash
# 移除隔离属性
xattr -cr build/mac/MarkText.app

# 或在系统偏好设置中允许运行
# 系统偏好设置 → 安全性与隐私 → 通用 → 点击"仍要打开"
```

### 4. 代码签名问题

**问题**: 需要签名才能分发

**解决方案**:
如果你有 Apple Developer 账号，可以在 `electron-builder.yml` 中添加签名配置：

```yaml
mac:
  identity: "Developer ID Application: Your Name (TEAM_ID)"
  hardenedRuntime: true
  gatekeeperAssess: false
  entitlements: "build/entitlements.mac.plist"
  entitlementsInherit: "build/entitlements.mac.plist"
```

然后设置环境变量：
```bash
export APPLEID="your-apple-id@email.com"
export APPLEIDPASS="app-specific-password"
```

### 5. 内存不足

**问题**: 构建过程中内存不足

**解决方案**:
```bash
# 增加 Node.js 内存限制
export NODE_OPTIONS="--max-old-space-size=4096"
yarn run release:mac
```

### 6. 构建速度慢

**优化方案**:
```bash
# 仅构建当前架构
yarn run build:bin  # 比完整打包快

# 或者修改 electron-builder.yml，注释掉不需要的架构
# 例如，只构建 x64:
# target:
#   - target: dmg
#     arch: [x64]  # 移除 arm64
```

---

## 🔧 高级选项

### 仅构建特定架构

**仅构建 Intel (x64)**:
```bash
yarn run release:mac --x64
```

**仅构建 Apple Silicon (arm64)**:
```bash
yarn run release:mac --arm64
```

### 跳过代码签名
```bash
export CSC_IDENTITY_AUTO_DISCOVERY=false
yarn run release:mac
```

### 生成调试符号
在 `electron-builder.yml` 中添加：
```yaml
mac:
  ...
  extendInfo:
    ElectronTeamID: "your-team-id"
```

---

## 📝 构建脚本说明

| 命令 | 说明 |
|------|------|
| `yarn run release:mac` | 完整 Mac 打包（DMG + ZIP，x64 + arm64） |
| `yarn run build` | 根据当前系统自动构建 |
| `yarn run build:bin` | 仅构建 .app 文件（不打包） |
| `yarn run dev` | 开发模式（带热重载） |
| `yarn run build:clean` | 清理构建文件 |

---

## 📂 输出文件说明

构建完成后，`build/` 目录包含：

```
build/
├── marktext-x64.dmg              # Intel Mac 安装镜像
├── marktext-arm64.dmg            # Apple Silicon Mac 安装镜像
├── marktext-x64-mac.zip          # Intel Mac 压缩包
├── marktext-arm64-mac.zip        # Apple Silicon Mac 压缩包
└── mac/
    └── MarkText.app              # 应用包（未压缩）
```

**文件大小**（大约）：
- DMG 文件: ~150-200 MB
- ZIP 文件: ~140-180 MB

---

## ✅ 验证构建

### 检查应用信息
```bash
# 查看应用版本
/usr/libexec/PlistBuddy -c "Print :CFBundleShortVersionString" \
  build/mac/MarkText.app/Contents/Info.plist

# 查看应用架构
lipo -info build/mac/MarkText.app/Contents/MacOS/MarkText
```

### 运行基本测试
```bash
# 打开应用并检查是否正常启动
open build/mac/MarkText.app

# 检查以下功能：
# 1. 创建新文件
# 2. 打开 markdown 文件
# 3. 导出 PDF
# 4. 创建新窗口（File → New Window）
```

---

## 🎯 快速构建流程总结

```bash
# 1. 准备环境
nvm use 16
yarn install --frozen-lockfile

# 2. 构建应用
yarn run release:mac

# 3. 测试
open build/marktext-x64.dmg  # 或 marktext-arm64.dmg

# 4. 分发
# 将 build/*.dmg 文件分发给用户
```

---

## 📚 相关文档

- [构建说明](docs/dev/BUILD.md) - 完整构建文档
- [开发文档](docs/dev/README.md) - 开发指南
- [electron-builder 文档](https://www.electron.build/configuration/mac) - Mac 打包配置

---

## 💡 提示

1. **首次构建**可能需要 10-20 分钟
2. **后续构建**通常只需 2-5 分钟
3. 建议在 **SSD** 上进行构建以提高速度
4. 至少需要 **5GB 可用空间**
5. 网络良好时，依赖下载会更快

---

## 🆘 获取帮助

如果遇到问题：

1. 查看 [GitHub Issues](https://github.com/marktext/marktext/issues)
2. 查看 [构建文档](docs/dev/BUILD.md)
3. 提交新的 Issue 并附上：
   - macOS 版本
   - Node.js 版本
   - 完整错误日志

---

祝你打包顺利！🎉
