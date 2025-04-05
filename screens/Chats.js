import React, { useEffect, useState, useLayoutEffect } from 'react'; // Import useLayoutEffect
import { View, FlatList, SafeAreaView, StatusBar, StyleSheet, Text, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import ContactRow from '../components/ContactRow';
import Seperator from '../components/Seperator';
import { colors } from '../config/constants';
import { Ionicons } from '@expo/vector-icons'; // Import Ionicons
import supabase from '../config/supabase';
import { useAuth } from '../App';
import { getConversationsWithLastMessages } from '../services/chatService'; // Import the new service function

const Chats = ({ navigation }) => {
  const { user, checkUser, supabase, signOut } = useAuth();
  const [chats, setChats] = useState([]); // Initialize with empty array
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [isLoadingChats, setIsLoadingChats] = useState(false); // Add loading state for chats

  // Add the handleLogout function
  const handleLogout = async () => {
    try {
      await signOut();
      // Navigation should be handled automatically by the auth state change
    } catch (error) {
      console.error("Çıkış yaparken hata:", error);
      Alert.alert("Hata", "Çıkış yapılırken bir sorun oluştu.");
    }
  };

  // --- Header Setup ---
  useLayoutEffect(() => {
    navigation.setOptions({
      headerStyle: {
        backgroundColor: colors.primary,
      },
      headerTintColor: 'white', // Color of back button and title
      headerTitleStyle: {
        fontWeight: 'bold',
      },
      // Add the New Chat button to the header
      headerRight: () => (
        <View style={{ flexDirection: 'row', marginRight: 10 }}>
          <TouchableOpacity
            onPress={() => navigation.navigate('NewChat')} // Navigate to NewChatScreen
            style={{ marginRight: 15 }} // Add some margin between icons
          >
            <Ionicons name="create-outline" size={24} color="white" />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={24} color="white" />
          </TouchableOpacity>
        </View>
      ),
    });
  }, [navigation, handleLogout]); // Add handleLogout to dependencies if it's not stable

  // Effect for Auth Check
  useEffect(() => {
    // Oturum kontrolü
    const checkSession = async () => {
      setIsAuthChecking(true);
      try {
        if (!user) {
          // Kullanıcı oturumu aktif değilse
          await checkUser(); // Auth Context'teki checkUser fonksiyonunu çalıştır
        } else {
          // Kullanıcının veritabanında hala var olduğundan emin ol
          const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('id', user.id);

          if (error || !data || data.length === 0) {
            console.log("Kullanıcı veritabanında bulunamadı, oturum sonlandırılıyor");
            await supabase.auth.signOut();
            // Auth Context güncellemesi otomatik olarak yapılacak
            return; // Kontrol tamamlandığında eğer kullanıcı bulunamadıysa işlemi sonlandır
          }
        }
      } catch (error) {
        console.error("Oturum kontrolü hatası:", error);
      } finally {
        // İşlemi bitir, içeriği göstermeye başla
        setIsAuthChecking(false);
      }
    };

    checkSession();
  }, [navigation, user, checkUser]); // Dependency on user and checkUser

  // Effect for Fetching Chats after Auth Check
  useEffect(() => {
    const fetchChats = async () => {
      if (user && !isAuthChecking) {
        setIsLoadingChats(true);
        try {
          // Yeni fonksiyonu kullanarak sohbetleri ve son mesajları getir
          const fetchedConversations = await getConversationsWithLastMessages(user.id);

          // Map fetched data to the structure expected by ContactRow
          const formattedChats = fetchedConversations
            .filter(conv => conv.profiles) // Ensure the other participant's profile exists
            .map(conv => ({
              id: conv.id, // Conversation ID
              otherUserId: conv.profiles.id, // Other user's ID
              name: conv.profiles.username || 'Bilinmeyen Kullanıcı', // Other user's name
              message: conv.last_message || 'Henüz mesaj yok', // Son mesaj içeriğini kullan
              avatarUrl: conv.profiles.avatar_url, // Other user's avatar
              timestamp: conv.last_message_time || conv.updated_at, // Son mesaj zamanı
              unread: conv.unread_count || 0, // Okunmamış mesaj sayısı
              messages: conv.all_messages || [], // Tüm mesajlar (geçmiş mesajlar)
            }));

          setChats(formattedChats);
          console.log(`${formattedChats.length} sohbet görüntüleniyor`);

          // İlk birkaç mesajın içeriğini logla (debug için)
          if (formattedChats.length > 0) {
            console.log('İlk sohbetin son mesajı:', formattedChats[0].message);
            console.log('İlk sohbetin mesaj sayısı:', formattedChats[0].messages?.length || 0);
          }
        } catch (error) {
          console.error("Sohbetleri getirme hatası:", error);
          // Handle error appropriately, maybe show a message to the user
        } finally {
          setIsLoadingChats(false);
        }
      } else if (!user && !isAuthChecking) {
        // Handle case where user is not logged in after auth check
        setChats([]); // Clear chats if user logs out
      }
    };

    fetchChats();
  }, [user, isAuthChecking]); // Re-run when user or auth check status changes

  // Zaman damgasını formatla
  const formatTime = (timestamp) => {
    if (!timestamp) return ''; // Handle null timestamps
    const now = new Date();
    const messageDate = new Date(timestamp);

    // Aynı gün içinde ise saat:dakika göster
    if (now.toDateString() === messageDate.toDateString()) {
      return messageDate.getHours().toString().padStart(2, '0') + ':' +
        messageDate.getMinutes().toString().padStart(2, '0');
    }

    // Son bir hafta içindeyse gün adı göster
    const daysAgo = Math.floor((now - messageDate) / (1000 * 60 * 60 * 24));
    if (daysAgo < 7) {
      const days = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
      return days[messageDate.getDay()];
    }

    // Daha eski tarihler için gün/ay
    return messageDate.getDate() + '/' + (messageDate.getMonth() + 1);
  };

  // Sohbet öğesine tıklandığında
  const handleChatPress = (chat) => {
    // TODO: Implement unread count reset logic if needed later
    // const updatedChats = chats.map(item =>
    //   item.id === chat.id ? { ...item, unread: 0 } : item
    // );
    // setChats(updatedChats);

    console.log("Tıklanan sohbet ID:", chat.id);
    console.log("Yönlendirme: Ana Chat ekranına yönlendiriliyor");

    // Sohbet ekranına yönlendir, conversationId ve diğer kullanıcı bilgilerini gönder
    navigation.navigate('Chat', {
      conversationId: chat.id, // Pass conversation ID
      otherUserId: chat.otherUserId, // Pass other user's ID
      name: chat.name, // Pass other user's name
      avatarUrl: chat.avatarUrl // Pass other user's avatar URL
    });
  };

  // Auth kontrol ediliyor veya sohbetler yükleniyor, uygun ekranı göster
  if (isAuthChecking || isLoadingChats) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>
          {isAuthChecking ? 'Oturum kontrol ediliyor...' : 'Sohbetler yükleniyor...'}
        </Text>
      </View>
    );
  }

  // Kullanıcı yoksa veya sohbet yoksa mesaj göster
  if (!user) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <Text style={styles.infoText}>Sohbetleri görmek için giriş yapmalısınız.</Text>
      </View>
    );
  }

  if (chats.length === 0) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <Text style={styles.infoText}>Henüz mesaj yok.</Text> {/* Changed empty state text */}
        {/* TODO: Add a button to start a new chat */}

        {/* Yeni sohbet butonu */}
        <TouchableOpacity
          style={styles.fabButton}
          onPress={() => navigation.navigate('NewChat')}
        >
          <Ionicons name="add" size={30} color="white" />
        </TouchableOpacity>
      </View>
    );
  }


  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="auto" />

      {isLoadingChats ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={chats}
          keyExtractor={(item) => item.id ? String(item.id) : Math.random().toString()}
          renderItem={({ item }) => {
            // Debug için kontroller
            if (!item || !item.name) {
              console.warn("Geçersiz sohbet öğesi:", item);
              return null; // Geçersiz öğeler için hiçbir şey render etme
            }

            return (
              <ContactRow
                name={item.name || ''}
                subtitle={item.message || ''}
                onPress={() => handleChatPress(item)}
                time={formatTime(item.timestamp)}
                avatarUrl={item.avatarUrl}
                unread={item.unread || 0}
              />
            );
          }}
          ItemSeparatorComponent={Seperator}
          ListEmptyComponent={() => (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>Henüz hiç sohbetiniz yok.</Text>
              <Text style={styles.emptySubText}>Sağ üstteki veya aşağıdaki + butonuna tıklayarak yeni bir sohbet başlatabilirsiniz.</Text>
            </View>
          )}
        />
      )}

      {/* Yeni sohbet butonu */}
      <TouchableOpacity
        style={styles.fabButton}
        onPress={() => navigation.navigate('NewChat')}
      >
        <Ionicons name="add" size={30} color="white" />
      </TouchableOpacity>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white', // Use white background
  },
  loadingContainer: {
    flex: 1, // Take full screen
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 10,
    color: colors.primary,
    fontSize: 16,
  },
  infoText: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  headerButton: {
    marginRight: 15, // Add some spacing
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    marginTop: 50,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textPrimary,
    textAlign: 'center',
  },
  emptySubText: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 10,
    lineHeight: 20,
  },
  fabButton: {
    position: 'absolute',
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    right: 20,
    bottom: 20,
    elevation: 5, // Android için gölge
    shadowColor: '#000', // iOS için gölge
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
});

export default Chats;
