
import React, { memo } from 'react';
import { Loader2, ChevronDown, ArrowUpRight } from 'lucide-react';
import { Card } from '../../../components/ui/Card';

interface ToolGroupProps {
    title: string;
    icon: React.ReactNode;
    subtitle: string;
    isOpen: boolean;
    onToggle: () => void;
    children: React.ReactNode;
    isLoading?: boolean;
    loadingText?: string;
}

export const ToolGroup: React.FC<ToolGroupProps> = memo(({ 
    title, icon, subtitle, isOpen, onToggle, children, isLoading, loadingText 
}) => (
    <Card 
        tone={isOpen ? "bento-purple" : "default"}
        padding="none"
        bento={isOpen}
        className={`
        relative overflow-hidden transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] group transform-gpu will-change-[height,border-color,box-shadow]
        ${isOpen 
            ? 'bento-card shadow-[var(--shadow-bento)]' 
            : 'hover:shadow-[var(--shadow-soft)]' 
        }
    `}>
        {/* Loading Progress Line */}
        <div className={`absolute top-0 left-0 h-[2px] bg-accent transition-all duration-500 ease-in-out z-20 ${isLoading ? 'w-full opacity-100' : 'w-0 opacity-0'}`}></div>
        
        <button 
            onClick={onToggle} 
            className="w-full p-6 md:p-8 flex flex-col md:flex-row md:items-center justify-between cursor-pointer text-left focus:outline-none relative z-10 gap-6 md:gap-0"
        >
            <div className="flex items-start md:items-center gap-5 md:gap-8">
                <div className={`
                    w-14 h-14 md:w-20 md:h-20 rounded-[var(--radius-md)] flex items-center justify-center shadow-[var(--shadow-soft)] border transition-all duration-500 shrink-0 relative overflow-hidden transform-gpu
                    ${isOpen ? 'bg-white/20 text-white border-white/30' : 'bg-[var(--surface-2)] text-[var(--text-muted)] border-[color:var(--border)]/50 group-hover:text-[var(--accent)]'}
                    ${isLoading && !isOpen ? 'text-[var(--accent)]' : ''}
                `}>
                    {isLoading 
                        ? <Loader2 size={28} className={`animate-spin relative z-10 ${isOpen ? 'text-white' : ''}`} /> 
                        : React.cloneElement(icon as React.ReactElement<any>, { size: 28, strokeWidth: 1.7, className: `relative z-10 ${isOpen ? 'text-white' : ''}` })
                    }
                </div>
                
                <div className="space-y-1">
                    <h3 className={`${isOpen ? 'bento-card-title text-white' : 'section-title text-text'} transition-transform duration-300 ${isOpen ? 'translate-x-0.5' : 'group-hover:translate-x-0.5'}`}>
                        {title}
                    </h3>
                    <div className="flex flex-col gap-1">
                        <p className={`${isOpen ? 'bento-card-description text-white/80' : 'caption'} flex items-center gap-2 transition-all duration-500 ${isLoading && !isOpen ? 'text-accent' : ''}`}>
                             {isLoading ? (loadingText || 'Working...') : subtitle}
                        </p>
                    </div>
                </div>
            </div>

            <div className="flex items-center gap-4 md:gap-6 absolute top-6 right-6 md:static">
                {!isOpen && (
                    <div className="hidden md:flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity transform translate-x-4 group-hover:translate-x-0 duration-300">
                        <span className="caption text-text-muted">Open</span>
                        <ArrowUpRight size={18} className="text-accent" />
                    </div>
                )}
                <div className={`w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center transition-all duration-500 border shadow-[var(--shadow-soft)] ${isOpen ? 'rotate-180 bg-white/20 text-white shadow-[var(--shadow-bento)] border-white/30' : 'bg-[var(--surface)] text-[var(--text-muted)] group-hover:text-[var(--text)] border-[color:var(--border)]/50'}`}>
                    <ChevronDown size={20} />
                </div>
            </div>
        </button>

        {/* Content Expansion Area - Optimized for Paint Flashing & Layout Thrashing */}
        <div 
            className={`transition-[max-height,opacity] duration-700 ease-[cubic-bezier(0.2,0,0,1)] overflow-hidden will-change-[max-height,opacity] ${isOpen ? 'max-h-[3000px] opacity-100' : 'max-h-0 opacity-0'}`}
        >
            <div className="px-4 pb-6 md:px-8 md:pb-8 pt-0 relative transform-gpu">
                {isLoading && (
                    <div className="absolute inset-0 bg-surface/90 backdrop-blur-sm z-20 flex items-center justify-center animate-fade-in rounded-b-[var(--radius-lg)] border-t border-border">
                        <div className="flex flex-col items-center gap-4 p-6 rounded-[var(--radius-lg)] bg-surface border border-border shadow-[var(--shadow-soft)]">
                            <div className="w-14 h-14 rounded-full border-4 border-accent/20 border-t-accent animate-spin" />
                            <span className="caption text-accent text-center">Processing...</span>
                        </div>
                    </div>
                )}
                <div className="bg-surface rounded-[var(--radius-md)] border border-border p-1 shadow-inner relative overflow-hidden">
                    {/* Render children only if open or previously opened to save memory if needed, but for smooth animation keep mounted. */}
                    {children}
                </div>
            </div>
        </div>
    </Card>
));
