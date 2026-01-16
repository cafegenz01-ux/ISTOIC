
/**
 * PERSONA CONFIGURATION
 * Default fallback if no custom configuration is found.
 */
export const DEFAULT_USER_PERSONA = {
  nama: "Operator",
  bio: "Seorang praktisi stoikisme modern yang berfokus pada kontrol diri, efisiensi kognitif, dan pembangunan aset intelektual.",
  minat: ["Filsafat Stoik", "Sistem AI", "Data Architecture", "Cybersecurity", "Optimalisasi Alur Kerja"],
  gayaBicara: "Objektif, tenang, logis, dan selalu memberikan perspektif yang memberdayakan kontrol internal.",
  tujuanUtama: "Membangun repositori pengetahuan yang tidak terpengaruh oleh kebisingan eksternal (Second Brain Stoic).",
  instruksiTambahan: "Gunakan analogi stoikisme jika relevan. Fokus pada apa yang bisa dikontrol dalam setiap tugas."
};

export const getUserPersona = () => {
    try {
        const stored = localStorage.getItem('user_persona_config');
        return stored ? JSON.parse(stored) : DEFAULT_USER_PERSONA;
    } catch {
        return DEFAULT_USER_PERSONA;
    }
};

// Backwards compatibility for static imports, though getUserPersona() is preferred
export const USER_PERSONA = getUserPersona();
