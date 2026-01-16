
import React, { useState, useEffect, useRef } from 'react';

interface GlitchTextProps {
    text: string;
    speed?: number; // ms per frame
    scrambleDuration?: number; // total duration
    preserveSpace?: boolean;
}

const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789@#$%^&*";

export const GlitchText: React.FC<GlitchTextProps> = ({ 
    text, 
    speed = 30, 
    scrambleDuration = 600,
    preserveSpace = true 
}) => {
    const [display, setDisplay] = useState('');
    const frameRef = useRef(0);
    const mountedRef = useRef(true);

    useEffect(() => {
        mountedRef.current = true;
        let iteration = 0;
        const length = text.length;
        const frames = scrambleDuration / speed;
        const step = length / frames;

        const interval = setInterval(() => {
            if (!mountedRef.current) return;

            setDisplay(
                text
                    .split("")
                    .map((char, index) => {
                        if (char === ' ' && preserveSpace) return ' ';
                        if (index < iteration) {
                            return text[index];
                        }
                        return CHARS[Math.floor(Math.random() * CHARS.length)];
                    })
                    .join("")
            );

            if (iteration >= length) {
                clearInterval(interval);
            }

            iteration += step;
        }, speed);

        return () => {
            mountedRef.current = false;
            clearInterval(interval);
        };
    }, [text, speed, scrambleDuration, preserveSpace]);

    return <span className="font-mono">{display || text}</span>;
};
