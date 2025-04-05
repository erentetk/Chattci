import React, { useState, useEffect, useLayoutEffect, useCallback } from 'react';
import {
    View,
    TextInput,
    FlatList,
    Text,
    StyleSheet,
    ActivityIndicator,
    TouchableOpacity,
    SafeAreaView,
    Keyboard,
    Alert,
    Image
} from 'react-native';
import supabase from '../config/supabase';
import { useAuth } from '../App';
import { colors } from '../config/constants';
import ContactRow from '../components/ContactRow'; // Reuse ContactRow for displaying users
import Seperator from '../components/Seperator';
import { getAllUsers, getOrCreateConversation, searchUsers } from '../services/chatService';

const NewChatScreen = ({ navigation }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [users, setUsers] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const { user } = useAuth();

    useLayoutEffect(() => {
        navigation.setOptions({
            title: 'Yeni Sohbet Başlat',
            headerStyle: { backgroundColor: colors.primary },
            headerTintColor: 'white',
            headerTitleStyle: { fontWeight: 'bold' },
        });
    }, [navigation]);

    // Debounce fonksiyonu
    const debounce = (func, delay) => {
        let timeoutId;
        return (...args) => {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => {
                func.apply(this, args);
            }, delay);
        };
    };

    // Kullanıcıları arama fonksiyonu
    const performSearch = async (term) => {
        if (!user) return;

        if (!term || term.trim() === '') {
            setUsers([]);
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const { users: searchResults, error: searchError } = await searchUsers(term, user.id);

            if (searchError) {
                throw searchError;
            }

            setUsers(searchResults);
        } catch (err) {
            console.error("Kullanıcı arama hatası:", err);
            setError("Arama sırasında bir hata oluştu");
        } finally {
            setIsLoading(false);
        }
    };

    // Debounce edilmiş arama fonksiyonu
    const debouncedSearch = useCallback(
        debounce(performSearch, 500), // 500ms bekleme süresi
        [user]
    );

    // Arama terimi değiştiğinde arama yap
    useEffect(() => {
        debouncedSearch(searchTerm);
    }, [searchTerm, debouncedSearch]);

    // İlk yükleme 
    useEffect(() => {
        // Arama kutusu boşken tüm kullanıcıları göster (opsiyonel)
        const loadInitialUsers = async () => {
            if (!user) return;
            setIsLoading(true);

            try {
                const { users: allUsers, error: fetchError } = await getAllUsers(user.id);

                if (fetchError) {
                    throw fetchError;
                }

                setUsers(allUsers);
            } catch (err) {
                console.error("Kullanıcıları getirme hatası:", err);
                setError("Kullanıcılar yüklenirken bir hata oluştu");
            } finally {
                setIsLoading(false);
            }
        };

        loadInitialUsers();
    }, [user]);

    // Handle selecting a user from the list
    const handleSelectUser = async (selectedUser) => {
        if (!user || !selectedUser) return;
        console.log("Seçilen kullanıcı:", selectedUser.username);

        // Aynı kullanıcıyla sohbet engelleme
        if (selectedUser.id === user.id) {
            Alert.alert("Hata", "Kendinizle sohbet başlatamazsınız.");
            return;
        }

        try {
            setIsLoading(true);
            // Sohbeti bul veya oluştur
            const conversation = await getOrCreateConversation(user.id, selectedUser.id);

            console.log("Oluşturulan/bulunan konuşma ID:", conversation.id);
            console.log("Diğer kullanıcı ID:", selectedUser.id);
            console.log("Diğer kullanıcı adı:", selectedUser.username);

            // Kısa bir gecikme ekleyerek UI'ın güncellenmesini sağla
            setTimeout(() => {
                // Sohbet ekranına yönlendir - resetlemeden navigate edelim
                navigation.navigate('Chat', {
                    conversationId: conversation.id,
                    otherUserId: selectedUser.id,
                    name: selectedUser.username || 'Kullanıcı',
                    avatarUrl: selectedUser.avatar_url,
                });

                // UI güncellemesi için Loading'i navigasyondan sonra kapat
                setTimeout(() => {
                    setIsLoading(false);
                }, 300);
            }, 300);
        } catch (err) {
            console.error("Sohbet başlatma hatası:", err);
            Alert.alert("Hata", "Sohbet başlatılırken bir sorun oluştu.");
            setIsLoading(false);
        }
    };

    const renderUserItem = ({ item }) => (
        <TouchableOpacity
            style={styles.userItem}
            onPress={() => handleSelectUser(item)}
        >
            <View style={styles.avatar}>
                {item.avatar_url ? (
                    <Image
                        source={{ uri: item.avatar_url }}
                        style={styles.avatarImage}
                    />
                ) : (
                    <View style={[styles.avatarImage, styles.defaultAvatar]}>
                        <Text style={styles.avatarText}>
                            {item.username ? item.username[0].toUpperCase() : '?'}
                        </Text>
                    </View>
                )}
            </View>
            <View style={styles.userInfo}>
                <Text style={styles.userName}>{item.username || 'İsimsiz Kullanıcı'}</Text>
            </View>
        </TouchableOpacity>
    );

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.searchContainer}>
                <TextInput
                    style={styles.searchInput}
                    placeholder="Kullanıcı adı ara..."
                    value={searchTerm}
                    onChangeText={setSearchTerm}
                    autoCapitalize="none"
                    autoCorrect={false}
                />
            </View>

            {isLoading ? (
                <View style={styles.centered}>
                    <ActivityIndicator size="large" color={colors.primary} />
                </View>
            ) : error ? (
                <View style={styles.centered}>
                    <Text style={styles.errorText}>{error}</Text>
                </View>
            ) : (
                <FlatList
                    data={users}
                    renderItem={renderUserItem}
                    keyExtractor={(item) => item.id.toString()}
                    ListEmptyComponent={() => (
                        <View style={styles.centered}>
                            <Text>
                                {searchTerm.trim() ?
                                    'Belirtilen isimde kullanıcı bulunamadı.' :
                                    'Arama yapmak için yukarıdaki kutuya yazın.'
                                }
                            </Text>
                        </View>
                    )}
                />
            )}
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    searchContainer: {
        padding: 10,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: colors.border,
        backgroundColor: '#f8f8f8', // Light background for search bar area
    },
    searchInput: {
        backgroundColor: 'white',
        paddingHorizontal: 15,
        paddingVertical: 10,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#e0e0e0',
        fontSize: 16,
    },
    centered: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    errorText: {
        color: 'red',
        textAlign: 'center',
    },
    userItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: '#ccc',
    },
    avatar: {
        width: 50,
        height: 50,
        borderRadius: 25,
        overflow: 'hidden',
        marginRight: 15,
    },
    avatarImage: {
        width: 50,
        height: 50,
        borderRadius: 25,
    },
    defaultAvatar: {
        backgroundColor: colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarText: {
        color: 'white',
        fontSize: 20,
        fontWeight: 'bold',
    },
    userInfo: {
        flex: 1,
    },
    userName: {
        fontSize: 16,
        fontWeight: '500',
    },
});

export default NewChatScreen; 