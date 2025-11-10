import { startExportButton } from './export/index';
import { startFolderManager } from './folder/index';
import { startTimeline } from './timeline/index';

try {
  // DeepSeek 网站检测
  if (location.hostname === 'chat.deepseek.com') {
    console.log('[DeepSeek Voyager] 初始化中...');
    startTimeline();
    startFolderManager();
    startExportButton();
    console.log('[DeepSeek Voyager] 初始化完成');
  }
} catch (e) {
  console.error('[DeepSeek Voyager] 初始化错误:', e);
}
