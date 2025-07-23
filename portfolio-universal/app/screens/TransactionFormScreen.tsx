import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import GradientText from '../components/GradientText';
import { colors } from '../theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'TransactionForm'>;

export default function TransactionFormScreen({ route }: Props): React.JSX.Element {
  const transactionType = route.params?.type || 'buy';
  
  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <GradientText style={styles.title}>
          {transactionType === 'buy' ? 'Buy' : 'Sell'} Transaction
        </GradientText>
      </View>
      <View style={styles.content}>
        <Text style={styles.placeholder}>
          Transaction form for {transactionType} orders will be implemented here
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.primaryText,
  },
  content: {
    padding: 20,
  },
  placeholder: {
    fontSize: 16,
    color: colors.secondaryText,
    textAlign: 'center',
    marginTop: 40,
  },
});