import supabase from '../config/supabase';
import { sendNotification } from './notificationService';

// Kullanıcının çevrimiçi durumunu güncelle
export const updateOnlineStatus = async (userId, status) => {
    try {
        // Veritabanına uygun olarak user_status tablosunu kullan
        const { error } = await supabase.rpc('update_user_online_status', {
            user_id_param: userId,
            is_online: status
        });

        if (error) throw error;
    } catch (error) {
        console.error('Çevrimiçi durum güncellenirken hata:', error.message);
    }
};

// Kullanıcının durumunu getir
export const getUserStatus = async (userId) => {
    try {
        // user_status tablosundan sorgula
        const { data, error } = await supabase
            .from('user_status')
            .select('online_status, last_seen')
            .eq('user_id', userId)
            .single();

        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Kullanıcı durumu alınırken hata:', error.message);
        return null;
    }
};

// Mesaj gönderme
export const sendMessage = async (conversationId, senderId, content) => {
    try {
        console.log(`Mesaj gönderiliyor: ${content.substring(0, 20)}... | conversationId: ${conversationId}, senderId: ${senderId}`);

        // Mesajı veritabanına ekle - 3 deneme hakkı ver
        let data = null;
        let error = null;
        let retryCount = 0;
        const maxRetries = 2;

        while (retryCount <= maxRetries && !data) {
            if (retryCount > 0) {
                console.log(`Mesaj gönderme tekrar deneniyor (${retryCount}/${maxRetries})...`);
                // Yeniden denemeden önce kısa bir bekleme yap
                await new Promise(resolve => setTimeout(resolve, 1000));
            }

            const result = await supabase
                .from('messages')
                .insert({
                    conversation_id: conversationId,
                    sender_id: senderId,
                    content: content,
                    created_at: new Date().toISOString()
                })
                .select();

            if (result.error) {
                error = result.error;
                console.error(`Mesaj gönderme hatası (deneme ${retryCount + 1}/${maxRetries + 1}):`, error);
                retryCount++;
            } else {
                data = result.data;
                error = null;
                break;
            }
        }

        if (error) {
            console.error("Mesaj veritabanına kaydedilemedi, tüm denemeler başarısız oldu:", error);
            return { data: null, error };
        }

        console.log("Mesaj veritabanına kaydedildi:", data?.[0]?.id);

        // Karşılıklı tarafları bul
        const { data: conversationData, error: convoError } = await supabase
            .from('conversations')
            .select('user1_id, user2_id')
            .eq('id', conversationId)
            .single();

        if (!convoError && conversationData) {
            // Alıcı ID'sini belirle
            const recipientId = conversationData.user1_id === senderId
                ? conversationData.user2_id
                : conversationData.user1_id;

            console.log(`Mesaj alıcısı: ${recipientId}`);

            // Bildirim gönder - hata olursa işlemi durdurmadan devam et
            try {
                await sendNotification(
                    recipientId,
                    'Yeni Mesaj',
                    `Yeni bir mesajınız var: ${content.substring(0, 30)}${content.length > 30 ? '...' : ''}`
                );
            } catch (notifError) {
                console.error("Bildirim gönderme hatası:", notifError);
                // Bildirim hatasını rapor et ama işlemi durdurma
            }

            // Broadcast işlemi için mesajı manuel olarak kanala gönder
            try {
                await broadcastMessage(conversationId, data[0]);
            } catch (broadcastError) {
                console.error("Broadcast mesaj hatası:", broadcastError);
                // Broadcast hatasını rapor et ama işlemi durdurma
            }
        } else {
            console.error("Konuşma katılımcıları bulunamadı:", convoError);
        }

        console.log("Mesaj başarıyla gönderildi:", data?.[0]?.id);
        return { data: data?.[0], error: null };
    } catch (error) {
        console.error("Mesaj gönderirken beklenmeyen hata:", error);
        return { data: null, error };
    }
};

