import React, { useState } from "react";
import { View, Text, StyleSheet, SafeAreaView, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, Alert, ActivityIndicator } from "react-native";
import { colors } from "../config/constants";
import { Ionicons } from "@expo/vector-icons";
import supabase from "../config/supabase";
import { useAuth } from '../App';

const SignUp = ({ navigation }) => {
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [isPasswordVisible, setIsPasswordVisible] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const { checkUser } = useAuth();

    // Platforma özgü uyarı fonksiyonu
    const showAlert = (title, message, actions = []) => {
        if (Platform.OS === 'web') {
            // Web için özel uyarı modalı
            alert(`${title}\n\n${message}`);
            // Eğer action varsa ve "Tamam" ise, callback'i çağır
            if (actions.length > 0 && actions[0].onPress) {
                actions[0].onPress();
            }
        } else {
            // Mobil için normal Alert
            Alert.alert(title, message, actions);
        }
    };

    const handleSignUp = async () => {
        // Basit validasyon kontrolü
        if (!name.trim()) {
            showAlert("Hata", "Lütfen adınızı girin");
            return;
        }
        if (!email.trim() || !email.includes('@')) {
            showAlert("Hata", "Lütfen geçerli bir e-posta adresi girin");
            return;
        }
        if (password.length < 6) {
            showAlert("Hata", "Şifre en az 6 karakter olmalıdır");
            return;
        }

        setIsLoading(true);

        try {
            // 1. Supabase Auth ile kullanıcı oluştur
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email,
                password,
            });

            if (authError) throw authError;

            if (authData?.user) {
                // Kullanıcı adı oluştur (e-posta adresinin @ işaretinden önceki kısmı)
                const username = email.split('@')[0] + Math.floor(Math.random() * 1000);

                // 2. Kullanıcılar tablosuna kaydet
                const { error: profileError } = await supabase
                    .from('users')
                    .insert([
                        {
                            id: authData.user.id,
                            username,
                            email,
                            full_name: name,
                            avatar_url: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random`
                        }
                    ]);

                if (profileError) throw profileError;

                // Kullanıcıyı kontrol etmek için checkUser fonksiyonunu çağır
                await checkUser();

                showAlert(
                    "Başarılı",
                    "Hesabınız oluşturuldu! Emailinize mail gönderildi. Onay linkine tıklayarak hesabınızı aktif edebilirsiniz.",
                    [{ text: "Tamam", onPress: () => navigation.navigate('Login') }]
                );
            }
        } catch (error) {
            console.error('Kayıt hatası:', error.message);

            if (error.message.includes('already registered')) {
                showAlert("Hata", "Bu e-posta adresi zaten kayıtlı");
            } else if (error.message.includes('unique constraint')) {
                showAlert("Hata", "Bu kullanıcı adı zaten alınmış");
            } else {
                showAlert("Hata", "Kayıt işlemi başarısız oldu. Lütfen tekrar deneyin.");
            }
        } finally {
            setIsLoading(false);
        }
    };

    const handleSignIn = () => {
        // Login sayfasına yönlendir
        navigation.navigate('Login');
    };

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
            <SafeAreaView style={styles.safeArea}>
                <View style={styles.contentContainer}>
                    <Text style={styles.title}>Yeni Hesap Oluştur</Text>

                    <View style={styles.inputContainer}>
                        <Ionicons name="person-outline" size={22} color={colors.darkGray} style={styles.inputIcon} />
                        <TextInput
                            style={styles.input}
                            placeholder="Adınız"
                            placeholderTextColor={colors.text.secondary}
                            value={name}
                            onChangeText={setName}
                            autoCapitalize="words"
                        />
                    </View>

                    <View style={styles.inputContainer}>
                        <Ionicons name="mail-outline" size={22} color={colors.darkGray} style={styles.inputIcon} />
                        <TextInput
                            style={styles.input}
                            placeholder="E-posta"
                            placeholderTextColor={colors.text.secondary}
                            value={email}
                            onChangeText={setEmail}
                            keyboardType="email-address"
                            autoCapitalize="none"
                        />
                    </View>

                    <View style={styles.inputContainer}>
                        <Ionicons name="lock-closed-outline" size={22} color={colors.darkGray} style={styles.inputIcon} />
                        <TextInput
                            style={styles.input}
                            placeholder="Şifre"
                            placeholderTextColor={colors.text.secondary}
                            secureTextEntry={!isPasswordVisible}
                            value={password}
                            onChangeText={setPassword}
                            autoCapitalize="none"
                        />
                        <TouchableOpacity
                            style={styles.visibilityButton}
                            onPress={() => setIsPasswordVisible(!isPasswordVisible)}
                        >
                            <Ionicons
                                name={isPasswordVisible ? "eye-off-outline" : "eye-outline"}
                                size={22}
                                color={colors.darkGray}
                            />
                        </TouchableOpacity>
                    </View>
                    <TouchableOpacity
                        style={styles.signUpButton}
                        onPress={handleSignUp}
                        disabled={isLoading}
                        activeOpacity={0.7}
                    >
                        {isLoading ? (
                            <View style={styles.loadingContainer}>
                                <ActivityIndicator size="small" color="white" />
                                <Text style={[styles.signUpButtonText, { marginLeft: 8 }]}>
                                    İşleniyor...
                                </Text>
                            </View>
                        ) : (
                            <Text style={styles.signUpButtonText}>
                                Kayıt Ol
                            </Text>
                        )}
                    </TouchableOpacity>

                    <View style={styles.signInContainer}>
                        <Text style={styles.signInText}>Zaten hesabınız var mı?</Text>
                        <TouchableOpacity onPress={handleSignIn}>
                            <Text style={styles.signInButton}>Giriş Yap</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </SafeAreaView>
        </KeyboardAvoidingView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.primary,
    },
    safeArea: {
        flex: 1,
    },
    contentContainer: {
        padding: 24,
        flex: 1,
        justifyContent: 'center',
    },
    title: {
        fontSize: 32,
        fontWeight: 'bold',
        color: 'white',
        marginBottom: 32,
        textAlign: 'center',
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        borderRadius: 10,
        marginBottom: 16,
        paddingHorizontal: 12,
    },
    inputIcon: {
        marginRight: 8,
    },
    input: {
        flex: 1,
        fontSize: 16,
        paddingVertical: 14,
        color: colors.text.primary,
    },
    visibilityButton: {
        padding: 8,
    },
    signUpButton: {
        backgroundColor: 'white',
        paddingVertical: 16,
        borderRadius: 10,
        marginTop: 24,
        alignItems: 'center',
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.1,
        shadowRadius: 3.84,
        elevation: 5,
    },
    signUpButtonText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: colors.primary,
    },
    signInContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginTop: 24,
    },
    signInText: {
        fontSize: 14,
        color: 'white',
    },
    signInButton: {
        fontSize: 14,
        fontWeight: 'bold',
        color: 'white',
        marginLeft: 5,
        textDecorationLine: 'underline',
    },
    loadingContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
});

export default SignUp;
