import supabase from '../config/supabase';

const disableConversationRLS = async () => {
    try {
        console.log('RLS güvenlik politikalarını devre dışı bırakma işlemi başlatılıyor...');

        // Basit SQL komutunu çalıştır - Tüm RLS'yi kaldır
        await supabase.rpc('run_sql', {
            sql: `
      -- Önce tüm politikaları kaldır
      DROP POLICY IF EXISTS "Users can view participants" ON conversation_participants;
      DROP POLICY IF EXISTS "Users can manage participants" ON conversation_participants;
      DROP POLICY IF EXISTS "Users can insert participants" ON conversation_participants;
      DROP POLICY IF EXISTS "Users can delete participants" ON conversation_participants;
      DROP POLICY IF EXISTS "Users can select participants" ON conversation_participants;
      DROP POLICY IF EXISTS "Users can update participants" ON conversation_participants;
      `
        });

        // RLS'yi tamamen devre dışı bırak
        await supabase.rpc('run_sql', {
            sql: `
      -- conversation_participants tablosu için RLS'yi devre dışı bırak
      ALTER TABLE conversation_participants DISABLE ROW LEVEL SECURITY;
      
      -- conversations tablosu için de RLS'yi devre dışı bırak
      ALTER TABLE conversations DISABLE ROW LEVEL SECURITY;
      `
        });

        console.log('RLS güvenlik politikaları başarıyla devre dışı bırakıldı!');
        return { success: true, message: 'RLS devre dışı bırakıldı' };
    } catch (error) {
        console.error('Beklenmeyen hata:', error.message);
        return { success: false, error: error.message };
    }
};

// Script doğrudan çalıştırıldığında
if (require.main === module) {
    disableConversationRLS()
        .then(result => {
            console.log(result.message || result.error);
            process.exit(result.success ? 0 : 1);
        })
        .catch(error => {
            console.error('Hata:', error);
            process.exit(1);
        });
}

export default disableConversationRLS; 