// Mesajı manuel olarak broadcast et (Realtime sorunlarına karşı)
const broadcastMessage = async (conversationId, messageData) => {
    try {
        if (!messageData || !messageData.id) {
            console.error("Broadcast için geçerli mesaj verisi yok");
            return;
        }

        console.log(`Mesaj broadcast başlıyor: ConversationID=${conversationId}, MessageID=${messageData.id}`);

        // Gönderici bilgilerini al - profiles değil users tablosundan çekiyoruz
        const { data: senderData, error: userError } = await supabase
            .from('users')
            .select('username, avatar_url')
            .eq('id', messageData.sender_id)
            .single();

        if (userError) {
            console.log('Kullanıcı bilgileri alınamadı, mesaj yine de gönderilecek:', userError.message);
        }

        // Mesajı broadcast kanalı üzerinden yayınla - her mesaj için benzersiz kanal
        // Web sürümünde daha iyi çalışması için benzersiz kanal adı
        const channelName = `msg-bc-${conversationId}-${messageData.id}-${Date.now()}`;

        // Kanal yapılandırmasını güçlendirilmiş ayarlarla oluştur
        const channel = supabase.channel(channelName, {
            config: {
                broadcast: { ack: true }, // Onaylı gönderim
                presence: { key: '' },
                retryIntervalMs: 1000,  // 1 saniye sonra tekrar dene (daha hızlı)
                timeout: 20000  // 20 saniye (daha kısa timeout)
            }
        });

        // Bağlantı durumunu izle
        let subscribed = false;
        let retryCount = 0;
        const maxRetries = 3;

        // Kanala abone ol ve tekrar denemeleri yönet
        while (retryCount < maxRetries && !subscribed) {
            try {
                if (retryCount > 0) {
                    console.log(`Broadcast kanal bağlantısı tekrar deneniyor (${retryCount}/${maxRetries})`);
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }

                await new Promise((resolve, reject) => {
                    let resolved = false;

                    // Zaman aşımı kontrolü
                    const timeoutId = setTimeout(() => {
                        if (!resolved) {
                            resolved = true;
                            reject(new Error("Kanal bağlantı zaman aşımı"));
                        }
                    }, 10000);

                    channel.subscribe(async (status) => {
                        console.log(`Mesaj kanal durumu: ${status}, kanal: ${channelName}`);

                        if (status === 'SUBSCRIBED' && !resolved) {
                            resolved = true;
                            clearTimeout(timeoutId);
                            subscribed = true;
                            resolve();

                            try {
                                // Mesajı kanala gönder
                                const result = await channel.send({
                                    type: 'broadcast',
                                    event: 'message',
                                    payload: {
                                        ...messageData,
                                        profiles: senderData || { username: 'Bilinmeyen Kullanıcı' },
                                        eventType: 'INSERT',
                                        conversation_id: conversationId
                                    }
                                });

                                console.log(`Mesaj broadcast tamamlandı: ${result ? 'başarılı' : 'başarısız'}`);

                                // Konuşmayı güncelle (son mesaj tarihini günceller)
                                try {
                                    const { error: updateError } = await supabase
                                        .from('conversations')
                                        .update({
                                            updated_at: new Date().toISOString()
                                        })
                                        .eq('id', conversationId);

                                    if (updateError) {
                                        console.error("Konuşma güncellenirken hata:", updateError);
                                    } else {
                                        console.log(`Konuşma son mesaj bilgisi güncellendi: ${conversationId}`);
                                    }
                                } catch (updateErr) {
                                    console.error("Konuşma güncelleme işleminde hata:", updateErr);
                                }
                            } catch (sendErr) {
                                console.error("Broadcast mesaj gönderme hatası:", sendErr);
                            }

                            // İşlem bittiğinde kanalı temizle
                            setTimeout(() => {
                                try {
                                    if (channel && subscribed) {
                                        console.log(`Mesaj kanalı kapatılıyor: ${channelName}`);
                                        channel.unsubscribe();
                                    }
                                } catch (err) {
                                    console.error("Kanal kapatma hatası:", err);
                                }
                            }, 1500);
                        }
                        else if ((status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') && !resolved) {
                            resolved = true;
                            clearTimeout(timeoutId);
                            reject(new Error(`Kanal bağlantı hatası: ${status}`));
                        }
                    });
                });

                // Başarıyla abone olduysak döngüden çık
                if (subscribed) break;

            } catch (err) {
                console.error(`Broadcast denemesi ${retryCount + 1} başarısız:`, err.message);

                try {
                    if (channel) {
                        await channel.unsubscribe();
                    }
                } catch (unsubErr) {
                    console.error("Kanal kapatma hatası:", unsubErr);
                }

                retryCount++;

                // Son deneme başarısızsa
                if (retryCount >= maxRetries) {
                    console.error(`Tüm broadcast denemeleri (${maxRetries}) başarısız oldu`);
                }
            }
        }
    } catch (error) {
        console.error("Mesaj broadcast hatası:", error);
    }
};

// Konuşmadaki mesajları getirme (En Basit Versiyon - Profilsiz)
export const getMessagesByConversation = async (conversationId) => {
    try {
        console.log("Mesajlar getiriliyor (v3 - profilsiz):", conversationId);

        // Sadece mesajları getir
        const { data, error } = await supabase
            .from('messages')
            .select('id, content, created_at, sender_id, conversation_id') // Sadece gerekli mesaj alanları
            .eq('conversation_id', conversationId)
            .order('created_at', { ascending: false });

        if (error) {
            console.error("Mesajları getirme hatası:", error);
            return { data: [], error };
        }

        console.log(`${data?.length || 0} mesaj başarıyla getirildi.`);
        return { data: data || [], error: null }; // Profil bilgisi olmadan döndür
    } catch (error) {
        console.error("Mesajları getirirken beklenmeyen hata:", error);
        return { data: [], error };
    }
};

/**
 * İki kullanıcı arasındaki konuşmayı bulur veya yeni bir konuşma oluşturur
 * @param {string} userId1 - Birinci kullanıcının ID'si
 * @param {string} userId2 - İkinci kullanıcının ID'si
 * @returns {Promise<Object>} - Konuşma nesnesi
 */
export const getOrCreateConversation = async (userId1, userId2) => {
    if (!userId1 || !userId2) {
        console.error('getOrCreateConversation: Geçersiz kullanıcı ID\'leri', { userId1, userId2 });
        throw new Error('Geçersiz kullanıcı ID\'leri');
    }

    try {
        console.log(`Konuşma aranıyor/oluşturuluyor: Kullanıcılar ${userId1} ve ${userId2}`);

        // Önce mevcut konuşmaları kontrol et - her iki yönde de arıyoruz
        const { data: existingConversations, error: fetchError } = await supabase
            .from('conversations')
            .select('*')
            .or(`and(user1_id.eq.${userId1},user2_id.eq.${userId2}),and(user1_id.eq.${userId2},user2_id.eq.${userId1})`);

        if (fetchError) {
            console.error('Konuşma arama hatası:', fetchError);
            throw new Error('Konuşma aranırken bir sorun oluştu');
        }

        // Eğer konuşma bulunduysa ilkini döndür
        if (existingConversations && existingConversations.length > 0) {
            console.log('Mevcut konuşma bulundu:', existingConversations[0].id);
            return existingConversations[0];
        }

        // Konuşma bulunamadıysa yeni bir tane oluştur
        console.log('Yeni konuşma oluşturuluyor...');
        const { data: newConversation, error: insertError } = await supabase
            .from('conversations')
            .insert({
                user1_id: userId1,
                user2_id: userId2,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            })
            .select()
            .single();

        if (insertError) {
            console.error('Konuşma oluşturma hatası:', insertError);
            throw new Error('Yeni konuşma oluşturulurken bir sorun oluştu');
        }

        console.log('Yeni konuşma oluşturuldu:', newConversation.id);

        // Konuşma katılımcılarını da ekleyelim (isteğe bağlı)
        try {
            await ensureConversationParticipants(newConversation.id, userId1, userId2);
        } catch (participantError) {
            console.error('Katılımcılar eklenirken hata (konuşma yine de kullanılabilir):', participantError);
        }

        return newConversation;
    } catch (error) {
        console.error('getOrCreateConversation hatası:', error);
        throw error;
    }
};

// Konuşma katılımcılarını ekle veya kontrol et
const ensureConversationParticipants = async (conversationId, user1Id, user2Id) => {
    try {
        console.log(`Konuşma katılımcıları kontrol ediliyor: conversationId=${conversationId}`);

        // İlk kullanıcıyı kontrol et
        const { data: participant1, error: error1 } = await supabase
            .from('conversation_participants')
            .select('id')
            .eq('conversation_id', conversationId)
            .eq('user_id', user1Id)
            .single();

        // İlk kullanıcı yoksa ekle
        if (error1 && error1.code === 'PGRST116') {
            console.log(`Katılımcı 1 ekleniyor: user=${user1Id}`);
            const { error: insertError1 } = await supabase
                .from('conversation_participants')
                .insert({
                    conversation_id: conversationId,
                    user_id: user1Id
                });

            if (insertError1) {
                console.error('Katılımcı 1 eklenirken hata:', insertError1);
            }
        }

        // İkinci kullanıcıyı kontrol et
        const { data: participant2, error: error2 } = await supabase
            .from('conversation_participants')
            .select('id')
            .eq('conversation_id', conversationId)
            .eq('user_id', user2Id)
            .single();

        // İkinci kullanıcı yoksa ekle
        if (error2 && error2.code === 'PGRST116') {
            console.log(`Katılımcı 2 ekleniyor: user=${user2Id}`);
            const { error: insertError2 } = await supabase
                .from('conversation_participants')
                .insert({
                    conversation_id: conversationId,
                    user_id: user2Id
                });

            if (insertError2) {
                console.error('Katılımcı 2 eklenirken hata:', insertError2);
            }
        }

        console.log('Konuşma katılımcıları kontrol edildi ve eklendi.');
    } catch (error) {
        console.error('Katılımcılar eklenirken hata:', error);
    }
};

// Kullanıcının tüm konuşmalarını getir
export const getUserConversations = async (userId) => {
    try {
        console.log(`Kullanıcının konuşmaları getiriliyor: userId=${userId}`);

        // İki yöntemle kontrol edelim: hem doğrudan konuşmalar tablosunda hem de katılımcılar tablosunda
        // Önce doğrudan conversations tablosundan (eski yöntem)
        const { data: directConversations, error: directError } = await supabase
            .from('conversations')
            .select(`
                *,
                user1:user1_id (id, username, avatar_url),
                user2:user2_id (id, username, avatar_url),
                messages (
                    id,
                    content,
                    created_at,
                    sender_id
                )
            `)
            .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
            .order('updated_at', { ascending: false });

        if (directError) {
            console.error('Doğrudan konuşmalar alınırken hata:', directError.message);
        }

        // Şimdi conversation_participants tablosundan konuşmaları alalım
        const { data: participantConversations, error: participantError } = await supabase
            .from('conversation_participants')
            .select(`
                conversation:conversation_id (
                    id,
                    user1_id, 
                    user2_id,
                    created_at,
                    updated_at,
                    user1:user1_id (id, username, avatar_url),
                    user2:user2_id (id, username, avatar_url),
                    messages (
                        id,
                        content,
                        created_at,
                        sender_id
                    )
                )
            `)
            .eq('user_id', userId);

        if (participantError) {
            console.error('Katılımcılar üzerinden konuşmalar alınırken hata:', participantError.message);
        }

        // İki listeden benzersiz konuşmaları birleştirelim
        const allConversations = [];

        // Önce doğrudan conversations tablosundan gelenleri ekleyelim
        if (directConversations && directConversations.length > 0) {
            console.log(`Doğrudan conversations tablosundan ${directConversations.length} konuşma bulundu`);
            allConversations.push(...directConversations);
        }

        // Sonra conversation_participants tablosundan gelenleri ekleyelim
        if (participantConversations && participantConversations.length > 0) {
            console.log(`Katılımcılar tablosundan ${participantConversations.length} konuşma bulundu`);

            // Flatten the conversation objects and deduplicate
            participantConversations.forEach(participantData => {
                if (participantData.conversation) {
                    // Daha önce eklenmemişse ekle
                    const isDuplicate = allConversations.some(conv => conv.id === participantData.conversation.id);
                    if (!isDuplicate) {
                        allConversations.push(participantData.conversation);
                    }
                }
            });
        }

        console.log(`Toplam benzersiz konuşma: ${allConversations.length}`);
        return allConversations;

    } catch (error) {
        console.error('Kullanıcı konuşmaları alınırken hata:', error.message);
        return [];
    }
};

// Mesajları dinleme aboneliği oluştur
export const subscribeToMessages = (conversationId, callback) => {
    if (!conversationId) {
        console.error("subscribeToMessages: conversationId olmadan abonelik oluşturulamaz");
        return { unsubscribe: () => { } };  // Boş bir unsubscribe fonksiyonu döndür
    }

    console.log(`Mesaj aboneliği oluşturuluyor: ConversationID=${conversationId}`);

    // Eşsiz kanal adları oluştur - timestamp ekleyerek benzersiz olmasını sağla
    const timestamp = Date.now();
    const pgChannelName = `msgs-pg-${conversationId}-${timestamp}`;
    const broadcastChannelName = `msgs-bc-${conversationId}-${timestamp}`;

    // Kanalların aktif olup olmadığını takip et
    let pgActive = false;
    let bcActive = false;
    let isUnsubscribed = false;

    // PostgreSQL değişikliklerini dinleyen kanal - gelişmiş yapılandırma
    const pgChannel = supabase
        .channel(pgChannelName, {
            config: {
                broadcast: { ack: true },
                presence: { key: '' },
                retryIntervalMs: 1500,  // 1.5 saniye sonra tekrar dene (daha hızlı)
                timeout: 30000  // 30 saniye timeout
            }
        })
        .on('postgres_changes', {
            event: '*', // INSERT yanında UPDATE olaylarını da dinle
            schema: 'public',
            table: 'messages',
            filter: `conversation_id=eq.${conversationId}`
        }, (payload) => {
            console.log(`POSTGRES_CHANGES (${pgChannelName}): Yeni mesaj alındı:`, payload.new?.id);
            callback(payload);
        })
        .subscribe(async (status) => {
            console.log(`Mesaj aboneliği durumu (${pgChannelName}): ${status}`);

            if (status === 'SUBSCRIBED') {
                pgActive = true;
                console.log(`PostgreSQL kanal bağlantısı başarılı: ${pgChannelName}`);
            } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                console.error(`Postgres kanal hatası: ${status}`);
                pgActive = false;

                if (!isUnsubscribed) {
                    // Kanalı yeniden bağla
                    console.log(`PostgreSQL kanalı yeniden bağlanıyor: ${pgChannelName}`);
                    try {
                        await pgChannel.unsubscribe();
                        await new Promise(resolve => setTimeout(resolve, 1000));
                        await pgChannel.subscribe();
                    } catch (e) {
                        console.error("PostgreSQL kanalı yeniden bağlanma hatası:", e);
                    }
                }
            }
        });

    // Broadcast kanalı (manuel gönderimler için) - gelişmiş yapılandırma
    const broadcastChannel = supabase
        .channel(broadcastChannelName, {
            config: {
                broadcast: { ack: true },
                presence: { key: '' },
                retryIntervalMs: 1000,  // 1 saniye sonra tekrar dene (daha hızlı)
                timeout: 20000  // 20 saniye timeout (daha hızlı timeout)
            }
        })
        .on('broadcast', { event: 'message' }, (payload) => {
            // Sadece bu konuşmaya ait mesajları işle
            if (payload.conversation_id === conversationId) {
                console.log(`BROADCAST (${broadcastChannelName}): Yeni mesaj alındı:`, payload.id);
                const eventPayload = {
                    eventType: 'INSERT',
                    new: {
                        ...payload,
                        sender: payload.profiles
                    }
                };
                callback(eventPayload);
            }
        })
        .subscribe(async (status) => {
            console.log(`Broadcast aboneliği durumu (${broadcastChannelName}): ${status}`);

            if (status === 'SUBSCRIBED') {
                bcActive = true;
                console.log(`Broadcast kanal bağlantısı başarılı: ${broadcastChannelName}`);
            } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                console.error(`Broadcast kanal hatası: ${status}`);
                bcActive = false;

                if (!isUnsubscribed) {
                    // Kanalı yeniden bağla
                    console.log(`Broadcast kanalı yeniden bağlanıyor: ${broadcastChannelName}`);
                    try {
                        await broadcastChannel.unsubscribe();
                        await new Promise(resolve => setTimeout(resolve, 1000));
                        await broadcastChannel.subscribe();
                    } catch (e) {
                        console.error("Broadcast kanalı yeniden bağlanma hatası:", e);
                    }
                }
            }
        });

    // Daha sık sağlık kontrolü yap - her 10 saniyede bir
    const healthCheck = setInterval(() => {
        if (isUnsubscribed) {
            clearInterval(healthCheck);
            return;
        }

        if (!pgActive) {
            console.log(`Postgres kanalı aktif değil, yeniden abone olunuyor: ${pgChannelName}`);
            pgChannel.subscribe();
        }
        if (!bcActive) {
            console.log(`Broadcast kanalı aktif değil, yeniden abone olunuyor: ${broadcastChannelName}`);
            broadcastChannel.subscribe();
        }
    }, 10000); // 10 saniyede bir kontrol et (daha sık)

    // Aboneliği sonlandıracak fonksiyonu döndür
    return {
        unsubscribe: () => {
            isUnsubscribed = true;
            clearInterval(healthCheck);
            if (pgChannel) pgChannel.unsubscribe();
            if (broadcastChannel) broadcastChannel.unsubscribe();
            console.log(`Mesaj abonelikleri sonlandırıldı (${pgChannelName}, ${broadcastChannelName})`);
        }
    };
};

