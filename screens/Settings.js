import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Alert, ActivityIndicator, ScrollView, Platform, TouchableOpacity } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Cell from '../components/Cell';
import { colors } from '../config/constants';
import supabase from '../config/supabase';
import Ionicons from 'react-native-vector-icons/Ionicons';

const Settings = ({ navigation }) => {
    const [loading, setLoading] = useState(false);
    const [user, setUser] = useState(null);
    const [profileLoading, setProfileLoading] = useState(true);

    // Platforma özgü uyarı fonksiyonu
    const showAlert = (title, message, actions = []) => {
        if (Platform.OS === 'web') {
            // Web için özel uyarı modalı
            alert(`${title}\n\n${message}`);
            // Eğer action varsa ve callback'i çağır
            if (actions && actions.length > 0) {
                const confirmAction = actions.find(action => action.style === 'destructive' || action.text === 'Tamam');
                if (confirmAction && confirmAction.onPress) {
                    confirmAction.onPress();
                }
            }
        } else {
            // Mobil için normal Alert
            Alert.alert(title, message, actions);
        }
    };

    useEffect(() => {
        fetchUserProfile();
    }, []);

    const fetchUserProfile = async () => {
        try {
            setProfileLoading(true);

            // Mevcut kullanıcı bilgilerini al
            const { data: { user } } = await supabase.auth.getUser();

            if (user) {
                // Kullanıcı profilini veritabanından çek
                const { data, error } = await supabase
                    .from('users')
                    .select('*')
                    .eq('id', user.id);

                if (error) throw error;

                // Kullanıcı veritabanında bulunamadı, oturumu sonlandır
                if (!data || data.length === 0) {
                    console.log('Kullanıcı veritabanında bulunamadı, oturum sonlandırılıyor');
                    // Otomatik çıkış yap
                    await handleLogout();
                    return;
                }

                setUser(data[0]);
            } else {
                // Kullanıcı oturumu yoksa login sayfasına yönlendir
                console.log('Kullanıcı oturumu bulunamadı, login sayfasına yönlendiriliyor');
                setTimeout(() => {
                    navigation.reset({
                        index: 0,
                        routes: [{ name: 'Login' }],
                    });
                }, 100);
                return;
            }
        } catch (error) {
            console.error('Profil bilgisi çekme hatası:', error.message);
            // Kritik bir hata oluşursa login sayfasına yönlendir
            if (error.message.includes('multiple (or no) rows returned')) {
                showAlert('Hata', 'Kullanıcı bilgileri bulunamadı, lütfen tekrar giriş yapın.');
                await handleLogout();
            }
        } finally {
            setProfileLoading(false);
        }
    };

    const handleLogout = async () => {
        try {
            setLoading(true);

            // Önce Supabase oturumunu sonlandır
            const { error } = await supabase.auth.signOut();
            if (error) throw error;
            console.log(error);

            // Platform bazlı storage temizleme
            if (Platform.OS === 'web') {
                // Web için localStorage
                localStorage.clear();
            } else {
                // Mobil için AsyncStorage
                await AsyncStorage.clear();
            }

            // Supabase auth state'ini sıfırla
            await supabase.auth.refreshSession();

            // Login ekranına yönlendir
            navigation.reset({
                index: 0,
                routes: [{ name: 'Login' }],
            });

        } catch (error) {
            console.error('Çıkış hatası:', error.message);
            showAlert('Hata', 'Çıkış yapılırken bir hata oluştu.');
        } finally {
            setLoading(false);
        }
    };

    const confirmLogout = () => {
        if (Platform.OS === 'web') {
            const confirmed = window.confirm('Çıkış yapmak istediğinize emin misiniz?');
            if (confirmed) {
                handleLogout();
            }
        } else {
            showAlert(
                'Çıkış Yap',
                'Çıkış yapmak istediğinize emin misiniz?',
                [
                    { text: 'İptal', style: 'cancel' },
                    { text: 'Çıkış Yap', onPress: handleLogout, style: 'destructive' }
                ]
            );
        }
    };

    if (profileLoading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <ScrollView contentContainerStyle={styles.scrollContainer}>
                {user && (
                    <View style={styles.profileSection}>
                        <View style={styles.avatarContainer}>
                            <Text style={styles.avatarText}>
                                {user.full_name ? user.full_name.charAt(0).toUpperCase() : '?'}
                            </Text>
                        </View>
                        <Text style={styles.userName}>{user.full_name || 'Kullanıcı'}</Text>
                        <Text style={styles.userInfo}>@{user.username || 'kullanıcı'}</Text>
                        <Text style={styles.userInfo}>{user.email}</Text>
                    </View>
                )}

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Hesap</Text>
                    <Cell
                        title="Profili Düzenle"
                        icon="person"
                        onPress={() => {
                            navigation.navigate('EditProfile');
                            // Yardım sayfasına git
                        }}
                    />

                    <Cell
                        title="Şifre Değiştir"
                        icon="key"
                        onPress={async () => {
                            try {
                                const { data: { user } } = await supabase.auth.getUser();
                                if (!user?.email) {
                                    showAlert('Hata', 'Kullanıcı e-posta adresi bulunamadı.');
                                    return;
                                }

                                // Web ve mobil için farklı redirectTo URL'leri kullan
                                const redirectTo = Platform.OS === 'web'
                                    ? `${window.location.origin}/reset-password`
                                    : 'chattcii://reset-password';

                                const { error } = await supabase.auth.resetPasswordForEmail(
                                    user.email,
                                    {
                                        redirectTo: redirectTo
                                    }
                                );

                                if (error) {
                                    console.error('Şifre sıfırlama e-posta hatası:', error.message);
                                    showAlert('Hata', 'Şifre sıfırlama e-postası gönderilemedi: ' + error.message);
                                } else {
                                    showAlert(
                                        'Başarılı',
                                        'Şifre sıfırlama e-postası gönderildi. Lütfen e-posta kutunuzu kontrol edin ve gelen bağlantıya tıklayın.'
                                    );
                                }
                            } catch (error) {
                                console.error('Şifre sıfırlama hatası:', error);
                                showAlert('Hata', 'Bir sorun oluştu. Lütfen daha sonra tekrar deneyin.');
                            }
                        }}
                    />
                    <Cell
                        title="Bildirimler"
                        icon="notifications"
                        onPress={() => {
                            navigation.navigate('Notifications');
                        }}
                    />
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Uygulama</Text>
                    <Cell
                        title="Hakkında"
                        icon="information-circle"
                        onPress={() => {
                            navigation.navigate('About');
                        }}
                    />
                    <Cell
                        title="Yardım"
                        icon="help-circle"
                        onPress={() => {
                            navigation.navigate('Help');
                            // Yardım sayfasına git
                        }}
                    />
                </View>

                <View style={styles.logoutSection}>
                    <Cell
                        title="Çıkış Yap"
                        icon="log-out"
                        onPress={confirmLogout}
                        isDestructive={true}
                        loading={loading}
                    />
                </View>
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f5f5',
    },
    scrollContainer: {
        flexGrow: 1,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    header: {
        backgroundColor: colors.primary,
        paddingVertical: 50,
        paddingHorizontal: 20,
        marginBottom: 20,
    },
    title: {
        fontSize: 22,
        fontWeight: 'bold',
        color: 'white',
    },
    profileSection: {
        backgroundColor: 'white',
        padding: 20,
        marginBottom: 20,
        marginTop: 15,
        borderRadius: 10,
        marginHorizontal: 15,
        alignItems: 'center',
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 1,
    },
    avatarContainer: {
        //yukarıdanboşluk bırak
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 15,
        marginTop: 15

    },
    avatarText: {
        fontSize: 36,
        color: 'white',
        fontWeight: 'bold',
    },
    userName: {
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 5,
    },
    userInfo: {
        fontSize: 14,
        color: '#666',
        marginBottom: 3,
    },
    section: {
        marginBottom: 20,
        marginHorizontal: 15,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 10,
        marginLeft: 5,
        color: '#444',
    },
    logoutSection: {
        marginHorizontal: 15,
        marginTop: 'auto',
        marginBottom: 30,
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 10,
    },
    menuItemContent: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    menuItemText: {
        fontSize: 16,
        fontWeight: 'bold',
        marginLeft: 10,
    },
});

export default Settings;  