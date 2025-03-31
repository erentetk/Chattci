import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Switch, Platform } from 'react-native';
import { colors } from '../config/constants';

// Platform'a özgü depolama çözümü
// Web'de localStorage, mobil'de AsyncStorage kullanır
const storage = {
    // Veri okuma işlemi
    getItem: async (key) => {
        try {
            if (Platform.OS === 'web') {
                // Web platformunda localStorage kullan
                const item = localStorage.getItem(key);
                return item ? Promise.resolve(item) : null;
            } else {
                // Mobil platformda AsyncStorage kullan
                const AsyncStorage = require('@react-native-async-storage/async-storage').default;
                return await AsyncStorage.getItem(key);
            }
        } catch (error) {
            console.error('Storage getItem error:', error);
            return null;
        }
    },
    // Veri kaydetme işlemi
    setItem: async (key, value) => {
        try {
            if (Platform.OS === 'web') {
                // Web platformunda localStorage kullan
                localStorage.setItem(key, value);
                return Promise.resolve();
            } else {
                // Mobil platformda AsyncStorage kullan
                const AsyncStorage = require('@react-native-async-storage/async-storage').default;
                return await AsyncStorage.setItem(key, value);
            }
        } catch (error) {
            console.error('Storage setItem error:', error);
        }
    }
};

const Notifications = () => {
    // Bildirim ayarlarının durumunu tutan state
    const [settings, setSettings] = useState({
        messageNotifications: true, // Mesaj bildirimleri varsayılan olarak açık
        groupNotifications: true,   // Grup bildirimleri varsayılan olarak açık
        soundEnabled: true,         // Bildirim sesi varsayılan olarak açık
        vibrationEnabled: true,     // Titreşim varsayılan olarak açık
    });

    // Komponent yüklendiğinde kayıtlı ayarları yükle
    useEffect(() => {
        loadSettings();
    }, []);

    // Kaydedilmiş ayarları storage'dan yükle
    const loadSettings = async () => {
        try {
            const savedSettings = await storage.getItem('notificationSettings');
            if (savedSettings) {
                setSettings(JSON.parse(savedSettings));
            }
        } catch (error) {
            console.error('Ayarlar yüklenirken hata:', error);
        }
    };

    // Ayarları güncelle ve storage'a kaydet
    const updateSetting = async (key, value) => {
        try {
            // Yeni ayarları oluştur
            const newSettings = { ...settings, [key]: value };
            // State'i güncelle
            setSettings(newSettings);
            // Storage'a kaydet
            await storage.setItem('notificationSettings', JSON.stringify(newSettings));
        } catch (error) {
            console.error('Ayar güncellenirken hata:', error);
        }
    };

    return (
        <View style={styles.container}>
            {/* Bildirim türleri bölümü */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Bildirim Türleri</Text>

                {/* Mesaj bildirimleri ayarı */}
                <View style={styles.settingItem}>
                    <Text style={styles.settingText}>Mesaj Bildirimleri</Text>
                    <Switch
                        value={settings.messageNotifications}
                        onValueChange={(value) => updateSetting('messageNotifications', value)}
                        trackColor={{ false: '#767577', true: colors.primary }}
                    />
                </View>

                {/* Grup bildirimleri ayarı */}
                <View style={styles.settingItem}>
                    <Text style={styles.settingText}>Grup Bildirimleri</Text>
                    <Switch
                        value={settings.groupNotifications}
                        onValueChange={(value) => updateSetting('groupNotifications', value)}
                        trackColor={{ false: '#767577', true: colors.primary }}
                    />
                </View>
            </View>

            {/* Ses ve titreşim ayarları bölümü */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Ses ve Titreşim</Text>

                {/* Bildirim sesi ayarı */}
                <View style={styles.settingItem}>
                    <Text style={styles.settingText}>Bildirim Sesi</Text>
                    <Switch
                        value={settings.soundEnabled}
                        onValueChange={(value) => updateSetting('soundEnabled', value)}
                        trackColor={{ false: '#767577', true: colors.primary }}
                    />
                </View>

                {/* Titreşim ayarı */}
                <View style={styles.settingItem}>
                    <Text style={styles.settingText}>Titreşim</Text>
                    <Switch
                        value={settings.vibrationEnabled}
                        onValueChange={(value) => updateSetting('vibrationEnabled', value)}
                        trackColor={{ false: '#767577', true: colors.primary }}
                    />
                </View>
            </View>

            {/* Bilgilendirme notu */}
            <Text style={styles.note}>
                Not: Bildirim ayarlarını değiştirdiğinizde otomatik olarak kaydedilir.
            </Text>
        </View>
    );
};

// Stil tanımlamaları
const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f5f5',
        padding: 20,
    },
    section: {
        backgroundColor: 'white',
        borderRadius: 10,
        padding: 20,
        marginBottom: 20,
        // Gölgelendirme efekti
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3, // Android için gölge
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 15,
        color: '#333',
    },
    settingItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
    settingText: {
        fontSize: 16,
        color: '#444',
    },
    note: {
        fontSize: 14,
        color: '#666',
        fontStyle: 'italic',
        textAlign: 'center',
        marginTop: 20,
    },
});

export default Notifications; 