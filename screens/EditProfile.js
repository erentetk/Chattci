import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    SafeAreaView,
} from 'react-native';
import { colors } from '../config/constants';
import { Ionicons } from '@expo/vector-icons';

const EditProfile = ({ navigation }) => {
    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.contentContainer}>
                <View style={styles.iconContainer}>
                    <Ionicons name="construct-outline" size={80} color={colors.primary} />
                </View>
                <Text style={styles.title}>Profil Düzenleme</Text>
                <Text style={styles.message}>
                    Bu özellik çok yakında kullanıma sunulacaktır.
                </Text>
                <Text style={styles.submessage}>
                    Profil düzenleme özelliği geliştirme aşamasındadır.
                </Text>

                <TouchableOpacity
                    style={styles.button}
                    onPress={() => navigation.goBack()}
                >
                    <Text style={styles.buttonText}>Geri Dön</Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f5f5',
    },
    contentContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    iconContainer: {
        marginBottom: 20,
        padding: 20,
        borderRadius: 70,
        backgroundColor: 'rgba(33, 150, 243, 0.1)',
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 15,
    },
    message: {
        fontSize: 18,
        color: '#555',
        textAlign: 'center',
        marginBottom: 10,
    },
    submessage: {
        fontSize: 16,
        color: '#777',
        textAlign: 'center',
        marginBottom: 30,
    },
    button: {
        backgroundColor: colors.primary,
        paddingVertical: 12,
        paddingHorizontal: 30,
        borderRadius: 25,
        marginTop: 20,
    },
    buttonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: 'bold',
    },
});

export default EditProfile; 