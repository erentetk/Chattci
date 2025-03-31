import React, { useState, useCallback, useEffect } from 'react';
import { View, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform, SafeAreaView } from 'react-native';
import { GiftedChat, Bubble } from 'react-native-gifted-chat';
import 'react-native-get-random-values';
import { colors } from '../config/constants';

const Chat = ({ route, navigation }) => {
    const [messages, setMessages] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const { name = 'Sohbet' } = route?.params || {};

    useEffect(() => {
        // Başlık ayarı
        navigation?.setOptions({
            title: name,
            headerShown: true,
            headerStyle: {
                backgroundColor: colors.primary,
            },
            headerTintColor: 'white',
            headerTitleStyle: {
                fontWeight: 'bold',
            },
        });

        // Örnek mesajlar oluşturalım
        setTimeout(() => {
            setMessages([
                {
                    _id: 1,
                    text: 'Merhaba, nasılsınız?',
                    createdAt: new Date(),
                    user: {
                        _id: 2,
                        name: name,
                        avatar: 'https://ui-avatars.com/api/?name=' + encodeURIComponent(name) + '&background=random',
                    },
                },
                {
                    _id: 2,
                    text: 'Hoş geldiniz!',
                    createdAt: new Date(Date.now() - 1000 * 60),
                    user: {
                        _id: 2,
                        name: name,
                        avatar: 'https://ui-avatars.com/api/?name=' + encodeURIComponent(name) + '&background=random',
                    },
                },
            ]);
            setIsLoading(false);
        }, 1000);
    }, [navigation, name]);

    // Mesaj gönderme işlevi
    const onSend = useCallback((newMessages = []) => {
        setMessages(previousMessages =>
            GiftedChat.append(previousMessages, newMessages)
        );
    }, []);

    // Mesaj baloncuklarının özelleştirilmesi
    const renderBubble = (props) => {
        return (
            <Bubble
                {...props}
                wrapperStyle={{
                    right: {
                        backgroundColor: colors.primary,
                    },
                    left: {
                        backgroundColor: '#E8E8E8',
                    },
                }}
                textStyle={{
                    right: {
                        color: 'white',
                    },
                    left: {
                        color: 'black',
                    },
                }}
            />
        );
    };

    if (isLoading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
            </View>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <KeyboardAvoidingView
                style={styles.container}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}
            >
                <GiftedChat
                    messages={messages}
                    onSend={onSend}
                    user={{
                        _id: 1,
                    }}
                    renderBubble={renderBubble}
                    placeholder="Mesajınızı yazın..."
                    alwaysShowSend
                    scrollToBottom
                    textInputStyle={styles.textInput}
                    bottomOffset={Platform.OS === 'ios' ? 10 : 0}
                />
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'white',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    textInput: {
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#E8E8E8',
        marginRight: 10,
        paddingHorizontal: 15,
        paddingTop: 8,
        paddingBottom: 8,
        minHeight: 40
    }
});

export default Chat;