// Okunmamış mesaj sayısını getir
export const getUnreadMessagesCount = async (userId) => {
    try {
        // Kullanıcının yer aldığı tüm konuşmaları bul
        const { data: conversationsData, error: conversationsError } = await supabase
            .from('conversations')
            .select('id')
            .or(`user1_id.eq.${userId},user2_id.eq.${userId}`);

        if (conversationsError || !conversationsData) {
            console.error("Konuşmaları getirme hatası:", conversationsError);
            return { count: 0, error: conversationsError };
        }

        if (conversationsData.length === 0) {
            return { count: 0, error: null };
        }

        // Konuşma ID'lerini al
        const conversationIds = conversationsData.map(c => c.id);

        // Okunmamış mesajları sayıyı getir
        const { count, error: countError } = await supabase
            .from('messages')
            .select('id', { count: 'exact', head: true })
            .eq('is_read', false)
            .neq('sender_id', userId)
            .in('conversation_id', conversationIds);

        if (countError) {
            console.error("Okunmamış mesaj sayısını getirme hatası:", countError);
            return { count: 0, error: countError };
        }

        return { count: count || 0, error: null };
    } catch (error) {
        console.error("Okunmamış mesaj sayısını getirirken beklenmeyen hata:", error);
        return { count: 0, error };
    }
};

