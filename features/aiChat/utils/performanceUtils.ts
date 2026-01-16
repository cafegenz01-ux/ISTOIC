/**
 * Chat Performance Utilities
 * Optimization helpers for chat operations
 */

import { type ChatMessage, type ChatThread } from '../../../types';

/**
 * Memoization helper for chat messages
 */
export const shouldUpdateMessages = (
  prevMessages: ChatMessage[],
  nextMessages: ChatMessage[]
): boolean => {
  if (prevMessages.length !== nextMessages.length) return true;
  
  for (let i = 0; i < prevMessages.length; i++) {
    const prev = prevMessages[i];
    const next = nextMessages[i];
    
    if (
      prev.id !== next.id ||
      prev.role !== next.role ||
      (typeof prev.text === 'string' && typeof next.text === 'string' && prev.text !== next.text)
    ) {
      return true;
    }
  }
  return false;
};

/**
 * Batch message updates for better performance
 */
export const batchMessageUpdates = (messages: ChatMessage[], updates: Partial<ChatMessage>[]) => {
  const updateMap = new Map(updates.map(u => [u.id, u]));
  
  return messages.map(msg => 
    updateMap.has(msg.id) 
      ? { ...msg, ...updateMap.get(msg.id) }
      : msg
  );
};

/**
 * Paginate messages for virtualization
 */
export const paginateMessages = (
  messages: ChatMessage[],
  pageSize: number = 50
): ChatMessage[][] => {
  const pages: ChatMessage[][] = [];
  for (let i = 0; i < messages.length; i += pageSize) {
    pages.push(messages.slice(i, i + pageSize));
  }
  return pages;
};

/**
 * Check if message needs scroll
 */
export const shouldAutoScroll = (
  container: HTMLElement | null,
  threshold = 100
): boolean => {
  if (!container) return true;
  const { scrollHeight, clientHeight, scrollTop } = container;
  return scrollHeight - (scrollTop + clientHeight) < threshold;
};

/**
 * Estimate message render time
 */
export const estimateRenderTime = (message: ChatMessage): number => {
  const baseTime = 16; // 16ms for one frame
  const textLength = typeof message.text === 'string' ? message.text.length : (message.text as Blob).size;
  const isBlob = message.text instanceof Blob;
  
  return baseTime + (textLength / 1000) * 5 + (isBlob ? 20 : 0);
};

/**
 * Prioritize messages for rendering
 */
export const prioritizeMessages = (messages: ChatMessage[]) => {
  return messages.sort((a, b) => {
    // Most recent first (by message ID as timestamp proxy)
    const aOrder = parseInt(a.id.split('-')[0] || '0', 10);
    const bOrder = parseInt(b.id.split('-')[0] || '0', 10);
    if (aOrder !== bOrder) return bOrder - aOrder;
    
    // User messages first
    return a.role === 'user' ? -1 : 1;
  });
};

/**
 * Get unread message count (messages from assistant)
 */
export const getUnreadCount = (messages: ChatMessage[]): number => {
  return messages.filter(m => m.role === 'assistant').length;
};
