import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../config/constants';

const ContactRow = ({ name, subtitle, onPress, style }) => {
    // Debug için bir breakpoint ekleyebileceğiniz örnek kod
    const debugValue = {
        name,
        subtitle,
        style
    };

    // Bu satıra breakpoint ekleyebilirsiniz
    console.log('Debug değerleri:', debugValue);

    const nameParts = name ? name.split(' ') : ['', ''];
    const firstInitial = nameParts[0] ? nameParts[0].charAt(0) : '';
    const secondInitial = nameParts[1] ? nameParts[1].charAt(0) : '';

    return (
        <TouchableOpacity style={[styles.row, style]} onPress={onPress}>
            <View style={styles.avatar}>
                <Text style={styles.avatarLabel}>
                    {firstInitial}{secondInitial}
                </Text>
            </View>
            <View style={styles.textsContainer}>
                <Text style={styles.name}>{name}</Text>
                <Text style={styles.subtitle}>{subtitle}</Text>
            </View>
            <Ionicons name="chevron-forward-outline" size={20} color="black" />
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 20,
        borderBottomColor: '#ccc',
    },
    avatar: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarLabel: {
        fontSize: 20,
        color: 'white',
        textAlign: 'center',
    },
    textsContainer: {
        flex: 1,
        marginStart: 16,
    },
    name: {
        fontSize: 16,
    },
    subtitle: {
        marginTop: 2,
        color: 'gray',
    }
});

export default ContactRow;