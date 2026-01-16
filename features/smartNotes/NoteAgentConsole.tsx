import React, { useState, useCallback } from 'react';
import { Sparkles, Loader2, CheckCircle2, X, Brain, Archive, ListTodo, Lightbulb } from 'lucide-react';
import { type Note } from '../../types';
import { NOTE_AGENTS, type AgentType } from '../../services/noteAgentService';
import { Dialog } from '../../components/ui/Dialog';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { cn } from '../../utils/cn';
import { debugService } from '../../services/debugService';
import { UI_REGISTRY, FN_REGISTRY } from '../../constants/registry';

interface NoteAgentConsoleProps {
  notes: Note[];
  setNotes: React.Dispatch<React.SetStateAction<Note[]>>;
  isOpen: boolean;
  onClose: () => void;
  personaMode?: 'hanisah' | 'stoic';
}

interface AgentCard {
  id: AgentType;
  name: string;
  description: string;
  icon: React.ReactNode;
  color: 'bento-purple' | 'bento-teal' | 'bento-orange' | 'bento-blue';
}

const AGENTS: AgentCard[] = [
  {
    id: 'ORGANIZER',
    name: 'Auto Organizer',
    description: 'Rename, tag, and archive notes intelligently',
    icon: <Archive size={20} />,
    color: 'bento-purple'
  },
  {
    id: 'INSIGHT',
    name: 'Pattern Insight',
    description: 'Discover themes and productivity patterns',
    icon: <Lightbulb size={20} />,
    color: 'bento-teal'
  },
  {
    id: 'TASKS',
    name: 'Task Extractor',
    description: 'Extract and prioritize action items',
    icon: <ListTodo size={20} />,
    color: 'bento-orange'
  },
  {
    id: 'MEMORY',
    name: 'Memory Recall',
    description: 'Find related notes by context',
    icon: <Brain size={20} />,
    color: 'bento-blue'
  }
];

export const NoteAgentConsole: React.FC<NoteAgentConsoleProps> = ({
  notes,
  setNotes,
  isOpen,
  onClose,
  personaMode = 'stoic'
}) => {
  const [activeAgent, setActiveAgent] = useState<AgentType | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleRunAgent = useCallback(async (agentId: AgentType) => {
    setActiveAgent(agentId);
    setIsProcessing(true);
    setResult(null);
    setError(null);

    try {
      debugService.logAction(UI_REGISTRY.NOTES_BTN_AGENT_CONSOLE, FN_REGISTRY.NOTE_BATCH_ACTION, agentId);

      switch (agentId) {
        case 'ORGANIZER': {
          const updates = await NOTE_AGENTS.runOrganizer(notes, personaMode);
          if (updates.length > 0) {
            setNotes(prevNotes =>
              prevNotes.map(note => {
                const update = updates.find(u => u.id === note.id);
                return update ? { ...note, ...update } : note;
              })
            );
            setResult(`✅ Organized ${updates.length} note${updates.length > 1 ? 's' : ''}`);
          } else {
            setResult('ℹ️ No changes needed. Your notes are already well organized.');
          }
          break;
        }

        case 'INSIGHT': {
          const insight = await NOTE_AGENTS.runInsight(notes);
          setResult(insight);
          break;
        }

        case 'TASKS': {
          const tasks = await NOTE_AGENTS.runActionExtractor(notes);
          if (tasks.length > 0) {
            const taskList = tasks.map(t => `- ${t.text}`).join('\n');
            setResult(`📋 Found ${tasks.length} task${tasks.length > 1 ? 's' : ''}:\n\n${taskList}`);
          } else {
            setResult('ℹ️ No actionable tasks found in your notes.');
          }
          break;
        }

        case 'MEMORY': {
          // Memory recall needs a current note context, so we'll show a message
          setResult('💡 Memory Recall works best when editing a note. It will suggest related notes automatically.');
          break;
        }

        default:
          setError('Unknown agent type');
      }
    } catch (err: any) {
      console.error('Agent execution failed:', err);
      setError(err.message || 'Agent execution failed');
    } finally {
      setIsProcessing(false);
    }
  }, [notes, setNotes, personaMode]);

  const handleClose = useCallback(() => {
    setActiveAgent(null);
    setResult(null);
    setError(null);
    setIsProcessing(false);
    onClose();
  }, [onClose]);

  return (
    <Dialog
      open={isOpen}
      onClose={handleClose}
      title="AI Agent Console"
      size="lg"
      footer={
        <Button onClick={handleClose} variant="secondary">
          Close
        </Button>
      }
    >
      <div className="space-y-6">
        {/* Agent Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {AGENTS.map((agent) => (
            <Card
              key={agent.id}
              tone={agent.color}
              padding="bento"
              interactive
              bento
              className={cn(
                'bento-card cursor-pointer transition-all',
                activeAgent === agent.id && 'ring-2 ring-accent/50',
                isProcessing && activeAgent === agent.id && 'opacity-75'
              )}
              onClick={() => !isProcessing && handleRunAgent(agent.id)}
            >
              <div className="bento-card-content">
                <div className="bento-card-icon mb-3">
                  {agent.icon}
                </div>
                <h3 className="bento-card-title mb-2">{agent.name}</h3>
                <p className="bento-card-description">{agent.description}</p>
                {isProcessing && activeAgent === agent.id && (
                  <div className="mt-3 flex items-center gap-2 text-sm">
                    <Loader2 size={14} className="animate-spin" />
                    <span>Processing...</span>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>

        {/* Results Display */}
        {(result || error) && (
          <Card
            padding="bento"
            bento
            className={cn(
              'animate-slide-up',
              error ? 'border-danger/30 bg-danger/5' : 'border-accent/30 bg-accent/5'
            )}
          >
            <div className="flex items-start gap-3">
              {error ? (
                <X size={20} className="text-danger flex-shrink-0 mt-0.5" />
              ) : (
                <CheckCircle2 size={20} className="text-success flex-shrink-0 mt-0.5" />
              )}
              <div className="flex-1 min-w-0">
                {error ? (
                  <p className="text-sm text-danger font-medium">{error}</p>
                ) : (
                  <div className="text-sm text-text whitespace-pre-wrap">
                    {result}
                  </div>
                )}
              </div>
            </div>
          </Card>
        )}

        {/* Info */}
        <div className="text-xs text-text-muted/60 text-center">
          Agents use AI to analyze and organize your notes. Results may vary.
        </div>
      </div>
    </Dialog>
  );
};