/**
 * Kullanıcının tüm sohbetlerini ve son mesajlarını detaylı olarak getirir
 * @param {string} userId - Kullanıcı ID'si
 * @returns {Promise<Array>} - Detaylı sohbet dizisi
 */
export const getConversationsWithLastMessages = async (userId) => {
    if (!userId) {
        console.error('getConversationsWithLastMessages: Geçersiz kullanıcı ID\'si');
        throw new Error('Geçersiz kullanıcı ID\'si');
    }

    try {
        console.log(`${userId} ID'li kullanıcı için mesajlı sohbetler getiriliyor`);

        // Kullanıcının dahil olduğu konuşmaları ve son mesajları getir
        const { data: conversations, error } = await supabase
            .from('conversations')
            .select(`
                *,
                user1:user1_id (id, username, avatar_url),
                user2:user2_id (id, username, avatar_url),
                messages:messages (
                    id,
                    content,
                    created_at,
                    sender_id
                )
            `)
            .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
            .order('updated_at', { ascending: false });

        if (error) {
            console.error('Mesajlı konuşmaları getirme hatası:', error.message);
            throw new Error('Konuşmaları getirirken bir sorun oluştu: ' + error.message);
        }

        if (!conversations || conversations.length === 0) {
            console.log('Kullanıcı için konuşma bulunamadı');
            return [];
        }

        console.log(`${conversations.length} konuşma bulundu`);

        // Veriyi formatla ve son mesajları düzenle
        const formattedConversations = conversations.map(conversation => {
            try {
                // Diğer kullanıcıyı belirle
                const otherUser = conversation.user1_id === userId ? conversation.user2 : conversation.user1;

                // Eğer diğer kullanıcı bilgisi yoksa varsayılan değerler ile devam et
                if (!otherUser || !otherUser.id) {
                    console.warn(`Konuşma #${conversation.id} için diğer kullanıcı bilgisi eksik.`);

                    // Bilinmeyen kullanıcı varsayılan bilgileri
                    const defaultUser = {
                        id: conversation.user1_id === userId ? conversation.user2_id : conversation.user1_id,
                        username: 'Bilinmeyen Kullanıcı',
                        avatar_url: null
                    };

                    // Diğer kullanıcı bilgilerini varsayılan değerlerle doldur
                    const fixedOtherUser = otherUser ? { ...otherUser } : { ...defaultUser };

                    // Gerekli alanları kontrol et ve eksikse ekle
                    if (!fixedOtherUser.id) {
                        fixedOtherUser.id = defaultUser.id;
                    }
                    if (!fixedOtherUser.username) {
                        fixedOtherUser.username = defaultUser.username;
                    }

                    // Konuşma mesajlarını oluşturulma tarihine göre sırala
                    const sortedMessages = conversation.messages ?
                        [...conversation.messages].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)) :
                        [];

                    // Son mesaj bilgilerini ayarla
                    const lastMessage = sortedMessages.length > 0 ? sortedMessages[0] : null;
                    let lastMessageText = 'Henüz mesaj yok';
                    let lastMessageTime = conversation.updated_at;

                    if (lastMessage) {
                        lastMessageText = lastMessage.content;
                        lastMessageTime = lastMessage.created_at;

                        // Son mesajı kimin gönderdiğini belirle
                        const isMyMessage = lastMessage.sender_id === userId;
                        if (isMyMessage) {
                            lastMessageText = 'Sen: ' + lastMessageText;
                        }
                    }

                    // Düzeltilmiş yapıyı oluştur
                    return {
                        ...conversation,
                        profiles: fixedOtherUser,
                        last_message: lastMessageText,
                        last_message_time: lastMessageTime,
                        all_messages: sortedMessages,
                        unread_count: 0
                    };
                }

                // Konuşma mesajlarını oluşturulma tarihine göre sırala (en yeni en üstte)
                const sortedMessages = conversation.messages ?
                    [...conversation.messages].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)) :
                    [];

                // En son mesajı al
                const lastMessage = sortedMessages.length > 0 ? sortedMessages[0] : null;

                // Son mesaj metnini belirle
                let lastMessageText = 'Henüz mesaj yok';
                let lastMessageTime = conversation.updated_at;

                if (lastMessage) {
                    lastMessageText = lastMessage.content;
                    lastMessageTime = lastMessage.created_at;

                    // Son mesajı kimin gönderdiğini belirle
                    const isMyMessage = lastMessage.sender_id === userId;
                    if (isMyMessage) {
                        lastMessageText = 'Sen: ' + lastMessageText;
                    }
                }

                // Beklenen yapıyı oluştur
                return {
                    ...conversation, // Konuşmanın diğer tüm alanları
                    profiles: otherUser, // Diğer kullanıcının profil bilgisi
                    last_message: lastMessageText, // Son mesaj içeriği
                    last_message_time: lastMessageTime, // Son mesaj zamanı
                    all_messages: sortedMessages, // Tüm mesajlar (opsiyonel)
                    unread_count: 0 // Okunmamış mesaj sayısı (daha sonra implement edebilirsiniz)
                };
            } catch (err) {
                console.error(`Konuşma #${conversation.id} formatlanırken hata:`, err);
                return null;
            }
        }).filter(conv => conv !== null); // Eksik profilli konuşmaları filtrele

        return formattedConversations;
    } catch (error) {
        console.error('getConversationsWithLastMessages hatası:', error);
        throw error;
    }
};

