import browser from 'webextension-polyfill';

import type { Folder, FolderData, ConversationReference, DragData } from './types';

import { FolderImportExportService } from '@/features/folder/services/FolderImportExportService';
import type { ImportStrategy } from '@/features/folder/types/import-export';
import { initI18n, getTranslationSync } from '@/utils/i18n';
import {
  DEEPSEEK_SELECTORS,
  tryFindElement,
  tryFindElements,
  extractConversationId,
  buildConversationUrl,
} from '../deepseek/selectors';
import { createIcon, getIconHTML } from './icons';

const STORAGE_KEY = 'dsFolderData';  // DeepSeek Folder Data
const IS_DEBUG = false; // Set to true to enable debug logging
const ROOT_CONVERSATIONS_ID = '__root_conversations__'; // Special ID for root-level conversations

export class FolderManager {
  private debug(...args: any[]): void {
    if (this.isDebugEnabled()) {
      console.log('[FolderManager]', ...args);
    }
  }

  private debugWarn(...args: any[]): void {
    if (this.isDebugEnabled()) {
      console.warn('[FolderManager]', ...args);
    }
  }
  private isDebugEnabled(): boolean {
    try {
      // Enable by setting localStorage.dsFolderDebug = '1'
      return IS_DEBUG || localStorage.getItem('dsFolderDebug') === '1';
    } catch {
      return IS_DEBUG;
    }
  }
  private data: FolderData = { folders: [], folderContents: {} };
  private containerElement: HTMLElement | null = null;
  private sidebarContainer: HTMLElement | null = null;
  private recentSection: HTMLElement | null = null;
  private tooltipElement: HTMLElement | null = null;
  private tooltipTimeout: number | null = null;
  private sideNavObserver: MutationObserver | null = null;
  private importInProgress: boolean = false; // Lock to prevent concurrent imports
  private exportInProgress: boolean = false; // Lock to prevent concurrent exports

  constructor() {
    this.loadData();
    this.createTooltip();
    // Initialize i18n system
    initI18n().catch((e) => {
      this.debugWarn('Failed to initialize i18n:', e);
    });
  }

  async init(): Promise<void> {
    try {
      // Wait for sidebar to be available
      await this.waitForSidebar();

      // Find the Recent section
      this.findRecentSection();

      if (!this.recentSection) {
        this.debugWarn('Could not find Recent section');
        return;
      }

      // Create and inject folder UI
      this.createFolderUI();

      // Make conversations draggable
      this.makeConversationsDraggable();

      // Set up mutation observer to handle dynamically added conversations
      this.setupMutationObserver();

      // Set up sidebar visibility observer
      this.setupSideNavObserver();

      // Initial visibility check
      this.updateVisibilityBasedOnSideNav();

      // Set up native conversation menu injection
      this.setupConversationClickTracking();
      this.setupNativeConversationMenuObserver();

      this.debug('Initialized successfully');
    } catch (error) {
      console.error('[FolderManager] Initialization error:', error);
    }
  }

  private async waitForSidebar(): Promise<void> {
    return new Promise((resolve) => {
      const checkSidebar = () => {
        // DeepSeek 使用 .ds-scroll-area 作为侧边栏容器
        const container = tryFindElement(DEEPSEEK_SELECTORS.sidebarContainer);
        if (container) {
          this.sidebarContainer = container as HTMLElement;
          this.debug('找到侧边栏容器');
          resolve();
        } else {
          setTimeout(checkSidebar, 500);
        }
      };
      checkSidebar();
    });
  }

  private findRecentSection(): void {
    if (!this.sidebarContainer) {
      this.debugWarn('侧边栏容器不存在');
      return;
    }

    this.debug('查找对话列表，侧边栏容器:', this.sidebarContainer);
    
    // DeepSeek: 直接在document中查找对话项（因为侧边栏可能嵌套较深）
    const conversationItems = document.querySelectorAll('a[href*="/a/chat/s/"]');
    this.debug('找到对话链接数量:', conversationItems.length);
    
    if (conversationItems.length > 0) {
      // 使用侧边栏容器作为 Recent section
      this.recentSection = this.sidebarContainer;
      this.debug('✅ 找到对话列表区域，包含', conversationItems.length, '个对话');
    } else {
      this.debugWarn('❌ 未找到对话列表 - 将在2秒后重试');
      // Retry after a delay
      setTimeout(() => {
        this.findRecentSection();
        if (this.recentSection && !this.containerElement) {
          this.createFolderUI();
          this.makeConversationsDraggable();
          this.setupMutationObserver();
        }
      }, 2000);
    }
  }

  private createFolderUI(): void {
    if (!this.recentSection) return;

    // Create folder container
    this.containerElement = document.createElement('div');
    this.containerElement.className = 'gv-folder-container';

    // Create header
    const header = this.createHeader();
    this.containerElement.appendChild(header);

    // Create folders list
    const foldersList = this.createFoldersList();
    this.containerElement.appendChild(foldersList);

    // Insert before Recent section
    this.recentSection.parentElement?.insertBefore(this.containerElement, this.recentSection);
  }

  private createHeader(): HTMLElement {
    const header = document.createElement('div');
    header.className = 'gv-folder-header';

    // Use bookshelf icon instead of text title
    const titleContainer = document.createElement('div');
    titleContainer.className = 'title-container';
    
    const iconWrapper = document.createElement('div');
    iconWrapper.style.display = 'flex';
    iconWrapper.style.alignItems = 'center';
    iconWrapper.style.gap = '8px';
    iconWrapper.style.paddingLeft = '12px';
    
    const bookshelfIcon = createIcon('bookshelf');
    bookshelfIcon.style.opacity = '0.7';
    iconWrapper.appendChild(bookshelfIcon);
    
    // Optional: small text label
    const label = document.createElement('span');
    label.textContent = this.t('folder_title');
    label.style.fontSize = '12px';
    label.style.opacity = '0.6';
    label.style.fontWeight = '500';
    label.style.color = 'var(--bard-color-on-surface-variant, #666)';  // 去除紫色，使用统一的文字颜色
    iconWrapper.appendChild(label);

    titleContainer.appendChild(iconWrapper);

    // Actions container for buttons
    const actionsContainer = document.createElement('div');
    actionsContainer.className = 'gv-folder-header-actions';

    // Import button
    const importButton = document.createElement('button');
    importButton.className = 'gv-folder-action-btn';
    importButton.appendChild(createIcon('upload'));
    importButton.title = this.t('folder_import');
    importButton.addEventListener('click', () => this.showImportDialog());

    // Export button
    const exportButton = document.createElement('button');
    exportButton.className = 'gv-folder-action-btn';
    exportButton.appendChild(createIcon('download'));
    exportButton.title = this.t('folder_export');
    exportButton.addEventListener('click', () => this.exportFolders());

    // Add folder button
    const addButton = document.createElement('button');
    addButton.className = 'gv-folder-add-btn';
    addButton.appendChild(createIcon('add'));
    addButton.title = this.t('folder_create');
    addButton.addEventListener('click', () => this.createFolder());

    actionsContainer.appendChild(importButton);
    actionsContainer.appendChild(exportButton);
    actionsContainer.appendChild(addButton);

    header.appendChild(titleContainer);
    header.appendChild(actionsContainer);

    // Setup root drop zone on header
    this.setupRootDropZone(header);

    return header;
  }

  private createFoldersList(): HTMLElement {
    const list = document.createElement('div');
    list.className = 'gv-folder-list';

    // Setup root-level drop zone for dragging folders and conversations to root
    this.setupRootDropZone(list);

    // Render root-level conversations (favorites/pinned conversations)
    const rootConversations = this.data.folderContents[ROOT_CONVERSATIONS_ID] || [];
    if (rootConversations.length > 0) {
      rootConversations.forEach((conv) => {
        const convEl = this.createConversationElement(conv, ROOT_CONVERSATIONS_ID, 0);
        list.appendChild(convEl);
      });
    }

    // Render root level folders (sorted)
    const rootFolders = this.data.folders.filter((f) => f.parentId === null);
    const sortedRootFolders = this.sortFolders(rootFolders);
    sortedRootFolders.forEach((folder) => {
      const folderElement = this.createFolderElement(folder);
      list.appendChild(folderElement);
    });

    return list;
  }

