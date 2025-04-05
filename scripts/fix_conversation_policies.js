import supabase from '../config/supabase';

const fixConversationPolicies = async () => {
    try {
        console.log('Konuşma politikalarını düzeltme başlatılıyor...');

        // 1. Önce mevcut politikaları kontrol et ve varsa kaldır
        const { error: dropPoliciesError } = await supabase.rpc('run_sql', {
            sql: `
      -- Mevcut politikaları kaldır
      DROP POLICY IF EXISTS "Users can view participants" ON conversation_participants;
      DROP POLICY IF EXISTS "Users can manage participants" ON conversation_participants;
      
      -- conversation_participants tablosu için RLS'i etkinleştir
      ALTER TABLE conversation_participants ENABLE ROW LEVEL SECURITY;
      `
        });

        if (dropPoliciesError) {
            console.error('Politikalar kaldırılırken hata:', dropPoliciesError.message);
            return { success: false, error: dropPoliciesError.message };
        }

        // 2. Yeni ve daha basit politikalar oluştur
        const { error: createPoliciesError } = await supabase.rpc('run_sql', {
            sql: `
      -- Görüntüleme politikası: Kullanıcılar kendi sohbetlerinin katılımcılarını görebilir
      CREATE POLICY "Users can view participants" ON conversation_participants
        FOR SELECT USING (
          EXISTS (
            SELECT 1 FROM conversations c
            WHERE c.id = conversation_participants.conversation_id 
            AND (c.user1_id = auth.uid() OR c.user2_id = auth.uid())
          )
        );
        
      -- Ekleme/Düzenleme/Silme politikası: Kullanıcılar kendi sohbetlerindeki katılımcıları yönetebilir
      CREATE POLICY "Users can manage participants" ON conversation_participants
        FOR ALL USING (
          auth.uid() IN (
            SELECT c.user1_id FROM conversations c WHERE c.id = conversation_participants.conversation_id
            UNION
            SELECT c.user2_id FROM conversations c WHERE c.id = conversation_participants.conversation_id
          )
        );
      `
        });

        if (createPoliciesError) {
            console.error('Yeni politikalar oluşturulurken hata:', createPoliciesError.message);
            return { success: false, error: createPoliciesError.message };
        }

        // 3. Conversations tablosu politikalarını da kontrol et ve güncelle
        const { error: conversationPoliciesError } = await supabase.rpc('run_sql', {
            sql: `
      -- Mevcut politikaları kaldır
      DROP POLICY IF EXISTS "Users can view their own conversations" ON conversations;
      DROP POLICY IF EXISTS "Users can insert their own conversations" ON conversations;
      DROP POLICY IF EXISTS "Users can update their own conversations" ON conversations;
      
      -- RLS'i etkinleştir
      ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
      
      -- Yeni politikalar oluştur
      CREATE POLICY "Users can view their own conversations" ON conversations
        FOR SELECT USING (
          user1_id = auth.uid() OR user2_id = auth.uid()
        );
        
      CREATE POLICY "Users can insert their own conversations" ON conversations
        FOR INSERT WITH CHECK (
          user1_id = auth.uid() OR user2_id = auth.uid()
        );
        
      CREATE POLICY "Users can update their own conversations" ON conversations
        FOR UPDATE USING (
          user1_id = auth.uid() OR user2_id = auth.uid()
        );
      `
        });

        if (conversationPoliciesError) {
            console.error('Conversations politikaları güncellenirken hata:', conversationPoliciesError.message);
            return { success: false, error: conversationPoliciesError.message };
        }

        console.log('Konuşma politikaları başarıyla düzeltildi!');
        return { success: true, message: 'Konuşma politikaları düzeltildi' };
    } catch (error) {
        console.error('Beklenmeyen hata:', error.message);
        return { success: false, error: error.message };
    }
};

// Script doğrudan çalıştırıldığında
if (require.main === module) {
    fixConversationPolicies()
        .then(result => {
            console.log(result.message || result.error);
            process.exit(result.success ? 0 : 1);
        })
        .catch(error => {
            console.error('Hata:', error);
            process.exit(1);
        });
}

export default fixConversationPolicies; 