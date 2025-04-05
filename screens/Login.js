import React, { useState } from 'react';
import { View, TextInput, StyleSheet, Text, TouchableOpacity, Alert, ActivityIndicator, KeyboardAvoidingView, Platform, TouchableWithoutFeedback, Keyboard } from 'react-native';
import { colors } from '../config/constants';
import Button from '../components/Button';
import Separator from '../components/Seperator';
import supabase from '../config/supabase';
import { useAuth } from '../App';
import { chats } from '../config/constants';

const Login = ({ navigation }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const { setUser, checkUser } = useAuth();

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

    const handleLogin = async () => {
        if (!email || !password) {
            setError('Lütfen e-posta ve şifrenizi girin');
            return;
        }

        // E-posta doğrulama kontrolü
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            setError('Geçersiz e-posta formatı. Lütfen doğru bir e-posta adresi girin.');
            return;
        }

        // .com yerine .coım yazılmış olabilir mi kontrolü
        if (email.includes('gmail.coım')) {
            const correctedEmail = email.replace('gmail.coım', 'gmail.com');
            setError(`E-posta adresiniz hatalı olabilir. Belki şunu demek istediniz: ${correctedEmail}?`);
            return;
        }

        try {
            setLoading(true);
            setError('');

            console.log('Giriş denemesi:', email);

            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            console.log('Giriş yanıtı:', data ? 'Başarılı' : 'Başarısız');

            if (error) {
                console.error('Supabase hata detayı:', error);
                if (error.message.includes('Email not confirmed')) {
                    setError('E-posta adresiniz henüz doğrulanmamış. Lütfen e-posta kutunuzu kontrol edin ve doğrulama bağlantısına tıklayın.');

                    // Opsiyonel: Doğrulama e-postasını yeniden gönder
                    try {
                        await supabase.auth.resend({
                            type: 'signup',
                            email: email
                        });
                        showAlert(
                            'Bilgi',
                            'Doğrulama e-postası yeniden gönderildi. Lütfen e-posta kutunuzu kontrol edin.'
                        );
                    } catch (resendError) {
                        console.error('Doğrulama e-postası gönderme hatası:', resendError);
                    }
                    return;
                }
                throw error;
            }

            if (data?.user) {
                console.log('Kullanıcı girişi başarılı, yönlendiriliyor...');

                // Kullanıcının veritabanında da olduğunu kontrol et
                const { data: userData, error: userError } = await supabase
                    .from('users')
                    .select('*')
                    .eq('id', data.user.id);

                if (userError || !userData || userData.length === 0) {
                    await supabase.auth.signOut();
                    setError('Kullanıcı profili bulunamadı. Lütfen hesabınızı yeniden oluşturun.');
                    return;
                }

                // Oturum durumunu güncelle
                setUser(data.user);

                // Auth Provider'daki kontrol mekanizmasını çalıştır
                await checkUser();
            } else {
                setError('Giriş başarılı oldu, ancak kullanıcı verisi alınamadı.');
            }
        } catch (error) {
            console.error('Giriş hatası:', error.message, error);

            if (error.message.includes('Invalid login credentials')) {
                setError('E-posta veya şifre hatalı. Lütfen bilgilerinizi kontrol edin ve yazım hatası olup olmadığını dikkatle inceleyin.');
            } else if (error.message.includes('network')) {
                setError('Ağ bağlantı sorunu. İnternet bağlantınızı kontrol edin.');
            } else if (error.message.includes('timeout')) {
                setError('Bağlantı zaman aşımına uğradı. Lütfen tekrar deneyin.');
            } else {
                setError(`Giriş yapılamadı: ${error.message}`);
            }
        } finally {
            setLoading(false);
        }
    };

    const navigateToSignUp = () => {
        navigation.navigate('SignUp');
    };

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={styles.container}
        >
            <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                <View style={styles.inner}>
                    <View style={styles.logoContainer}>
                        <Text style={styles.logoText}>Chat App</Text>
                    </View>

                    <View style={styles.formContainer}>
                        <Text style={styles.title}>Giriş Yap</Text>

                        {error ? <Text style={styles.errorText}>{error}</Text> : null}

                        <TextInput
                            placeholder="E-posta"
                            value={email}
                            onChangeText={setEmail}
                            style={styles.input}
                            autoCapitalize="none"
                            keyboardType="email-address"
                        />

                        <TextInput
                            placeholder="Şifre"
                            value={password}
                            onChangeText={setPassword}
                            style={styles.input}
                            secureTextEntry
                        />

                        <Button
                            label={loading ? "Giriş Yapılıyor..." : "Giriş Yap"}
                            onPress={handleLogin}
                            disabled={loading}
                        />

                        <Separator label="veya" />

                        <View style={styles.signupContainer}>
                            <Text style={styles.accountText}>Hesabınız yok mu?</Text>
                            <TouchableOpacity onPress={navigateToSignUp}>
                                <Text style={styles.signupText}>Kaydol</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    inner: {
        flex: 1,
        justifyContent: 'center',
        padding: 20,
    },
    logoContainer: {
        alignItems: 'center',
        marginBottom: 40,
    },
    logoText: {
        fontSize: 30,
        fontWeight: 'bold',
        color: colors.primary,
    },
    formContainer: {
        width: '100%',
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 20,
        textAlign: 'center',
    },
    input: {
        borderWidth: 1,
        borderColor: '#ddd',
        padding: 15,
        borderRadius: 10,
        marginBottom: 15,
        fontSize: 16,
    },
    errorText: {
        color: 'red',
        marginBottom: 15,
        textAlign: 'center',
    },
    signupContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginTop: 20,
    },
    accountText: {
        fontSize: 16,
        color: '#333',
    },
    signupText: {
        fontSize: 16,
        color: colors.primary,
        fontWeight: 'bold',
        marginLeft: 5,
    },
});

export default Login; 