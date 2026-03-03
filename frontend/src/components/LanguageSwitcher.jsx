import React from 'react';
import { Select, Space } from 'antd';
import { useTranslation } from 'react-i18next';
import { GlobalOutlined } from '@ant-design/icons';

const { Option } = Select;

const languages = [
    { code: 'en', label: 'English', flag: 'https://flagcdn.com/w40/us.png' },
    { code: 'fr', label: 'Français', flag: 'https://flagcdn.com/w40/fr.png' },
    { code: 'ar', label: 'العربية', flag: 'https://flagcdn.com/w40/sa.png' },
    { code: 'es', label: 'Español', flag: 'https://flagcdn.com/w40/es.png' },
    { code: 'de', label: 'Deutsch', flag: 'https://flagcdn.com/w40/de.png' },
];

const LanguageSwitcher = ({ size = 'middle', style }) => {
    const { i18n } = useTranslation();

    const handleChange = (value) => {
        i18n.changeLanguage(value);
    };

    const currentLang = languages.find(l => l.code === (i18n.language || 'en')) || languages[0];

    return (
        <Select
            value={i18n.language || 'en'}
            onChange={handleChange}
            size={size}
            style={{
                minWidth: 150,
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                borderRadius: '10px',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                padding: '2px 4px',
                ...style
            }}
            variant="borderless"
            popupMatchSelectWidth={false}
            className="glass-effect language-switcher-select"
            dropdownStyle={{
                background: 'rgba(30, 41, 59, 0.95)',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '12px'
            }}
        >
            {languages.map((lang) => (
                <Option key={lang.code} value={lang.code}>
                    <Space size="middle">
                        <img
                            src={lang.flag}
                            alt={lang.label}
                            style={{
                                width: 22,
                                height: 15,
                                borderRadius: 2,
                                boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                                objectFit: 'cover'
                            }}
                        />
                        <span style={{ color: '#fff', fontWeight: 500 }}>{lang.label}</span>
                    </Space>
                </Option>
            ))}
        </Select>
    );
};

export default LanguageSwitcher;
