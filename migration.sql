-- 1. Kullanıcıların çevrimiçi durumlarını takip edeceğimiz tablo
CREATE TABLE IF NOT EXISTS user_status (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  online_status BOOLEAN DEFAULT FALSE,
  last_seen TIMESTAMPTZ DEFAULT NOW(),
  typing_to UUID REFERENCES users(id),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Mesajlaşma için sohbet odaları (konuşmalar)
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Hangi kullanıcıların hangi sohbetlere dahil olduğunu gösteren tablo
CREATE TABLE IF NOT EXISTS conversation_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(conversation_id, user_id)
);

-- 4. Mesaj tablosu
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Mesaj durumlarını (okundu, teslim edildi) takip edeceğimiz tablo
CREATE TABLE IF NOT EXISTS message_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, -- mesajın alıcısı
  is_delivered BOOLEAN DEFAULT FALSE,
  is_read BOOLEAN DEFAULT FALSE,
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(message_id, user_id)
);

-- Realtime için gerekli ayarlamalar
ALTER TABLE conversations REPLICA IDENTITY FULL;
ALTER TABLE messages REPLICA IDENTITY FULL;
ALTER TABLE message_status REPLICA IDENTITY FULL;
ALTER TABLE user_status REPLICA IDENTITY FULL;

-- Tetikleyiciler: son güncelleme zamanını otomatik güncellemek için
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Her tablo için tetikleyici oluşturma - 'IF NOT EXISTS' ekleyerek çakışmaları önlüyoruz
DO $$ 
BEGIN
  -- conversations tablosu için tetikleyici
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_conversations_updated_at') THEN
    CREATE TRIGGER update_conversations_updated_at
    BEFORE UPDATE ON conversations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;

  -- messages tablosu için tetikleyici
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_messages_updated_at') THEN
    CREATE TRIGGER update_messages_updated_at
    BEFORE UPDATE ON messages
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;

  -- message_status tablosu için tetikleyici
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_message_status_updated_at') THEN
    CREATE TRIGGER update_message_status_updated_at
    BEFORE UPDATE ON message_status
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;

  -- user_status tablosu için tetikleyici
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_user_status_updated_at') THEN
    CREATE TRIGGER update_user_status_updated_at
    BEFORE UPDATE ON user_status
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;
END
$$;

-- Fonksiyonlar
-- 1. İki kullanıcı arasında sohbet başlatma veya mevcut sohbeti bulma
CREATE OR REPLACE FUNCTION get_or_create_conversation(user1_id UUID, user2_id UUID)
RETURNS UUID AS $$
DECLARE
  existing_conversation_id UUID;
  new_conversation_id UUID;
BEGIN
  -- İki kullanıcı arasında mevcut bir sohbet var mı kontrol et
  SELECT c.id INTO existing_conversation_id
  FROM conversations c
  JOIN conversation_participants cp1 ON c.id = cp1.conversation_id
  JOIN conversation_participants cp2 ON c.id = cp2.conversation_id
  WHERE cp1.user_id = user1_id AND cp2.user_id = user2_id
  LIMIT 1;
  
  -- Eğer sohbet varsa, mevcut sohbeti döndür
  IF existing_conversation_id IS NOT NULL THEN
    RETURN existing_conversation_id;
  END IF;
  
  -- Sohbet yoksa yeni bir sohbet oluştur
  INSERT INTO conversations DEFAULT VALUES RETURNING id INTO new_conversation_id;
  
  -- Kullanıcıları sohbete ekle
  INSERT INTO conversation_participants (conversation_id, user_id) VALUES (new_conversation_id, user1_id);
  INSERT INTO conversation_participants (conversation_id, user_id) VALUES (new_conversation_id, user2_id);
  
  RETURN new_conversation_id;
END;
$$ LANGUAGE plpgsql;

-- 2. Yeni mesaj gönderme fonksiyonu (durumları otomatik oluşturur)
CREATE OR REPLACE FUNCTION send_message(sender_id UUID, receiver_id UUID, message_content TEXT)
RETURNS UUID AS $$
DECLARE
  conversation_id UUID;
  new_message_id UUID;
