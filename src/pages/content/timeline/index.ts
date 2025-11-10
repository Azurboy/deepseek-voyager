import { TimelineManager } from './manager';
import { isConversationRoute } from '../deepseek/selectors';

function isDeepSeekConversationRoute(pathname = location.pathname): boolean {
  // DeepSeek 对话路由格式: /a/chat/s/[UUID]
  return isConversationRoute(pathname);
}

let timelineManagerInstance: TimelineManager | null = null;
let currentUrl = location.href;
let routeCheckIntervalId: number | null = null;
let routeListenersAttached = false;
let activeObservers: MutationObserver[] = [];
let cleanupHandlers: (() => void)[] = [];
let isInitializing = false;

function initializeTimeline(): void {
  // 防止重复初始化
  if (isInitializing) {
    console.log('[Timeline] 已在初始化中，跳过重复调用');
    return;
  }
  
  if (timelineManagerInstance) {
    try {
      timelineManagerInstance.destroy();
    } catch {}
    timelineManagerInstance = null;
  }
  try {
    document.querySelector('.gemini-timeline-bar')?.remove();
  } catch {}
  try {
    document.querySelector('.timeline-left-slider')?.remove();
  } catch {}
  try {
    document.getElementById('gemini-timeline-tooltip')?.remove();
  } catch {}
  
  isInitializing = true;
  timelineManagerInstance = new TimelineManager();
  timelineManagerInstance
    .init()
    .then(() => {
      isInitializing = false;
      console.log('[Timeline/index] 初始化成功完成');
    })
    .catch((err) => {
      isInitializing = false;
      console.error('[DeepSeek Voyager] Timeline initialization failed:', err);
    });
}

function handleUrlChange(): void {
  if (location.href === currentUrl) return;
  currentUrl = location.href;
  if (isDeepSeekConversationRoute()) initializeTimeline();
  else {
    isInitializing = false; // 重置标志
    if (timelineManagerInstance) {
      try {
        timelineManagerInstance.destroy();
      } catch {}
      timelineManagerInstance = null;
    }
    try {
      document.querySelector('.gemini-timeline-bar')?.remove();
    } catch {}
    try {
      document.querySelector('.timeline-left-slider')?.remove();
    } catch {}
    try {
      document.getElementById('gemini-timeline-tooltip')?.remove();
    } catch {}
  }
}

function attachRouteListenersOnce(): void {
  if (routeListenersAttached) return;
  routeListenersAttached = true;
  window.addEventListener('popstate', handleUrlChange);
  window.addEventListener('hashchange', handleUrlChange);
  routeCheckIntervalId = window.setInterval(() => {
    if (location.href !== currentUrl) handleUrlChange();
  }, 800);

  // Register cleanup handlers for proper resource management
  cleanupHandlers.push(() => {
    window.removeEventListener('popstate', handleUrlChange);
    window.removeEventListener('hashchange', handleUrlChange);
  });
}

/**
 * Cleanup function to prevent memory leaks
 * Disconnects all observers, clears intervals, and removes event listeners
 */
function cleanup(): void {
  // Disconnect all active MutationObservers
  activeObservers.forEach((observer) => {
    try {
      observer.disconnect();
    } catch (e) {
      console.error('[Gemini Voyager] Failed to disconnect observer during cleanup:', e);
    }
  });
  activeObservers = [];

  // Clear the route check interval
  if (routeCheckIntervalId !== null) {
    clearInterval(routeCheckIntervalId);
    routeCheckIntervalId = null;
  }

  // Execute all registered cleanup handlers
  cleanupHandlers.forEach((handler) => {
    try {
      handler();
    } catch (e) {
      console.error('[Gemini Voyager] Failed to run cleanup handler:', e);
    }
  });
  cleanupHandlers = [];

  // Reset flags
  routeListenersAttached = false;
  isInitializing = false;
}

export function startTimeline(): void {
  // Immediately initialize if we're already on a conversation page
  if (document.body && isDeepSeekConversationRoute()) {
    initializeTimeline();
  }

  const initialObserver = new MutationObserver(() => {
    if (document.body) {
      if (isDeepSeekConversationRoute()) initializeTimeline();

      // Disconnect and remove from tracking
      initialObserver.disconnect();
      activeObservers = activeObservers.filter((obs) => obs !== initialObserver);

      // Create page observer for URL changes
      const pageObserver = new MutationObserver(handleUrlChange);
      pageObserver.observe(document.body, { childList: true, subtree: true });
      activeObservers.push(pageObserver);

      attachRouteListenersOnce();
    }
  });

  // Track observer for cleanup
  activeObservers.push(initialObserver);

  initialObserver.observe(document.documentElement || document.body, {
    childList: true,
    subtree: true,
  });

  // Setup cleanup on page unload
  window.addEventListener('beforeunload', cleanup, { once: true });

  // Also cleanup on extension unload (if content script is removed)
  if (typeof chrome !== 'undefined' && chrome.runtime) {
    chrome.runtime.onSuspend?.addListener?.(cleanup);
  }
}
