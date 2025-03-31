import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking } from 'react-native';
import { colors } from '../config/constants';
import { Ionicons } from '@expo/vector-icons';

const HelpItem = ({ title, description, icon }) => (
    <View style={styles.helpItem}>
        <View style={styles.iconContainer}>
            <Ionicons name={icon} size={24} color={colors.primary} />
        </View>
        <View style={styles.textContainer}>
            <Text style={styles.itemTitle}>{title}</Text>
            <Text style={styles.itemDescription}>{description}</Text>
        </View>
    </View>
);

const Help = () => {
    const openSupport = () => {
        Linking.openURL('mailto:support@chattcii.com');
    };

    return (
        <ScrollView style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Nasıl Yardımcı Olabiliriz?</Text>
                <Text style={styles.headerSubtitle}>
                    Sık sorulan sorular ve yardım konuları
                </Text>
            </View>

            <View style={styles.section}>
                <HelpItem
                    title="Mesaj Gönderme"
                    description="Sohbet ekranında mesaj yazmak için alt kısımdaki metin kutusunu kullanın."
                    icon="chatbubble-outline"
                />
                <HelpItem
                    title="Profil Düzenleme"
                    description="Ayarlar > Profili Düzenle menüsünden profil bilgilerinizi güncelleyebilirsiniz."
                    icon="person-outline"
                />
                <HelpItem
                    title="Bildirimler"
                    description="Bildirim ayarlarınızı Ayarlar > Bildirimler menüsünden özelleştirebilirsiniz."
                    icon="notifications-outline"
                />
                <HelpItem
                    title="Güvenlik"
                    description="Şifrenizi değiştirmek için Ayarlar > Şifre Değiştir seçeneğini kullanın."
                    icon="shield-outline"
                />
            </View>

            <View style={styles.supportSection}>
                <Text style={styles.supportTitle}>Hala yardıma mı ihtiyacınız var?</Text>
                <TouchableOpacity style={styles.supportButton} onPress={openSupport}>
                    <Text style={styles.supportButtonText}>Destek Ekibine Ulaşın</Text>
                </TouchableOpacity>
            </View>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f5f5',
    },
    header: {
        padding: 20,
        backgroundColor: colors.primary,
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: 'white',
        marginBottom: 8,
    },
    headerSubtitle: {
        fontSize: 16,
        color: 'rgba(255,255,255,0.8)',
    },
    section: {
        padding: 15,
    },
    helpItem: {
        flexDirection: 'row',
        backgroundColor: 'white',
        padding: 15,
        borderRadius: 10,
        marginBottom: 15,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    iconContainer: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#f0f0f0',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 15,
    },
    textContainer: {
        flex: 1,
    },
    itemTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 5,
        color: '#333',
    },
    itemDescription: {
        fontSize: 14,
        color: '#666',
        lineHeight: 20,
    },
    supportSection: {
        padding: 20,
        alignItems: 'center',
    },
    supportTitle: {
        fontSize: 18,
        fontWeight: '600',
        marginBottom: 15,
        color: '#333',
    },
    supportButton: {
        backgroundColor: colors.primary,
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 25,
    },
    supportButtonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: '600',
    },
});

export default Help; 