import React, { useState, useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import { View, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform, SafeAreaView, Text, TextInput, TouchableOpacity } from 'react-native';
import { GiftedChat, Bubble, InputToolbar, Send, Composer } from 'react-native-gifted-chat';
import 'react-native-get-random-values';
import { colors } from '../config/constants';
import { useAuth } from '../App'; // Import useAuth
import { getMessagesByConversation, sendMessage, subscribeToMessages } from '../services/chatService'; // Import chat services
import { Ionicons } from '@expo/vector-icons'; // For Send button icon
import { SafeAreaView as SafeAreaViewContext } from 'react-native-safe-area-context'; // Use safe-area-context for better edge handling

// Helper to map Supabase message format to GiftedChat format
// Adjusted to work without profile data directly attached to the message
const formatMessageForGiftedChat = (message, currentUserId, otherParticipant) => {
    if (!message || !message.sender_id) {
        console.warn("formatMessageForGiftedChat: Invalid message object received", message);
        return null; // Skip invalid messages
    }

    // Eksik veriler için güvenlik kontrolleri
    const validOtherParticipant = otherParticipant && typeof otherParticipant === 'object' ? otherParticipant : {
        id: 'unknown-user',
        name: 'Bilinmeyen Kullanıcı',
        avatarUrl: null
    };

    // Determine user object for GiftedChat based on sender_id
    let giftedUser;
    if (message.sender_id === currentUserId) {
        // Current user's message
        giftedUser = {
            _id: currentUserId || 'current-user',
            name: 'Siz',
        };
    } else if (validOtherParticipant && message.sender_id === validOtherParticipant.id) {
        // Other participant's message - use details passed via navigation/state
        giftedUser = {
            _id: validOtherParticipant.id || 'other-user',
            name: validOtherParticipant.name || 'Bilinmeyen',
            avatar: validOtherParticipant.avatarUrl,
        };
    } else {
        // Fallback if sender is somehow unknown (shouldn't happen in 1-on-1)
        giftedUser = {
            _id: message.sender_id || 'unknown-user',
            name: 'Bilinmeyen',
        };
    }

    try {
        return {
            _id: message.id || `temp-${Date.now()}`, // Use Supabase message ID as GiftedChat _id
            text: message.content || '',
            createdAt: new Date(message.created_at || Date.now()),
            user: giftedUser,
        };
    } catch (err) {
        console.error("Mesaj formatlarken hata:", err);
        // Minimum bir mesaj objesi oluştur
        return {
            _id: `error-${Date.now()}`,
            text: 'Mesaj gösterilemiyor',
            createdAt: new Date(),
            user: giftedUser,
        };
    }
};


const Chat = ({ route, navigation }) => {
    const [messages, setMessages] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const { user } = useAuth(); // Get current user from Auth context
    const { conversationId, otherUserId, name, avatarUrl } = route.params || {}; // Get params passed from Chats screen

    // Mesaj giriş alanı değişkenleri
    const [inputText, setInputText] = useState('');
    const inputRef = useRef(null);
    const [isSending, setIsSending] = useState(false);

    // --- Fetch Initial Messages ---
    useEffect(() => {
        console.log("Sohbet ekranı açılıyor, bilgiler:", { conversationId, otherUserId, name, avatarUrl });

        if (!conversationId || !user) {
            setError("Sohbet bilgileri eksik.");
            setIsLoading(false);
            return;
        }

        if (!otherUserId) {
            console.warn("Chat ekranında otherUserId parametresi eksik! Varsayılan değer kullanılacak.");
        }

        setIsLoading(true);
        setError(null);

        getMessagesByConversation(conversationId)
            .then(({ data, error: fetchError }) => {
                if (fetchError) {
                    console.error("Mesajları getirme hatası:", fetchError);
                    setError("Mesajlar yüklenirken bir hata oluştu.");
                } else {
                    // Prepare other participant info for the formatter
                    const otherParticipantInfo = {
                        id: otherUserId || 'unknown-user',
                        name: name || 'Bilinmeyen Kullanıcı',
                        avatarUrl: avatarUrl
                    };

                    console.log("Formatlamada kullanılacak katılımcı bilgisi:", otherParticipantInfo);

                    const formattedMessages = data
                        .map(msg => formatMessageForGiftedChat(msg, user.id, otherParticipantInfo))
                        .filter(msg => msg !== null); // Filter out any null messages from formatting

                    setMessages(formattedMessages);
                }
            })
            .finally(() => {
                setIsLoading(false);
            });

    }, [conversationId, user]);

    // --- Real-time Subscription ---
    useEffect(() => {
        if (!conversationId || !user) return;

        console.log(`${conversationId} ID'li sohbet için mesaj aboneliği başlatılıyor...`);

        // Subscribe to new messages
        const subscription = subscribeToMessages(conversationId, (payload) => {
            console.log("Yeni mesaj olayı alındı:", payload.eventType);

            // Prepare other participant info for the formatter
            const otherParticipantInfo = { id: otherUserId, name: name, avatarUrl: avatarUrl };

            if (payload.eventType === 'INSERT' && payload.new) {
                console.log("Yeni mesaj alındı:", payload.new.id);

                const newMessage = formatMessageForGiftedChat(payload.new, user.id, otherParticipantInfo);

                // Sadece mesaj geçerliyse ve kendi mesajımız değilse ekle
                // Kendi mesajlarımız onSend fonksiyonu tarafından UI'a eklenir
                if (newMessage && newMessage.user._id !== user.id) {
                    setMessages(previousMessages => {
                        // Mesaj zaten varsa ekleme (çift mesaj önleme)
                        if (previousMessages.some(msg => msg._id === newMessage._id)) {
                            console.log("Bu mesaj zaten eklenmiş, atlanıyor:", newMessage._id);
                            return previousMessages;
                        }

                        console.log("Yeni mesaj UI'a ekleniyor:", newMessage._id);
                        return GiftedChat.append(previousMessages, [newMessage]);
                    });
                }
            }
        });

        // Cleanup subscription on unmount
        return () => {
            console.log(`${conversationId} ID'li sohbet için mesaj aboneliği sonlandırılıyor...`);
            if (subscription && subscription.unsubscribe) {
                subscription.unsubscribe();
            }
        };
    }, [conversationId, user, otherUserId, name, avatarUrl]); // Re-subscribe if any of these change

    // --- Header Title ---
    useLayoutEffect(() => {
        try {
            navigation.setOptions({
                title: name || 'Sohbet',
                headerShown: true,
                headerStyle: {
                    backgroundColor: colors.primary,
                },
                headerTintColor: 'white',
                headerTitleStyle: {
                    fontWeight: 'bold',
                }
            });
        } catch (err) {
            console.error("Header ayarlanırken hata:", err);
            navigation.setOptions({
                title: 'Sohbet',
                headerShown: true,
            });
        }
    }, [navigation, name]);

    // --- Send Message ---
    const onSend = useCallback(async (newMessages = []) => {
        if (!user || !conversationId) {
            console.error("Mesaj gönderilemiyor: Kullanıcı veya sohbet ID'si eksik.");
            return Promise.reject(new Error("Mesaj gönderilemiyor: Kullanıcı veya sohbet ID'si eksik."));
        }

        const messageToSend = newMessages[0];
        if (!messageToSend) return Promise.resolve();

        console.log(`Mesaj gönderiliyor: "${messageToSend.text.substring(0, 20)}${messageToSend.text.length > 20 ? '...' : ''}"`);

        // Önce UI'a ekle (iyimser güncelleme)
        setMessages(previousMessages =>
            GiftedChat.append(previousMessages, [messageToSend])
        );

        try {
            // Backend'e gönder
            const { data: sentMessage, error: sendError } = await sendMessage(
                conversationId,
                user.id,
                messageToSend.text
            );

            if (sendError) {
                throw sendError;
            }

            console.log("Mesaj başarıyla gönderildi, ID:", sentMessage?.id);
            return Promise.resolve(sentMessage);
        } catch (error) {
            console.error("Mesaj gönderme hatası:", error);

            // Hata durumunda iyimser güncellemeyi geri al
            setMessages(previousMessages =>
                previousMessages.filter(msg => msg._id !== messageToSend._id)
            );

            // Kullanıcıya hata bildir
            alert("Mesaj gönderilemedi. Lütfen tekrar deneyin.");
            return Promise.reject(error);
        }
    }, [user, conversationId]);

    // --- Özel mesaj gönderme işlevi ---
    const handleSendMessage = () => {
        if (!inputText.trim() || isSending) return;

        setIsSending(true); // Gönderim başlatıldı, butonu devre dışı bırak

        console.log("Mesaj gönderiliyor: " + inputText.trim());

        const message = {
            _id: Math.round(Math.random() * 1000000),
            text: inputText.trim(),
            createdAt: new Date(),
            user: { _id: user.id }
        };

        // Mesajı temizle, kullanıcıya anında geribildirim verir
        setInputText('');

        // onSend fonksiyonunu async olduğundan, tamamlandığında isSending'i false yap
        onSend([message])
            .then(() => {
                // Input alanına tekrar odaklan
                if (inputRef.current) {
                    setTimeout(() => {
                        inputRef.current.focus();
                    }, 100);
                }
            })
            .finally(() => {
                setIsSending(false); // İşlem tamamlandı, butonu tekrar aktif et
            });
    };

    // --- Customizations ---
    // Mesaj baloncuklarının özelleştirilmesi
    const renderBubble = (props) => {
        return (
            <Bubble
                {...props}
                wrapperStyle={{
                    right: { // Style for messages sent by the current user
                        backgroundColor: colors.primary,
                        borderRadius: 15,
                        marginBottom: 5,
                        marginRight: 5,
                    },
                    left: { // Style for messages received from others
                        backgroundColor: '#E5E5EA',
                        borderRadius: 15,
                        marginBottom: 5,
                        marginLeft: 5,
                    },
                }}
                textStyle={{
                    right: { // Text color for sent messages
                        color: 'white',
                        padding: 2,
                    },
                    left: { // Text color for received messages
                        color: '#000000',
                        padding: 2,
                    },
                }}
                timeTextStyle={{
                    right: { color: 'rgba(255,255,255,0.7)' },
                    left: { color: 'rgba(0,0,0,0.5)' },
                }}
            />
        );
    };

    // Customize Send Button
    const renderSend = (props) => (
        <Send {...props} containerStyle={styles.sendContainer}>
            <Ionicons name="send" size={24} color={colors.primary} />
        </Send>
    );

    // --- Custom Input Toolbar ---
    const renderCustomInputToolbar = (props) => {
        return (
            <View style={styles.inputMainContainer}>
                <View style={styles.inputInnerContainer}>
                    <TextInput
                        style={styles.textInputNew}
                        placeholder="Mesaj yazın..."
                        placeholderTextColor="#999"
                        multiline={true}
                        value={inputText}
                        onChangeText={setInputText}
                        maxLength={500}
                        ref={inputRef}
                        onSubmitEditing={() => {
                            if (inputText.trim()) {
                                handleSendMessage();
                            }
                        }}
                    />
                    <TouchableOpacity
                        style={[
                            styles.sendButtonContainer,
                            inputText.trim() ? styles.sendButtonActive : styles.sendButtonInactive
                        ]}
                        onPress={() => {
                            if (inputText.trim()) {
                                handleSendMessage();
                            }
                        }}
                        disabled={!inputText.trim() || isSending}
                        activeOpacity={0.7}
                    >
                        {isSending ? (
                            <ActivityIndicator size="small" color="white" />
                        ) : (
                            <Ionicons
                                name="send"
                                size={22}
                                color={inputText.trim() ? 'white' : '#CCC'}
                            />
                        )}
                    </TouchableOpacity>
                </View>
            </View>
        );
    };

    // --- Render Logic ---
    if (isLoading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
            </View>
        );
    }

    if (error) {
        return (
            <View style={styles.loadingContainer}>
                <Text style={styles.errorText}>{error}</Text>
            </View>
        );
    }

    if (!user) {
        return (
            <View style={styles.loadingContainer}>
                <Text style={styles.errorText}>Mesajları görmek için giriş yapmalısınız.</Text>
            </View>
        );
    }

    return (
        <SafeAreaViewContext style={styles.safeContainer} edges={['bottom']}>
            <GiftedChat
                messages={messages}
                onSend={onSend}
                user={{
                    _id: user.id,
                }}
                renderBubble={renderBubble}
                renderInputToolbar={renderCustomInputToolbar}
                placeholder="Mesaj yazın..."
                scrollToBottom
                scrollToBottomComponent={() => (
                    <View style={styles.scrollToBottomButton}>
                        <Ionicons name="chevron-down" size={24} color="#FFF" />
                    </View>
                )}
                inverted={true}
                renderLoading={() => (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color={colors.primary} />
                    </View>
                )}
                listViewProps={{
                    style: styles.listView,
                    keyboardDismissMode: 'interactive',
                    showsVerticalScrollIndicator: true,
                    initialNumToRender: 30,
                    onEndReachedThreshold: 0.1
                }}
                messagesContainerStyle={styles.messagesContainer}
                minInputToolbarHeight={60}
                bottomOffset={0}
            />
        </SafeAreaViewContext>
    );
};

