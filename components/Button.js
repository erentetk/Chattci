import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { colors } from '../config/constants';

const Button = ({ label, title, onPress, variant = 'primary', disabled = false, style }) => {
    // Geriye dönük uyumluluk için hem label hem de title proplarını destekle
    const buttonText = label || title;

    return (
        <TouchableOpacity
            style={[
                styles.buttonContainer,
                {
                    backgroundColor: variant === 'primary' ? colors.primary : "transparent",
                    opacity: disabled ? 0.7 : 1
                },
                style
            ]}
            onPress={onPress}
            disabled={disabled}
        >
            {disabled ? (
                <ActivityIndicator color="white" size="small" />
            ) : (
                <Text style={[
                    styles.buttonLabel,
                    { color: variant === 'primary' ? "white" : "black" }]}
                >
                    {buttonText}
                </Text>
            )}
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    buttonContainer: {
        paddingVertical: 15,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        marginVertical: 10,
        paddingHorizontal: 16
    },
    buttonLabel: {
        fontSize: 16,
        fontWeight: 'bold'
    }
});

export default Button;
