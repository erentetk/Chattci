import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, Platform, ActivityIndicator } from 'react-native';
import { colors } from '../config/constants';
import supabase from '../config/supabase';

const ResetPassword = ({ navigation, route }) => {
    const [newPassword, setNewPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [validToken, setValidToken] = useState(false);

    useEffect(() => {
        checkResetToken();
    }, []);

    const checkResetToken = async () => {
        try {
            // Web platformunda URL'den token kontrolü
            if (Platform.OS === 'web') {
                const hashParams = new URLSearchParams(window.location.hash.replace('#', ''));
                const type = hashParams.get('type');
                const accessToken = hashParams.get('access_token');

                if (type !== 'recovery' || !accessToken) {
                    throw new Error('Geçersiz şifre sıfırlama bağlantısı');
                }

                // Token'ı session'a set et
                const { data, error } = await supabase.auth.setSession({
                    access_token: accessToken,
                    refresh_token: null
                });

                if (error) throw error;
                setValidToken(true);
            } else {
                // Mobil platformda deep link ile gelen token kontrolü
                // Deep link işlemleri burada yapılacak
                setValidToken(true);
            }
        } catch (error) {
            console.error('Token kontrolü hatası:', error);
            Alert.alert(
                'Hata',
                'Geçersiz veya süresi dolmuş şifre sıfırlama bağlantısı. Lütfen tekrar deneyin.',
                [{ text: 'Tamam', onPress: () => navigation.replace('Login') }]
            );
        }
    };

    const handleResetPassword = async () => {
        if (!validToken) {
            Alert.alert('Hata', 'Geçersiz şifre sıfırlama oturumu.');
            return;
        }

        if (newPassword.length < 6) {
            Alert.alert('Hata', 'Şifre en az 6 karakter olmalıdır.');
            return;
        }

        try {
            setLoading(true);
            const { error } = await supabase.auth.updateUser({
                password: newPassword
            });

            if (error) throw error;

            Alert.alert(
                'Başarılı',
                'Şifreniz başarıyla güncellendi. Lütfen yeni şifrenizle giriş yapın.',
                [{ text: 'Tamam', onPress: () => navigation.replace('Login') }]
            );
        } catch (error) {
            console.error('Şifre güncelleme hatası:', error.message);
            Alert.alert('Hata', 'Şifre güncellenirken bir hata oluştu: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    if (!validToken) {
        return (
            <View style={styles.container}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={styles.message}>Token kontrol ediliyor...</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Yeni Şifre Belirle</Text>
            <TextInput
                style={styles.input}
                placeholder="Yeni şifre (en az 6 karakter)"
                secureTextEntry
                value={newPassword}
                onChangeText={setNewPassword}
            />
            <TouchableOpacity
                style={styles.button}
                onPress={handleResetPassword}
                disabled={loading}
            >
                <Text style={styles.buttonText}>
                    {loading ? 'Güncelleniyor...' : 'Şifreyi Güncelle'}
                </Text>
            </TouchableOpacity>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 20,
        justifyContent: 'center',
        backgroundColor: '#f5f5f5',
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 20,
        textAlign: 'center',
    },
    input: {
        backgroundColor: 'white',
        padding: 15,
        borderRadius: 8,
        marginBottom: 15,
        borderWidth: 1,
        borderColor: '#ddd',
    },
    button: {
        backgroundColor: colors.primary,
        padding: 15,
        borderRadius: 8,
        alignItems: 'center',
    },
    buttonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: '600',
    },
    message: {
        marginTop: 10,
        textAlign: 'center',
        color: '#666',
    }
});

export default ResetPassword; 