BEGIN
  -- Sohbeti bul veya oluştur
  conversation_id := get_or_create_conversation(sender_id, receiver_id);
  
  -- Mesajı ekle
  INSERT INTO messages (conversation_id, sender_id, content)
  VALUES (conversation_id, sender_id, message_content)
  RETURNING id INTO new_message_id;
  
  -- Alıcı için mesaj durumu oluştur (başlangıçta teslim edilmedi ve okunmadı)
  INSERT INTO message_status (message_id, user_id, is_delivered, is_read)
  VALUES (new_message_id, receiver_id, FALSE, FALSE);
  
  RETURN new_message_id;
END;
$$ LANGUAGE plpgsql;

-- 3. Mesajın durumunu güncelleme fonksiyonu (okundu veya teslim edildi)
CREATE OR REPLACE FUNCTION update_message_status(message_id_param UUID, user_id_param UUID, mark_delivered BOOLEAN, mark_read BOOLEAN)
RETURNS VOID AS $$
BEGIN
  UPDATE message_status
  SET 
    is_delivered = CASE WHEN mark_delivered THEN TRUE ELSE is_delivered END,
    delivered_at = CASE WHEN mark_delivered AND NOT is_delivered THEN NOW() ELSE delivered_at END,
    is_read = CASE WHEN mark_read THEN TRUE ELSE is_read END,
    read_at = CASE WHEN mark_read AND NOT is_read THEN NOW() ELSE read_at END
  WHERE message_id = message_id_param AND user_id = user_id_param;
END;
$$ LANGUAGE plpgsql;

-- 4. Kullanıcı çevrimiçi durumunu güncelleme
CREATE OR REPLACE FUNCTION update_user_online_status(user_id_param UUID, is_online BOOLEAN)
RETURNS VOID AS $$
BEGIN
  INSERT INTO user_status (user_id, online_status, last_seen)
  VALUES (user_id_param, is_online, NOW())
  ON CONFLICT (user_id) 
  DO UPDATE SET 
    online_status = is_online,
    last_seen = NOW();
END;
$$ LANGUAGE plpgsql;

