# DeepSeek Voyager

DeepSeek 适配版——为 [DeepSeek](https://chat.deepseek.com) 提供时间轴导航与文件夹管理的对话增强工具。

本项目改编自 [Gemini Voyager](https://github.com/Nagi-ovo/gemini-voyager)，针对 DeepSeek 平台进行了全面适配。

---

## 功能概览

### 时间轴导航（已完成）
- 点击节点快速定位到对应消息
- 悬停预览消息内容
- 长按可标记重要消息（跨标签页同步）
- 支持拖拽调整时间轴位置
- 自动跟随滚动位置

### 文件夹管理（已完成）
- 两层级结构：文件夹与子文件夹
- 支持拖拽对话到文件夹
- 右键菜单：重命名、复制、删除
- 固定常用文件夹
- 导入/导出文件夹数据，支持跨设备同步

---

## 安装使用

### Chromium 浏览器（Chrome、Edge、Brave 等）
1. 克隆仓库
   ```bash
   git clone https://github.com/Azurboy/gemini-voyager.git
   cd gemini-voyager
   ```
2. 安装依赖
   ```bash
   npm install --legacy-peer-deps
   ```
3. 构建扩展
   ```bash
   npm run build:chrome
   ```
4. 加载到浏览器
   - 打开 `chrome://extensions`
   - 开启“开发者模式”
   - 点击“加载已解压的扩展程序”，选择 `dist_chrome` 文件夹

### Firefox
1. 构建 Firefox 版本
   ```bash
   npm run build:firefox
   ```
2. 打开 `about:debugging#/runtime/this-firefox`
3. 点击“临时载入附加组件”
4. 选择 `dist_firefox/manifest.json`

---

## 许可与致谢

MIT License（详见 `LICENSE`）。

本项目基于 Gemini Voyager 改编，感谢原作者 Jesse Zhang 的工作。原项目面向 Google Gemini，本分支专注适配 DeepSeek 平台。

---

## 相关链接
- 原项目：https://github.com/Nagi-ovo/gemini-voyager
- DeepSeek：https://chat.deepseek.com
- Issues：https://github.com/Azurboy/gemini-voyager/issues
