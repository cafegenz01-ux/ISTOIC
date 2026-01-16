import React, { useRef, useEffect, useState, memo, useCallback, useMemo } from 'react';
import {
  Plus,
  Mic,
  MicOff,
  Paperclip,
  X,
  Palette,
  Smile,
  Database,
  DatabaseZap,
  Square,
  CornerDownLeft
} from 'lucide-react';
import { TRANSLATIONS, getLang } from '../../../services/i18n';
import { debugService } from '../../../services/debugService';
import { UI_REGISTRY, FN_REGISTRY } from '../../../constants/registry';
import { optimizeImageForAI } from '../../../utils/imageOptimizer';

interface ChatInputProps {
  input: string;
  setInput: React.Dispatch<React.SetStateAction<string>>;
  isLoading: boolean;
  onSubmit: (e?: React.FormEvent, options?: { attachment?: { data: string; mimeType: string } }) => void;
  onStop?: () => void;
  onNewChat: () => void;
  onFocusChange: (isFocused: boolean) => void;
  aiName: string;
  isVaultSynced?: boolean;
  onToggleVaultSync?: () => void;
  personaMode?: 'hanisah' | 'stoic';
  isVaultEnabled?: boolean;
  onTogglePersona?: () => void;
  variant?: 'hero' | 'standard';
  onPollinations?: () => void;
  disableVisuals?: boolean;
}

const MAX_CHARS = 4000;

const EMOJI_CATEGORIES = {
  EXPRESSIONS: ['😀', '😊', '😉', '😂', '😍', '🤔', '😴', '😎', '😭', '🙌'],
  SIGNALS: ['👍', '👎', '🙏', '🔥', '🎯', '⚡', '✅', '❓', '🚀', '💡'],
  NATURE: ['🌿', '🌱', '🌤️', '🌙', '⭐', '🌊', '🔥', '🍃', '🌻', '🌵']
};