/**
 * Bir kullanıcının tüm konuşmalarını getirir
 * @param {string} userId - Kullanıcı ID'si
 * @returns {Promise<Array>} - Konuşma dizisi
 */
export const getConversations = async (userId) => {
    if (!userId) {
        console.error('getConversations: Geçersiz kullanıcı ID\'si');
        throw new Error('Geçersiz kullanıcı ID\'si');
    }

    try {
        console.log(`${userId} ID'li kullanıcı için konuşmalar getiriliyor`);

        // Kullanıcının dahil olduğu konuşmaları user1_id veya user2_id üzerinden getir
        const { data: conversations, error } = await supabase
            .from('conversations')
            .select(`
                *,
                user1:user1_id (id, username, avatar_url),
                user2:user2_id (id, username, avatar_url)
            `)
            .or(`user1_id.eq.${userId},user2_id.eq.${userId}`) // Check both user ID columns
            .order('updated_at', { ascending: false });

        if (error) {
            console.error('Konuşmaları getirme hatası:', error.message);
            throw new Error('Konuşmaları getirirken bir sorun oluştu: ' + error.message);
        }

        if (!conversations || conversations.length === 0) {
            console.log('Kullanıcı için konuşma bulunamadı');
            return [];
        }

        console.log(`${conversations.length} konuşma bulundu`);

        // Veriyi formatla: Diğer kullanıcının profilini 'profiles' anahtarı altına al
        const formattedConversations = conversations.map(conversation => {
            // Diğer kullanıcıyı belirle
            const otherUser = conversation.user1_id === userId ? conversation.user2 : conversation.user1;

            // Eğer diğer kullanıcı bilgisi yoksa (örneğin silinmiş kullanıcı), bu konuşmayı atla veya işaretle
            if (!otherUser) {
                console.warn(`Konuşma #${conversation.id} için diğer kullanıcı bilgisi eksik.`);
                return null; // Veya varsayılan bir nesne döndür
            }

            // Beklenen yapıyı oluştur
            return {
                ...conversation, // Konuşmanın diğer tüm alanları
                profiles: otherUser // Diğer kullanıcının profil bilgisi
            };
        }).filter(conv => conv !== null); // Eksik profilli konuşmaları filtrele

        return formattedConversations;
    } catch (error) {
        console.error('getConversations hatası:', error);
        throw error;
    }
};

