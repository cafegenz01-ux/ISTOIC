import React, { useState, useEffect } from 'react';
import { RefreshCw, Quote, Sun, Moon, Calendar, Zap } from 'lucide-react';
import { HANISAH_KERNEL } from '../../../services/melsaKernel';
import useLocalStorage from '../../../hooks/useLocalStorage';
import { Card } from '../../../components/ui/Card';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';

export const DailyStoicWidget: React.FC = () => {
    const [briefing, setBriefing] = useLocalStorage<any>('stoic_daily_briefing', null);
    const [language] = useLocalStorage<string>('app_language', 'id');
    const [isLoading, setIsLoading] = useState(false);
    const [timeOfDay, setTimeOfDay] = useState<'morning' | 'afternoon' | 'evening'>('morning');

    useEffect(() => {
        const hour = new Date().getHours();
        if (hour < 12) setTimeOfDay('morning');
        else if (hour < 18) setTimeOfDay('afternoon');
        else setTimeOfDay('evening');

        // Check if briefing is stale (older than today)
        const today = new Date().toDateString();
        if (!briefing || briefing.date !== today) {
            generateBriefing(today, hour);
        }
    }, []);

    const generateBriefing = async (dateKey: string, hour: number) => {
        setIsLoading(true);
        try {
            const context = hour < 12 ? "Focus on preparing the mind for the day's challenges." 
                : hour < 18 ? "Focus on endurance and maintaining rationality." 
                : "Focus on reflection and calming the mind.";

            const prompt = `
            Generate a short, powerful Daily Stoic Briefing.
            Context: ${context}
            Language: Indonesian (Casual but philosophical).
            
            IMPORTANT: Return ONLY raw JSON. Do not include markdown formatting like \`\`\`json.
            Structure:
            {
                "quote": "A stoic quote (Marcus Aurelius/Seneca/Epictetus)",
                "advice": "1 short paragraph applying this to modern work/code life.",
                "focus": "ONE_WORD_THEME"
            }
            `;

            const result = await HANISAH_KERNEL.execute(prompt, 'gemini-3-flash-preview');
            
            // Robust JSON Extraction
            let cleanText = result.text || '';
            const jsonMatch = cleanText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                cleanText = jsonMatch[0];
            } else {
                cleanText = cleanText.replace(/```json|```/g, '').trim();
            }

            try {
                const data = JSON.parse(cleanText);
                if (data.quote) {
                    setBriefing({ ...data, date: dateKey });
                }
            } catch (parseError) {
                console.warn("Failed to parse stoic briefing JSON. Retrying with fallback.", cleanText);
            }
        } catch (e) {
            console.error("Failed to generate stoic briefing", e);
        } finally {
            setIsLoading(false);
        }
    };

    if (!briefing && !isLoading) return null;

    const locale = language === 'en' ? 'en-US' : 'id-ID';
    const dayLabel = new Date().toLocaleDateString(locale, { weekday: 'long' });
    const timeLabel =
        language === 'en'
            ? timeOfDay === 'morning' ? 'Morning brief' : timeOfDay === 'afternoon' ? 'Afternoon brief' : 'Evening brief'
            : timeOfDay === 'morning' ? 'Brief pagi' : timeOfDay === 'afternoon' ? 'Brief siang' : 'Brief malam';
    const timeIcon = isLoading ? <RefreshCw className="animate-spin" size={24} /> : timeOfDay === 'evening' ? <Moon size={24} /> : <Sun size={24} />;
    const focusLabel = language === 'en' ? 'Focus' : 'Fokus';
    const refreshLabel = language === 'en' ? 'Refresh' : 'Muat ulang';
    const offlineLabel = language === 'en' ? 'Offline. Unable to generate a briefing right now.' : 'Offline. Tidak bisa membuat briefing saat ini.';

    return (
        <Card className="relative overflow-hidden animate-slide-up" padding="lg">
            <div className="absolute inset-0 bg-gradient-to-br from-accent/5 via-transparent to-surface-2/70" />

            <div className="relative z-10 flex flex-col gap-6 md:flex-row md:items-start">
                <div className="flex items-start gap-4 min-w-[220px]">
                    <div className="w-12 h-12 rounded-[var(--radius-md)] bg-surface-2 border border-border flex items-center justify-center text-text-muted">
                        {timeIcon}
                    </div>
                    <div className="space-y-1">
                        <div className="caption text-text-muted flex items-center gap-2">
                            <Calendar size={14} /> {dayLabel}
                        </div>
                        <div className="section-title text-text">{timeLabel}</div>
                    </div>
                </div>

                <div className="flex-1 space-y-4">
                    {isLoading ? (
                        <div className="space-y-3 animate-pulse">
                            <div className="h-4 bg-surface-2 rounded w-3/4"></div>
                            <div className="h-4 bg-surface-2 rounded w-1/2"></div>
                        </div>
                    ) : briefing ? (
                        <>
                            <div className="relative">
                                <Quote size={20} className="absolute -top-2 -left-2 text-text-muted/40 -scale-x-100" />
                                <p className="body text-text italic leading-relaxed">
                                    "{briefing.quote}"
                                </p>
                            </div>

                            <div className="h-[1px] bg-border w-full"></div>

                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <Badge variant="accent" className="w-fit">
                                    <Zap size={12} />
                                    {focusLabel}: {briefing.focus}
                                </Badge>
                                <p className="caption text-text-muted max-w-xl">
                                    {briefing.advice}
                                </p>
                            </div>
                        </>
                    ) : (
                        <p className="body text-text-muted">{offlineLabel}</p>
                    )}
                </div>

                <Button
                    onClick={() => generateBriefing(new Date().toDateString(), new Date().getHours())}
                    variant="ghost"
                    size="sm"
                    className="md:ml-auto"
                    aria-label="Refresh briefing"
                >
                    <RefreshCw size={16} />
                    {refreshLabel}
                </Button>
            </div>
        </Card>
    );
};