const styles = StyleSheet.create({
    safeContainer: {
        flex: 1,
        backgroundColor: 'white',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'white',
    },
    errorText: {
        color: 'red',
        fontSize: 16,
        textAlign: 'center',
        padding: 20,
    },
    messagesContainer: {
        flex: 1,
    },
    scrollToBottomButton: {
        backgroundColor: colors.primary,
        width: 35,
        height: 35,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 3,
        elevation: 3,
    },
    listView: {
        flex: 1,
    },

    // Mesaj giriş alanı stilleri
    inputMainContainer: {
        borderTopWidth: 1,
        borderTopColor: '#E5E5EA',
        backgroundColor: 'white',
        padding: 8,
    },
    inputInnerContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    textInputNew: {
        flex: 1,
        borderWidth: 1,
        borderColor: '#E1E1E1',
        borderRadius: 20,
        paddingHorizontal: 15,
        paddingVertical: 8,
        fontSize: 16,
        backgroundColor: '#F8F8F8',
        marginRight: 10,
        minHeight: 40,
        maxHeight: 100,
    },
    sendButtonContainer: {
        padding: 8,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 20,
        width: 40,
        height: 40,
    },
    sendButtonActive: {
        backgroundColor: colors.primary,
    },
    sendButtonInactive: {
        backgroundColor: '#CCC',
    },
    // GiftedChat için gerekli stiller
    sendContainer: {
        justifyContent: 'center',
        alignItems: 'center',
        height: 40,
        width: 40,
    }
});


export default Chat;
