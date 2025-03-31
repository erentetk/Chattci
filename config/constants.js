import { Platform } from 'react-native';
import { SUPABASE_URL, SUPABASE_KEY } from '@env';

const colors = {
    primary: '#2196f3',// mavi  chat screen header rengi 
    primaryLight: '#64b5f6', // Daha açık mavi ton
    secondary: '#111111',
    border: "#e2e2e2",
    red: "#f44336",
    green: "#4CAF50",
    pink: "#e91e63",
    darkGray: "#666666",
    text: {
        primary: "#333333",
        secondary: "#777777"
    }
}

// Web platformunda TextInput focus outline'ını kaldırmak için stil
export const webNoOutlineStyle = Platform.OS === 'web' ? {
    outline: "none",
    outlineStyle: "none"
} : {};

export { colors };

// Supabase Yapılandırması
export const supabaseConfig = {
    supabaseUrl: SUPABASE_URL,
    supabaseKey: SUPABASE_KEY
};