/**
 * Tüm kullanıcıları döndürür (kullanıcının kendisi hariç)
 * @param {string} currentUserId - Mevcut kullanıcının ID'si (hariç tutulacak)
 * @returns {Promise<Array>} - Kullanıcıların listesi
 */
export const getAllUsers = async (currentUserId) => {
    try {
        // Başlangıçta boş bir dizi döndür, böylece kullanıcı adı anlık olarak görünüp kaybolmaz
        return { users: [], error: null };

        // Not: Aşağıdaki kod artık çalıştırılmayacak, böylece görsel olarak kötü görüntü oluşmayacak
        // Kullanıcılar arama yapıldığında searchUsers fonksiyonu ile getirilecek

        /*
        const { data, error } = await supabase
            .from('users')
            .select('id, username, avatar_url, created_at')
            .neq('id', currentUserId) // Mevcut kullanıcıyı hariç tut
            .order('username', { ascending: true });

        if (error) {
            console.error('Kullanıcıları getirme hatası:', error);
            return { users: [], error };
        }

        return { users: data || [], error: null };
        */
    } catch (error) {
        console.error('getAllUsers hatası:', error);
        return { users: [], error };
    }
};

/**
 * Kullanıcıları ada göre arar
 * @param {string} searchTerm - Aranacak isim/username
 * @param {string} currentUserId - Mevcut kullanıcının ID'si (hariç tutulacak)
 * @returns {Promise<Array>} - Eşleşen kullanıcıların listesi
 */
export const searchUsers = async (searchTerm, currentUserId) => {
    try {
        if (!searchTerm || searchTerm.trim() === '') {
            return { users: [], error: null };
        }

        // Kullanıcı adını arama terimini içeren ve mevcut kullanıcı olmayan kullanıcıları getir
        const { data, error } = await supabase
            .from('users')
            .select('id, username, avatar_url, created_at')
            .ilike('username', `%${searchTerm}%`) // Case-insensitive arama
            .neq('id', currentUserId) // Mevcut kullanıcıyı hariç tut
            .order('username', { ascending: true })
            .limit(20); // Performans için sonuçları sınırla

        if (error) {
            console.error('Kullanıcı arama hatası:', error);
            return { users: [], error };
        }

        return { users: data || [], error: null };
    } catch (error) {
        console.error('searchUsers hatası:', error);
        return { users: [], error };
    }
};
