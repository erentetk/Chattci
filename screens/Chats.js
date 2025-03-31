import React, { useEffect, useState } from 'react';
import { View, FlatList, SafeAreaView, StatusBar, StyleSheet, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import ContactRow from '../components/ContactRow';
import Seperator from '../components/Seperator';
import { colors } from '../config/constants';
import { Ionicons } from '@expo/vector-icons';
import supabase from '../config/supabase';
import { useAuth } from '../App';

// iOS için optimize edilmiş örnek sohbet verileri
const chatData = [
  {
    id: '1',
    name: 'Eren TETİK',
    message: 'Merhaba, akşam yemeği için seni bekliyorum',
    avatar: 'ET',
    timestamp: new Date(new Date().getTime() - 30 * 60000), // 30 dakika önce
    unread: 2,
  },
  {
    id: '2',
    name: 'Selami Sahin',
    message: 'Merhaba, nasılsın?',
    avatar: 'KT',
    timestamp: new Date(new Date().getTime() - 2 * 60 * 60000), // 2 saat önce
    unread: 0,
  },
  {
    id: '3',
    name: 'Ahmet Yılmaz',
    message: 'Projemiz tamamlandı mı?',
    avatar: 'AY',
    timestamp: new Date(new Date().getTime() - 5 * 60 * 60000), // 5 saat önce
    unread: 1,
  },
  {
    id: '4',
    name: 'Ayşe Demir',
    message: 'Toplantı saat 14:00\'te başlayacak',
    avatar: 'AD',
    timestamp: new Date(new Date().getTime() - 24 * 60 * 60000), // 1 gün önce
    unread: 0,
  },
];

const Chats = ({ navigation }) => {
  const { user, checkUser } = useAuth();
  const [chats, setChats] = useState(chatData);
  const [isAuthChecking, setIsAuthChecking] = useState(true);

  useEffect(() => {
    // Başlık ayarı
    navigation.setOptions({
      headerStyle: {
        backgroundColor: colors.primary,
      },
      headerTintColor: 'white',
      headerTitleStyle: {
        fontWeight: 'bold',
      },
    });

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
  }, [navigation, user, checkUser]);

  // Zaman damgasını formatla
  const formatTime = (timestamp) => {
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
    // Tıklanan sohbetin okunmamış mesaj sayısını sıfırla
    const updatedChats = chats.map(item =>
      item.id === chat.id ? { ...item, unread: 0 } : item
    );
    setChats(updatedChats);

    // Sohbet ekranına yönlendir
    navigation.navigate('Chat', {
      name: chat.name,
      userId: chat.id,
      avatarUrl: chat.avatar ? `https://ui-avatars.com/api/?name=${chat.name.replace(' ', '+')}&background=random` : null
    });
  };

  // Auth kontrol ediliyor, uygun ekranı göster
  if (isAuthChecking) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Oturum kontrol ediliyor...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="white" />
      <FlatList
        data={chats}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ContactRow
            name={item.name}
            subtitle={item.message}
            time={formatTime(item.timestamp)}
            unread={item.unread}
            onPress={() => handleChatPress(item)}
          />
        )}
        ItemSeparatorComponent={Seperator}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7', // iOS gri arkaplan
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: colors.primary,
    fontSize: 16,
  }
});

export default Chats;

