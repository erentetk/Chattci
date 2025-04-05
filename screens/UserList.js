import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, ActivityIndicator, SafeAreaView, Image, Keyboard } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { colors } from '../config/constants';
import { useAuth } from '../App';
import supabase from '../config/supabase';
import { getOrCreateConversation } from '../services/chatService';

const UserList = () => {
    const [users, setUsers] = useState([]);
    const [filteredUsers, setFilteredUsers] = useState([]);
    const [search, setSearch] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [refreshing, setRefreshing] = useState(false);

    const navigation = useNavigation();
    const { user } = useAuth();

    // Kullanıcıları getir
    const fetchUsers = useCallback(async () => {
        if (!user) {
            setError('Lütfen önce giriş yapın');
            setIsLoading(false);
            return;
        }

        try {
            setIsLoading(true);
            setError(null);

            // Mevcut kullanıcı dışındaki tüm kullanıcıları getir
            const { data, error } = await supabase
                .from('profiles')
                .select('id, username, avatar_url, created_at')
                .neq('id', user.id)
                .order('username');

            if (error) {
                console.error('Kullanıcı listesi getirme hatası:', error);
                setError('Kullanıcılar yüklenirken bir hata oluştu');
                setUsers([]);
                setFilteredUsers([]);
                return;
            }

            console.log(`${data.length} kullanıcı bulundu`);
            setUsers(data || []);
            setFilteredUsers(data || []);
        } catch (err) {
            console.error('Kullanıcılar yüklenirken beklenmeyen hata:', err);
            setError('Bir sorun oluştu. Lütfen tekrar deneyin.');
        } finally {
            setIsLoading(false);
            setRefreshing(false);
        }
    }, [user]);

    // İlk yükleme ve kullanıcı değişiminde çağrılır
    useEffect(() => {
        fetchUsers();
    }, [fetchUsers]);

    // Arama metnine göre kullanıcıları filtrele
    useEffect(() => {
        if (search.trim() === '') {
            setFilteredUsers(users);
            return;
        }

        const filtered = users.filter(u =>
            u.username && u.username.toLowerCase().includes(search.toLowerCase())
        );
        setFilteredUsers(filtered);
    }, [search, users]);

    // Yenileme işlemi
    const handleRefresh = () => {
        setRefreshing(true);
        fetchUsers();
    };

    // Kullanıcıya tıklandığında konuşma oluştur/aç
    const handleUserPress = async (selectedUser) => {
        try {
            setIsLoading(true);
            console.log(`${selectedUser.username} ile konuşma başlatılıyor...`);

            // Konuşma oluştur veya mevcut olanı getir
            const conversation = await getOrCreateConversation(user.id, selectedUser.id);
            console.log('Konuşma bilgisi:', conversation.id);

            // Chat ekranına yönlendir
            navigation.navigate('Chat', {
                conversationId: conversation.id,
                userId: selectedUser.id,
                name: selectedUser.username || 'Sohbet'
            });
        } catch (error) {
            console.error('Konuşma oluşturma/getirme hatası:', error);
            setError('Konuşma açılırken bir sorun oluştu');
        } finally {
            setIsLoading(false);
        }
    };

    // Kullanıcı öğesi
    const renderItem = ({ item }) => (
        <TouchableOpacity
            style={styles.userItem}
            onPress={() => handleUserPress(item)}
        >
            <View style={styles.userAvatar}>
                {item.avatar_url ? (
                    <Image source={{ uri: item.avatar_url }} style={styles.avatarImage} />
                ) : (
                    <View style={styles.defaultAvatar}>
                        <Text style={styles.avatarText}>
                            {(item.username || 'U').charAt(0).toUpperCase()}
                        </Text>
                    </View>
                )}
            </View>
            <View style={styles.userInfo}>
                <Text style={styles.userName}>{item.username || 'Kullanıcı'}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#ccc" />
        </TouchableOpacity>
    );

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.searchContainer}>
                <Ionicons name="search" size={20} color="#666" style={styles.searchIcon} />
                <TextInput
                    style={styles.searchInput}
                    placeholder="Kullanıcı ara..."
                    value={search}
                    onChangeText={setSearch}
                    autoCapitalize="none"
                    onSubmitEditing={Keyboard.dismiss}
                />
                {search.length > 0 && (
                    <TouchableOpacity
                        onPress={() => {
                            setSearch('');
                            Keyboard.dismiss();
                        }}
                        style={styles.clearButton}
                    >
                        <Ionicons name="close-circle" size={20} color="#999" />
                    </TouchableOpacity>
                )}
            </View>

            {error ? (
                <View style={styles.errorContainer}>
                    <Text style={styles.errorText}>{error}</Text>
                    <TouchableOpacity
                        style={styles.retryButton}
                        onPress={fetchUsers}
                    >
                        <Text style={styles.retryButtonText}>Tekrar Dene</Text>
                    </TouchableOpacity>
                </View>
            ) : (
                <FlatList
                    data={filteredUsers}
                    renderItem={renderItem}
                    keyExtractor={item => item.id}
                    refreshing={refreshing}
                    onRefresh={handleRefresh}
                    ListEmptyComponent={
                        isLoading ? (
                            <View style={styles.loadingContainer}>
                                <ActivityIndicator size="large" color={colors.primary} />
                                <Text style={styles.loadingText}>Kullanıcılar yükleniyor...</Text>
                            </View>
                        ) : (
                            <View style={styles.emptyContainer}>
                                <Ionicons name="people-outline" size={48} color="#ccc" />
                                <Text style={styles.emptyTitle}>
                                    {search.trim() ? 'Kullanıcı bulunamadı' : 'Henüz kullanıcı yok'}
                                </Text>
                                <Text style={styles.emptySubtitle}>
                                    {search.trim() ? 'Farklı bir arama yapın' : 'Daha sonra tekrar deneyin'}
                                </Text>
                            </View>
                        )
                    }
                />
            )}
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'white',
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f0f0f0',
        borderRadius: 8,
        margin: 10,
        paddingHorizontal: 10,
    },
    searchIcon: {
        marginRight: 8,
    },
    searchInput: {
        flex: 1,
        height: 40,
        fontSize: 16,
    },
    clearButton: {
        padding: 5,
    },
    userItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },
    userAvatar: {
        width: 50,
        height: 50,
        borderRadius: 25,
        marginRight: 15,
        overflow: 'hidden',
    },
    avatarImage: {
        width: '100%',
        height: '100%',
    },
    defaultAvatar: {
        width: '100%',
        height: '100%',
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
        fontWeight: 'bold',
        color: colors.text.primary,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
        height: 300,
    },
    loadingText: {
        marginTop: 10,
        color: '#666',
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
        height: 300,
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#666',
        marginTop: 16,
    },
    emptySubtitle: {
        fontSize: 14,
        color: '#999',
        textAlign: 'center',
        marginTop: 8,
    },
    errorContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    errorText: {
        fontSize: 16,
        color: colors.red,
        textAlign: 'center',
        marginBottom: 20,
    },
    retryButton: {
        backgroundColor: colors.primary,
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 5,
    },
    retryButtonText: {
        color: 'white',
        fontWeight: 'bold',
    },
});

export default UserList;
