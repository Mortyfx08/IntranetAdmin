import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import Backend from 'i18next-http-backend';
import LanguageDetector from 'i18next-browser-languagedetector';

i18n
    .use(Backend)
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
        fallbackLng: 'en',
        debug: false,
        interpolation: {
            escapeValue: false,
        },
        backend: {
            loadPath: '/locales/{{lng}}/translation.json',
        },
        detection: {
            order: ['localStorage', 'cookie', 'navigator'],
            caches: ['localStorage'],
        }
    });

// RTL Support Logic
i18n.on('languageChanged', (lng) => {
    const isRtl = lng === 'ar';
    document.body.dir = isRtl ? 'rtl' : 'ltr';
    document.body.classList.toggle('rtl-mode', isRtl);
});

// Initial check
const initialLng = i18n.language || 'en';
document.body.dir = initialLng === 'ar' ? 'rtl' : 'ltr';
if (initialLng === 'ar') document.body.classList.add('rtl-mode');

export default i18n;
