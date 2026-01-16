import { TRANSLATIONS, getLang } from "../i18n";
import { getUserPersona } from "../persona";

export const getReasoningLayer = (persona: 'hanisah' | 'stoic'): string => {
    try {
        const currentLang = getLang() || 'id';
        const translation = TRANSLATIONS[currentLang] || TRANSLATIONS['id'];
        
        let user;
        try { user = getUserPersona(); } catch (e) { console.warn("Persona load failed", e); }

        const userName = user?.nama || "User";
        const userBio = user?.bio || "Digital Operator";
        const langLabel = translation?.meta?.label || "Indonesian";

        const STOIC_TITANIUM = `[IDENTITY: STOIC_AURELIUS_TITANIUM]\n- Archetype: Philosopher-King.\n- Tone: Formal, Precise.`;
        const HANISAH_V25 = `[IDENTITY: HANISAH_V25_TITANIUM]\n- Archetype: Digital Partner.\n- Tone: Casual (Aku/Kamu).`;

        return `
${persona === 'hanisah' ? HANISAH_V25 : STOIC_TITANIUM}
=== PROFILE ===
Name: ${userName}
Bio: ${userBio}
Language: ${langLabel}
`;
    } catch (err) {
        return "[SYSTEM RECOVERY MODE]: Identity Matrix Corrupted. Using Default.";
    }
};