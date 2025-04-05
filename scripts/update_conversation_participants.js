import supabase from '../config/supabase';

const updateConversationParticipants = async () => {
    try {
        console.log('Conversation participants tablosunu güncelleme başlatılıyor...');

        // 1. Önce tabloyu kontrol et
        const { data: tableInfo, error: checkError } = await supabase
            .from('conversation_participants')
            .select('id')
            .limit(1);

        // 2. Eğer tablo yoksa migration.sql'deki yapıda oluştur
        if (checkError && checkError.message.includes('does not exist')) {
            console.log('Conversation participants tablosu bulunamadı, oluşturuluyor...');
            const { error: createError } = await supabase.rpc('run_sql', {
                sql: `
        CREATE TABLE IF NOT EXISTS conversation_participants (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          UNIQUE(conversation_id, user_id)
        );
        
        ALTER TABLE conversation_participants ENABLE ROW LEVEL SECURITY;
        `
            });

            if (createError) {
                console.error('Conversation participants tablosu oluşturulamadı:', createError.message);
                return { success: false, error: createError.message };
            }

            console.log('Conversation participants tablosu başarıyla oluşturuldu!');
        } else if (checkError) {
            console.error('Tablo kontrolünde beklenmeyen hata:', checkError.message);
            return { success: false, error: checkError.message };
        } else {
            console.log('Conversation participants tablosu zaten var.');
        }

        // 3. Mevcut conversations tablosundaki verileri conversation_participants tablosuna senkronize et
        console.log('Mevcut konuşma verilerini senkronize etme...');
        const { error: syncError } = await supabase.rpc('run_sql', {
            sql: `
      -- Mevcut konuşmaları conversation_participants tablosuna ekle
      INSERT INTO conversation_participants (conversation_id, user_id)
      SELECT id, user1_id FROM conversations
      WHERE user1_id IS NOT NULL
      ON CONFLICT (conversation_id, user_id) DO NOTHING;
      
      INSERT INTO conversation_participants (conversation_id, user_id)
      SELECT id, user2_id FROM conversations
      WHERE user2_id IS NOT NULL
      ON CONFLICT (conversation_id, user_id) DO NOTHING;
      `
        });

        if (syncError) {
            console.error('Konuşma verileri senkronize edilirken hata:', syncError.message);
            return { success: false, error: syncError.message };
        }

        console.log('Conversation participants tablosu başarıyla güncellendi!');
        return { success: true, message: 'Conversation participants tablosu güncellendi' };
    } catch (error) {
        console.error('Beklenmeyen hata:', error.message);
        return { success: false, error: error.message };
    }
};

// Script doğrudan çalıştırıldığında
if (require.main === module) {
    updateConversationParticipants()
        .then(result => {
            console.log(result.message || result.error);
            process.exit(result.success ? 0 : 1);
        })
        .catch(error => {
            console.error('Hata:', error);
            process.exit(1);
        });
}

export default updateConversationParticipants; 