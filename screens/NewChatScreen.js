import React, { useState, useEffect, useLayoutEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { useAuth } from '../App'; // Assuming useAuth provides the current user
import { colors } from '../config/constants';
// TODO: Import the function to get all users (e.g., from chatService)
// import { getAllUsers, findOrCreateConversation } from '../services/chatService';

const NewChatScreen = ({ navigation }) => {
    const { user } = useAuth();
    const [users, setUsers] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    useLayoutEffect(() => {
        navigation.setOptions({
            title: 'Yeni Sohbet Başlat',
            headerStyle: { backgroundColor: colors.primary },
            headerTintColor: 'white',
            headerTitleStyle: { fontWeight: 'bold' },
        });
    }, [navigation]);

    useEffect(() => {
        const fetchUsers = async () => {
            if (!user) return; // Wait for user auth
            setIsLoading(true);
            setError(null);
            try {
                // TODO: Replace with actual function call to get users
                // const fetchedUsers = await getAllUsers();
                const fetchedUsers = []; // Placeholder
                // Filter out the current user
                setUsers(fetchedUsers.filter(u => u.id !== user.id));
            } catch (err) {
                console.error("Kullanıcıları getirme hatası:", err);
                setError("Kullanıcılar yüklenirken bir hata oluştu.");
                Alert.alert("Hata", "Kullanıcılar yüklenirken bir sorun oluştu.");
            } finally {
                setIsLoading(false);
            }
        };

        fetchUsers();
    }, [user]); // Re-fetch if user changes

    const handleSelectUser = async (selectedUser) => {
        if (!user || !selectedUser) return;
        console.log("Selected user:", selectedUser.username);
        // Prevent initiating chat with self
        if (selectedUser.id === user.id) {
            Alert.alert("Kendinizle sohbet başlatamazsınız.");
            return;
        }

        try {
            // TODO: Implement logic to find or create conversation
            // const conversation = await findOrCreateConversation(user.id, selectedUser.id);
            const conversation = { id: 'temp_conv_id', profiles: selectedUser }; // Placeholder

            if (conversation) {
                navigation.replace('Chat', { // Use replace to avoid back navigation to user list after starting chat
                    conversationId: conversation.id,
                    otherUserId: selectedUser.id,
                    name: selectedUser.username || 'Kullanıcı',
                    avatarUrl: selectedUser.avatar_url,
                });
            } else {
                Alert.alert("Hata", "Sohbet başlatılamadı.");
            }
        } catch (err) {
            console.error("Sohbet başlatma hatası:", err);
            Alert.alert("Hata", "Sohbet başlatılırken bir sorun oluştu.");
        }
    };

    const renderUserItem = ({ item }) => (
        <TouchableOpacity style={styles.userItem} onPress={() => handleSelectUser(item)}>
            {/* TODO: Add Avatar component if available */}
            <View style={styles.userInfo}>
                <Text style={styles.userName}>{item.username || 'İsimsiz Kullanıcı'}</Text>
                {/* Optional: Add user status or email */}
            </View>
        </TouchableOpacity>
    );

    if (isLoading) {
        return (
            <View style={styles.centered}>
                <ActivityIndicator size="large" color={colors.primary} />
            </View>
        );
    }

    if (error) {
        return (
            <View style={styles.centered}>
                <Text style={styles.errorText}>{error}</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <FlatList
                data={users}
                renderItem={renderUserItem}
                keyExtractor={(item) => item.id.toString()}
                ListEmptyComponent={() => (
                    <View style={styles.centered}>
                        <Text>Sohbet edilecek kullanıcı bulunamadı.</Text>
                    </View>
                )}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
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
        paddingVertical: 15,
        paddingHorizontal: 20,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: '#ccc',
    },
    // TODO: Add styles for Avatar
    userInfo: {
        marginLeft: 15, // Add margin if avatar is present
    },
    userName: {
        fontSize: 16,
        fontWeight: '500',
    },
});

export default NewChatScreen; 