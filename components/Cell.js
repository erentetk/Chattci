
import React from "react";
import { TouchableOpacity, View, Text, StyleSheet, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../config/constants";

const Cell = ({ title, icon, onPress, tintColor, style, isDestructive = false, loading = false }) => {
    const iconColor = isDestructive ? colors.red : (tintColor || colors.primary);

    return (
        <TouchableOpacity
            style={[styles.cell, style]}
            onPress={onPress}
            disabled={loading}
        >
            <View style={styles.cellContent}>
                {icon && (
                    <Ionicons
                        name={icon}
                        size={24}
                        color={iconColor}
                        style={styles.cellIcon}
                    />
                )}
                <Text style={[
                    styles.cellTitle,
                    isDestructive && styles.destructiveText
                ]}>
                    {title}
                </Text>
            </View>

            {loading ? (
                <ActivityIndicator size="small" color={iconColor} />
            ) : (
                <Ionicons
                    name="chevron-forward-outline"
                    size={20}
                    color="#bbb"
                />
            )}
        </TouchableOpacity>
    )
}

const styles = StyleSheet.create({
    cell: {
        paddingHorizontal: 16,
        paddingVertical: 14,
        backgroundColor: "white",
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderRadius: 10,
        marginBottom: 8,
    },
    cellContent: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    cellIcon: {
        marginRight: 10,
    },
    cellTitle: {
        fontSize: 16,
        color: '#333',
    },
    destructiveText: {
        color: colors.red,
    },
})

export default Cell;