export const ChatInput: React.FC<ChatInputProps> = memo(
  ({
    input,
    setInput,
    isLoading,
    onSubmit,
    onStop,
    onNewChat,
    onFocusChange,
    aiName,
    isVaultSynced = true,
    onToggleVaultSync,
    personaMode = 'hanisah',
    isVaultEnabled = true,
    onTogglePersona,
    variant = 'standard',
    onPollinations,
    disableVisuals = false
  }) => {
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const recognitionRef = useRef<any>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const [isDictating, setIsDictating] = useState(false);
    const [isFocused, setIsFocused] = useState(false);
    const [attachment, setAttachment] = useState<{ file?: File; preview: string; base64: string; mimeType: string } | null>(null);
    const [isDragOver, setIsDragOver] = useState(false);
    const [pasteFlash, setPasteFlash] = useState(false);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [activeEmojiCategory, setActiveEmojiCategory] = useState<keyof typeof EMOJI_CATEGORIES>('EXPRESSIONS');

    const currentLang = getLang();
    const t = TRANSLATIONS[currentLang].chat;

    // Handle iOS keyboard and safe-area padding
    useEffect(() => {
      const handleVisualViewportChange = () => {
        if (!window.visualViewport || !containerRef.current) return;
        
        const viewport = window.visualViewport;
        const keyboardHeight = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop);
        
        // Adjust container scroll into view when keyboard appears
        if (keyboardHeight > 0 && inputRef.current) {
          requestAnimationFrame(() => {
            inputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
          });
        }
      };

      window.visualViewport?.addEventListener('resize', handleVisualViewportChange);
      window.visualViewport?.addEventListener('scroll', handleVisualViewportChange);

      return () => {
        window.visualViewport?.removeEventListener('resize', handleVisualViewportChange);
        window.visualViewport?.removeEventListener('scroll', handleVisualViewportChange);
      };
    }, []);

    const suggestionChips = useMemo(() => {
      if (personaMode === 'hanisah') {
        return [
          { label: 'Buat Gambar', text: 'Buatkan gambar dengan detail: ' },
          { label: 'Ringkas', text: 'Tolong ringkas ini: ' },
          { label: 'Rencanakan Task', text: 'Buat daftar tugas dari: ' },
          { label: 'Brainstorm', text: 'Bantu ide untuk ' }
        ];
      }
      return [
        { label: 'Analisis', text: 'Analyze this logically: ' },
        { label: 'Debug', text: 'Debug this code: ' },
        { label: 'Ekstrak Task', text: 'Extract action items: ' },
        { label: 'Ringkas', text: 'Summarize key points: ' }
      ];
    }, [personaMode]);

    useEffect(() => {
      if (inputRef.current) {
        const textarea = inputRef.current;
        requestAnimationFrame(() => {
          textarea.style.height = 'auto';
          const maxHeight = Math.min(240, window.innerHeight * 0.4);
          const newHeight = Math.min(textarea.scrollHeight, maxHeight);
          textarea.style.height = `${Math.max(44, newHeight)}px`;
        });
      }
    }, [input, attachment]);

    useEffect(() => {
      return () => {
        if (recognitionRef.current) recognitionRef.current.stop();
      };
    }, []);

    const handlePaste = (e: React.ClipboardEvent) => {
      e.preventDefault();
      const text = e.clipboardData.getData('text/plain');
      if (inputRef.current) {
        const start = inputRef.current.selectionStart;
        const end = inputRef.current.selectionEnd;
        const next = input.substring(0, start) + text + input.substring(end);
        setInput(next);
        setTimeout(() => {
          if (inputRef.current) {
            inputRef.current.selectionStart = inputRef.current.selectionEnd = start + text.length;
          }
        }, 0);
      } else {
        setInput((prev) => prev + text);
      }
      setPasteFlash(true);
      setTimeout(() => setPasteFlash(false), 500);
    };

    const handleInsertEmoji = (emoji: string) => {
      if (inputRef.current) {
        const start = inputRef.current.selectionStart;
        const end = inputRef.current.selectionEnd;
        const next = input.substring(0, start) + emoji + input.substring(end);
        setInput(next);
        setTimeout(() => {
          if (inputRef.current) {
            inputRef.current.selectionStart = inputRef.current.selectionEnd = start + emoji.length;
            inputRef.current.focus();
          }
        }, 0);
      } else {
        setInput((prev) => prev + emoji);
      }
    };

    const toggleDictation = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        debugService.logAction(UI_REGISTRY.CHAT_INPUT_MIC, FN_REGISTRY.CHAT_SEND_MESSAGE, isDictating ? 'STOP' : 'START');

        if (isDictating) {
          recognitionRef.current?.stop();
          setIsDictating(false);
          return;
        }

        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SpeechRecognition) {
          alert('Browser tidak mendukung voice input.');
          return;
        }

        try {
          const recognition = new SpeechRecognition();
          recognition.lang = TRANSLATIONS[currentLang].meta.code;
          recognition.continuous = true;
          recognition.interimResults = true;

          recognition.onstart = () => setIsDictating(true);
          recognition.onend = () => setIsDictating(false);
          recognition.onresult = (event: any) => {
            let finalTranscript = '';
            for (let i = event.resultIndex; i < event.results.length; ++i) {
              if (event.results[i].isFinal) {
                finalTranscript += event.results[i][0].transcript;
              }
            }
            if (finalTranscript) {
              setInput((prev) => {
                const needsSpace = prev.length > 0 && !prev.endsWith(' ');
                return prev + (needsSpace ? ' ' : '') + finalTranscript;
              });
            }
          };
          recognition.onerror = () => setIsDictating(false);
          recognitionRef.current = recognition;
          recognition.start();
        } catch (err) {
          console.error('Mic initialization failed', err);
          alert('Gagal memulai mikrofon. Pastikan izin telah diberikan.');
        }
      },
      [currentLang, isDictating, setInput]
    );

    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (!isLoading) handleSubmit();
      }
    };

    const processFile = async (file: File) => {
      if (!file.type.startsWith('image/')) {
        alert('Only images supported.');
        return;
      }
      try {
        const { base64, mimeType } = await optimizeImageForAI(file);
        setAttachment({
          file,
          preview: `data:${mimeType};base64,${base64}`,
          base64,
          mimeType
        });
      } catch (e) {
        console.error('Image processing error', e);
        alert('Failed to process image. Please try another file.');
      }
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files?.[0]) processFile(e.target.files[0]);
      e.target.value = '';
    };

    const handleAttachClick = () => {
      if (disableVisuals) return;
      debugService.logAction(UI_REGISTRY.CHAT_INPUT_ATTACH, FN_REGISTRY.CHAT_SEND_MESSAGE, 'OPEN_DIALOG');
      fileInputRef.current?.click();
    };

    const handleStop = (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      onStop?.();
    };

    const handleSubmit = () => {
      if (isDictating) {
        recognitionRef.current?.stop();
        setIsDictating(false);
      }
      if ((!input.trim() && !attachment) || isLoading) return;
      if (input.length > MAX_CHARS) {
        alert(`Character limit exceeded (${MAX_CHARS}). Please shorten your message.`);
        return;
      }

      debugService.logAction(UI_REGISTRY.CHAT_INPUT_SEND, FN_REGISTRY.CHAT_SEND_MESSAGE, 'SUBMIT');

      const attachmentPayload = attachment ? { data: attachment.base64, mimeType: attachment.mimeType } : undefined;
      onSubmit(undefined, attachmentPayload ? { attachment: attachmentPayload } : undefined);
      setAttachment(null);
      if (inputRef.current) inputRef.current.style.height = 'auto';
      setTimeout(() => inputRef.current?.focus(), 0);
    };

    const charTone =
      input.length > MAX_CHARS * 0.9 ? 'var(--danger)' : input.length > MAX_CHARS * 0.7 ? 'var(--warning)' : 'var(--text-muted)';

    return (
      <div className="w-full relative group" style={{ willChange: 'transform' }} ref={containerRef}>
        {showEmojiPicker && <div className="fixed inset-0 z-20" onClick={() => setShowEmojiPicker(false)}></div>}

        {showEmojiPicker && (
          <div className="absolute bottom-[110%] left-0 w-full sm:w-96 bg-gradient-to-br from-[var(--surface)] to-[var(--surface-2)] border border-[color:var(--border)] rounded-[20px] shadow-xl z-30 animate-slide-up flex flex-col overflow-hidden backdrop-blur-lg">
            <div className="flex p-2 border-b border-[color:var(--border)]/30 overflow-x-auto no-scrollbar gap-1">
              {Object.keys(EMOJI_CATEGORIES).map((cat) => (
                <button
                  key={cat}
                  onClick={() => setActiveEmojiCategory(cat as any)}
                  className={`flex-1 py-2.5 text-[11px] font-bold uppercase tracking-widest rounded-lg transition-all duration-200 ${
                    activeEmojiCategory === cat
                      ? 'bg-[var(--accent)]/15 text-[var(--accent)] border border-[color:var(--accent)]/40'
                      : 'text-[var(--text-muted)] hover:text-[var(--text)] border border-transparent hover:bg-[var(--surface-2)]/60'
                  }`}
                >
                  {cat.charAt(0) + cat.slice(1).toLowerCase()}
                </button>
              ))}
            </div>
            <div className="p-4 grid grid-cols-6 gap-2 max-h-56 overflow-y-auto custom-scroll">
              {EMOJI_CATEGORIES[activeEmojiCategory].map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => handleInsertEmoji(emoji)}
                  className="h-12 rounded-lg hover:bg-[var(--surface-2)] text-2xl flex items-center justify-center transition-transform hover:scale-125 active:scale-95"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        )}

        {pasteFlash && (
          <div className="absolute -top-10 right-0 text-[11px] md:text-[12px] font-bold text-[var(--success)] bg-[color:var(--success)]/15 border border-[color:var(--success)]/40 px-4 py-2 rounded-xl animate-fade-in flex items-center gap-2 backdrop-blur-sm">
            <span>✓</span> Format cleaned
          </div>
        )}

        <div
          className={`w-full transition-all duration-300 bg-[var(--surface)] border border-[color:var(--border)]/50 rounded-[var(--bento-radius)] p-3 flex flex-col shadow-[var(--shadow-bento)] ${
            isDictating
              ? 'ring-2 ring-[color:var(--accent)] border-[color:var(--accent)]/50'
              : isFocused || isDragOver
                ? 'ring-2 ring-[color:var(--accent)]/30 border-[color:var(--accent)]/30'
                : ''
          }`}
          style={{
            minHeight: '44px',
            position: 'relative'
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragOver(true);
          }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragOver(false);
            if (e.dataTransfer.files?.[0]) processFile(e.dataTransfer.files[0]);
          }}
        >
          {attachment && (
            <div className="px-4 pt-4 pb-2 flex animate-slide-up">
              <div className="relative inline-block group">
                <img
                  src={attachment.preview}
                  alt="Preview"
                  className="h-24 w-auto rounded-2xl border border-[color:var(--border)] shadow-lg object-cover group-hover:shadow-xl transition-all duration-300"
                />
                <button
                  onClick={() => setAttachment(null)}
                  aria-label="Remove Attachment"
                  className="absolute -top-3 -right-3 bg-[var(--danger)] text-white rounded-full p-2 shadow-lg hover:bg-[var(--danger)]/90 transition-all duration-200 active:scale-90 border border-[color:var(--danger)]/30"
                >
                  <X size={14} strokeWidth={2.5} />
                </button>
                <div className="absolute bottom-2 right-2 px-2.5 py-1 rounded-lg bg-[var(--bg)]/90 backdrop-blur-sm text-[11px] text-[var(--accent)] font-semibold uppercase border border-[color:var(--border)] shadow-md">
                  {attachment.mimeType.split('/')[1]}
                </div>
              </div>
            </div>
          )}

          <div className="relative px-4 pt-3 pb-2 flex flex-col">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              onFocus={() => {
                setIsFocused(true);
                onFocusChange(true);
              }}
              onBlur={() => {
                setIsFocused(false);
                onFocusChange(false);
              }}
              placeholder={isDictating ? '🎤 Listening...' : personaMode === 'hanisah' ? 'Tanya Hanisah tentang apa...' : 'Kirim perintah logis ke Stoic...'}
              className="w-full bg-transparent text-[15px] leading-relaxed font-medium text-[var(--text)] placeholder:text-[var(--text-muted)]/70 resize-none focus:outline-none max-h-[40vh] custom-scroll"
              rows={1}
              aria-label="Chat input"
              disabled={isLoading && !onStop}
            />

            {!input && !attachment && !isDictating && (
              <div
                className={`flex gap-2 mt-3 ${
                  variant === 'hero' ? 'flex-wrap opacity-0 animate-fade-in' : 'overflow-x-auto no-scrollbar mask-fade-sides'
                }`}
                style={variant === 'hero' ? { animationDelay: '200ms', opacity: 1 } : {}}
              >
                {suggestionChips.map((chip, i) => (
                  <button
                    key={chip.label}
                    onClick={() => {
                      setInput(chip.text);
                      inputRef.current?.focus();
                    }}
                    className="shrink-0 px-3 py-1.5 rounded-xl border text-[12px] font-semibold whitespace-nowrap bg-[var(--accent)]/8 border-[color:var(--accent)]/30 text-[var(--text-muted)] hover:border-[color:var(--accent)] hover:bg-[var(--accent)]/15 hover:text-[var(--accent)] transition-all duration-200 active:scale-95"
                    style={{ animationDelay: `${50 * i}ms` }}
                  >
                    {chip.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between px-2 pb-1.5 gap-2 border-t border-[color:var(--border)]/30 mt-2">
            <div className="flex gap-1.5 items-center">
              <button
                onClick={onNewChat}
                aria-label="New chat"
                className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl bg-[var(--surface-2)]/60 hover:bg-[var(--surface-2)] text-[var(--text-muted)] hover:text-[var(--accent)] border border-transparent hover:border-[color:var(--accent)]/30 transition-all duration-200 active:scale-90"
                title={t.newChat}
              >
                <Plus size={20} strokeWidth={2.2} />
              </button>

              <button
                onClick={handleAttachClick}
                disabled={disableVisuals}
                aria-label="Attach image"
                className={`min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl transition-all duration-200 active:scale-90 border ${
                  disableVisuals
                    ? 'opacity-40 cursor-not-allowed text-[var(--text-muted)]'
                    : attachment
                      ? 'text-[var(--accent)] bg-[var(--accent)]/15 border-[color:var(--accent)]/40'
                      : 'bg-[var(--surface-2)]/60 hover:bg-[var(--surface-2)] border-transparent text-[var(--text-muted)] hover:text-[var(--accent)] hover:border-[color:var(--accent)]/30'
                }`}
                title={disableVisuals ? 'Visuals disabled' : 'Attach image'}
              >
                <Paperclip size={20} strokeWidth={2.2} />
              </button>
              <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileSelect} accept="image/*" />

              <button
                onClick={() => setShowEmojiPicker((prev) => !prev)}
                className={`min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl transition-all duration-200 active:scale-90 border ${
                  showEmojiPicker
                    ? 'text-[var(--accent)] bg-[var(--accent)]/15 border-[color:var(--accent)]/40'
                    : 'bg-[var(--surface-2)]/60 hover:bg-[var(--surface-2)] border-transparent text-[var(--text-muted)] hover:text-[var(--accent)] hover:border-[color:var(--accent)]/30'
                }`}
                title="Insert emoji"
              >
                <Smile size={20} strokeWidth={2.2} />
              </button>

              <button
                onClick={() => !disableVisuals && onPollinations?.()}
                disabled={disableVisuals}
                className={`min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl transition-all duration-200 active:scale-90 border ${
                  disableVisuals
                    ? 'opacity-40 cursor-not-allowed text-[var(--text-muted)]'
                    : 'bg-[var(--surface-2)]/60 hover:bg-[var(--surface-2)] border-transparent text-[var(--text-muted)] hover:text-[var(--accent)] hover:border-[color:var(--accent)]/30'
                }`}
                title={disableVisuals ? 'Visuals disabled' : 'Generate visual'}
              >
                <Palette size={20} strokeWidth={2.2} />
              </button>

              <button
                onClick={onToggleVaultSync}
                disabled={!isVaultEnabled}
                aria-label={isVaultEnabled ? (isVaultSynced ? 'Vault sync active' : 'Vault sync inactive') : 'Vault disabled'}
                className={`min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl transition-all duration-200 active:scale-90 border ${
                  !isVaultEnabled
                    ? 'opacity-40'
                    : isVaultSynced
                      ? 'text-[var(--success)] bg-[var(--success)]/15 border-[color:var(--success)]/40'
                      : 'bg-[var(--surface-2)]/60 hover:bg-[var(--surface-2)] border-transparent text-[var(--text-muted)] hover:text-[var(--accent)] hover:border-[color:var(--accent)]/30'
                }`}
                title={isVaultEnabled ? 'Vault Sync' : 'Vault Disabled'}
              >
                {isVaultSynced ? <DatabaseZap size={20} strokeWidth={2.2} /> : <Database size={20} strokeWidth={2.2} />}
              </button>
            </div>

            <div className="flex items-center gap-3">
              <div className={`text-[11px] font-bold transition-opacity ${input.length > 0 ? 'opacity-100' : 'opacity-0'}`} style={{ color: charTone }}>
                {input.length}<span className="opacity-60 font-medium">/{MAX_CHARS}</span>
              </div>

              <button
                onClick={toggleDictation}
                aria-label={isDictating ? 'Stop dictation' : 'Start dictation'}
                className={`min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl transition-all duration-200 active:scale-90 border ${
                  isDictating
                    ? 'bg-[var(--accent)] text-[var(--on-accent-color)] border-transparent shadow-lg'
                    : 'bg-[var(--surface-2)]/60 hover:bg-[var(--surface-2)] border-transparent text-[var(--text-muted)] hover:text-[var(--accent)] hover:border-[color:var(--accent)]/30'
                }`}
                title="Voice input"
              >
                {isDictating ? <MicOff size={20} strokeWidth={2.2} /> : <Mic size={20} strokeWidth={2.2} />}
              </button>

              {isLoading ? (
                <button
                  onClick={handleStop}
                  aria-label="Stop generation"
                  className="min-w-[56px] min-h-[56px] rounded-[var(--radius-lg)] flex items-center justify-center transition-all duration-300 bg-gradient-to-r from-[var(--danger)] to-[var(--danger)]/80 text-white shadow-[var(--shadow-bento)] hover:shadow-[var(--shadow-strong)] hover:scale-105 active:scale-95 border border-[color:var(--danger)]/30"
                  title="Stop generation"
                >
                  <Square size={24} strokeWidth={2.5} />
                </button>
              ) : (
              <button
                onClick={handleSubmit}
                disabled={(!input.trim() && !attachment) || input.length > MAX_CHARS}
                aria-label="Send message"
                className={`min-w-[56px] min-h-[56px] rounded-[var(--radius-lg)] flex items-center justify-center transition-all duration-300 border font-semibold ${
                  input.trim() || attachment
                    ? 'bg-gradient-to-r from-[var(--accent)] to-[var(--accent-2)] text-white border-transparent shadow-[var(--shadow-bento)] hover:shadow-[var(--shadow-strong)] hover:scale-105 active:scale-95'
                    : 'bg-[var(--surface-2)]/40 text-[var(--text-muted)] cursor-not-allowed border-transparent'
                }`}
              >
                  <CornerDownLeft size={24} strokeWidth={2.5} />
                </button>
              )}
            </div>
          </div>
        </div>

        <style>{`
          .mask-fade-sides {
            mask-image: linear-gradient(to right, transparent, black 10%, black 90%, transparent);
            -webkit-mask-image: linear-gradient(to right, transparent, black 10%, black 90%, transparent);
          }
        `}</style>
      </div>
    );
  },
  (prev, next) => {
    // Memoization: Return true if props are equal (skip re-render)
    return (
      prev.input === next.input &&
      prev.isLoading === next.isLoading &&
      prev.personaMode === next.personaMode &&
      prev.isVaultSynced === next.isVaultSynced &&
      prev.variant === next.variant
    );
  }
);
