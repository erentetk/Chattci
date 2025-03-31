import { View, StyleSheet } from 'react-native';
import { colors } from '../config/constants';

const Seperator = () => {
    return (
        <View style={styles.seperator}></View>
    )
}

const styles = StyleSheet.create({
    seperator: {
        height: 1,
        backgroundColor: colors.border,
        marginStart: 86,
        marginEnd: 16
    }
});

export default Seperator;
