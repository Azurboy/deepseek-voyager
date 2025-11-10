# 🚀 快速开始指南

## 安装步骤

### 1. 安装依赖

```bash
# 使用 Bun（推荐）
bun install

# 或使用 npm
npm install

# 或使用 pnpm
pnpm install
```

### 2. 构建扩展

```bash
# Chrome/Edge/Brave 等 Chromium 浏览器
bun run build:chrome

# Firefox
bun run build:firefox
```

### 3. 加载到浏览器

#### Chrome/Edge/Brave

1. 打开扩展管理页面
   - Chrome: `chrome://extensions`
   - Edge: `edge://extensions`
   - Brave: `brave://extensions`

2. 开启"开发者模式"（右上角开关）

3. 点击"加载已解压的扩展程序"

4. 选择项目中的 `dist_chrome` 文件夹

5. 完成！访问 https://chat.deepseek.com 即可看到效果

#### Firefox

1. 打开 `about:debugging#/runtime/this-firefox`

2. 点击"临时载入附加组件"

3. 选择 `dist_firefox/manifest.json` 文件

4. 完成！访问 https://chat.deepseek.com 即可看到效果

---

## 开发模式

开发模式支持热重载，修改代码后自动重新构建：

```bash
# Chrome 开发模式
bun run dev:chrome

# Firefox 开发模式
bun run dev:firefox
```

---

## 功能演示

### 📍 时间轴功能

1. 打开任意对话页面
2. 右侧会自动出现时间轴
3. 点击节点跳转到对应消息
4. 长按节点标星（跨标签页同步）

### 📂 文件夹功能

1. 侧边栏顶部会出现"文件夹"区域
2. 点击 `+` 创建文件夹
3. 从侧边栏拖拽对话到文件夹
4. 点击文件夹中的对话快速跳转

### 💾 导出功能

1. 点击页面上的导出按钮
2. 选择导出格式（JSON/Markdown/PDF）
3. 下载文件

---

## 配置选项

点击浏览器工具栏中的扩展图标，可以配置：

- **滚动模式**: Jump（瞬移）或 Flow（平滑）
- **聊天宽度**: 400px - 1400px
- **时间轴位置**: 可拖拽
- **隐藏容器**: 隐藏原生侧边栏

---

## 调试技巧

### 查看调试日志

```javascript
// 在浏览器控制台执行
localStorage.setItem('dsFolderDebug', '1');
```

### 测试选择器

```javascript
// 测试对话列表
document.querySelectorAll('a[href*="/a/chat/s/"]');

// 测试消息元素
document.querySelectorAll('.ds-message');
```

### 清除数据

```javascript
// 清除文件夹数据
localStorage.removeItem('dsFolderData');

// 清除时间轴收藏
localStorage.removeItem('deepseekTimelineStars:deepseek:...');
```

---

## 常见问题

### Q: 时间轴不显示？
A: 检查是否在对话页面（URL包含 `/a/chat/s/`）

### Q: 拖拽对话无效？
A: 刷新页面，或检查控制台是否有错误

### Q: 选择器失效？
A: DeepSeek 可能更新了DOM结构，参考 [MIGRATION_GUIDE.md](MIGRATION_GUIDE.md) 更新选择器

### Q: 导出按钮不显示？
A: 确保在对话页面，并检查控制台错误

---

## 项目结构

```
src/
├── pages/
│   ├── content/
│   │   ├── deepseek/         # DeepSeek 特定配置
│   │   │   └── selectors.ts  # 选择器配置
│   │   ├── timeline/          # 时间轴功能
│   │   ├── folder/            # 文件夹功能
│   │   └── export/            # 导出功能
│   ├── popup/                 # 弹出窗口
│   └── background/            # 后台脚本
├── components/                # React 组件
└── utils/                     # 工具函数
```

---

## 下一步

- 阅读 [README_DEEPSEEK.md](README_DEEPSEEK.md) 了解完整功能
- 查看 [MIGRATION_GUIDE.md](MIGRATION_GUIDE.md) 了解技术细节
- 贡献代码或报告问题

---

Happy coding! 🎉

