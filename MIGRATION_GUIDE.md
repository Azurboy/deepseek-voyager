# DeepSeek 迁移指南

本文档说明了如何从 Gemini Voyager 迁移到 DeepSeek Voyager。

## 主要代码变更

### 1. 选择器配置 (`src/pages/content/deepseek/selectors.ts`)

创建了新的选择器配置系统，用于处理 DeepSeek 的混淆类名：

```typescript
export const DEEPSEEK_SELECTORS = {
  userMessage: {
    primary: '.ds-message',
    fallbacks: ['[class*="ds-message"]', 'div[class*="message"]'],
  },
  conversationItem: {
    primary: 'a[href*="/a/chat/s/"]',  // 最稳定的选择器
    fallbacks: ['a[href*="/chat/"]'],
  },
  // ...
};
```

### 2. 对话ID提取

**Gemini** (hex格式):
```typescript
// 从 jslog 属性提取: c_3456c77162722c1a
const match = jslog.match(/c_([a-f0-9]+)/);
```

**DeepSeek** (UUID格式):
```typescript
// 从 href 提取: 040e281f-fd36-41a0-8b5a-85344dc365ed
const match = href.match(/\/a\/chat\/s\/([a-f0-9-]{36})/i);
```

### 3. URL结构

| Platform | URL Format |
|----------|------------|
| Gemini | `https://gemini.google.com/app/{hex}` |
| DeepSeek | `https://chat.deepseek.com/a/chat/s/{uuid}` |

### 4. 存储键名

所有 localStorage 键都已更新以避免冲突：

| Gemini | DeepSeek |
|--------|----------|
| `gvFolderData` | `dsFolderData` |
| `geminiTimelineStars` | `deepseekTimelineStars` |
| `geminiTimelineScrollMode` | `deepseekTimelineScrollMode` |

### 5. DOM查找策略

**Gemini**:
- 使用 `data-test-id` 属性
- 依赖稳定的类名

**DeepSeek**:
- 优先使用 `href` 属性模式匹配
- 使用多层级后备选择器
- 通过 `tryFindElement()` 和 `tryFindElements()` 辅助函数

## 测试清单

在 DeepSeek 网站上测试以下功能：

### Timeline功能
- [ ] 时间轴是否显示
- [ ] 点击节点是否跳转到对应消息
- [ ] 滚动时时间轴是否自动同步
- [ ] 长按节点标星是否工作
- [ ] 拖拽时间轴位置是否保存

### Folder功能
- [ ] 文件夹UI是否显示在侧边栏
- [ ] 拖拽对话到文件夹是否工作
- [ ] 创建/重命名/删除文件夹
- [ ] 文件夹展开/折叠
- [ ] 点击文件夹中的对话是否正确跳转
- [ ] 导入/导出文件夹数据

### Export功能
- [ ] 导出按钮是否显示
- [ ] JSON导出是否包含完整数据
- [ ] Markdown/PDF导出格式正确

## 调试技巧

### 启用调试日志

在浏览器控制台执行：
```javascript
localStorage.setItem('dsFolderDebug', '1');
```

### 查看当前选择器

```javascript
// 测试对话项选择器
document.querySelectorAll('a[href*="/a/chat/s/"]');

// 测试消息选择器
document.querySelectorAll('.ds-message');

// 测试侧边栏容器
document.querySelector('.ds-scroll-area');
```

### 检查对话ID提取

```javascript
// 示例URL
const url = '/a/chat/s/040e281f-fd36-41a0-8b5a-85344dc365ed';
const match = url.match(/\/a\/chat\/s\/([a-f0-9-]{36})/i);
console.log('提取的ID:', match ? match[1] : 'null');
```

## 已知问题

### 混淆类名不稳定

**问题**: DeepSeek 使用的混淆类名（如 `_a1b2c3d`）在每次部署后可能改变。

**解决方案**: 
1. 使用稳定的类名前缀（如 `.ds-message`）
2. 使用属性选择器（如 `a[href*="/a/chat/s/"]`）
3. 实现多层级后备策略

**如果选择器失效**:
1. 打开 F12 检查元素
2. 找到新的类名或属性
3. 更新 `src/pages/content/deepseek/selectors.ts`
4. 重新构建扩展

### 导航问题

如果点击文件夹中的对话无法正确跳转：
1. 检查控制台是否有错误
2. 验证 URL 格式是否正确
3. 确认侧边栏元素是否能被找到

## 性能优化建议

1. **虚拟滚动**: Timeline 已实现虚拟滚动，只渲染可见节点
2. **防抖**: 使用 `debounce` 减少频繁的 DOM 操作
3. **事件委托**: 在容器上监听事件而非每个元素

## 未来改进方向

1. [ ] 支持更多 DeepSeek 特性（如果有）
2. [ ] 改进对混淆类名的自动检测
3. [ ] 添加更详细的错误提示
4. [ ] 支持自定义选择器配置

---

## 需要帮助？

如果遇到问题：
1. 检查浏览器控制台错误
2. 启用调试日志查看详细信息
3. 检查 DeepSeek 的 DOM 结构是否改变
4. 提交 Issue 并附上错误信息和 DOM 结构

