/**
 * DeepSeek Selectors Configuration
 * 
 * 重要提示：DeepSeek 使用混淆类名（如 _a1b2c3d），这些类名在每次部署时都会改变。
 * 因此我们采用多层级后备策略，优先使用稳定的选择器。
 */

export interface SelectorConfig {
  primary: string;           // 主选择器（最稳定）
  fallbacks: string[];       // 后备选择器列表
  description: string;       // 描述
}

/**
 * 选择器配置
 */
export const DEEPSEEK_SELECTORS = {
  /**
   * 用户消息选择器
   * DeepSeek 的用户消息有固定类名 d29f3d7d（根据实际测试）
   * 用户消息格式：<div class="d29f3d7d ds-message _63c77b1">
   * 助手消息格式：<div class="ds-message _63c77b1">
   */
  userMessage: {
    primary: '.d29f3d7d.ds-message',  // 用户消息的固定类名组合
    fallbacks: [
      '.ds-message',  // 如果上面失效，回退到通用选择器
      '[class*="ds-message"]',
    ],
    description: '用户消息元素',
  } as SelectorConfig,

  /**
   * 侧边栏容器选择器
   */
  sidebarContainer: {
    primary: '.ds-scroll-area',  // DeepSeek 使用的滚动区域类名
    fallbacks: [
      '[class*="ds-scroll"]',
      '[class*="sidebar"]',
      'nav',
      'aside',
    ],
    description: '侧边栏容器',
  } as SelectorConfig,

  /**
   * 对话项选择器（最稳定）
   * 使用 href 属性匹配，因为 URL 结构相对稳定
   */
  conversationItem: {
    primary: 'a[href*="/a/chat/s/"]',  // 通过 URL 模式匹配
    fallbacks: [
      'a[href*="/chat/"]',
      '[class*="conversation"]',
      '[class*="chat-item"]',
    ],
    description: '侧边栏对话项',
  } as SelectorConfig,

  /**
   * 对话标题选择器
   */
  conversationTitle: {
    primary: 'a[href*="/a/chat/s/"] div',  // 对话链接内的第一个 div
    fallbacks: [
      'a[href*="/a/chat/s/"] span',
      '[class*="title"]',
      '[class*="name"]',
    ],
    description: '对话标题',
  } as SelectorConfig,

  /**
   * 主滚动容器选择器
   */
  scrollContainer: {
    primary: '.ds-scroll-area',
    fallbacks: [
      '[class*="scroll"]',
      'main',
      '#root',
    ],
    description: '主对话区域滚动容器',
  } as SelectorConfig,
};

/**
 * 尝试使用选择器配置查找元素
 * @param config 选择器配置
 * @param parent 父元素，默认为 document
 * @returns 找到的元素或 null
 */
export function tryFindElement(
  config: SelectorConfig,
  parent: Element | Document = document
): Element | null {
  // 先尝试主选择器
  let element = parent.querySelector(config.primary);
  if (element) return element;

  // 尝试后备选择器
  for (const fallback of config.fallbacks) {
    try {
      element = parent.querySelector(fallback);
      if (element) {
        console.warn(
          `[DeepSeek Voyager] ${config.description} 使用后备选择器: ${fallback}`
        );
        return element;
      }
    } catch (e) {
      // 某些选择器可能无效，忽略错误
      continue;
    }
  }

  console.warn(`[DeepSeek Voyager] 无法找到 ${config.description}`);
  return null;
}

/**
 * 尝试使用选择器配置查找所有元素
 */
export function tryFindElements(
  config: SelectorConfig,
  parent: Element | Document = document
): NodeListOf<Element> | Element[] {
  // 先尝试主选择器
  let elements = parent.querySelectorAll(config.primary);
  if (elements.length > 0) return elements;

  // 尝试后备选择器
  for (const fallback of config.fallbacks) {
    try {
      elements = parent.querySelectorAll(fallback);
      if (elements.length > 0) {
        console.warn(
          `[DeepSeek Voyager] ${config.description} 使用后备选择器: ${fallback}`
        );
        return elements;
      }
    } catch (e) {
      continue;
    }
  }

  console.warn(`[DeepSeek Voyager] 无法找到 ${config.description}`);
  return [];
}

/**
 * 从 href 属性中提取对话 ID
 * @param href URL 或路径
 * @returns UUID 格式的对话 ID
 */
export function extractConversationId(href: string): string | null {
  // DeepSeek 的对话 URL 格式: /a/chat/s/[UUID]
  const match = href.match(/\/a\/chat\/s\/([a-f0-9-]{36})/i);
  return match ? match[1] : null;
}

/**
 * 构建对话 URL
 * @param conversationId UUID 格式的对话 ID
 * @returns 完整的对话 URL
 */
export function buildConversationUrl(conversationId: string): string {
  return `https://chat.deepseek.com/a/chat/s/${conversationId}`;
}

/**
 * 检测当前是否在对话页面
 */
export function isConversationRoute(pathname = location.pathname): boolean {
  return /^\/a\/chat\/s\/[a-f0-9-]{36}/i.test(pathname);
}

/**
 * 从当前 URL 获取对话 ID
 */
export function getCurrentConversationId(): string | null {
  return extractConversationId(location.pathname);
}


