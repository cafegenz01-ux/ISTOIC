
import { HANISAH_KERNEL } from "./melsaKernel";
import { debugService } from "./debugService";

// Expanded Language Map
const LANG_MAP: Record<string, string> = {
    'INDONESIAN': 'Bahasa Indonesia (Natural/Gaul/Kontekstual)',
    'ENGLISH': 'English (Native/Slang/Casual)',
    'JAPANESE': 'Japanese (Natural/Conversational)',
    'CHINESE': 'Mandarin (Simplified)',
    'KOREAN': 'Korean (Hangul/Conversational)',
    'SPANISH': 'Spanish (Español)',
    'FRENCH': 'French (Français)',
    'GERMAN': 'German (Deutsch)',
    'RUSSIAN': 'Russian',
    'ARABIC': 'Arabic',
    'HINDI': 'Hindi',
    'PORTUGUESE': 'Portuguese',
    'THAI': 'Thai',
    'VIETNAMESE': 'Vietnamese',
    'JAVANESE': 'Basa Jawa (Sesuaikan Ngoko/Krama)',
    'SUNDANESE': 'Basa Sunda'
};

export const TranslationService = {
    
    isDeepLAvailable: (): boolean => {
        return false; 
    },

    mapLanguage: (lang: string): string => {
        const upper = lang.toUpperCase();
        if (LANG_MAP[upper]) return LANG_MAP[upper];
        
        if (upper.includes('INDO')) return LANG_MAP['INDONESIAN'];
        if (upper.includes('ENG')) return LANG_MAP['ENGLISH'];
        if (upper.includes('JPN') || upper.includes('JEPANG')) return LANG_MAP['JAPANESE'];
        if (upper.includes('KOR')) return LANG_MAP['KOREAN'];
        
        return lang; 
    },

    /**
     * POWERFUL CONTEXTUAL TRANSLATOR v3.0
     * Logic: Strict "No-BS" Translation.
     */
    translate: async (text: string, targetLangLabel: string): Promise<string> => {
        const targetLang = TranslationService.mapLanguage(targetLangLabel);
        debugService.log('INFO', 'HYDRA_TRANS', 'REQ', `Translating to ${targetLang}...`);

        const systemPrompt = `
[ROLE: ELITE_TRANSLATION_ENGINE]
TUGAS: Terjemahkan teks input pengguna ke ${targetLang}.

[ATURAN MUTLAK - DILARANG DILANGGAR]:
1. **TO THE POINT**: Output HANYA hasil terjemahan. 
   - DILARANG ada kata pembuka ("Ini terjemahannya:", "Tentu,", "Berikut...").
   - DILARANG memberikan opsi alternatif ("Atau bisa juga...", "Opsi lain...").
   - DILARANG menjelaskan grammar atau konteks.
2. **KONTEKS**: 
   - Jika teks asli kasar/slang/gaul -> Terjemahan HARUS slang/gaul/natural.
   - Jika teks asli formal -> Terjemahan HARUS formal.
   - Pertahankan nuansa emosi (marah, sedih, bercanda).
3. **BUKAN CHATBOT**: 
   - Jangan pernah membalas isi pesan. Jika input "Halo apa kabar?", terjemahkan saja, JANGAN dijawab "Baik".
4. **TEKNIS**:
   - Jangan terjemahkan nama orang, brand, atau istilah teknis umum (kecuali diminta).
   - Pertahankan emoji 100%.

[CONTOH YANG BENAR]
Input: "Gue laper banget gila" (Target: English)
Output: "I'm starving like crazy"

Input: "Mohon lampirkan dokumen" (Target: English)
Output: "Please attach the document"

[INPUT DATA]
"${text}"
`;

        try {
            // Use 'auto-best' to force high-intelligence model for nuance detection
            const response = await HANISAH_KERNEL.execute(systemPrompt, 'auto-best', []);
            
            let result = response.text || text;

            // Post-Processing Cleanup (Safety Net)
            result = result.replace(/^["']|["']$/g, ''); // Hapus tanda kutip luar
            result = result.replace(/^(Here is|Berikut adalah|Translation:|Terjemahan:).*/i, ''); // Hapus intro basa-basi
            result = result.replace(/\n\n(Note:|Catatan:|Option|Opsi).*/gs, ''); // Hapus penjelasan tambahan di bawah

            return result.trim();

        } catch (error: any) {
            debugService.log('ERROR', 'HYDRA_TRANS', 'FAIL', error.message);
            return text; 
        }
    }
};
