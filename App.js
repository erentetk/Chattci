import React, { useState, useEffect, createContext, useContext } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { Text, View, ActivityIndicator } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Chats from './screens/Chats';
import Chat from './screens/Chat';
import Settings from './screens/Settings';
import SignUp from './screens/SignUp';
import Login from './screens/Login';
import ResetPassword from './screens/ResetPassword';
import Notifications from './screens/Notifications';
import About from './screens/About';
import Help from './screens/Help';
import EditProfile from './screens/EditProfile';
import NewChatScreen from './screens/NewChats';  // NewChat.js yerine NewChats.js
import { colors } from './config/constants';
import supabase from './config/supabase';

// Auth context oluştur
const AuthContext = createContext();

// Auth provider bileşeni
const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Uygulama başlatıldığında mevcut oturumu kontrol et
    checkUser();

    // Supabase auth durumu değiştiğinde dinle
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log("Auth durumu değişti: ", event);
        setUser(session?.user || null);
        setLoading(false);
      }
    );

    return () => {
      if (authListener && authListener.subscription) {
        authListener.subscription.unsubscribe();
      }
    };
  }, []);

  const checkUser = async () => {
    try {
      setLoading(true);

      // Mevcut oturumu al
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        // Kullanıcı veritabanında var mı kontrol et
        const { data, error } = await supabase
          .from('users')
          .select('*')
          .eq('id', user.id);

        if (error) {
          console.error("Kullanıcı profili çekilirken hata oluştu:", error.message);
          await supabase.auth.signOut();
          setUser(null);
          return;
        }

        if (!data || data.length === 0) {
          console.log("Kullanıcı veritabanında bulunamadı");
          // Oturumu temizlemek için 100ms bekleme
          setTimeout(async () => {
            await supabase.auth.signOut();
            setUser(null);
          }, 100);
        } else {
          console.log("Kullanıcı veritabanında bulundu:", data[0].email);
          setUser(user);
        }
      } else {
        console.log("Aktif oturum bulunamadı");
        setUser(null);
      }
    } catch (error) {
      console.error("Oturum kontrolü hatası:", error.message);
      setUser(null);
    } finally {
      // Yükleme durumundan çıkmak için kısa bir gecikme ekle
      setTimeout(() => {
        setLoading(false);
      }, 300);
    }
  };

  const value = {
    user,
    loading,
    setUser,
    checkUser,
    supabase,
    signOut: async () => {
      try {
        await supabase.auth.signOut();
        setUser(null);
        return { success: true };
      } catch (error) {
        console.error("Çıkış yapma hatası:", error.message);
        return { success: false, error };
      }
    }
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// Auth hook
export const useAuth = () => useContext(AuthContext);

const ChatsStack = createStackNavigator();
const MainStack = createStackNavigator();
const AuthStack = createStackNavigator();
const Tabs = createBottomTabNavigator();

// Auth ekranları
const AuthScreens = () => (
  <AuthStack.Navigator screenOptions={{ headerShown: false }}>
    <AuthStack.Screen name="Login" component={Login} />
    <AuthStack.Screen name="SignUp" component={SignUp} />
    <AuthStack.Screen
      name="ResetPassword"
      component={ResetPassword}
      options={{
        headerShown: true,
        title: 'Şifre Sıfırlama',
        headerStyle: {
          backgroundColor: colors.primary,
        },
        headerTintColor: 'white',
      }}
    />
  </AuthStack.Navigator>
);

const ChatsScreen = () => {
  return (
    <ChatsStack.Navigator
      screenOptions={{
        headerShown: false   // chat screen header görünmez
      }}
    >
      <ChatsStack.Screen name="Chats" component={Chats} />
    </ChatsStack.Navigator>
  );
};

const TabsScreen = () => {
  return (
    <Tabs.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;
          if (route.name === 'Chats') {
            iconName = focused ? 'chatbubbles' : 'chatbubbles-outline';
          } else if (route.name === 'Settings') {
            iconName = focused ? 'settings' : 'settings-outline';
          }
          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: 'gray',
        headerShown: true,
        headerStyle: {
          backgroundColor: colors.primary,
        },
        headerTintColor: 'white',
        headerTitleStyle: {
          fontWeight: 'bold',
        },
      })}
    >
      <Tabs.Screen
        name="Chats"
        component={ChatsScreen}
        options={{ title: 'Sohbetler' }}
      />
      <Tabs.Screen
        name="Settings"
        component={Settings}
        options={{ title: 'Ayarlar' }}
      />
    </Tabs.Navigator>
  );
};

// Giriş yapan kullanıcılar için ana ekranlar
const AppScreens = () => (
  <MainStack.Navigator screenOptions={{ headerShown: false }}>
    <MainStack.Screen name="Tabs" component={TabsScreen} />
    <MainStack.Screen
      name="Notifications"
      component={Notifications}
      options={{
        headerShown: true,
        title: 'Bildirimler',
        headerStyle: {
          backgroundColor: colors.primary,
        },
        headerTintColor: 'white',
      }}
    />
    <MainStack.Screen
      name="About"
      component={About}
      options={{
        headerShown: true,
        title: 'Hakkında',
        headerStyle: {
          backgroundColor: colors.primary,
        },
        headerTintColor: '#fff',
        headerBackTitle: 'Geri',
      }}
    />
    <MainStack.Screen
      name="Help"
      component={Help}
      options={{
        headerShown: true,
        title: 'Yardım',
        headerStyle: {
          backgroundColor: colors.primary,
        },
        headerTintColor: '#fff',
        headerBackTitle: 'Geri'
      }}
    />
    <MainStack.Screen
      name="EditProfile"
      component={EditProfile}
      options={{
        headerShown: true,
        title: 'Profili Düzenle',
        headerStyle: {
          backgroundColor: colors.primary,
        },
        headerTintColor: '#fff',
        headerBackTitle: 'Geri'
      }}
    />
    {/* Add NewChat screen to the main stack */}
    <MainStack.Screen
      name="NewChat"
      component={NewChatScreen}
      options={{
        headerShown: true,
        title: 'Yeni Sohbet Başlat',
        headerStyle: {
          backgroundColor: colors.primary,
        },
        headerTintColor: '#fff', // White color for title and back button
        headerBackTitle: 'Geri', // Text for the back button on iOS
      }}
    />

    {/* Chat ekranını ana navigasyon stack'ine de ekleyelim */}
    <MainStack.Screen
      name="Chat"
      component={Chat}
      options={{
        headerShown: true,
        title: 'Sohbet',
        headerStyle: {
          backgroundColor: colors.primary,
        },
        headerTintColor: '#fff',
        headerBackTitle: 'Geri'
      }}
    />
  </MainStack.Navigator>
);

const App = () => {
  return (
    <AuthProvider>
      <NavigationContainer>
        <RootNavigator />
      </NavigationContainer>
    </AuthProvider>
  );
};

// Oturum durumuna göre ekranları yönlendiren navigator
const RootNavigator = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return user ? <AppScreens /> : <AuthScreens />;
};

export default App;
