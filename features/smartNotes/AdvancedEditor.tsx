import React, { useRef, useState, useEffect, useCallback } from 'react';
import { 
  Bold, Italic, Underline, Maximize2, Minimize2, 
  Mic, MicOff, Sparkles, RefreshCw, Flame, CheckCircle,
  Code, Wand2, Clock,
  Type, CheckSquare, Trash2, Plus, ArrowLeft, Check,
  Undo, Redo
} from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { HANISAH_KERNEL } from '../../services/melsaKernel';
import { type TaskItem } from '../../types';
import { TRANSLATIONS, getLang } from '../../services/i18n';
import { sanitizeInput } from '../../utils/securityHelper';
import { Dialog } from '../../components/ui/Dialog';
import { Button } from '../../components/ui/Button';
import { Input, Textarea } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { Card } from '../../components/ui/Card';
import { cn } from '../../utils/cn';

interface AdvancedEditorProps {
  initialContent: string;
  initialTitle: string;
  initialTasks?: TaskItem[];
  initialTags?: string[];
  onSave: (title: string, content: string, tasks: TaskItem[], tags: string[]) => void;
  onDelete: () => void;
  onBack: () => void;
  language: 'id' | 'en';
  fontSize: number;
  onFontSizeChange: (size: number) => void;
}

const FONTS = [
    { label: 'Sans', value: 'Plus Jakarta Sans, sans-serif' },
    { label: 'Mono', value: 'JetBrains Mono, monospace' },
    { label: 'Serif', value: 'Playfair Display, serif' },
];

const ToolbarButton: React.FC<{ onClick: (e: React.MouseEvent) => void; icon: React.ReactNode; isActive?: boolean; ariaLabel: string; className?: string; label?: string }> = ({ onClick, icon, isActive, ariaLabel, className, label }) => (
    <Button 
        onMouseDown={(e) => { e.preventDefault(); onClick(e); }} 
        variant="ghost"
        size="sm"
        className={cn(
            label ? 'h-8 px-2' : 'h-8 w-8 p-0',
            isActive ? 'bg-accent/10 text-accent' : '',
            className
        )}
        aria-label={ariaLabel}
        type="button"
        title={ariaLabel}
    >
        {icon}
        {label && <span className="caption uppercase">{label}</span>}
    </Button>
);

const WRITER_PRESETS = [
    { id: 'GRAMMAR', label: 'Fix grammar', icon: <CheckCircle size={12}/>, prompt: 'Correct grammar and spelling errors. Keep the tone natural.' },
    { id: 'FORMAL', label: 'Professional tone', icon: <Type size={12}/>, prompt: 'Rewrite to be more professional, concise, and executive-ready.' },
    { id: 'EXPAND', label: 'Expand', icon: <Wand2 size={12}/>, prompt: 'Elaborate on this point. Add detail and context.' },
    { id: 'SUMMARIZE', label: 'Summarize', icon: <Minimize2 size={12}/>, prompt: 'Summarize the key points into a concise list or paragraph.' },
];

