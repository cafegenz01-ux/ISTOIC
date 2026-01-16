/**
 * Chat System Styles
 * Handles layout, spacing, and visual hierarchy for AI Chat UI
 * Backward compatible with existing design tokens
 */

export const chatSystemStyles = `
/* ========== CHAT LAYOUT FOUNDATION ========== */
.chat-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  overflow: hidden;
  background: var(--bg);
  position: relative;
}

.chat-header {
  flex-shrink: 0;
  position: relative;
  z-index: 50;
  padding-top: max(0.5rem, env(safe-area-inset-top));
}

.chat-main {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  position: relative;
  width: 100%;
}

.chat-column {
  width: 100%;
  max-width: 860px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  height: 100%;
}

.chat-messages {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  -webkit-overflow-scrolling: touch;
  overscroll-behavior-y: contain;
  scroll-behavior: smooth;
}

.chat-footer {
  flex-shrink: 0;
  position: relative;
  z-index: 50;
  width: 100%;
  pointer-events: auto;
  padding-bottom: max(0.5rem, env(safe-area-inset-bottom));
}

/* ========== RESPONSIVE LAYOUT ========== */
@media (max-width: 640px) {
  .chat-container {
    px: 1rem;
  }
  
  .chat-column {
    max-width: 100%;
  }
}

/* ========== MESSAGE SPACING & RHYTHM ========== */
.message-group {
  display: flex;
  width: 100%;
  margin-bottom: 1.5rem;
  padding: 0.75rem 1rem;
  animation: fadeInUp 0.3s ease-out;
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.message-row {
  display: flex;
  gap: 0.75rem;
  align-items: flex-end;
}

.message-bubble {
  border-radius: 18px;
  padding: 1rem 1.25rem;
  max-width: 85%;
  word-wrap: break-word;
  word-break: break-word;
  hyphens: auto;
  line-height: 1.5;
  font-size: 0.9375rem;
}

@media (min-width: 640px) {
  .message-bubble {
    padding: 1.25rem 1.5rem;
    max-width: 75%;
  }
}

@media (min-width: 1024px) {
  .message-bubble {
    max-width: 65%;
  }
}

/* Assistant message (left) */
.message-assistant {
  justify-content: flex-start;
}

.message-assistant .message-bubble {
  background: var(--surface);
  color: var(--text);
  border: 1px solid var(--border);
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.08);
}

/* User message (right) */
.message-user {
  justify-content: flex-end;
}

.message-user .message-bubble {
  background: var(--accent);
  color: var(--text-invert);
  border: 1px solid var(--accent);
  box-shadow: 0 8px 24px rgba(var(--accent-rgb), 0.25);
}

/* ========== MARKDOWN STYLING ========== */
.message-content {
  font-family: var(--font-sans);
  line-height: 1.6;
}

.message-content p {
  margin: 0.75rem 0;
}

.message-content p:first-child {
  margin-top: 0;
}

.message-content p:last-child {
  margin-bottom: 0;
}

.message-content ul,
.message-content ol {
  margin: 0.75rem 0;
  padding-left: 1.5rem;
}

.message-content li {
  margin: 0.375rem 0;
  line-height: 1.6;
}

.message-content h1,
.message-content h2,
.message-content h3 {
  margin: 1rem 0 0.75rem;
  font-weight: 600;
  line-height: 1.3;
}

.message-content h1 {
  font-size: 1.5rem;
}

.message-content h2 {
  font-size: 1.25rem;
}

.message-content h3 {
  font-size: 1.1rem;
}

/* ========== CODE BLOCK STYLING ========== */
.message-content pre {
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 1rem;
  margin: 0.75rem 0;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  font-family: var(--font-mono);
  font-size: 0.8125rem;
  line-height: 1.5;
  max-width: 100%;
  box-shadow: 0 4px 12px rgba(15, 23, 42, 0.04);
}

.message-content code {
  font-family: var(--font-mono);
  font-size: 0.85em;
}

.message-content pre code {
  background: none;
  padding: 0;
  border: none;
}

/* Inline code */
.message-content code:not(pre code) {
  background: var(--surface-2);
  color: var(--accent);
  padding: 0.25rem 0.5rem;
  border-radius: 6px;
  font-weight: 500;
}

.message-user .message-content code:not(pre code) {
  background: rgba(255, 255, 255, 0.2);
  color: var(--text-invert);
}

/* ========== LINK STYLING ========== */
.message-content a {
  color: var(--accent);
  text-decoration: underline;
  text-decoration-color: var(--accent);
  transition: all 0.2s ease;
  cursor: pointer;
}

.message-content a:hover {
  text-decoration-thickness: 2px;
  opacity: 0.8;
}

.message-user .message-content a {
  color: var(--text-invert);
  text-decoration-color: rgba(255, 255, 255, 0.6);
}

.message-user .message-content a:hover {
  text-decoration-color: var(--text-invert);
}

/* ========== BLOCKQUOTE ========== */
.message-content blockquote {
  border-left: 4px solid var(--accent);
  padding-left: 1rem;
  margin: 0.75rem 0;
  color: var(--text-muted);
  font-style: italic;
}

/* ========== AVATAR & ICON ========== */
.message-avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2.25rem;
  height: 2.25rem;
  border-radius: 12px;
  flex-shrink: 0;
  background: var(--surface);
  border: 1px solid var(--border);
  color: var(--accent);
  box-shadow: 0 4px 12px rgba(15, 23, 42, 0.08);
}

/* ========== TYPING INDICATOR ========== */
.typing-indicator {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 1rem 1.25rem;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 20px;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.08);
}

.typing-dot {
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 50%;
  background: var(--accent);
  animation: typingBounce 1.4s infinite;
}

.typing-dot:nth-child(1) {
  animation-delay: -0.32s;
}

.typing-dot:nth-child(2) {
  animation-delay: -0.16s;
}

@keyframes typingBounce {
  0%, 60%, 100% {
    opacity: 0.4;
    transform: translateY(0);
  }
  30% {
    opacity: 1;
    transform: translateY(-6px);
  }
}

/* ========== EMPTY STATE ========== */
.chat-empty-state {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  height: 100%;
  padding: 2rem;
  text-align: center;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

.empty-state-icon {
  width: 5rem;
  height: 5rem;
  border-radius: 1.5rem;
  background: linear-gradient(135deg, var(--accent)/0.2 0%, var(--accent)/0.05 100%);
  border: 1px solid var(--accent)/0.3;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--accent);
  margin-bottom: 1rem;
  box-shadow: 0 12px 32px rgba(15, 23, 42, 0.08);
}

/* ========== SCROLL BUTTON ========== */
.scroll-to-bottom-btn {
  position: absolute;
  bottom: -80px;
  right: 1rem;
  width: 3rem;
  height: 3rem;
  border-radius: 1rem;
  background: linear-gradient(135deg, var(--accent), var(--accent-2));
  color: white;
  border: 1px solid var(--accent);
  box-shadow: 0 12px 32px rgba(var(--accent-rgb), 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  animation: bounceIn 0.4s ease-out;
  transition: all 0.2s ease;
  z-index: 20;
}

.scroll-to-bottom-btn:hover {
  transform: scale(1.05);
  box-shadow: 0 16px 48px rgba(var(--accent-rgb), 0.4);
}

.scroll-to-bottom-btn:active {
  transform: scale(0.95);
}

@keyframes bounceIn {
  0% {
    opacity: 0;
    transform: translateY(20px);
  }
  100% {
    opacity: 1;
    transform: translateY(0);
  }
}

/* ========== SCROLLBAR STYLING ========== */
.custom-scroll {
  scrollbar-width: thin;
  scrollbar-color: var(--border) transparent;
}

.custom-scroll::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

.custom-scroll::-webkit-scrollbar-track {
  background: transparent;
}

.custom-scroll::-webkit-scrollbar-thumb {
  background: var(--border);
  border-radius: 3px;
  transition: background 0.2s ease;
}

.custom-scroll::-webkit-scrollbar-thumb:hover {
  background: var(--border);
  opacity: 0.8;
}
`;