  private createFolderElement(folder: Folder, level = 0): HTMLElement {
    const folderEl = document.createElement('div');
    folderEl.className = 'gv-folder-item';
    folderEl.dataset.folderId = folder.id;
    folderEl.dataset.level = level.toString();

    // Folder header
    const folderHeader = document.createElement('div');
    folderHeader.className = 'gv-folder-item-header';
    folderHeader.style.paddingLeft = `${level * 16 + 8}px`;

    // Expand/collapse button
    const expandBtn = document.createElement('button');
    expandBtn.className = 'gv-folder-expand-btn';
    expandBtn.appendChild(createIcon(folder.isExpanded ? 'expand_more' : 'chevron_right'));
    expandBtn.addEventListener('click', () => this.toggleFolder(folder.id));

    // Folder icon
    const folderIcon = createIcon('folder', 'gv-folder-icon');

    // Folder name
    const folderName = document.createElement('span');
    folderName.className = 'gv-folder-name gds-label-l';
    folderName.textContent = folder.name;
    folderName.addEventListener('dblclick', () => this.renameFolder(folder.id));

    // Add tooltip event listeners
    folderName.addEventListener('mouseenter', () =>
      this.showTooltip(folderName, folder.name),
    );
    folderName.addEventListener('mouseleave', () => this.hideTooltip());

    // Pin button
    const pinBtn = document.createElement('button');
    pinBtn.className = 'gv-folder-pin-btn';
    pinBtn.appendChild(createIcon(folder.pinned ? 'push_pin_filled' : 'push_pin'));
    pinBtn.title = folder.pinned ? this.t('folder_unpin') : this.t('folder_pin');
    pinBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.togglePinFolder(folder.id);
    });

    // Actions menu
    const actionsBtn = document.createElement('button');
    actionsBtn.className = 'gv-folder-actions-btn';
    actionsBtn.appendChild(createIcon('more_vert'));
    actionsBtn.addEventListener('click', (e) => this.showFolderMenu(e, folder.id));

    folderHeader.appendChild(expandBtn);
    folderHeader.appendChild(folderIcon);
    folderHeader.appendChild(folderName);
    folderHeader.appendChild(pinBtn);
    folderHeader.appendChild(actionsBtn);

    // Setup drop zone for conversations and folders
    this.setupDropZone(folderHeader, folder.id);

    folderEl.appendChild(folderHeader);

    // Apply draggable behavior dynamically based on current state
    // This ensures draggability is always in sync with folder structure
    this.applyFolderDraggableBehavior(folderHeader, folder);

    // Folder content (conversations and subfolders)
    if (folder.isExpanded) {
      const content = document.createElement('div');
      content.className = 'gv-folder-content';

      // Render conversations in this folder
      const conversations = this.data.folderContents[folder.id] || [];
      conversations.forEach((conv) => {
        const convEl = this.createConversationElement(conv, folder.id, level + 1);
        content.appendChild(convEl);
      });

      // Render subfolders (sorted)
      const subfolders = this.data.folders.filter((f) => f.parentId === folder.id);
      const sortedSubfolders = this.sortFolders(subfolders);
      sortedSubfolders.forEach((subfolder) => {
        const subfolderEl = this.createFolderElement(subfolder, level + 1);
        content.appendChild(subfolderEl);
      });

      folderEl.appendChild(content);
    }

    return folderEl;
  }

  private createConversationElement(
    conv: ConversationReference,
    folderId: string,
    level: number
  ): HTMLElement {
    const convEl = document.createElement('div');
    convEl.className = 'gv-folder-conversation';
    convEl.dataset.conversationId = conv.conversationId;
    convEl.dataset.folderId = folderId;
    // Increase indentation for conversations under folders
    convEl.style.paddingLeft = `${level * 16 + 24}px`; // More indentation for tree structure

    // Try to sync title from native conversation
    const syncedTitle = this.syncConversationTitleFromNative(conv.conversationId);
    const displayTitle = syncedTitle || conv.title;

    // Update stored title if we found a different one
    if (syncedTitle && syncedTitle !== conv.title) {
      conv.title = syncedTitle;
      this.saveData();
      this.debug('Updated conversation title from native:', syncedTitle);
    }

    // Make conversation draggable within folders
    convEl.draggable = true;
    convEl.addEventListener('dragstart', (e) => {
      e.stopPropagation();
      const dragData = {
        type: 'conversation',
        conversationId: conv.conversationId,
        title: displayTitle,
        url: conv.url,
        isGem: conv.isGem,
        gemId: conv.gemId,
        sourceFolderId: folderId, // Track where it's being dragged from
      };
      e.dataTransfer!.setData('application/json', JSON.stringify(dragData));
      convEl.style.opacity = '0.5';
    });

    convEl.addEventListener('dragend', () => {
      convEl.style.opacity = '1';
    });

    // Conversation icon
    const icon = createIcon('chat_bubble', 'gv-conversation-icon');

    // Conversation title
    const title = document.createElement('span');
    title.className = 'gv-conversation-title gds-label-l';
    title.textContent = displayTitle;

    // Add tooltip event listeners
    title.addEventListener('mouseenter', () => this.showTooltip(title, displayTitle));
    title.addEventListener('mouseleave', () => this.hideTooltip());

    // Remove button
    const removeBtn = document.createElement('button');
    removeBtn.className = 'gv-conversation-remove-btn';
    removeBtn.appendChild(createIcon('close'));
    removeBtn.title = this.t('folder_remove_conversation');
    removeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.confirmRemoveConversation(folderId, conv.conversationId, displayTitle, e);
    });

    // Click to navigate - use SPA-style navigation like original conversations
    convEl.addEventListener('click', () => {
      // Don't capture conv object in closure - look up latest data
      this.navigateToConversationById(folderId, conv.conversationId);
    });

    // Double-click to rename
    title.addEventListener('dblclick', (e) => {
      e.stopPropagation();
      this.renameConversation(folderId, conv.conversationId, title);
    });

    convEl.appendChild(icon);
    convEl.appendChild(title);
    convEl.appendChild(removeBtn);

    return convEl;
  }

  private setupDropZone(element: HTMLElement, folderId: string): void {
    element.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.stopPropagation(); // Prevent root drop zone from also highlighting
      element.classList.add('gv-folder-dragover');
    });

    element.addEventListener('dragleave', () => {
      element.classList.remove('gv-folder-dragover');
    });

    element.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation(); // CRITICAL: Prevent event bubbling to root drop zone
      element.classList.remove('gv-folder-dragover');

      const data = e.dataTransfer?.getData('application/json');
      if (!data) return;

      try {
        const dragData: DragData = JSON.parse(data);

        // Handle different drag types
        if (dragData.type === 'folder') {
          // Handle folder drop
          this.debug('Dropping folder into folder:', dragData.title, '→', folderId);
          this.addFolderToFolder(folderId, dragData);
        } else {
          // Handle conversation drop (default behavior for backward compatibility)
          this.addConversationToFolder(folderId, dragData);
        }
      } catch (error) {
        console.error('[FolderManager] Drop error:', error);
      }
    });
  }

  private setupRootDropZone(element: HTMLElement): void {
    element.addEventListener('dragover', (e) => {
      // Allow both folder and conversation drops on the root zone
      const data = e.dataTransfer?.types.includes('application/json');
      if (!data) return;

      e.preventDefault();
      e.stopPropagation(); // Prevent parent handlers from firing
      element.classList.add('gv-folder-list-dragover');
    });

    element.addEventListener('dragleave', (e) => {
      // Check if we're leaving this element (not just entering a child)
      const rect = element.getBoundingClientRect();
      const x = (e as DragEvent).clientX;
      const y = (e as DragEvent).clientY;

      if (
        x <= rect.left ||
        x >= rect.right ||
        y <= rect.top ||
        y >= rect.bottom
      ) {
        element.classList.remove('gv-folder-list-dragover');
      }
    });

    element.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation(); // Prevent parent handlers from firing
      element.classList.remove('gv-folder-list-dragover');

      const data = e.dataTransfer?.getData('application/json');
      if (!data) return;

      try {
        const dragData: DragData = JSON.parse(data);

        // Handle different drag types at root level
        if (dragData.type === 'folder') {
          this.moveFolderToRoot(dragData);
        } else {
          // Handle conversation drop - add to root-level favorites
          this.debug('Adding conversation to root level:', dragData.title);
          this.addConversationToFolder(ROOT_CONVERSATIONS_ID, dragData);
        }
      } catch (error) {
        console.error('[FolderManager] Root drop error:', error);
      }
    });
  }

  private makeConversationsDraggable(): void {
    if (!this.sidebarContainer) return;

    // DeepSeek: 对话项是 a[href*="/a/chat/s/"] 链接
    const conversations = tryFindElements(DEEPSEEK_SELECTORS.conversationItem, this.sidebarContainer);
    conversations.forEach((conv) => this.makeConversationDraggable(conv as HTMLElement));
    this.debug('使', conversations.length, '个对话可拖拽');
  }

  /**
   * Strategy Pattern: Determine if a folder can be dragged
   * Single Responsibility Principle: Separate logic for draggability check
   *
   * A folder can be dragged if and only if:
   * - It has no subfolders (to prevent deep nesting complexity)
   *
   * @param folderId - The ID of the folder to check
   * @returns true if the folder can be dragged, false otherwise
   */
  private canFolderBeDragged(folderId: string): boolean {
    return !this.data.folders.some((f) => f.parentId === folderId);
  }

  /**
   * Strategy Pattern: Apply or remove draggable behavior based on folder state
   * Open/Closed Principle: Easy to extend with new draggable conditions
   *
   * This method ensures that folder draggability is always in sync with the current state.
   * It will enable dragging if conditions are met, or disable it if not.
   *
   * @param element - The folder header element
   * @param folder - The folder data object
   */
  private applyFolderDraggableBehavior(element: HTMLElement, folder: Folder): void {
    if (this.canFolderBeDragged(folder.id)) {
      this.enableFolderDragging(element, folder);
    } else {
      this.disableFolderDragging(element);
    }
  }

  /**
   * Enable dragging for a folder element
   * Encapsulates all logic needed to make a folder draggable
   *
   * Uses a data attribute to track drag listeners and prevent duplicates.
   * This ensures event listeners are only added once per element lifecycle.
   *
   * @param element - The folder header element
   * @param folder - The folder data object
   */
  private enableFolderDragging(element: HTMLElement, folder: Folder): void {
    // Mark element as draggable
    element.draggable = true;
    element.style.cursor = 'grab';

    // Check if drag listeners are already attached
    if (element.dataset.dragListenersAttached === 'true') {
      this.debug('Drag listeners already attached for folder:', folder.name);
      return;
    }

    // Create named event handler functions for proper cleanup
    const handleDragStart = (e: Event) => {
      e.stopPropagation(); // Prevent parent folder from being dragged

      const dragData: DragData = {
        type: 'folder',
        folderId: folder.id,
        title: folder.name,
      };

      (e as DragEvent).dataTransfer?.setData('application/json', JSON.stringify(dragData));
      element.style.opacity = '0.5';

      this.debug('Folder drag start:', folder.name, 'canBeDragged:', this.canFolderBeDragged(folder.id));
    };

    const handleDragEnd = () => {
      element.style.opacity = '1';
    };

    // Store references for potential cleanup
    (element as any)._dragStartHandler = handleDragStart;
    (element as any)._dragEndHandler = handleDragEnd;

    // Add drag event listeners
    element.addEventListener('dragstart', handleDragStart);
    element.addEventListener('dragend', handleDragEnd);

    // Mark that listeners are attached
    element.dataset.dragListenersAttached = 'true';
  }

  /**
   * Disable dragging for a folder element
   * Ensures folder cannot be dragged when it has subfolders
   *
   * Properly removes event listeners to prevent memory leaks.
   *
   * @param element - The folder header element
   */
  private disableFolderDragging(element: HTMLElement): void {
    element.draggable = false;
    element.style.cursor = '';

    // Remove drag event listeners if they exist
    if (element.dataset.dragListenersAttached === 'true') {
      const dragStartHandler = (element as any)._dragStartHandler;
      const dragEndHandler = (element as any)._dragEndHandler;

      if (dragStartHandler) {
        element.removeEventListener('dragstart', dragStartHandler);
        delete (element as any)._dragStartHandler;
      }

      if (dragEndHandler) {
        element.removeEventListener('dragend', dragEndHandler);
        delete (element as any)._dragEndHandler;
      }

      delete element.dataset.dragListenersAttached;
    }
  }

  private makeConversationDraggable(element: HTMLElement): void {
    element.draggable = true;
    element.style.cursor = 'grab';

    element.addEventListener('dragstart', (e) => {
      const title = element.querySelector('.conversation-title')?.textContent?.trim() || 'Untitled';
      const conversationId = this.extractConversationId(element);

      // Extract URL and conversation metadata together
      const conversationData = this.extractConversationData(element);

      this.debug('Drag start:', {
        title,
        isGem: conversationData.isGem,
        gemId: conversationData.gemId,
        url: conversationData.url
      });

      const dragData: DragData = {
        type: 'conversation',
        conversationId,
        title,
        url: conversationData.url,
        isGem: conversationData.isGem,
        gemId: conversationData.gemId,
      };

      e.dataTransfer?.setData('application/json', JSON.stringify(dragData));
      element.style.opacity = '0.5';
    });

    element.addEventListener('dragend', () => {
      element.style.opacity = '1';
    });
  }

  private extractConversationId(element: HTMLElement): string {
    // DeepSeek: 从 href 属性提取 UUID 格式的对话 ID
    const href = element.getAttribute('href') || '';
    const id = extractConversationId(href);
    
    if (id) {
      this.debug('提取到对话ID:', id);
      return id;
    }

    // Fallback: 生成唯一ID
    const title = element.textContent?.trim() || '';
    const index = Array.from(element.parentElement?.children || []).indexOf(element);
    const uniqueString = `${title}_${index}_${Math.random()}_${Date.now()}`;
    const fallbackId = `conv_${this.hashString(uniqueString)}`;
    this.debugWarn('无法从href提取ID，使用后备方案:', fallbackId);
    return fallbackId;
  }

  private extractConversationData(element: HTMLElement): { url: string; isGem: boolean; gemId?: string } {
    // DeepSeek: 从 href 属性提取完整 URL
    const href = element.getAttribute('href') || '';
    const conversationId = extractConversationId(href);
    
    if (conversationId) {
      const url = buildConversationUrl(conversationId);
      this.debug('构建的URL:', url);
      return { url, isGem: false };
    }

    // Fallback
    return { url: window.location.href, isGem: false };
  }

  private setupMutationObserver(): void {
    if (!this.sidebarContainer) return;

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        // Handle added conversations
        mutation.addedNodes.forEach((node) => {
          if (node instanceof HTMLElement) {
            // DeepSeek: 查找新添加的对话链接
            const conversations = tryFindElements(DEEPSEEK_SELECTORS.conversationItem, node);
            conversations.forEach((conv) => this.makeConversationDraggable(conv as HTMLElement));
          }
        });

        // Handle removed conversations
        mutation.removedNodes.forEach((node) => {
          if (node instanceof HTMLElement) {
            // DeepSeek: 检查是否是对话元素
            const isConversation = node.matches?.(DEEPSEEK_SELECTORS.conversationItem.primary);
            const conversations = isConversation
              ? [node]
              : Array.from(tryFindElements(DEEPSEEK_SELECTORS.conversationItem, node));

            conversations.forEach((conv) => {
              // 从 href 提取对话 ID
              const href = (conv as HTMLElement).getAttribute('href');
              if (href) {
                const conversationId = extractConversationId(href);
                if (conversationId) {
                  this.debug('检测到对话删除:', conversationId);
                  this.removeConversationFromAllFolders(conversationId);
                }
              }
            });
          }
        });
      });
    });

    observer.observe(this.sidebarContainer, {
      childList: true,
      subtree: true,
    });
  }

  /**
   * Setup observer to monitor sidebar open/close state
   * Hides folder container when sidebar is collapsed for better UX
   */
  private setupSideNavObserver(): void {
    const appRoot = document.querySelector('#app-root');
    if (!appRoot) {
      this.debugWarn('Could not find #app-root element for sidebar monitoring');
      return;
    }

    this.sideNavObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
          this.updateVisibilityBasedOnSideNav();
        }
      });
    });

    this.sideNavObserver.observe(appRoot, {
      attributes: true,
      attributeFilter: ['class'],
    });

    this.debug('Side nav observer setup complete');
  }

  /**
   * Check if sidebar is open and update folder container visibility
   * Sidebar is considered open when #app-root has 'side-nav-open' class
   */
  private updateVisibilityBasedOnSideNav(): void {
    const appRoot = document.querySelector('#app-root');
    if (!appRoot || !this.containerElement) return;

    const isSideNavOpen = appRoot.classList.contains('side-nav-open');

    if (isSideNavOpen) {
      this.containerElement.style.display = '';
      this.debug('Sidebar open - showing folder container');
    } else {
      this.containerElement.style.display = 'none';
      this.debug('Sidebar closed - hiding folder container');
    }
  }

  private createFolder(parentId: string | null = null): void {
    // Create inline input for folder name
    const inputContainer = document.createElement('div');
    inputContainer.className = 'gv-folder-inline-input';

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'gv-folder-name-input';
    input.placeholder = this.t('folder_name_prompt');
    input.maxLength = 50;

    const saveBtn = document.createElement('button');
    saveBtn.className = 'gv-folder-inline-btn gv-folder-inline-save';
    saveBtn.appendChild(createIcon('check'));
    saveBtn.title = this.t('pm_save');

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'gv-folder-inline-btn gv-folder-inline-cancel';
    cancelBtn.appendChild(createIcon('close'));
    cancelBtn.title = this.t('pm_cancel');

    inputContainer.appendChild(input);
    inputContainer.appendChild(saveBtn);
    inputContainer.appendChild(cancelBtn);

    const save = () => {
      const name = input.value.trim();
      if (!name) {
        inputContainer.remove();
        return;
      }

      const folder: Folder = {
        id: this.generateId(),
        name,
        parentId,
        isExpanded: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      this.data.folders.push(folder);
      this.data.folderContents[folder.id] = [];
      this.saveData();
      this.refresh();
    };

    const cancel = () => {
      inputContainer.remove();
    };

    saveBtn.addEventListener('click', save);
    cancelBtn.addEventListener('click', cancel);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') save();
      if (e.key === 'Escape') cancel();
    });

    // Insert input into the folder list
    const folderList = this.containerElement?.querySelector('.gv-folder-list');
    if (folderList) {
      if (parentId) {
        // Insert after the parent folder
        const parentFolder = folderList.querySelector(`[data-folder-id="${parentId}"]`);
        if (parentFolder) {
          const parentContent = parentFolder.querySelector('.gv-folder-content');
          if (parentContent) {
            parentContent.insertBefore(inputContainer, parentContent.firstChild);
          } else {
            parentFolder.insertAdjacentElement('afterend', inputContainer);
          }
        } else {
          folderList.appendChild(inputContainer);
        }
      } else {
        folderList.insertBefore(inputContainer, folderList.firstChild);
      }

      input.focus();
    }
  }

  private renameFolder(folderId: string): void {
    const folder = this.data.folders.find((f) => f.id === folderId);
    if (!folder) return;

    // Find the folder element
    const folderEl = this.containerElement?.querySelector(`[data-folder-id="${folderId}"]`);
    if (!folderEl) return;

    const folderNameEl = folderEl.querySelector('.gv-folder-name');
    if (!folderNameEl) return;

    // Create inline input for renaming
    const inputContainer = document.createElement('span');
    inputContainer.className = 'gv-folder-rename-inline';

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'gv-folder-rename-input';
    input.value = folder.name;
    input.maxLength = 50;

    const saveBtn = document.createElement('button');
    saveBtn.className = 'gv-folder-inline-btn gv-folder-inline-save';
    saveBtn.appendChild(createIcon('check'));

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'gv-folder-inline-btn gv-folder-inline-cancel';
    cancelBtn.appendChild(createIcon('close'));

    inputContainer.appendChild(input);
    inputContainer.appendChild(saveBtn);
    inputContainer.appendChild(cancelBtn);

    const save = () => {
      const newName = input.value.trim();
      if (!newName) {
        restore();
        return;
      }

      folder.name = newName;
      folder.updatedAt = Date.now();
      this.saveData();
      this.refresh();
    };

    const restore = () => {
      folderNameEl.textContent = folder.name;
      inputContainer.remove();
      folderNameEl.classList.remove('gv-hidden');
    };

    const cancel = () => {
      restore();
    };

    saveBtn.addEventListener('click', save);
    cancelBtn.addEventListener('click', cancel);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') save();
      if (e.key === 'Escape') cancel();
    });

    // Hide original name and show input
    folderNameEl.classList.add('gv-hidden');
    folderNameEl.parentElement?.insertBefore(inputContainer, folderNameEl.nextSibling);
    input.focus();
    input.select();
  }

  private deleteFolder(folderId: string, event?: MouseEvent): void {
    // Create inline confirmation using safe DOM API
    const confirmDialog = document.createElement('div');
    confirmDialog.className = 'gv-folder-confirm-dialog';

    // Create message element safely
    const message = document.createElement('div');
    message.className = 'gv-folder-confirm-message';
    message.textContent = this.t('folder_delete_confirm'); // Safe: uses textContent

    // Create actions container
    const actions = document.createElement('div');
    actions.className = 'gv-folder-confirm-actions';

    // Create buttons safely
    const yesBtn = document.createElement('button');
    yesBtn.className = 'gv-folder-confirm-btn gv-folder-confirm-yes';
    yesBtn.textContent = this.t('pm_delete'); // Safe: uses textContent

    const noBtn = document.createElement('button');
    noBtn.className = 'gv-folder-confirm-btn gv-folder-confirm-no';
    noBtn.textContent = this.t('pm_cancel'); // Safe: uses textContent

    // Assemble the dialog
    actions.appendChild(yesBtn);
    actions.appendChild(noBtn);
    confirmDialog.appendChild(message);
    confirmDialog.appendChild(actions);

    // Position near the folder
    const folderEl = this.containerElement?.querySelector(`[data-folder-id="${folderId}"]`);
    if (folderEl) {
      const rect = folderEl.getBoundingClientRect();
      confirmDialog.style.position = 'fixed';
      confirmDialog.style.top = `${rect.bottom + 4}px`;
      confirmDialog.style.left = `${rect.left}px`;
    }

    document.body.appendChild(confirmDialog);

    // Cleanup function
    const cleanup = () => {
      confirmDialog.remove();
    };

    yesBtn?.addEventListener('click', () => {
      // Remove folder and all subfolders recursively
      const foldersToDelete = this.getFolderAndDescendants(folderId);
      this.data.folders = this.data.folders.filter((f) => !foldersToDelete.includes(f.id));

      // Remove folder contents
      foldersToDelete.forEach((id) => {
        delete this.data.folderContents[id];
      });

      this.saveData();
      this.refresh();
      cleanup();
    });

    noBtn?.addEventListener('click', cleanup);

    // Close on click outside
    setTimeout(() => {
      const closeOnOutside = (e: MouseEvent) => {
        if (!confirmDialog.contains(e.target as Node)) {
          cleanup();
          document.removeEventListener('click', closeOnOutside);
        }
      };
      document.addEventListener('click', closeOnOutside);
    }, 0);
  }

  private getFolderAndDescendants(folderId: string): string[] {
    const result = [folderId];
    const children = this.data.folders.filter((f) => f.parentId === folderId);
    children.forEach((child) => {
      result.push(...this.getFolderAndDescendants(child.id));
    });
    return result;
  }

  private toggleFolder(folderId: string): void {
    const folder = this.data.folders.find((f) => f.id === folderId);
    if (!folder) return;

    folder.isExpanded = !folder.isExpanded;
    folder.updatedAt = Date.now();
    this.saveData();
    this.refresh();
  }

  private togglePinFolder(folderId: string): void {
    const folder = this.data.folders.find((f) => f.id === folderId);
    if (!folder) return;

    folder.pinned = !folder.pinned;
    folder.updatedAt = Date.now();
    this.saveData();
    this.refresh();
  }

  /**
   * Sort folders with pinned folders first, then by name using localized collation
   */
  private sortFolders(folders: Folder[]): Folder[] {
    return [...folders].sort((a, b) => {
      // Pinned folders always come first
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;

      // Within the same pinned state, sort by name using localized comparison
      return a.name.localeCompare(b.name, undefined, {
        numeric: true,
        sensitivity: 'base',
      });
    });
  }

  private addConversationToFolder(folderId: string, dragData: DragData & { sourceFolderId?: string }): void {
    this.debug('Adding conversation to folder:', {
      folderId,
      dragData,
    });

    if (!this.data.folderContents[folderId]) {
      this.data.folderContents[folderId] = [];
    }

    // Check if conversation is already in this folder
    const exists = this.data.folderContents[folderId].some(
      (c) => c.conversationId === dragData.conversationId
    );

    if (exists) {
      this.debug('Conversation already in folder:', dragData.conversationId);
      this.debug('Existing conversations:', this.data.folderContents[folderId]);
      return;
    }

    const conv: ConversationReference = {
      conversationId: dragData.conversationId!,
      title: dragData.title,
      url: dragData.url!,
      addedAt: Date.now(),
      isGem: dragData.isGem,
      gemId: dragData.gemId,
    };

    this.data.folderContents[folderId].push(conv);
    this.debug('Conversation added. Total in folder:', this.data.folderContents[folderId].length);

    // If this was dragged from another folder, remove it from the source
    if (dragData.sourceFolderId && dragData.sourceFolderId !== folderId) {
      this.debug('Moving from folder:', dragData.sourceFolderId);
      this.removeConversationFromFolder(dragData.sourceFolderId, dragData.conversationId!);
      // Note: removeConversationFromFolder calls saveData() and refresh(), so we don't need to call them again
      return;
    }

    this.saveData();
    this.refresh();
  }

  private addFolderToFolder(targetFolderId: string, dragData: DragData): void {
    const draggedFolderId = dragData.folderId;
    if (!draggedFolderId) return;

    this.debug('Moving folder to folder:', {
      draggedFolderId,
      targetFolderId,
    });

    // Prevent dropping a folder onto itself
    if (draggedFolderId === targetFolderId) {
      this.debug('Cannot drop folder onto itself');
      return;
    }

    // Prevent dropping a folder onto its descendant (would create a cycle)
    if (this.isFolderDescendant(targetFolderId, draggedFolderId)) {
      this.debug('Cannot drop folder onto its descendant');
      return;
    }

    // Find the dragged folder
    const draggedFolder = this.data.folders.find((f) => f.id === draggedFolderId);
    if (!draggedFolder) return;

    // Update the parent
    draggedFolder.parentId = targetFolderId;
    draggedFolder.updatedAt = Date.now();

    this.saveData();
    this.refresh();
  }

  private moveFolderToRoot(dragData: DragData): void {
    const draggedFolderId = dragData.folderId;
    if (!draggedFolderId) return;

    this.debug('Moving folder to root level:', draggedFolderId);

    // Find the dragged folder
    const draggedFolder = this.data.folders.find((f) => f.id === draggedFolderId);
    if (!draggedFolder) return;

    // If already at root level, no need to do anything
    if (draggedFolder.parentId === null) {
      this.debug('Folder is already at root level');
      return;
    }

    // Update the parent to null (root level)
    draggedFolder.parentId = null;
    draggedFolder.updatedAt = Date.now();

    this.saveData();
    this.refresh();
  }

  private isFolderDescendant(folderId: string, potentialAncestorId: string): boolean {
    // Check if potentialAncestorId is an ancestor of folderId
    let currentId: string | null = folderId;
    while (currentId) {
      if (currentId === potentialAncestorId) {
        return true;
      }
      const folder = this.data.folders.find((f) => f.id === currentId);
      currentId = folder?.parentId || null;
    }
    return false;
  }

  private confirmRemoveConversation(
    folderId: string,
    conversationId: string,
    title: string,
    event: MouseEvent
  ): void {
    // Create inline confirmation dialog using safe DOM API
    const confirmDialog = document.createElement('div');
    confirmDialog.className = 'gv-folder-confirm-dialog';

    // Create message element safely with user-provided title
    const message = document.createElement('div');
    message.className = 'gv-folder-confirm-message';
    // Safe: textContent prevents XSS even with user-controlled title
    message.textContent = this.t('folder_remove_conversation_confirm').replace('{title}', title);

    // Create actions container
    const actions = document.createElement('div');
    actions.className = 'gv-folder-confirm-actions';

    // Create buttons safely
    const yesBtn = document.createElement('button');
    yesBtn.className = 'gv-folder-confirm-btn gv-folder-confirm-yes';
    yesBtn.textContent = this.t('pm_delete'); // Safe: uses textContent

    const noBtn = document.createElement('button');
    noBtn.className = 'gv-folder-confirm-btn gv-folder-confirm-no';
    noBtn.textContent = this.t('pm_cancel'); // Safe: uses textContent

    // Assemble the dialog
    actions.appendChild(yesBtn);
    actions.appendChild(noBtn);
    confirmDialog.appendChild(message);
    confirmDialog.appendChild(actions);

    // Position near the clicked element
    const rect = (event.target as HTMLElement).getBoundingClientRect();
    confirmDialog.style.position = 'fixed';
    confirmDialog.style.top = `${rect.bottom + 4}px`;
    confirmDialog.style.left = `${Math.min(rect.left, window.innerWidth - 280)}px`;

    document.body.appendChild(confirmDialog);

    // Cleanup function
    const cleanup = () => {
      confirmDialog.remove();
    };

    yesBtn?.addEventListener('click', () => {
      this.removeConversationFromFolder(folderId, conversationId);
      cleanup();
    });

    noBtn?.addEventListener('click', cleanup);

    // Close on click outside
    setTimeout(() => {
      const closeOnOutside = (e: MouseEvent) => {
        if (!confirmDialog.contains(e.target as Node)) {
          cleanup();
          document.removeEventListener('click', closeOnOutside);
        }
      };
      document.addEventListener('click', closeOnOutside);
    }, 0);
  }

  private removeConversationFromFolder(folderId: string, conversationId: string): void {
    if (!this.data.folderContents[folderId]) return;

    this.data.folderContents[folderId] = this.data.folderContents[folderId].filter(
      (c) => c.conversationId !== conversationId
    );

    this.saveData();
    this.refresh();
  }

  private renameConversation(folderId: string, conversationId: string, titleElement: HTMLElement): void {
    // Get current title
    const conv = this.data.folderContents[folderId]?.find((c) => c.conversationId === conversationId);
    if (!conv) return;

    const currentTitle = conv.title;

    // Create inline input for renaming
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'gv-folder-name-input gv-conversation-rename-input';
    input.value = currentTitle;
    input.style.width = '100%';

    // Replace title with input
    const parent = titleElement.parentElement;
    if (!parent) return;

    titleElement.style.display = 'none';
    parent.insertBefore(input, titleElement);
    input.focus();
    input.select();

    const save = () => {
      const newTitle = input.value.trim();
      if (newTitle && newTitle !== currentTitle) {
        conv.title = newTitle;
        this.saveData();
      }
      input.remove();
      titleElement.style.display = '';
      titleElement.textContent = conv.title;
    };

    const cancel = () => {
      input.remove();
      titleElement.style.display = '';
    };

    input.addEventListener('blur', save);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        save();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        cancel();
      }
    });
  }

  private showFolderMenu(event: MouseEvent, folderId: string): void {
    event.stopPropagation();

    const folder = this.data.folders.find((f) => f.id === folderId);
    if (!folder) return;

    // Create context menu
    const menu = document.createElement('div');
    menu.className = 'gv-folder-menu';
    menu.style.position = 'fixed';
    menu.style.left = `${event.clientX}px`;
    menu.style.top = `${event.clientY}px`;

    const menuItems = [
      {
        label: folder.pinned ? this.t('folder_unpin') : this.t('folder_pin'),
        action: () => this.togglePinFolder(folderId)
      },
      { label: this.t('folder_create_subfolder'), action: () => this.createFolder(folderId) },
      { label: this.t('folder_rename'), action: () => this.renameFolder(folderId) },
      { label: this.t('folder_delete'), action: () => this.deleteFolder(folderId) },
    ];

    menuItems.forEach((item) => {
      const menuItem = document.createElement('button');
      menuItem.className = 'gv-folder-menu-item';
      menuItem.textContent = item.label;
      menuItem.addEventListener('click', () => {
        item.action();
        menu.remove();
      });
      menu.appendChild(menuItem);
    });

    document.body.appendChild(menu);

    // Close menu on click outside
    const closeMenu = (e: MouseEvent) => {
      if (!menu.contains(e.target as Node)) {
        menu.remove();
        document.removeEventListener('click', closeMenu);
      }
    };
    setTimeout(() => document.addEventListener('click', closeMenu), 0);
  }

  private showMoveToFolderDialog(conversationId: string, conversationTitle: string, url: string, isGem?: boolean, gemId?: string): void {
    // Create dialog overlay
    const overlay = document.createElement('div');
    overlay.className = 'gv-folder-dialog-overlay';

    // Create dialog
    const dialog = document.createElement('div');
    dialog.className = 'gv-folder-dialog';

    // Dialog title
    const dialogTitle = document.createElement('div');
    dialogTitle.className = 'gv-folder-dialog-title';
    dialogTitle.textContent = this.t('conversation_move_to_folder_title');

    // Folder list
    const folderList = document.createElement('div');
    folderList.className = 'gv-folder-dialog-list';

    // Helper function to add folder options recursively
    const addFolderOptions = (parentId: string | null, level: number = 0) => {
      const folders = this.data.folders.filter((f) => f.parentId === parentId);
      folders.forEach((folder) => {
        const folderItem = document.createElement('button');
        folderItem.className = 'gv-folder-dialog-item';
        folderItem.style.paddingLeft = `${level * 16 + 12}px`;

        // Folder icon
        const icon = createIcon('folder', 'gv-folder-icon');

        // Folder name
        const name = document.createElement('span');
        name.textContent = folder.name;

        folderItem.appendChild(icon);
        folderItem.appendChild(name);

        folderItem.addEventListener('click', () => {
          this.addConversationToFolderFromNative(folder.id, conversationId, conversationTitle, url, isGem, gemId);
          overlay.remove();
        });

        folderList.appendChild(folderItem);

        // Add subfolders recursively
        addFolderOptions(folder.id, level + 1);
      });
    };

    // Add root folders and their children
    addFolderOptions(null);

    // Cancel button
    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'gv-folder-dialog-cancel';
    cancelBtn.textContent = this.t('pm_cancel');
    cancelBtn.addEventListener('click', () => overlay.remove());

    // Assemble dialog
    dialog.appendChild(dialogTitle);
    dialog.appendChild(folderList);
    dialog.appendChild(cancelBtn);
    overlay.appendChild(dialog);

    // Add to body
    document.body.appendChild(overlay);

    // Close on overlay click
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        overlay.remove();
      }
    });
  }

  private moveConversationToFolder(
    sourceFolderId: string,
    targetFolderId: string,
    conv: ConversationReference
  ): void {
    // Remove from source folder
    if (this.data.folderContents[sourceFolderId]) {
      this.data.folderContents[sourceFolderId] = this.data.folderContents[sourceFolderId].filter(
        (c) => c.conversationId !== conv.conversationId
      );
    }

    // Add to target folder
    if (!this.data.folderContents[targetFolderId]) {
      this.data.folderContents[targetFolderId] = [];
    }

    // Check if conversation already exists in target folder
    const existingIndex = this.data.folderContents[targetFolderId].findIndex(
      (c) => c.conversationId === conv.conversationId
    );

    if (existingIndex === -1) {
      // Add with updated timestamp
      this.data.folderContents[targetFolderId].push({
        ...conv,
        addedAt: Date.now(),
      });
    }

    this.saveData();
    this.refresh();
  }

  private addConversationToFolderFromNative(
    folderId: string,
    conversationId: string,
    title: string,
    url: string,
    isGem?: boolean,
    gemId?: string
  ): void {
    // Add to folder
    if (!this.data.folderContents[folderId]) {
      this.data.folderContents[folderId] = [];
    }

    // Check if conversation already exists in folder
    const existingIndex = this.data.folderContents[folderId].findIndex(
      (c) => c.conversationId === conversationId
    );

    if (existingIndex === -1) {
      // Add new conversation
      this.data.folderContents[folderId].push({
        conversationId,
        title,
        url,
        addedAt: Date.now(),
        isGem,
        gemId,
      });
    }

    this.saveData();
    this.refresh();
  }

  private setupNativeConversationMenuObserver(): void {
    // Observe the document for menu appearance and disappearance
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        // Handle added nodes (menu opening)
        mutation.addedNodes.forEach((node) => {
          if (node instanceof HTMLElement) {
            // Check if this is the native conversation menu
            const menuContent = node.querySelector('.mat-mdc-menu-content');
            if (menuContent && !menuContent.querySelector('.gv-move-to-folder-btn')) {
              // Check if this is a conversation menu (not model selection menu or other menus)
              if (this.isConversationMenu(node)) {
                this.debug('Observer: conversation menu detected, preparing to inject');
                this.injectMoveToFolderButton(menuContent as HTMLElement);
              } else {
                this.debug('Observer: non-conversation menu detected, skipping injection');
              }
            } else if (menuContent) {
              this.debug('Observer: menu content detected but button already present');
            }
          }
        });

        // Handle removed nodes (menu closing)
        mutation.removedNodes.forEach((node) => {
          if (node instanceof HTMLElement) {
            // Check if a menu panel was removed
            const isMenuPanel = node.classList?.contains('mat-mdc-menu-panel') ||
                               node.querySelector('.mat-mdc-menu-panel');
            if (isMenuPanel) {
              this.debug('Observer: menu closed, clearing conversation state');
              this.lastClickedConversation = null;
              this.lastClickedConversationInfo = null;
            }
          }
        });
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  private isConversationMenu(menuElement: HTMLElement): boolean {
    // Check if this is NOT a model selection menu or other non-conversation menus
    const menuPanel = menuElement.querySelector('.mat-mdc-menu-panel');

    // Exclude model selection menu (has gds-mode-switch-menu class)
    if (menuPanel?.classList.contains('gds-mode-switch-menu')) {
      this.debug('isConversationMenu: detected model selection menu');
      return false;
    }

    // Exclude menus with bard-mode-list-button (model selection)
    if (menuElement.querySelector('.bard-mode-list-button')) {
      this.debug('isConversationMenu: detected bard mode list menu');
      return false;
    }

    // Check for conversation-specific elements
    const menuContent = menuElement.querySelector('.mat-mdc-menu-content');
    if (!menuContent) return false;

    // Look for conversation menu indicators:
    // 1. Pin button (common in conversation menus)
    // 2. Rename/delete conversation buttons
    // 3. Share conversation button
    const hasPinButton = menuContent.querySelector('[data-test-id="pin-button"]');
    const hasRenameButton = menuContent.querySelector('[data-test-id="rename-button"]');
    const hasShareButton = menuContent.querySelector('[data-test-id="share-button"]');
    const hasDeleteButton = menuContent.querySelector('[data-test-id="delete-button"]');

    // If any conversation-specific button exists, it's a conversation menu
    if (hasPinButton || hasRenameButton || hasShareButton || hasDeleteButton) {
      this.debug('isConversationMenu: found conversation-specific buttons');
      return true;
    }

    // If we have a lastClickedConversation, we can assume it's a conversation menu
    if (this.lastClickedConversation) {
      this.debug('isConversationMenu: lastClickedConversation exists');
      return true;
    }

    // Default to false if we can't determine
    this.debug('isConversationMenu: could not determine menu type, defaulting to false');
    return false;
  }

  private injectMoveToFolderButton(menuContent: HTMLElement): void {
    this.debug('injectMoveToFolderButton: begin');

    // First, try to use pre-extracted conversation info (most reliable)
    let conversationId: string | null = null;
    let title: string | null = null;
    let url: string | null = null;

    if (this.lastClickedConversationInfo) {
      this.debug('Using pre-extracted conversation info');
      conversationId = this.lastClickedConversationInfo.id;
      title = this.lastClickedConversationInfo.title;
      url = this.lastClickedConversationInfo.url;
    } else {
      // Fallback: try to extract from conversation element
      this.debug('No pre-extracted info, falling back to extraction from element');
      const conversationEl = this.findConversationElementFromMenu();
      if (!conversationEl) {
        this.debug('No conversation element found from menu');
        return;
      }

      conversationId = this.extractNativeConversationId(conversationEl);
      title = this.extractNativeConversationTitle(conversationEl);
      url = this.extractNativeConversationUrl(conversationEl);
    }

    // DeepSeek: 如果仍然缺少信息，使用后备方案
    if (!url && conversationId) {
      url = buildConversationUrl(conversationId);
      this.debug('injectMoveToFolderButton: 从ID构建URL', url);
    }

    // Title fallback
    if ((!title || title.trim() === '') && this.lastClickedConversation) {
      title = this.extractFallbackTitle(this.lastClickedConversation) || 'Untitled';
      this.debug('injectMoveToFolderButton: using fallback title', title);
    }

    this.debug('Extracted conversation info:', { conversationId, title, url });

    if (!conversationId || !title || !url) {
      this.debugWarn('Missing conversation info:', { conversationId, title, url });
      return;
    }

    // Create the menu item
    const menuItem = document.createElement('button');
    menuItem.className = 'mat-mdc-menu-item mat-focus-indicator gv-move-to-folder-btn';
    menuItem.setAttribute('role', 'menuitem');
    menuItem.setAttribute('tabindex', '0');
    menuItem.setAttribute('aria-disabled', 'false');

    // Icon
    const icon = createIcon('folder_open', 'gv-menu-icon');

    // Text
    const textSpan = document.createElement('span');
    textSpan.className = 'mat-mdc-menu-item-text';
    const innerSpan = document.createElement('span');
    innerSpan.className = 'gds-body-m';
    innerSpan.textContent = this.t('conversation_move_to_folder');
    textSpan.appendChild(innerSpan);

    // Ripple effect
    const ripple = document.createElement('div');
    ripple.className = 'mat-ripple mat-mdc-menu-ripple';
    ripple.setAttribute('matripple', '');

    menuItem.appendChild(icon);
    menuItem.appendChild(textSpan);
    menuItem.appendChild(ripple);

    // Add click handler
    menuItem.addEventListener('click', (e) => {
      e.stopPropagation();
      this.showMoveToFolderDialog(conversationId, title, url);
      // Close the menu
      const menu = menuContent.closest('.mat-mdc-menu-panel');
      if (menu) {
        menu.remove();
      }
    });

    // Insert after the pin button if it exists, otherwise insert at the beginning
    const pinButton = menuContent.querySelector('[data-test-id="pin-button"]');
    if (pinButton && pinButton.nextSibling) {
      this.debug('injectMoveToFolderButton: inserting after pin-button');
      menuContent.insertBefore(menuItem, pinButton.nextSibling);
    } else {
      this.debug('injectMoveToFolderButton: inserting at beginning of menu');
      menuContent.insertBefore(menuItem, menuContent.firstChild);
    }
  }

  private findConversationElementFromMenu(): HTMLElement | null {
    // Use the element captured on click
    if (this.lastClickedConversation) {
      this.debug('findConversationElementFromMenu: using lastClickedConversation');
      return this.lastClickedConversation;
    }

    // No fallback - if we don't have the clicked conversation element, we should not guess
    // The previous fallback logic using '.conversation-actions-container.selected' was incorrect
    // as it would select the currently focused conversation instead of the one user clicked
    this.debugWarn('findConversationElementFromMenu: no conversation element found (lastClickedConversation is null)');
    return null;
  }

  private lastClickedConversation: HTMLElement | null = null;
  private lastClickedConversationInfo: { id: string; title: string; url: string } | null = null;

  private setupConversationClickTracking(): void {
    // Track clicks on conversation more buttons
    document.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const moreButton = target.closest('[data-test-id="actions-menu-button"]');
      if (moreButton) {
        this.debug('More button clicked:', moreButton);

        let conversationEl: HTMLElement | null = null;

        // Strategy 1: In Gemini's new UI, the conversation div and actions-menu-button are siblings!
        // Find the actions container first, then look for sibling conversation div
        const actionsContainer = moreButton.closest('.conversation-actions-container');
        if (actionsContainer) {
          this.debug('Found actions container, looking for sibling conversation...');
          // Look for previous sibling with data-test-id="conversation"
          let sibling = actionsContainer.previousElementSibling;
          while (sibling) {
            if (sibling.getAttribute('data-test-id') === 'conversation') {
              conversationEl = sibling as HTMLElement;
              this.debug('Found conversation as sibling:', conversationEl);
              break;
            }
            sibling = sibling.previousElementSibling;
          }
        }

        // Strategy 2: Try traditional closest approach (for older UI patterns)
        if (!conversationEl) {
          this.debug('Trying closest with conversation selector...');
          conversationEl = moreButton.closest('[data-test-id="conversation"]') as HTMLElement | null;
        }

        if (!conversationEl) {
          this.debug('Trying history-item selector...');
          conversationEl = moreButton.closest('[data-test-id^="history-item"]') as HTMLElement | null;
        }

        if (!conversationEl) {
          this.debug('Trying conversation-card selector...');
          conversationEl = moreButton.closest('.conversation-card') as HTMLElement | null;
        }

        // Strategy 3: Check parent container for conversation children
        if (!conversationEl && actionsContainer && actionsContainer.parentElement) {
          this.debug('Trying to find conversation in parent container...');
          const parentContainer = actionsContainer.parentElement;
          const conversationInParent = parentContainer.querySelector('[data-test-id="conversation"]') as HTMLElement | null;
          if (conversationInParent) {
            // Verify this is the right conversation by checking it's close to the actions container
            const actionsIndex = Array.from(parentContainer.children).indexOf(actionsContainer);
            const convIndex = Array.from(parentContainer.children).indexOf(conversationInParent);
            if (Math.abs(actionsIndex - convIndex) <= 1) {
              conversationEl = conversationInParent;
              this.debug('Found conversation in parent container');
            }
          }
        }

        // Last resort fallback
        if (!conversationEl) {
          this.debugWarn('Could not find precise conversation element, using broader fallback');
          conversationEl = moreButton.closest('[jslog]') as HTMLElement | null;
        }

        if (conversationEl) {
          this.lastClickedConversation = conversationEl as HTMLElement;

          // Debug: verify this element and show its attributes
          const linkCount = conversationEl.querySelectorAll('a[href*="/app/"], a[href*="/gem/"]').length;
          const jslogAttr = conversationEl.getAttribute('jslog');
          const dataTestId = conversationEl.getAttribute('data-test-id');
          this.debug('Tracked conversation element:', {
            element: conversationEl,
            linkCount,
            jslog: jslogAttr,
            dataTestId
          });

          // Extract conversation info immediately to avoid issues with multiple links later
          const conversationId = this.extractNativeConversationId(conversationEl);
          const title = this.extractNativeConversationTitle(conversationEl);
          const url = this.extractNativeConversationUrl(conversationEl);

          if (conversationId && title && url) {
            this.lastClickedConversationInfo = { id: conversationId, title, url };
            this.debug('✅ Extracted conversation info on click:', this.lastClickedConversationInfo);
          } else {
            this.debugWarn('⚠️ Failed to extract complete conversation info on click', { conversationId, title, url });
            this.lastClickedConversationInfo = null;
          }

          // Fallback: after the click, the Angular Material menu is rendered
          // into a global overlay container. Poll briefly to inject our item
          // even if the mutation observer misses the insertion.
          let attempts = 0;
          const maxAttempts = 20; // ~1s at 50ms intervals
          const timer = window.setInterval(() => {
            attempts++;
            const menuContent = document.querySelector('.mat-mdc-menu-panel .mat-mdc-menu-content') as HTMLElement | null;
            if (menuContent) {
              this.debug('Overlay poll: menu content found on attempt', attempts);
              if (!menuContent.querySelector('.gv-move-to-folder-btn')) {
                this.debug('Overlay poll: injecting Move to Folder');
                this.injectMoveToFolderButton(menuContent);
              }
              window.clearInterval(timer);
            } else if (attempts >= maxAttempts) {
              this.debugWarn('Overlay poll: menu not found within attempts', maxAttempts);
              window.clearInterval(timer);
            }
          }, 50);
        }
      }
    }, true);
  }

  private extractNativeConversationId(conversationEl: HTMLElement): string | null {
    // DeepSeek: 从 href 属性提取 UUID
    const href = conversationEl.getAttribute('href') || '';
    const id = extractConversationId(href);
    
    if (id) {
      this.debug('extractId: 提取到', id);
      return id;
    }
    
    this.debugWarn('extractId: 无法从 href 提取 ID');
    return null;
  }

  private extractNativeConversationTitle(conversationEl: HTMLElement): string | null {
    // DeepSeek: 对话标题在链接元素内部
    const titleEl = tryFindElement(DEEPSEEK_SELECTORS.conversationTitle, conversationEl);
    if (titleEl) {
      const title = titleEl.textContent?.trim();
      if (title) {
        this.debug('提取标题:', title);
        return title;
      }
    }

    // Fallback: 从链接文本提取
    const linkText = conversationEl.textContent?.trim();
    if (linkText) {
      this.debug('从链接文本提取标题:', linkText);
      return linkText;
    }

    // Fallback: 从 aria-label 提取
    const ariaLabel = conversationEl.getAttribute('aria-label')?.trim();
    if (ariaLabel) {
      this.debug('从 aria-label 提取标题:', ariaLabel);
      return ariaLabel;
    }

    this.debug('无法提取标题');
    return null;
  }

  private syncConversationTitleFromNative(conversationId: string): string | null {
    try {
      // DeepSeek: 从侧边栏查找对话并提取标题
      const conversations = tryFindElements(DEEPSEEK_SELECTORS.conversationItem, document);
      for (const convEl of Array.from(conversations)) {
        const href = (convEl as HTMLElement).getAttribute('href');
        if (href && href.includes(conversationId)) {
          // 找到匹配的对话，提取标题
          const currentTitle = this.extractNativeConversationTitle(convEl as HTMLElement);
          if (currentTitle) {
            this.debug('从原生侧边栏同步标题:', currentTitle);
            return currentTitle;
          }
        }
      }
    } catch (e) {
      this.debug('同步标题时出错:', e);
    }
    return null;
  }

  private updateConversationTitle(conversationId: string, newTitle: string): void {
    // Update the title for all instances of this conversation across all folders
    let updated = false;

    for (const folderId in this.data.folderContents) {
      const conversations = this.data.folderContents[folderId];
      for (const conv of conversations) {
        // Match by conversation ID (check both direct match and URL match)
        if (conv.conversationId === conversationId || conv.url.includes(conversationId)) {
          conv.title = newTitle;
          updated = true;
          this.debug(`Updated title for conversation ${conversationId} in folder ${folderId}`);
        }
      }
    }

    if (updated) {
      this.saveData();
      // Re-render folders to show updated title
      this.renderAllFolders();
    }
  }

  private removeConversationFromAllFolders(conversationId: string): void {
    // Remove this conversation from all folders when the original conversation is deleted
    let removed = false;

    for (const folderId in this.data.folderContents) {
      const conversations = this.data.folderContents[folderId];
      const initialLength = conversations.length;

      // Filter out the deleted conversation
      this.data.folderContents[folderId] = conversations.filter(
        (conv) => conv.conversationId !== conversationId && !conv.url.includes(conversationId)
      );

      if (this.data.folderContents[folderId].length < initialLength) {
        removed = true;
        this.debug(`Removed deleted conversation ${conversationId} from folder ${folderId}`);
      }
    }

    if (removed) {
      this.saveData();
      // Re-render folders to reflect the removal
      this.renderAllFolders();
    }
  }

  // DeepSeek: 不需要这些 Gemini 特定的辅助方法
  // 已移除: extractHexIdFromJslog, extractHexIdFromMenu, buildConversationUrlFromId

  // DeepSeek: 简化的备用标题提取方法
  private extractFallbackTitle(conversationEl: HTMLElement): string | null {
    try {
      // 尝试从常见属性提取
      const aria = conversationEl.getAttribute('aria-label');
      if (aria && aria.trim()) {
        return aria.trim();
      }
      
      const titleAttr = conversationEl.getAttribute('title');
      if (titleAttr && titleAttr.trim()) {
        return titleAttr.trim();
      }
      
      // 从文本内容提取
      const text = conversationEl.textContent?.trim() || '';
      if (text) {
        const firstLine = text.split('\n')[0]?.trim() || text;
        return firstLine.slice(0, 80);
      }
    } catch (e) {
      this.debugWarn('extractFallbackTitle error:', e);
    }
    return null;
  }

  private extractNativeConversationUrl(conversationEl: HTMLElement): string | null {
    // DeepSeek: 对话元素本身就是链接
    const href = conversationEl.getAttribute('href');
    if (!href) {
      this.debugWarn('extractUrl: no href found');
      return null;
    }
    
    const full = href.startsWith('http') ? href : `https://chat.deepseek.com${href}`;
    this.debug('extractUrl:', full);
    return full;
  }

  private refresh(): void {
    if (!this.containerElement) return;

    // Find and update the folders list
    const oldList = this.containerElement.querySelector('.gv-folder-list');
    if (oldList) {
      const newList = this.createFoldersList();
      oldList.replaceWith(newList);
    }
  }

  private loadData(): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        this.data = JSON.parse(stored);
      }
    } catch (error) {
      console.error('[FolderManager] Load data error:', error);
    }
  }

  private saveData(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
    } catch (error) {
      console.error('[FolderManager] Save data error:', error);
    }
  }

  private generateId(): string {
    return `folder_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }

  private navigateToConversationById(folderId: string, conversationId: string): void {
    // Look up the latest conversation data from storage
    const conv = this.data.folderContents[folderId]?.find((c) => c.conversationId === conversationId);
    if (!conv) {
      console.error('[FolderManager] Conversation not found:', conversationId);
      return;
    }

    this.debug('Navigating to conversation:', {
      title: conv.title,
      url: conv.url,
      isGem: conv.isGem,
      gemId: conv.gemId,
    });

    this.navigateToConversation(conv.url, conv);
  }

  private navigateToConversation(url: string, conversation?: ConversationReference): void {
    // DeepSeek: 使用 SPA 风格导航
    try {
      const targetUrl = new URL(url);
      const conversationId = extractConversationId(targetUrl.pathname);

      if (!conversationId) {
        this.debug('无法从URL提取对话ID:', url);
        window.location.href = url;
        return;
      }

      // 尝试找到并点击侧边栏的对话链接
      const conversations = tryFindElements(DEEPSEEK_SELECTORS.conversationItem, this.sidebarContainer!);
      for (const conv of Array.from(conversations)) {
        const href = (conv as HTMLElement).getAttribute('href');
        if (href && href.includes(conversationId)) {
          // 找到匹配的对话，点击它触发导航
          (conv as HTMLElement).click();
          this.debug('通过点击侧边栏元素导航');

          // 导航后同步标题
          setTimeout(() => {
            if (conversation) {
              const syncedTitle = this.syncConversationTitleFromNative(conversationId);
              if (syncedTitle && syncedTitle !== conversation.title) {
                this.updateConversationTitle(conversationId, syncedTitle);
                this.debug('导航后更新对话标题:', syncedTitle);
              }
            }
          }, 300);

          return;
        }
      }

      // 如果找不到侧边栏元素，使用 History API
      this.debug('未找到侧边栏元素，尝试使用 pushState');
      window.history.pushState({}, '', url);
      window.dispatchEvent(new PopStateEvent('popstate', { state: {} }));

      // 如果 pushState 不生效，回退到完整页面跳转
      setTimeout(() => {
        if (window.location.pathname !== targetUrl.pathname) {
          this.debug('回退到完整页面跳转');
          window.location.href = url;
        }
      }, 200);
    } catch (error) {
      console.error('[FolderManager] 导航错误:', error);
      window.location.href = url;
    }
  }

  // DeepSeek: 不需要此方法，因为没有 Gem 功能
  // 保留空实现以避免破坏现有代码
  private checkAndUpdateGemId(hexId: string): void {
    // DeepSeek does not have Gem feature, method kept for compatibility
  }

  private renderAllFolders(): void {
    if (!this.containerElement) return;

    // Find the existing folders list
    const existingList = this.containerElement.querySelector('.gv-folder-list');
    if (!existingList) return;

    // Create a new folders list
    const newList = this.createFoldersList();

    // Replace the old list with the new one
    existingList.replaceWith(newList);

    this.debug('Re-rendered all folders');
  }

  private t(key: string): string {
    // Use the centralized i18n system that respects user's language preference
    return getTranslationSync(key);
  }

  // Tooltip methods
  private createTooltip(): void {
    this.tooltipElement = document.createElement('div');
    this.tooltipElement.className = 'gv-tooltip';
    document.body.appendChild(this.tooltipElement);
  }

  private showTooltip(element: HTMLElement, text: string): void {
    if (!this.tooltipElement) return;

    // Clear any existing timeout
    if (this.tooltipTimeout) {
      clearTimeout(this.tooltipTimeout);
    }

    // Check if text is truncated
    const isTruncated = element.scrollWidth > element.clientWidth;
    if (!isTruncated) return;

    // Show tooltip after a short delay (200ms)
    this.tooltipTimeout = window.setTimeout(() => {
      if (!this.tooltipElement) return;

      this.tooltipElement.textContent = text;

      // Position tooltip
      const rect = element.getBoundingClientRect();
      const tooltipRect = this.tooltipElement.getBoundingClientRect();

      let left = rect.left;
      let top = rect.bottom + 8;

      // Adjust if tooltip goes off screen
      if (left + tooltipRect.width > window.innerWidth) {
        left = window.innerWidth - tooltipRect.width - 10;
      }
      if (top + tooltipRect.height > window.innerHeight) {
        top = rect.top - tooltipRect.height - 8;
      }

      this.tooltipElement.style.left = `${left}px`;
      this.tooltipElement.style.top = `${top}px`;

      // Trigger reflow for animation
      this.tooltipElement.offsetHeight;
      this.tooltipElement.classList.add('show');
    }, 200);
  }

  private hideTooltip(): void {
    if (this.tooltipTimeout) {
      clearTimeout(this.tooltipTimeout);
      this.tooltipTimeout = null;
    }
    if (this.tooltipElement) {
      this.tooltipElement.classList.remove('show');
    }
  }

  // Export/Import methods
  private exportFolders(): void {
    // Prevent concurrent exports
    if (this.exportInProgress) {
      this.showNotification(this.t('folder_export_in_progress') || 'Export already in progress', 'info');
      return;
    }

    this.exportInProgress = true;

    try {
      // Type assertion to match the service's expected type
      const payload = FolderImportExportService.exportToPayload(this.data as any);
      FolderImportExportService.downloadJSON(payload);
      this.showNotification(this.t('folder_export_success'), 'success');
      this.debug('Folders exported successfully');
    } catch (error) {
      console.error('[FolderManager] Export error:', error);
      this.showNotification(
        this.t('folder_import_error').replace('{error}', String(error)),
        'error'
      );
    } finally {
      // Always release the lock
      this.exportInProgress = false;
    }
  }

  private showImportDialog(): void {
    // Create dialog overlay
    const overlay = document.createElement('div');
    overlay.className = 'gv-folder-dialog-overlay';

    // Create dialog
    const dialog = document.createElement('div');
    dialog.className = 'gv-folder-import-dialog';

    // Dialog title
    const dialogTitle = document.createElement('div');
    dialogTitle.className = 'gv-folder-dialog-title';
    dialogTitle.textContent = this.t('folder_import_title');

    // Strategy selection
    const strategyContainer = document.createElement('div');
    strategyContainer.className = 'gv-folder-import-strategy';

    const strategyLabel = document.createElement('div');
    strategyLabel.className = 'gv-folder-import-strategy-label';
    strategyLabel.textContent = this.t('folder_import_strategy');

    const strategyOptions = document.createElement('div');
    strategyOptions.className = 'gv-folder-import-strategy-options';

    const mergeOption = this.createRadioOption('merge', this.t('folder_import_merge'), true);
    const overwriteOption = this.createRadioOption('overwrite', this.t('folder_import_overwrite'), false);

    strategyOptions.appendChild(mergeOption);
    strategyOptions.appendChild(overwriteOption);

    strategyContainer.appendChild(strategyLabel);
    strategyContainer.appendChild(strategyOptions);

    // File input
    const fileInputContainer = document.createElement('div');
    fileInputContainer.className = 'gv-folder-import-file-input';

    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.json,application/json';
    fileInput.style.display = 'none';

    const fileButton = document.createElement('button');
    fileButton.className = 'gv-folder-import-file-button';
    fileButton.textContent = this.t('folder_import_select_file');
    fileButton.addEventListener('click', () => fileInput.click());

    const fileName = document.createElement('div');
    fileName.className = 'gv-folder-import-file-name';
    fileName.textContent = '';

    fileInput.addEventListener('change', () => {
      if (fileInput.files && fileInput.files[0]) {
        fileName.textContent = fileInput.files[0].name;
      }
    });

    fileInputContainer.appendChild(fileInput);
    fileInputContainer.appendChild(fileButton);
    fileInputContainer.appendChild(fileName);

    // Buttons
    const buttonsContainer = document.createElement('div');
    buttonsContainer.className = 'gv-folder-dialog-buttons';

    const importBtn = document.createElement('button');
    importBtn.className = 'gv-folder-dialog-btn gv-folder-dialog-btn-primary';
    importBtn.textContent = this.t('pm_import');
    importBtn.addEventListener('click', async () => {
      const strategy = (mergeOption.querySelector('input') as HTMLInputElement).checked
        ? 'merge'
        : 'overwrite';
      await this.handleImport(fileInput, strategy);
      overlay.remove();
    });

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'gv-folder-dialog-btn gv-folder-dialog-btn-secondary';
    cancelBtn.textContent = this.t('pm_cancel');
    cancelBtn.addEventListener('click', () => overlay.remove());

    buttonsContainer.appendChild(cancelBtn);
    buttonsContainer.appendChild(importBtn);

    // Assemble dialog
    dialog.appendChild(dialogTitle);
    dialog.appendChild(strategyContainer);
    dialog.appendChild(fileInputContainer);
    dialog.appendChild(buttonsContainer);
    overlay.appendChild(dialog);

    // Add to body
    document.body.appendChild(overlay);

    // Close on overlay click
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        overlay.remove();
      }
    });
  }

  private createRadioOption(value: string, label: string, checked: boolean): HTMLElement {
    const container = document.createElement('label');
    container.className = 'gv-folder-import-radio-option';

    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = 'import-strategy';
    radio.value = value;
    radio.checked = checked;

    const labelText = document.createElement('span');
    labelText.textContent = label;

    container.appendChild(radio);
    container.appendChild(labelText);

    return container;
  }

  private async handleImport(fileInput: HTMLInputElement, strategy: ImportStrategy): Promise<void> {
    // Prevent concurrent imports to avoid data corruption
    if (this.importInProgress) {
      this.showNotification(this.t('folder_import_in_progress') || 'Import already in progress', 'info');
      return;
    }

    this.importInProgress = true;

    try {
      if (!fileInput.files || fileInput.files.length === 0) {
        this.showNotification(this.t('folder_import_select_file'), 'error');
        return;
      }

      const file = fileInput.files[0];

      // Confirm overwrite if strategy is overwrite
      if (strategy === 'overwrite') {
        const confirmed = confirm(this.t('folder_import_confirm_overwrite'));
        if (!confirmed) {
          return;
        }
      }

      // Read and parse file
      const readResult = await FolderImportExportService.readJSONFile(file);
      if (!readResult.success) {
        this.showNotification(this.t('folder_import_invalid_format'), 'error');
        return;
      }

      // Validate payload
      const validationResult = FolderImportExportService.validatePayload(readResult.data);
      if (!validationResult.success) {
        this.showNotification(
          this.t('folder_import_invalid_format') + ': ' + validationResult.error.message,
          'error'
        );
        return;
      }

      // Import data (now async with concurrency protection)
      const importResult = await FolderImportExportService.importFromPayload(
        validationResult.data,
        this.data as any,
        { strategy, createBackup: true }
      );

      if (!importResult.success) {
        this.showNotification(
          this.t('folder_import_error').replace('{error}', String(importResult.error)),
          'error'
        );
        return;
      }

      // Update data and save
      this.data = importResult.data.data as any;
      this.saveData();
      this.refresh();

      // Show success message
      const stats = importResult.data.stats;
      let message = this.t('folder_import_success')
        .replace('{folders}', String(stats.foldersImported))
        .replace('{conversations}', String(stats.conversationsImported));

      if (strategy === 'merge' && (stats.duplicatesFoldersSkipped || stats.duplicatesConversationsSkipped)) {
        const totalSkipped = (stats.duplicatesFoldersSkipped || 0) + (stats.duplicatesConversationsSkipped || 0);
        message = this.t('folder_import_success_skipped')
          .replace('{folders}', String(stats.foldersImported))
          .replace('{conversations}', String(stats.conversationsImported))
          .replace('{skipped}', String(totalSkipped));
      }

      this.showNotification(message, 'success');
      this.debug('Import successful:', stats);
    } catch (error) {
      console.error('[FolderManager] Import error:', error);
      this.showNotification(
        this.t('folder_import_error').replace('{error}', String(error)),
        'error'
      );
    } finally {
      // Always release the lock, even if an error occurred
      this.importInProgress = false;
    }
  }

  private showNotification(message: string, type: 'success' | 'error' | 'info' = 'info'): void {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `gv-notification gv-notification-${type}`;
    notification.textContent = message;

    // Add to body
    document.body.appendChild(notification);

    // Trigger animation
    setTimeout(() => notification.classList.add('show'), 10);

    // Remove after 3 seconds
    setTimeout(() => {
      notification.classList.remove('show');
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  }
}
