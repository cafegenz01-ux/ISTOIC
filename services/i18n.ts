
// CENTRAL LANGUAGE CONFIGURATION v0.30
export type LanguageCode = 'id' | 'en' | 'bn';

export const TRANSLATIONS = {
    id: {
        meta: { label: 'BAHASA INDONESIA', code: 'id-ID' },
        sidebar: {
            dashboard: "BERANDA",
            notes: "CATATAN",
            chat: "ASISTEN",
            tools: "ALAT",
            system: "SISTEM",
            settings: "PENGATURAN"
        },
        dashboard: {
            uptime: "SISTEM OPTIMAL",
            nodes: "TOTAL CATATAN",
            focus: "SINYAL P2P",
            archiveTitle: "BRANKAS ARSIP",
            archiveDesc: "Penyimpanan data jangka panjang.",
            chatTitle: "ASISTEN PINTAR",
            chatDesc: "Diskusi & Pemecahan Masalah.",
            toolsTitle: "ALAT KREATIF",
            toolsDesc: "Studio Gambar & Analisis Visual.",
            recent: "BARU DIBUKA",
            control: "KEAMANAN",
            vaultAccess: "BUKA BRANKAS"
        },
        chat: {
            placeholder: "Ketik sesuatu atau tanya...",
            listening: "MENDENGARKAN...",
            newChat: "SESI BARU",
            history: "RIWAYAT",
            empty: "BELUM ADA PESAN",
            welcome_hanisah: "⚡ **HANISAH SIAP.**\n\n*Halo! Ada yang bisa saya bantu selesaikan hari ini?*",
            welcome_stoic: "🧠 **LOGIC CORE AKTIF.**\n\n*Mode Analisis Rasional.*\nSampaikan masalah Anda secara objektif."
        },
        editor: {
            placeholder: "Mulai menulis ide...",
            tasks: "DAFTAR TUGAS",
            save: "MENYIMPAN...",
            saved: "TERSIMPAN",
            magic: "AI WRITER",
            dictate: "DIKTE"
        },
        settings: {
            title: "PENGATURAN UMUM",
            identity_title: "PROFIL PENGGUNA",
            data_title: "DATA & CADANGAN",
            lang_label: "BAHASA",
            lang_desc: "Bahasa antarmuka aplikasi.",
            theme_label: "TAMPILAN",
            theme_desc: "Mode Gelap atau Terang.",
            user_name: "NAMA PENGGUNA",
            user_bio: "KONTEKS PERSONAL",
            backup: "UNDUH CADANGAN (JSON)",
            restore: "PULIHKAN DATA",
            reset: "HAPUS SEMUA DATA",
            save: "SIMPAN",
            saved: "BERHASIL"
        },
        prompts: {
            hanisah: `Kamu adalah HANISAH (Asisten Virtual Cerdas).
[GAYA KOMUNIKASI]
- Gunakan Bahasa Indonesia yang natural, sopan, dan jelas.
- Bersikap solutif, langsung pada poin, namun tetap ramah.
- Gunakan "Saya" dan "Anda" atau "Aku" dan "Kamu" sesuai konteks pengguna.

[FUNGSI]
- Membantu produktivitas, mencatat, dan riset.
- Gunakan tool 'manage_note' untuk menyimpan informasi penting.
- Gunakan 'generate_visual' jika diminta membuat gambar.`,
            stoic: `Anda adalah LOGIC CORE (Mesin Analisis Stoik).
Bahasa: INDONESIA (Formal, Padat, Logis).
Fokus: Objektivitas, Dikotomi Kendali, dan Solusi Rasional.
Hindari respon emosional. Fokus pada fakta dan tindakan yang bisa diambil.`
        }
    },
    en: {
        meta: { label: 'ENGLISH', code: 'en-US' },
        sidebar: {
            dashboard: "HOME",
            notes: "NOTES",
            chat: "ASSISTANT",
            tools: "TOOLS",
            system: "SYSTEM",
            settings: "SETTINGS"
        },
        dashboard: {
            uptime: "SYSTEM ONLINE",
            nodes: "TOTAL NOTES",
            focus: "P2P SIGNAL",
            archiveTitle: "ARCHIVE VAULT",
            archiveDesc: "Long-term secure storage.",
            chatTitle: "AI ASSISTANT",
            chatDesc: "Smart conversation & logic.",
            toolsTitle: "CREATIVE SUITE",
            toolsDesc: "Image Gen & Vision.",
            recent: "RECENT FILES",
            control: "SECURITY",
            vaultAccess: "UNLOCK VAULT"
        },
        chat: {
            placeholder: "Type a message...",
            listening: "LISTENING...",
            newChat: "NEW CHAT",
            history: "HISTORY",
            empty: "NO DATA",
            welcome_hanisah: "⚡ **HANISAH ONLINE.**\n\n*Hello! How can I assist your productivity today?*",
            welcome_stoic: "🧠 **LOGIC CORE ONLINE.**\n\n*Analysis Mode Active.*\nState your query objectively."
        },
        editor: {
            placeholder: "Start typing...",
            tasks: "TASKS",
            save: "SAVING...",
            saved: "SAVED",
            magic: "AI WRITER",
            dictate: "DICTATE"
        },
        settings: {
            title: "GENERAL SETTINGS",
            identity_title: "USER PROFILE",
            data_title: "DATA MANAGEMENT",
            lang_label: "LANGUAGE",
            lang_desc: "App interface language.",
            theme_label: "APPEARANCE",
            theme_desc: "Dark or Light mode.",
            user_name: "USERNAME",
            user_bio: "SYSTEM CONTEXT",
            backup: "EXPORT BACKUP (JSON)",
            restore: "RESTORE DATA",
            reset: "FACTORY RESET",
            save: "SAVE",
            saved: "SAVED"
        },
        prompts: {
            hanisah: `You are HANISAH (Smart Virtual Assistant).
Style: Casual, polite, helpful English.
Focus: Productivity, clarity, and assistance.`,
            stoic: `You are LOGIC CORE.
Style: Formal, Objective, Stoic.
Focus: Logic and Rationality.`
        }
    },
    bn: {
        meta: { label: 'BRUNEI', code: 'ms-BN' },
        sidebar: {
            dashboard: "UTAMA",
            notes: "CATATAN",
            chat: "PEMBANTU",
            tools: "ALATAN",
            system: "SISTEM",
            settings: "TETAPAN"
        },
        dashboard: {
            uptime: "SISTEM AKTIF",
            nodes: "JUMLAH NOTA",
            focus: "SINYAL P2P",
            archiveTitle: "ARKIB",
            archiveDesc: "Simpanan selamat.",
            chatTitle: "PEMBANTU AI",
            chatDesc: "Interaksi pintar.",
            toolsTitle: "ALATAN KREATIF",
            toolsDesc: "Studio Gambar & Analisis.",
            recent: "TERKINI",
            control: "KESELAMATAN",
            vaultAccess: "BUKA KUNCI"
        },
        chat: {
            placeholder: "Taip mesej...",
            listening: "MENDENGAR...",
            newChat: "SESI BARU",
            history: "SEJARAH",
            empty: "TIADA DATA",
            welcome_hanisah: "⚡ **HANISAH ONLINE.**\n\n*Hai, apa bulih saya bantu?*",
            welcome_stoic: "🧠 **LOGIC CORE ONLINE.**\n\n*Mod Analisis Aktif.*\nSila nyatakan masalah awda."
        },
        editor: {
            placeholder: "Mula menaip...",
            tasks: "TUGASAN",
            save: "MENYIMPAN...",
            saved: "DISIMPAN",
            magic: "PENULIS AI",
            dictate: "DIKTE"
        },
        settings: {
            title: "TETAPAN UMUM",
            identity_title: "PROFIL PENGGUNA",
            data_title: "PENGURUSAN DATA",
            lang_label: "BAHASA",
            lang_desc: "Bahasa antaramuka.",
            theme_label: "TEMA",
            theme_desc: "Gelap atau Terang.",
            user_name: "NAMA PENGGUNA",
            user_bio: "KONTEKS SISTEM",
            backup: "EKSPORT DATA",
            restore: "IMPORT DATA",
            reset: "RESET SISTEM",
            save: "SIMPAN",
            saved: "DISIMPAN"
        },
        prompts: {
            hanisah: `Awda adalah HANISAH.
Bahasa: Melayu Brunei/Standard.
Gaya: Sopan dan membantu.`,
            stoic: `Anda adalah LOGIC CORE.
Bahasa: Formal.
Fokus: Logik.`
        }
    }
};

export const getLang = (): LanguageCode => {
    const stored = localStorage.getItem('app_language');
    return (stored === 'id' || stored === 'en' || stored === 'bn') ? stored : 'id';
};

export const getText = (section: keyof typeof TRANSLATIONS['id'], key: string) => {
    const lang = getLang();
    return (TRANSLATIONS[lang][section] as any)[key] || (TRANSLATIONS['id'][section] as any)[key];
};
