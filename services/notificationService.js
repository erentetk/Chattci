import supabase from '../config/supabase';

// Bildirim gönderme fonksiyonu (Basitleştirilmiş - Sadece DB Kaydı)
export const sendNotification = async (userId, title, message) => {
    if (!userId || !title || !message) {
        console.error("Bildirim gönderme için gerekli bilgiler eksik");
        return { data: null, error: new Error("Eksik parametreler") }; // Hata nesnesi döndür
    }

    try {
        console.log(`Bildirim veritabanına kaydediliyor - Kullanıcı: ${userId}, Başlık: ${title}`);

        // information_schema kontrolü ve otomatik tablo oluşturma kaldırıldı.
        // Doğrudan insert yapmayı dene.

        const { data, error } = await supabase
            .from('notifications')
            .insert({
                user_id: userId,
                title: title,
                message: message,
                created_at: new Date().toISOString(),
                is_read: false
            })
            .select() // Kaydedilen veriyi geri al
            .single(); // Tek kayıt eklediğimiz için

        if (error) {
            console.error("Bildirim veritabanına kaydedilemedi:", error);
            // Hata kodu 42P01 ise tablo yoktur.
            if (error.code === '42P01') {
                console.error(">>> Hata: 'notifications' tablosu veritabanında bulunamadı.");
            }
            return { data: null, error }; // Hatayı döndür
        }

        console.log("Bildirim veritabanına başarıyla kaydedildi, ID:", data?.id);

        // Realtime kanalı oluşturma/gönderme mantığı kaldırıldı.
        // Bu fonksiyon artık sadece DB kaydından sorumlu.

        return { data, error: null }; // Başarılı sonucu döndür

    } catch (error) {
        console.error("Bildirim kaydederken beklenmeyen hata:", error);
        return { data: null, error }; // Genel hatayı döndür
    }
};

// Belirli bir kullanıcının bildirimlerini getir
export const getUserNotifications = async (userId) => {
    if (!userId) {
        console.error("Bildirim getirmek için kullanıcı ID'si gerekli");
        return { data: [], error: "Kullanıcı ID'si eksik" };
    }

    try {
        const { data, error } = await supabase
            .from('notifications')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (error) {
            console.error("Bildirimleri getirme hatası:", error);
            // Hata kodu 42P01 ise tablo yoktur.
            if (error.code === '42P01') {
                console.error(">>> Hata: 'notifications' tablosu veritabanında bulunamadı.");
            }
            return { data: [], error };
        }

        return { data: data || [], error: null };
    } catch (error) {
        console.error("Bildirimleri getirirken beklenmeyen hata:", error);
        return { data: [], error };
    }
};

// Bildirimleri okundu olarak işaretle
export const markNotificationsAsRead = async (userId, notificationIds = null) => {
    if (!userId) {
        console.error("Bildirim işaretlemek için kullanıcı ID'si gerekli");
        return { error: "Kullanıcı ID'si eksik" };
    }

    try {
        let query = supabase
            .from('notifications')
            .update({ is_read: true })
            .eq('user_id', userId)
            .eq('is_read', false); // Sadece okunmamışları güncelle

        // Eğer belirli bildirim ID'leri varsa, sadece onları güncelle
        if (notificationIds && Array.isArray(notificationIds) && notificationIds.length > 0) {
            query = query.in('id', notificationIds);
        } else {
            // ID yoksa tüm okunmamışları güncelle
        }

        // Güncellenen kayıt sayısını almak için .select() eklenebilir veya count kullanılabilir
        const { data, error, count } = await query.select({ count: 'exact' });

        if (error) {
            console.error("Bildirimleri işaretleme hatası:", error);
            if (error.code === '42P01') {
                console.error(">>> Hata: 'notifications' tablosu veritabanında bulunamadı.");
            }
            return { error };
        }

        console.log(`${count} bildirim okundu olarak işaretlendi.`);
        return { success: true, count };
    } catch (error) {
        console.error("Bildirimleri işaretlerken beklenmeyen hata:", error);
        return { error };
    }
};

// Bildirimlere abone ol (Realtime DB Changes ile)
export const subscribeToNotifications = (userId, callback) => {
    if (!userId || !callback) {
        console.error("Bildirim aboneliği için kullanıcı ID'si ve callback gerekli");
        return { unsubscribe: () => { } };
    }

    // Sabit kanal adı kullanılıyor
    const channelName = `realtime-notifications-${userId}`; // Kanal adını da güncelleyelim
    let channel = null;

    try {
        console.log(`Bildirim aboneliği oluşturuluyor (postgres_changes): ${channelName}`);

        channel = supabase
            .channel(channelName, {
                config: {
                    // broadcast: { ack: false }, // postgres_changes için gereksiz
                    presence: { key: '' }
                }
            })
            // 'broadcast' yerine 'postgres_changes' dinle
            .on('postgres_changes', {
                event: 'INSERT', // Sadece yeni eklenen bildirimler
                schema: 'public',
                table: 'notifications',
                filter: `user_id=eq.${userId}` // Sadece bu kullanıcıya ait olanlar
            }, (payload) => {
                // Gelen yeni kaydı (payload.new) işle
                console.log(`REALTIME (${channelName}): Yeni bildirim alındı:`, payload.new?.id);
                // payload.new objesi yeni eklenen notification satırını içerir
                callback(payload.new); // Doğrudan yeni bildirimi callback'e gönder
            })
            .subscribe((status, err) => {
                console.log(`Bildirim aboneliği durumu (${channelName}): ${status}`);
                if (status === 'SUBSCRIBED') {
                    console.log(`Bildirim kanalı bağlantısı başarılı: ${channelName}`);
                } else if (status === 'CHANNEL_ERROR') {
                    console.error(`Kanal hatası (${channelName}):`, err);
                } else if (status === 'TIMED_OUT') {
                    console.warn(`Kanal bağlantı zaman aşımı (${channelName}). Otomatik yeniden deneme bekleniyor.`);
                }
            });

        return {
            unsubscribe: () => {
                if (channel) {
                    console.log(`Bildirim aboneliği sonlandırılıyor: ${channelName}`);
                    supabase.removeChannel(channel)
                        .catch(err => console.error(`Bildirim kanalı kaldırılırken hata (${channelName}):`, err));
                }
            }
        };
    } catch (error) {
        console.error("Bildirim aboneliği oluşturulurken hata:", error);
        return { unsubscribe: () => { } };
    }
}; 