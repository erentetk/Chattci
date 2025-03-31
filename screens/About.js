import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { colors } from '../config/constants';
import { Ionicons } from '@expo/vector-icons';

const About = () => {
    return (
        <ScrollView style={styles.container}>
            <View style={styles.header}>
                <View style={styles.iconContainer}>
                    <Ionicons name="chatbubbles" size={60} color={colors.primary} />
                </View>
                <Text style={styles.appName}>ChattCii</Text>
                <Text style={styles.version}>Versiyon 1.0.0</Text>
            </View>

            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Uygulama Hakkında</Text>
                <Text style={styles.description}>
                    ChattCii, kullanıcıların güvenli ve hızlı bir şekilde mesajlaşmasını sağlayan modern bir iletişim uygulamasıdır.
                </Text>
            </View>

            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Özellikler</Text>
                <Text style={styles.bulletPoint}>• Anlık mesajlaşma</Text>
                <Text style={styles.bulletPoint}>• Grup sohbetleri</Text>
                <Text style={styles.bulletPoint}>• Medya paylaşımı</Text>
                <Text style={styles.bulletPoint}>• Güvenli iletişim</Text>
            </View>

            <View style={styles.section}>
                <Text style={styles.sectionTitle}>İletişim</Text>
                <Text style={styles.description}>
                    Sorularınız ve önerileriniz için:
                    {'\n'}support@chattcii.com
                </Text>
            </View>

            <Text style={styles.copyright}>
                © 2024 ChattCii. Tüm hakları saklıdır.
            </Text>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f5f5',
    },
    header: {
        alignItems: 'center',
        padding: 20,
        backgroundColor: 'white',
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },
    iconContainer: {
        width: 100,
        height: 100,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 10,
        backgroundColor: '#f0f0f0',
        borderRadius: 20,
    },
    appName: {
        fontSize: 24,
        fontWeight: 'bold',
        color: colors.primary,
    },
    version: {
        fontSize: 16,
        color: '#666',
        marginTop: 5,
    },
    section: {
        backgroundColor: 'white',
        padding: 20,
        marginTop: 15,
        marginHorizontal: 15,
        borderRadius: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 10,
        color: '#333',
    },
    description: {
        fontSize: 16,
        color: '#444',
        lineHeight: 24,
    },
    bulletPoint: {
        fontSize: 16,
        color: '#444',
        marginBottom: 8,
        lineHeight: 24,
    },
    copyright: {
        textAlign: 'center',
        color: '#666',
        padding: 20,
        fontSize: 14,
    },
});

export default About; 