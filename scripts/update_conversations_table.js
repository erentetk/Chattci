import supabase from '../config/supabase';

const updateConversationsTable = async () => {
    try {
        console.log('Conversations tablosunu güncelleme başlatılıyor...');

        // 1. Önce conversations tablosunu kontrol et
        const { data: tableInfo, error: checkError } = await supabase
            .from('conversations')
            .select('id')
            .limit(1);

        // 2. Eğer tablo yoksa migration.sql'deki yapıda oluştur
        if (checkError && checkError.message.includes('does not exist')) {
            console.log('Conversations tablosu bulunamadı, oluşturuluyor...');
            const { error: createError } = await supabase.rpc('run_sql', {
                sql: `
        CREATE TABLE IF NOT EXISTS conversations (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user1_id UUID REFERENCES users(id) ON DELETE CASCADE,
          user2_id UUID REFERENCES users(id) ON DELETE CASCADE,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
        
        ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
        
        -- RLS Politikaları
        CREATE POLICY "Users can view their own conversations" ON conversations
          FOR SELECT USING (auth.uid() = user1_id OR auth.uid() = user2_id);
          
        CREATE POLICY "Users can insert their own conversations" ON conversations
          FOR INSERT WITH CHECK (auth.uid() = user1_id OR auth.uid() = user2_id);
          
        CREATE POLICY "Users can update their own conversations" ON conversations
          FOR UPDATE USING (auth.uid() = user1_id OR auth.uid() = user2_id);
        
        -- Tetikleyici
        CREATE OR REPLACE FUNCTION update_conversations_updated_at()
        RETURNS TRIGGER AS $$
        BEGIN
          NEW.updated_at = NOW();
          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
        
        DROP TRIGGER IF EXISTS update_conversations_updated_at ON conversations;
        CREATE TRIGGER update_conversations_updated_at
          BEFORE UPDATE ON conversations
          FOR EACH ROW EXECUTE FUNCTION update_conversations_updated_at();
        `
            });

            if (createError) {
                console.error('Conversations tablosu oluşturulamadı:', createError.message);
                return { success: false, error: createError.message };
            }

            console.log('Conversations tablosu başarıyla oluşturuldu!');
            return { success: true, message: 'Conversations tablosu oluşturuldu' };
        }

        // 3. Tablo var, yapısını kontrol et ve gerekirse güncelle
        console.log('Conversations tablosu mevcut, yapısı kontrol ediliyor...');

        const { error: checkColumnsError } = await supabase.rpc('run_sql', {
            sql: `
      -- Sütunların var olup olmadığını kontrol et
      DO $$ 
      BEGIN
        IF NOT EXISTS (
          SELECT FROM information_schema.columns 
          WHERE table_name = 'conversations' AND column_name = 'user1_id'
        ) THEN
          -- user1_id sütunu yoksa ekle
          ALTER TABLE conversations ADD COLUMN user1_id UUID REFERENCES users(id) ON DELETE CASCADE;
        END IF;
        
        IF NOT EXISTS (
          SELECT FROM information_schema.columns 
          WHERE table_name = 'conversations' AND column_name = 'user2_id'
        ) THEN
          -- user2_id sütunu yoksa ekle
          ALTER TABLE conversations ADD COLUMN user2_id UUID REFERENCES users(id) ON DELETE CASCADE;
        END IF;
      END $$;
      `
        });

        if (checkColumnsError) {
            console.error('Conversations tablosu güncellenemedi:', checkColumnsError.message);
            return { success: false, error: checkColumnsError.message };
        }

        console.log('Conversations tablosu başarıyla güncellendi!');
        return { success: true, message: 'Conversations tablosu güncellendi' };
    } catch (error) {
        console.error('Beklenmeyen hata:', error.message);
        return { success: false, error: error.message };
    }
};

// Script doğrudan çalıştırıldığında
if (require.main === module) {
    updateConversationsTable()
        .then(result => {
            console.log(result.message || result.error);
            process.exit(result.success ? 0 : 1);
        })
        .catch(error => {
            console.error('Hata:', error);
            process.exit(1);
        });
}

export default updateConversationsTable; 