export const AdvancedEditor: React.FC<AdvancedEditorProps> = ({ 
    initialContent, 
    initialTitle,
    initialTasks = [],
    initialTags = [],
    onSave,
    onDelete, 
    onBack,
    language, 
    fontSize, 
    onFontSizeChange 
}) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const currentLang = getLang();
  const t = TRANSLATIONS[currentLang].editor;
  
  // Core State
  const [title, setTitle] = useState(initialTitle);
  const [tasks, setTasks] = useState<TaskItem[]>(initialTasks);
  const [tags, setTags] = useState<string[]>(initialTags);
  const [isReadonly, setIsReadonly] = useState(false);
  const [isTaskPanelOpen, setIsTaskPanelOpen] = useState(false);
  
  // Editor State
  const [isDictating, setIsDictating] = useState(false);
  const [currentFont, setCurrentFont] = useState(FONTS[0].value);
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'SAVED' | 'SYNCING'>('SAVED');
  const [wordCount, setWordCount] = useState(0);
  const [readTime, setReadTime] = useState(0);
  
  // Formatting State
  const [formats, setFormats] = useState({
      bold: false,
      italic: false,
      underline: false,
      strikethrough: false,
      ul: false,
      ol: false,
      justifyLeft: false,
      justifyCenter: false,
      justifyRight: false,
      code: false,
      h1: false,
      h2: false,
      quote: false
  });
  
  // AI State
  const [showHanisahOverlay, setShowHanisahOverlay] = useState(false);
  const [hanisahInstruction, setHanisahInstruction] = useState('');
  const [isHanisahProcessing, setIsHanisahProcessing] = useState(false);
  const [hanisahResult, setHanisahResult] = useState<string | null>(null);
  const [selectedText, setSelectedText] = useState('');
  const [selectionRange, setSelectionRange] = useState<Range | null>(null);

  const recognitionRef = useRef<any>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const completedTasksCount = tasks.filter(t => t.isCompleted).length;
  const taskProgress = tasks.length > 0 ? (completedTasksCount / tasks.length) * 100 : 0;

  const updateStatsAndFormats = useCallback(() => {
    if (!editorRef.current) return;
    
    const text = editorRef.current.innerText || '';
    const words = text.trim() === '' ? 0 : text.trim().split(/\s+/).length;
    setWordCount(words);
    setReadTime(Math.ceil(words / 200)); 

    if (!isReadonly) {
        const formatBlock = document.queryCommandValue('formatBlock');
        setFormats({
            bold: document.queryCommandState('bold'),
            italic: document.queryCommandState('italic'),
            underline: document.queryCommandState('underline'),
            strikethrough: document.queryCommandState('strikethrough'),
            ul: document.queryCommandState('insertUnorderedList'),
            ol: document.queryCommandState('insertOrderedList'),
            justifyLeft: document.queryCommandState('justifyLeft'),
            justifyCenter: document.queryCommandState('justifyCenter'),
            justifyRight: document.queryCommandState('justifyRight'),
            code: formatBlock === 'pre',
            h1: typeof formatBlock === 'string' && formatBlock.toLowerCase() === 'h1',
            h2: typeof formatBlock === 'string' && formatBlock.toLowerCase() === 'h2',
            quote: formatBlock === 'blockquote'
        });
        
        const fontName = document.queryCommandValue('fontName');
        if (fontName) {
            const cleanFont = fontName.replace(/[\'"]+/g, '');
            const matched = FONTS.find(f => f.value.includes(cleanFont));
            if (matched) setCurrentFont(matched.value);
        }
    }
  }, [isReadonly]);

  useEffect(() => {
    if (editorRef.current) {
        if (editorRef.current.innerHTML !== initialContent) {
            editorRef.current.innerHTML = initialContent || '<div><br></div>';
        }
        setTitle(initialTitle);
        setTasks(initialTasks);
        setTags(initialTags);
        updateStatsAndFormats();
    }
  }, [initialContent, initialTitle, initialTasks, initialTags]);

  const performSave = useCallback((currentTitle: string, currentContent: string, currentTasks: TaskItem[], currentTags: string[]) => {
    onSave(currentTitle, currentContent, currentTasks, currentTags);
    setSyncStatus('SAVED');
  }, [onSave]);

  const triggerAutoSave = useCallback(() => {
      setSyncStatus('SYNCING');
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      
      const contentToSave = editorRef.current?.innerHTML || '';
      
      saveTimeoutRef.current = setTimeout(() => {
          performSave(title, contentToSave, tasks, tags);
      }, 800);
  }, [title, tasks, tags, performSave]);

  useEffect(() => {
      if (tasks !== initialTasks) {
          triggerAutoSave();
      }
  }, [tasks, triggerAutoSave, initialTasks]);

  const addTask = (text: string) => {
      if (!text.trim()) return;
      const newTasks = [...tasks, { id: uuidv4(), text, isCompleted: false }];
      setTasks(newTasks);
  };

  const toggleTask = (id: string) => {
      const newTasks = tasks.map(t => t.id === id ? { ...t, isCompleted: !t.isCompleted } : t);
      setTasks(newTasks);
  };

  const deleteTask = (id: string) => {
      const newTasks = tasks.filter(t => t.id !== id);
      setTasks(newTasks);
  };

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      setTitle(e.target.value);
      setSyncStatus('SYNCING');
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => {
          if (editorRef.current) performSave(e.target.value, editorRef.current.innerHTML, tasks, tags);
      }, 800);
  };

  useEffect(() => {
    const handleMutation = () => {
      if (!editorRef.current) return;
      updateStatsAndFormats();
      setSyncStatus('SYNCING');
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => {
          if (editorRef.current) performSave(title, editorRef.current.innerHTML, tasks, tags);
      }, 800);
    };

    const handleSelectionChange = () => {
        updateStatsAndFormats();
    };

    const observer = new MutationObserver(handleMutation);
    if (editorRef.current) {
        observer.observe(editorRef.current, { childList: true, characterData: true, subtree: true });
    }

    const el = editorRef.current;
    if (el) {
        el.addEventListener('input', handleMutation);
        el.addEventListener('keyup', updateStatsAndFormats);
        el.addEventListener('mouseup', updateStatsAndFormats);
        el.addEventListener('click', updateStatsAndFormats);
        document.addEventListener('selectionchange', handleSelectionChange);
    }

    return () => {
      observer.disconnect();
      if (el) {
          el.removeEventListener('input', handleMutation);
          el.removeEventListener('keyup', updateStatsAndFormats);
          el.removeEventListener('mouseup', updateStatsAndFormats);
          el.removeEventListener('click', updateStatsAndFormats);
          document.removeEventListener('selectionchange', handleSelectionChange);
      }
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [performSave, updateStatsAndFormats, title, tasks, tags]); 

  const executeCommand = (command: string, value: string | undefined = undefined) => {
    if (isReadonly) return;
    document.execCommand(command, false, value);
    if (editorRef.current) editorRef.current.focus();
    updateStatsAndFormats(); 
  };

  const formatCodeBlock = () => {
    if (isReadonly || !editorRef.current) return;
    
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    
    const range = selection.getRangeAt(0);
    const selectedText = range.toString();

    const textToWrap = selectedText || ' // Your code here ';
    const html = `<pre style="background: var(--surface-2); color: var(--text); padding: 12px; border-radius: var(--radius-md); border: 1px solid var(--border); font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace; overflow-x: auto; white-space: pre-wrap;"><code class="language-javascript">${textToWrap}</code></pre><p><br></p>`;
    
    document.execCommand('insertHTML', false, html);
    updateStatsAndFormats();
  };

  const changeFont = (fontValue: string) => {
      if (isReadonly) return;
      setCurrentFont(fontValue);
      document.execCommand('fontName', false, fontValue);
      if (editorRef.current) editorRef.current.style.fontFamily = fontValue;
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (isReadonly) return;

    if (e.ctrlKey || e.metaKey) {
        const key = e.key.toLowerCase();
        switch (key) {
            case 'b': e.preventDefault(); executeCommand('bold'); break;
            case 'i': e.preventDefault(); executeCommand('italic'); break;
            case 'u': e.preventDefault(); executeCommand('underline'); break;
            case 'z': e.preventDefault(); executeCommand('undo'); break;
            case 'y': e.preventDefault(); executeCommand('redo'); break;
            case 'j': e.preventDefault(); formatCodeBlock(); break;
            default: break;
        }
    }
  };

  const openHanisahWriter = () => {
      if (isReadonly) return;
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0 && !selection.isCollapsed) {
          const text = selection.toString();
          const range = selection.getRangeAt(0);
          setSelectedText(text);
          setSelectionRange(range);
      } else {
          setSelectedText('');
          setSelectionRange(null);
      }
      setHanisahResult(null);
      setHanisahInstruction('');
      setShowHanisahOverlay(true);
  };

  const handleHanisahProcess = async (instructionOverride?: string) => {
    const finalInstruction = instructionOverride || hanisahInstruction;
    if (!finalInstruction.trim() || isHanisahProcessing) return;
    setIsHanisahProcessing(true);
    setHanisahResult(null);
    try {
      const contextText = selectedText || editorRef.current?.innerText || '';
      const contextLabel = selectedText ? 'SELECTED_TEXT' : 'FULL_DOCUMENT';
      const prompt = `[ROLE: HANISAH_WRITER_MODULE] TASK: ${finalInstruction} CONTEXT (${contextLabel}): """${contextText}""" OUTPUT_DIRECTIVE: Return ONLY the revised/generated text. LANGUAGE_TARGET: ${TRANSLATIONS[currentLang].meta.label}`;
      const response = await HANISAH_KERNEL.execute(prompt, 'gemini-3-flash-preview', []);
      setHanisahResult(response.text || 'Output generation failed.');
    } catch (error) {
      setHanisahResult('Processing error.');
    } finally {
      setIsHanisahProcessing(false);
    }
  };

  const applyHanisahResult = (mode: 'REPLACE' | 'INSERT' = 'REPLACE') => {
    if (!hanisahResult || !editorRef.current) return;
    const safeResult = sanitizeInput(hanisahResult);
    editorRef.current.focus();
    if (selectionRange && selectedText) {
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(selectionRange);
        if (mode === 'REPLACE') document.execCommand('insertHTML', false, safeResult.replace(/\n/g, '<br>'));
        else { selectionRange.collapse(false); document.execCommand('insertHTML', false, ' ' + safeResult.replace(/\n/g, '<br>')); }
    } else {
        if (mode === 'REPLACE') { const formatted = safeResult.split('\n').filter(l => l.trim()).map(l => `<p>${l}</p>`).join(''); editorRef.current.innerHTML = formatted; }
        else document.execCommand('insertHTML', false, `<br>${safeResult.replace(/\n/g, '<br>')}`);
    }
    triggerAutoSave();
    updateStatsAndFormats();
    setShowHanisahOverlay(false);
    setHanisahResult(null);
    setHanisahInstruction('');
    setSelectedText('');
    setSelectionRange(null);
  };

  const toggleDictation = () => {
    if (isReadonly) return;
    if (isDictating) {
      recognitionRef.current?.stop();
      setIsDictating(false);
      return;
    }
    
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) { 
        alert('Browser ini tidak mendukung dikte suara.'); 
        return; 
    }

    const r = new SpeechRecognition();
    r.lang = TRANSLATIONS[currentLang].meta.code;
    r.continuous = true; 
    r.interimResults = true; 

    r.onstart = () => setIsDictating(true);
    r.onend = () => setIsDictating(false);
    r.onerror = (e: any) => {
        console.error('Dictation Error:', e);
        setIsDictating(false);
    };

    r.onresult = (e: any) => {
      const result = e.results[e.results.length - 1];
      const text = result[0].transcript;
      if (result.isFinal) {
          if (editorRef.current) {
              editorRef.current.focus();
              document.execCommand('insertText', false, text + ' ');
          }
      }
    };

    recognitionRef.current = r;
    r.start();
  };

  return (
    <div className={cn('flex flex-col h-full bg-surface', isFocusMode ? 'fixed inset-0 z-[1500] p-0' : 'relative rounded-[var(--radius-lg)] overflow-hidden')}>
      <div className="sticky top-0 z-[100] px-4 pb-3 pt-[calc(env(safe-area-inset-top)+0.75rem)] bg-surface/90 backdrop-blur-xl border-b border-border flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
              <Button
                  onClick={onBack}
                  variant="ghost"
                  size="sm"
                  className="w-9 h-9 p-0"
                  aria-label="Back to notes"
              >
                  <ArrowLeft size={18} strokeWidth={2.2} />
              </Button>

              <Badge variant={syncStatus === 'SYNCING' ? 'accent' : 'neutral'}>
                  {syncStatus === 'SYNCING' ? <RefreshCw size={12} className="animate-spin" /> : <Check size={12} />}
                  {syncStatus === 'SAVED' ? t.saved : t.save}
              </Badge>
          </div>

          <div className="flex items-center gap-2">
              <Button
                onClick={onDelete}
                variant="ghost"
                size="sm"
                className="w-9 h-9 p-0 text-danger hover:bg-danger/10"
                title="Delete note"
              >
                 <Trash2 size={16} />
              </Button>

              <Button 
                onClick={() => setIsTaskPanelOpen(!isTaskPanelOpen)}
                variant={isTaskPanelOpen ? 'primary' : 'secondary'}
                size="sm"
              >
                 <CheckSquare size={14} />
                 {t.tasks.split(' ')[0]}
                 {tasks.length > 0 && (
                     <span className="caption text-text-muted">{tasks.filter(t => !t.isCompleted).length}</span>
                 )}
              </Button>

              <Button
                onClick={() => setIsFocusMode(!isFocusMode)}
                variant="ghost"
                size="sm"
                className="w-9 h-9 p-0"
                title="Toggle focus"
              >
                 {isFocusMode ? <Minimize2 size={18}/> : <Maximize2 size={18}/>}
              </Button>
          </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scroll px-6 md:px-12 lg:px-24 pt-8 pb-32">
          <div className="max-w-3xl mx-auto relative flex flex-col h-full">
              <div className="mb-6 group shrink-0">
                  <Input 
                    type="text" 
                    value={title}
                    onChange={handleTitleChange}
                    readOnly={isReadonly}
                    placeholder="Untitled note"
                    className="w-full bg-transparent border-transparent px-0 page-title focus-visible:ring-0"
                  />
                  <div className="flex flex-wrap items-center gap-3 mt-4 caption text-text-muted">
                        <span className="flex items-center gap-1"><Clock size={12}/> {readTime} min read</span>
                        <span className="w-1 h-1 rounded-full bg-border"></span>
                        <span>{wordCount} words</span>
                        <span className="w-1 h-1 rounded-full bg-border"></span>
                        <span>{new Date().toLocaleDateString()}</span>
                  </div>
              </div>

              <div className="sticky top-0 z-40 py-3 mb-6 bg-surface/95 backdrop-blur-md -mx-4 px-4 transition-all border-b border-border">
                  <div className="flex items-center gap-1 overflow-x-auto no-scrollbar relative">
                        <div className="flex items-center gap-1 pr-2 mr-2 border-r border-border shrink-0">
                            <ToolbarButton onClick={() => executeCommand('undo')} icon={<Undo size={16} />} ariaLabel="Undo" className="w-9 h-9 rounded-xl" />
                            <ToolbarButton onClick={() => executeCommand('redo')} icon={<Redo size={16} />} ariaLabel="Redo" className="w-9 h-9 rounded-xl" />
                        </div>

                        <div className="flex items-center gap-1 pr-2 mr-2 border-r border-border shrink-0">
                            <ToolbarButton onClick={() => executeCommand('bold')} icon={<Bold size={16} />} isActive={formats.bold} ariaLabel="Bold" className="w-9 h-9 rounded-xl" />
                            <ToolbarButton onClick={() => executeCommand('italic')} icon={<Italic size={16} />} isActive={formats.italic} ariaLabel="Italic" className="w-9 h-9 rounded-xl" />
                            <ToolbarButton onClick={() => executeCommand('underline')} icon={<Underline size={16} />} isActive={formats.underline} ariaLabel="Underline" className="w-9 h-9 rounded-xl" />
                            <ToolbarButton onClick={formatCodeBlock} icon={<Code size={16} />} isActive={formats.code} ariaLabel="Code block" className="w-9 h-9 rounded-xl" />
                        </div>

                        <div className="flex items-center gap-2 pl-1 ml-auto shrink-0">
                            <Button 
                                onClick={toggleDictation}
                                variant="secondary"
                                size="sm"
                                className={cn('w-9 h-9 p-0', isDictating ? 'bg-danger text-text-invert' : '')}
                                title={t.dictate}
                            >
                                {isDictating ? <MicOff size={16} /> : <Mic size={16} />}
                            </Button>

                            <Button 
                                onClick={openHanisahWriter} 
                                disabled={isReadonly}
                                variant="primary"
                                size="sm"
                            >
                                <Sparkles size={16} /> Assistant
                            </Button>
                        </div>
                  </div>
              </div>

              <div 
                ref={editorRef}
                contentEditable={!isReadonly}
                suppressContentEditableWarning
                onKeyDown={handleKeyDown}
                className={cn(
                    'min-h-[50vh] flex-1 w-full outline-none text-text selection:bg-accent/20 body break-words overflow-x-hidden editor-content',
                    isReadonly ? 'cursor-default' : 'cursor-text'
                )}
                style={{ fontSize: `${fontSize}px`, fontFamily: currentFont }}
                data-placeholder={t.placeholder}
              />
          </div>
      </div>

      <Dialog 
        open={isTaskPanelOpen} 
        onClose={() => setIsTaskPanelOpen(false)} 
        title={t.tasks} 
        size="md"
        footer={!isReadonly && (
            <Button variant="secondary" onClick={() => setIsTaskPanelOpen(false)}>Close</Button>
        )}
      >
          <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-[var(--radius-md)] bg-accent/15 text-accent flex items-center justify-center">
                  <CheckSquare size={16} />
              </div>
              <div className="flex-1">
                  <p className="caption text-text-muted">{t.tasks}</p>
                  <div className="flex items-center gap-2 mt-1">
                      <div className="w-24 h-1.5 bg-surface-2 rounded-full overflow-hidden">
                          <div className="h-full bg-accent transition-all duration-500" style={{ width: `${taskProgress}%` }}></div>
                      </div>
                      <span className="caption text-text-muted">{Math.round(taskProgress)}%</span>
                  </div>
              </div>
          </div>

          <div className="space-y-2.5 max-h-[50vh] overflow-y-auto custom-scroll">
              {tasks.map(task => (
                  <div key={task.id} className={cn('group flex items-start gap-3 p-3 rounded-[var(--radius-md)] border transition-all', task.isCompleted ? 'bg-surface-2 border-border opacity-70' : 'bg-surface border-border')}>
                      <Button 
                        onClick={() => !isReadonly && toggleTask(task.id)}
                        variant="ghost"
                        size="sm"
                        className={cn('mt-0.5 w-5 h-5 p-0 border', task.isCompleted ? 'bg-accent text-text-invert border-accent' : 'border-border')}
                        type="button"
                      >
                          {task.isCompleted && <Check size={12} strokeWidth={2.5} />}
                      </Button>
                      <span className={cn('body leading-relaxed flex-1 break-words', task.isCompleted ? 'text-text-muted line-through' : 'text-text')}>
                          {task.text}
                      </span>
                      {!isReadonly && (
                          <Button 
                            onClick={() => deleteTask(task.id)} 
                            variant="ghost"
                            size="sm"
                            className="w-7 h-7 p-0 text-text-muted hover:text-danger"
                            title="Delete task"
                            type="button"
                          >
                              <Trash2 size={12} />
                          </Button>
                      )}
                  </div>
              ))}
              {tasks.length === 0 && <div className="text-center py-10 caption text-text-muted">No tasks yet</div>}
          </div>

          {!isReadonly && (
              <form 
                onSubmit={(e) => {
                    e.preventDefault();
                    const input = (e.target as any).taskInput;
                    addTask(input.value);
                    input.value = '';
                }}
                className="flex gap-2 mt-4"
              >
                  <Input 
                    name="taskInput"
                    placeholder="Add a task"
                    className="flex-1"
                    autoComplete="off"
                  />
                  <Button type="submit" variant="primary" size="md" className="w-12 p-0">
                      <Plus size={18} />
                  </Button>
              </form>
          )}
      </Dialog>

      <Dialog
        open={showHanisahOverlay}
        onClose={() => setShowHanisahOverlay(false)}
        title="Writing assistant"
        size="lg"
      >
        <div className="grid gap-6 md:grid-cols-[320px_1fr]">
            <div className="space-y-4">
                <Card padding="md" className="space-y-2">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-[var(--radius-md)] bg-accent/10 text-accent flex items-center justify-center">
                            <Flame size={20} />
                        </div>
                        <div>
                            <div className="section-title text-text">Hanisah</div>
                            <p className="caption text-text-muted">Writing helper</p>
                        </div>
                    </div>
                </Card>

                <Card padding="md" className="space-y-3">
                    <p className="caption text-text-muted">Quick actions</p>
                    <div className="grid grid-cols-2 gap-2">
                        {WRITER_PRESETS.map(preset => (
                            <Button
                                key={preset.id}
                                onClick={() => handleHanisahProcess(preset.prompt)}
                                disabled={isHanisahProcessing}
                                variant="secondary"
                                size="sm"
                                className="justify-start"
                            >
                                {preset.icon}
                                <span className="caption">{preset.label}</span>
                            </Button>
                        ))}
                    </div>
                </Card>

                <Card padding="md" className="space-y-3">
                    <p className="caption text-text-muted">Custom instruction</p>
                    <Textarea
                        value={hanisahInstruction}
                        onChange={(e) => setHanisahInstruction(e.target.value)}
                        placeholder="Describe what you want changed."
                        className="min-h-[120px]"
                    />
                    <Button
                        onClick={() => handleHanisahProcess()}
                        disabled={!hanisahInstruction || isHanisahProcessing}
                        variant="primary"
                        size="md"
                        className="w-full"
                    >
                        {isHanisahProcessing ? <RefreshCw size={14} className="animate-spin" /> : <Wand2 size={14} />}
                        {isHanisahProcessing ? 'Working.' : 'Generate'}
                    </Button>
                </Card>
            </div>

            <div className="flex flex-col gap-4">
                <Card padding="md" className="flex-1">
                    <p className="caption text-text-muted mb-3">Result</p>
                    {hanisahResult ? (
                        <div className="body text-text whitespace-pre-wrap break-words">
                            {sanitizeInput(hanisahResult)}
                        </div>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-center gap-3 text-text-muted">
                            <Sparkles size={32} />
                            <p className="body">Awaiting instruction.</p>
                        </div>
                    )}
                </Card>

                {hanisahResult && (
                    <div className="flex gap-3">
                        <Button onClick={() => applyHanisahResult('INSERT')} variant="secondary" size="md" className="flex-1">
                            Insert below
                        </Button>
                        <Button onClick={() => applyHanisahResult('REPLACE')} variant="primary" size="md" className="flex-1">
                            Replace selection
                        </Button>
                    </div>
                )}
            </div>
        </div>
      </Dialog>
    </div>
  );
};