-- 5. Kullanıcı yazıyor durumunu güncelleme
CREATE OR REPLACE FUNCTION update_typing_status(typing_user_id UUID, to_user_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE user_status
  SET typing_to = to_user_id
  WHERE user_id = typing_user_id;
END;
$$ LANGUAGE plpgsql;

-- Güvenlik politikaları (RLS)
-- Kullanıcı kendi mesajlarını ve kendisine gelen mesajları görebilir
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Politikaları DROP IF EXISTS ile önce temizleyip sonra ekleme
DO $$ 
BEGIN
  -- Messages tablosu politikaları
  IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view their own messages') THEN
    DROP POLICY "Users can view their own messages" ON messages;
  END IF;
  
  CREATE POLICY "Users can view their own messages" ON messages
    FOR SELECT USING (
      auth.uid() = sender_id OR 
      EXISTS (
        SELECT 1 FROM conversation_participants 
        WHERE conversation_id = messages.conversation_id AND user_id = auth.uid()
      )
    );

  IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can insert their own messages') THEN
    DROP POLICY "Users can insert their own messages" ON messages;
  END IF;
  
  CREATE POLICY "Users can insert their own messages" ON messages
    FOR INSERT WITH CHECK (auth.uid() = sender_id);

  -- User status tablosu politikaları  
  IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can update their own status') THEN
    DROP POLICY "Users can update their own status" ON user_status;
  END IF;
  
  ALTER TABLE user_status ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "Users can update their own status" ON user_status
    FOR ALL USING (auth.uid() = user_id);

  -- Message status tablosu politikaları
  IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view message status') THEN
    DROP POLICY "Users can view message status" ON message_status;
  END IF;
  
  ALTER TABLE message_status ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "Users can view message status" ON message_status
    FOR SELECT USING (
      auth.uid() = user_id OR 
      EXISTS (
        SELECT 1 FROM messages 
        WHERE id = message_status.message_id AND sender_id = auth.uid()
      )
    );

  IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can update their own message status') THEN
    DROP POLICY "Users can update their own message status" ON message_status;
  END IF;
  
  CREATE POLICY "Users can update their own message status" ON message_status
    FOR UPDATE USING (auth.uid() = user_id);

  -- Conversations tablosu politikaları
  IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view their conversations') THEN
    DROP POLICY "Users can view their conversations" ON conversations;
  END IF;
  
  ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "Users can view their conversations" ON conversations
    FOR SELECT USING (
      EXISTS (
        SELECT 1 FROM conversation_participants 
        WHERE conversation_id = conversations.id AND user_id = auth.uid()
      )
    );

  -- Conversation participants tablosu politikaları
  IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view their conversation participants') THEN
    DROP POLICY "Users can view their conversation participants" ON conversation_participants;
  END IF;
  
  ALTER TABLE conversation_participants ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "Users can view their conversation participants" ON conversation_participants
    FOR SELECT USING (
      user_id = auth.uid() OR
      EXISTS (
        SELECT 1 FROM conversation_participants cp
        WHERE cp.conversation_id = conversation_participants.conversation_id AND cp.user_id = auth.uid()
      )
    );
END
$$;

-- Realtime publication'a tabloları güvenli bir şekilde ekleme
DO $$ 
BEGIN
  -- Conversations tablosunu ekle
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE conversations;
  EXCEPTION
    WHEN duplicate_object THEN
      RAISE NOTICE 'Tablo zaten publication''a eklenmiş, atlıyor: conversations';
    WHEN undefined_object THEN
      RAISE NOTICE 'supabase_realtime publication bulunamadı, yeni oluşturuluyor';
      CREATE PUBLICATION supabase_realtime FOR TABLE conversations, messages, message_status, user_status;
      RETURN;
  END;

  -- Messages tablosunu ekle
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE messages;
  EXCEPTION
    WHEN duplicate_object THEN
      RAISE NOTICE 'Tablo zaten publication''a eklenmiş, atlıyor: messages';
  END;

  -- Message status tablosunu ekle
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE message_status;
  EXCEPTION
    WHEN duplicate_object THEN
      RAISE NOTICE 'Tablo zaten publication''a eklenmiş, atlıyor: message_status';
  END;

  -- User status tablosunu ekle
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE user_status;
  EXCEPTION
    WHEN duplicate_object THEN
      RAISE NOTICE 'Tablo zaten publication''a eklenmiş, atlıyor: user_status';
  END;
END
$$;

-- Notifications tablosunu oluşturmak için fonksiyon
CREATE OR REPLACE FUNCTION create_notifications_table_if_not_exists()
RETURNS boolean AS $$
BEGIN
  -- Notifications tablosunu oluştur
  IF NOT EXISTS (
    SELECT FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'notifications'
  ) THEN
    CREATE TABLE public.notifications (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      user_id UUID NOT NULL,
      title VARCHAR(255) NOT NULL,
      message TEXT NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      is_read BOOLEAN DEFAULT FALSE,
      CONSTRAINT fk_user_id FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
    );

    -- notifications tablosu için updated_at tetikleyicisi oluştur
    CREATE TRIGGER update_notifications_updated_at
    BEFORE UPDATE ON notifications
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

    -- Bildirimler tablosunu realtime sistemine ekle
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
    EXCEPTION
      WHEN duplicate_object THEN
        RAISE NOTICE 'Tablo zaten publication''a eklenmiş, atlıyor: notifications';
      WHEN undefined_object THEN
        RAISE NOTICE 'supabase_realtime publication bulunamadı';
        CREATE PUBLICATION supabase_realtime FOR TABLE notifications;
    END;

    -- Tablo başarıyla oluşturuldu
    RAISE NOTICE 'Notifications tablosu oluşturuldu';
    RETURN TRUE;
  ELSE
    -- Tablo zaten var
    RAISE NOTICE 'Notifications tablosu zaten mevcut';
    RETURN FALSE;
  END IF;
END;
$$ LANGUAGE plpgsql; 