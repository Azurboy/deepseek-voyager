/**
 * SVG 图标库
 * 所有图标都来自 Material Design Icons
 * 使用 SVG 以避免依赖 Google Fonts（国内可能被墙）
 */

export const ICONS = {
  // 上传
  upload: `<svg xmlns="http://www.w3.org/2000/svg" height="20" viewBox="0 -960 960 960" width="20" fill="currentColor">
    <path d="M444-336v-363L321-576l-51-51 210-210 210 210-51 51-123-123v363h-72ZM264-192q-29.7 0-50.85-21.15Q192-234.3 192-264v-120h72v120h432v-120h72v120q0 29.7-21.15 50.85Q725.7-192 696-192H264Z"/>
  </svg>`,
  
  // 下载
  download: `<svg xmlns="http://www.w3.org/2000/svg" height="20" viewBox="0 -960 960 960" width="20" fill="currentColor">
    <path d="M480-336 270-546l51-51 123 123v-363h72v363l123-123 51 51-210 210ZM264-192q-29.7 0-50.85-21.15Q192-234.3 192-264v-120h72v120h432v-120h72v120q0 29.7-21.15 50.85Q725.7-192 696-192H264Z"/>
  </svg>`,
  
  // 添加
  add: `<svg xmlns="http://www.w3.org/2000/svg" height="20" viewBox="0 -960 960 960" width="20" fill="currentColor">
    <path d="M444-444H240v-72h204v-204h72v204h204v72H516v204h-72v-204Z"/>
  </svg>`,
  
  // 展开（向下箭头）
  expand_more: `<svg xmlns="http://www.w3.org/2000/svg" height="20" viewBox="0 -960 960 960" width="20" fill="currentColor">
    <path d="M480-360 276-564l51-51 153 153 153-153 51 51-204 204Z"/>
  </svg>`,
  
  // 收起（向右箭头）
  chevron_right: `<svg xmlns="http://www.w3.org/2000/svg" height="20" viewBox="0 -960 960 960" width="20" fill="currentColor">
    <path d="M534-480 354-660l51-51 231 231-231 231-51-51 180-180Z"/>
  </svg>`,
  
  // 文件夹
  folder: `<svg xmlns="http://www.w3.org/2000/svg" height="20" viewBox="0 -960 960 960" width="20" fill="currentColor">
    <path d="M168-192q-29.7 0-50.85-21.15Q96-234.3 96-264v-432q0-29.7 21.15-50.85Q138.3-768 168-768h216l96 96h312q29.7 0 50.85 21.15Q864-629.7 864-600v336q0 29.7-21.15 50.85Q821.7-192 792-192H168Zm0-72h624v-336H450l-96-96H168v432Zm0 0v-432 432Z"/>
  </svg>`,
  
  // 打开的文件夹
  folder_open: `<svg xmlns="http://www.w3.org/2000/svg" height="20" viewBox="0 -960 960 960" width="20" fill="currentColor">
    <path d="M168-192q-29 0-50.5-21.5T96-264v-432q0-30 21.5-51t50.5-21h216l96 96h312q30 0 51 21t21 51H450l-96-96H168v432l102-312h618L761-219q-8 24-29 37.5T684-168H168Zm84-72h438l90-288H342l-90 288Zm0 0 90-288-90 288Zm-84-360v-72 72Z"/>
  </svg>`,
  
  // 订书钉（未固定）- 空心
  push_pin: `<svg xmlns="http://www.w3.org/2000/svg" height="18" viewBox="0 0 24 24" width="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
  </svg>`,
  
  // 订书钉（已固定）- 实心
  push_pin_filled: `<svg xmlns="http://www.w3.org/2000/svg" height="18" viewBox="0 0 24 24" width="18" fill="currentColor">
    <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57C14 1.51 16.22.89 18.38 1.5c2.16.61 3.72 2.17 4.33 4.33.61 2.16-.01 4.38-1.68 6.05l-9.2 9.19c-1.39 1.39-3.63 1.39-5.02 0-1.39-1.39-1.39-3.63 0-5.02l8.49-8.48c.78-.78 2.05-.78 2.83 0 .78.78.78 2.05 0 2.83l-8.48 8.48"/>
  </svg>`,
  
  // 书架图标 - 用于替代"文件夹"文字
  bookshelf: `<svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 -960 960 960" width="24" fill="currentColor">
    <path d="M240-240v-480h120v480H240Zm180 0v-480h120v480H420Zm180 0v-480h120v480H600ZM120-120v-72h720v72H120Zm0-648v-72h720v72H120Z"/>
  </svg>`,
  
  // 更多选项（竖三点）
  more_vert: `<svg xmlns="http://www.w3.org/2000/svg" height="20" viewBox="0 -960 960 960" width="20" fill="currentColor">
    <path d="M480-192q-29.7 0-50.85-21.15Q408-234.3 408-264q0-29.7 21.15-50.85Q450.3-336 480-336q29.7 0 50.85 21.15Q552-293.7 552-264q0 29.7-21.15 50.85Q509.7-192 480-192Zm0-216q-29.7 0-50.85-21.15Q408-450.3 408-480q0-29.7 21.15-50.85Q450.3-552 480-552q29.7 0 50.85 21.15Q552-509.7 552-480q0 29.7-21.15 50.85Q509.7-408 480-408Zm0-216q-29.7 0-50.85-21.15Q408-666.3 408-696q0-29.7 21.15-50.85Q450.3-768 480-768q29.7 0 50.85 21.15Q552-725.7 552-696q0 29.7-21.15 50.85Q509.7-624 480-624Z"/>
  </svg>`,
  
  // 聊天气泡
  chat_bubble: `<svg xmlns="http://www.w3.org/2000/svg" height="20" viewBox="0 -960 960 960" width="20" fill="currentColor">
    <path d="M240-240 131-131q-14 14-32.5 6.5T80-152v-640q0-29.7 21.15-50.85Q122.3-864 152-864h656q29.7 0 50.85 21.15Q880-821.7 880-792v480q0 29.7-21.15 50.85Q837.7-240 808-240H240Zm-88-102 46-46h610v-480H152v526Zm0-526v526-526Z"/>
  </svg>`,
  
  // 关闭
  close: `<svg xmlns="http://www.w3.org/2000/svg" height="20" viewBox="0 -960 960 960" width="20" fill="currentColor">
    <path d="m291-240-51-51 189-189-189-189 51-51 189 189 189-189 51 51-189 189 189 189-51 51-189-189-189 189Z"/>
  </svg>`,
  
  // 确认
  check: `<svg xmlns="http://www.w3.org/2000/svg" height="20" viewBox="0 -960 960 960" width="20" fill="currentColor">
    <path d="m382-354 339-339 51 51-390 390-195-195 51-51 144 144Z"/>
  </svg>`,
};

/**
 * 创建 SVG 图标元素
 * @param iconName 图标名称
 * @param className 额外的 CSS 类名
 * @returns SVG 元素
 */
export function createIcon(iconName: keyof typeof ICONS, className = ''): HTMLSpanElement {
  const span = document.createElement('span');
  span.className = `gv-icon ${className}`.trim();
  span.innerHTML = ICONS[iconName] || '';
  return span;
}

/**
 * 获取 SVG 图标的 HTML 字符串
 * @param iconName 图标名称
 * @returns SVG HTML 字符串
 */
export function getIconHTML(iconName: keyof typeof ICONS): string {
  return `<span class="gv-icon">${ICONS[iconName] || ''}</span>`;
}

