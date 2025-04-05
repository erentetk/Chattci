import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../config/constants';

const ContactRow = ({ name, subtitle, onPress, style, time, avatarUrl, unread }) => {
    // Debug değerlerini güvenli şekilde konsola yazdır
    if (__DEV__) {
        console.log('Debug değerleri:', {
            name: name || '',
            subtitle: subtitle || '',
            time: time || '',
            unread: unread || 0
        });
    }

    // İsim parçalarını güvenli bir şekilde ayır
    const nameParts = name ? name.split(' ') : ['', ''];
    const firstInitial = nameParts[0] ? nameParts[0].charAt(0) : '';
    const secondInitial = nameParts[1] ? nameParts[1].charAt(0) : '';

    return (
        <TouchableOpacity style={[styles.row, style]} onPress={onPress}>
            <View style={styles.avatar}>
                {avatarUrl ? (
                    <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
                ) : (
                    <Text style={styles.avatarLabel}>
                        {firstInitial}{secondInitial}
                    </Text>
                )}
            </View>
            <View style={styles.textsContainer}>
                <View style={styles.nameTimeRow}>
                    <Text style={styles.name}>{name || ''}</Text>
                    {time ? <Text style={styles.timeText}>{time}</Text> : null}
                </View>
                <View style={styles.subtitleContainer}>
                    <Text style={styles.subtitle} numberOfLines={1} ellipsizeMode="tail">
                        {subtitle || ''}
                    </Text>
                    {unread > 0 && (
                        <View style={styles.unreadBadge}>
                            <Text style={styles.unreadText}>
                                {unread}
                            </Text>
                        </View>
                    )}
                </View>
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
        overflow: 'hidden',
    },
    avatarImage: {
        width: '100%',
        height: '100%',
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
    nameTimeRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    name: {
        fontSize: 16,
        fontWeight: '500',
    },
    timeText: {
        fontSize: 12,
        color: 'gray',
        marginRight: 10,
    },
    subtitleContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 4,
    },
    subtitle: {
        color: 'gray',
        flex: 1,
    },
    unreadBadge: {
        backgroundColor: colors.primary,
        borderRadius: 10,
        minWidth: 20,
        height: 20,
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: 8,
    },
    unreadText: {
        color: 'white',
        fontSize: 12,
        fontWeight: 'bold',
        paddingHorizontal: 5,
    },
});

export default ContactRow;