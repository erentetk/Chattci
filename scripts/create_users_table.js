import supabase from '../config/supabase';

const createUsersTable = async () => {
    try {
        console.log('Users tablosunu oluşturma kontrolü başlatılıyor...');

        // users tablosunu kontrol et
        const { data: tables, error: tableError } = await supabase
            .rpc('get_tables');

        if (tableError) {
            console.error('Tablo listesi alınamadı:', tableError.message);
            // SQL komutunu doğrudan çalıştırmaya çalış
            const { error: createError } = await supabase.rpc('run_sql', {
                sql: `
        CREATE TABLE IF NOT EXISTS users (
          id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
          username TEXT UNIQUE,
          email TEXT UNIQUE NOT NULL,
          full_name TEXT,
          phone TEXT,
          avatar_url TEXT,
          bio TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
        
        ALTER TABLE users ENABLE ROW LEVEL SECURITY;
        
        -- RLS Politikaları
        CREATE POLICY "Users can view other users" ON users
          FOR SELECT USING (true);
          
        CREATE POLICY "Users can update own profile" ON users
          FOR UPDATE USING (auth.uid() = id);
        `
            });

            if (createError) {
                console.error('Users tablosu oluşturulamadı:', createError.message);
                return false;
            }

            console.log('Users tablosu başarıyla oluşturuldu!');
            return true;
        }

        // Tablonun var olup olmadığını kontrol et
        const hasUsersTable = tables.some(table => table.table_name === 'users');

        if (!hasUsersTable) {
            console.log('Users tablosu bulunamadı, oluşturuluyor...');
            const { error: createError } = await supabase.rpc('run_sql', {
                sql: `
        CREATE TABLE IF NOT EXISTS users (
          id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
          username TEXT UNIQUE,
          email TEXT UNIQUE NOT NULL,
          full_name TEXT,
          phone TEXT,
          avatar_url TEXT,
          bio TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
        
        ALTER TABLE users ENABLE ROW LEVEL SECURITY;
        
        -- RLS Politikaları
        CREATE POLICY "Users can view other users" ON users
          FOR SELECT USING (true);
          
        CREATE POLICY "Users can update own profile" ON users
          FOR UPDATE USING (auth.uid() = id);
        `
            });

            if (createError) {
                console.error('Users tablosu oluşturulamadı:', createError.message);
                return false;
            }

            console.log('Users tablosu başarıyla oluşturuldu!');
            return true;
        } else {
            // Tabloyu kontrol et ve full_name sütununu ekle (eğer yoksa)
            try {
                const { error: alterError } = await supabase.rpc('run_sql', {
                    sql: `
          -- Sütunun var olup olmadığını kontrol et
          DO $$ 
          BEGIN
            IF NOT EXISTS (
              SELECT FROM information_schema.columns 
              WHERE table_name = 'users' AND column_name = 'full_name'
            ) THEN
              -- Sütun yoksa ekle
              ALTER TABLE users ADD COLUMN full_name TEXT;
            END IF;
          END $$;
          `
                });

                if (alterError) {
                    console.error('Tablo sütunu eklenemedi:', alterError.message);
                } else {
                    console.log('Tablo sütunları kontrol edildi ve güncellendi!');
                }
            } catch (err) {
                console.error('Tablo güncellenirken beklenmeyen hata:', err.message);
            }
        }

        console.log('Users tablosu zaten var.');
        return true;
    } catch (error) {
        console.error('Beklenmeyen hata:', error.message);
        return false;
    }
};

export default createUsersTable;

// Script doğrudan çalıştırıldığında
if (require.main === module) {
    createUsersTable()
        .then(success => {
            console.log(`İşlem ${success ? 'başarılı' : 'başarısız'} oldu.`);
            process.exit(success ? 0 : 1);
        })
        .catch(error => {
            console.error('Hata:', error);
            process.exit(1);
        });
} 