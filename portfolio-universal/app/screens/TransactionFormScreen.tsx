import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import GradientText from '../components/GradientText';
import { colors } from '../theme/colors';
import { api } from '../services/api';
import { useAuth } from '../components/AuthProvider';

type Props = NativeStackScreenProps<RootStackParamList, 'TransactionForm'>;

interface TransactionData {
  transactionType: 'buy' | 'sell';
  symbol: string;
  quantity: string;
  price: string;
  date: Date;
  currency: string;
  exchangeRate: string;
  commission: string;
  notes: string;
}

const CURRENCIES = [
  { code: 'USD', name: 'US Dollar' },
  { code: 'EUR', name: 'Euro' },
  { code: 'GBP', name: 'British Pound' },
  { code: 'JPY', name: 'Japanese Yen' },
  { code: 'AUD', name: 'Australian Dollar' },
  { code: 'CAD', name: 'Canadian Dollar' },
  { code: 'CHF', name: 'Swiss Franc' },
  { code: 'CNY', name: 'Chinese Yuan' },
  { code: 'HKD', name: 'Hong Kong Dollar' },
  { code: 'NZD', name: 'New Zealand Dollar' },
  { code: 'SEK', name: 'Swedish Krona' },
  { code: 'KRW', name: 'South Korean Won' },
  { code: 'SGD', name: 'Singapore Dollar' },
  { code: 'NOK', name: 'Norwegian Krone' },
  { code: 'MXN', name: 'Mexican Peso' },
  { code: 'INR', name: 'Indian Rupee' },
  { code: 'RUB', name: 'Russian Ruble' },
  { code: 'ZAR', name: 'South African Rand' },
  { code: 'TRY', name: 'Turkish Lira' },
  { code: 'BRL', name: 'Brazilian Real' },
];

export default function TransactionFormScreen({ route, navigation }: Props): React.JSX.Element {
  const { ticker } = route.params || {};
  const { user } = useAuth();
  
  const [loading, setLoading] = useState(false);
  const [loadingRate, setLoadingRate] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [userCurrency, setUserCurrency] = useState('USD');
  const [stockCurrency, setStockCurrency] = useState('USD');
  
  const [formData, setFormData] = useState<TransactionData>({
    transactionType: 'buy',
    symbol: ticker || '',
    quantity: '',
    price: '',
    date: new Date(),
    currency: 'USD',
    exchangeRate: '1.0',
    commission: '0',
    notes: '',
  });

  // Fetch user's base currency on mount
  useEffect(() => {
    fetchUserCurrency();
  }, []);

  // Determine stock currency from symbol
  useEffect(() => {
    if (formData.symbol) {
      const detectedCurrency = getStockCurrency(formData.symbol);
      setStockCurrency(detectedCurrency);
      setFormData(prev => ({ ...prev, currency: detectedCurrency }));
    }
  }, [formData.symbol]);

  // Fetch exchange rate when currencies differ
  useEffect(() => {
    if (stockCurrency !== userCurrency && formData.symbol) {
      fetchExchangeRate();
    } else {
      setFormData(prev => ({ ...prev, exchangeRate: '1.0' }));
    }
  }, [stockCurrency, userCurrency, formData.date]);

  const fetchUserCurrency = async () => {
    try {
      const response = await api.get('/profile/currency');
      if (response.data?.base_currency) {
        setUserCurrency(response.data.base_currency);
      }
    } catch (error) {
      console.error('Failed to fetch user currency:', error);
    }
  };

  const fetchExchangeRate = async () => {
    setLoadingRate(true);
    try {
      const dateStr = formData.date.toISOString().split('T')[0];
      const response = await api.get('/forex/rate', {
        params: {
          from_currency: stockCurrency,
          to_currency: userCurrency,
          date: dateStr
        }
      });
      
      if (response.data?.rate) {
        setFormData(prev => ({ ...prev, exchangeRate: response.data.rate.toString() }));
      }
    } catch (error) {
      console.error('Failed to fetch exchange rate:', error);
      // Keep the manually entered rate
    } finally {
      setLoadingRate(false);
    }
  };

  const getStockCurrency = (symbol: string): string => {
    const upperSymbol = symbol.toUpperCase();
    
    if (upperSymbol.endsWith('.AX')) return 'AUD';
    if (upperSymbol.endsWith('.L')) return 'GBP';
    if (upperSymbol.endsWith('.TO')) return 'CAD';
    if (upperSymbol.endsWith('.PA') || upperSymbol.endsWith('.DE') || 
        upperSymbol.endsWith('.MC') || upperSymbol.endsWith('.MI')) return 'EUR';
    if (upperSymbol.endsWith('.T')) return 'JPY';
    if (upperSymbol.endsWith('.HK')) return 'HKD';
    if (upperSymbol.endsWith('.SI')) return 'SGD';
    
    return 'USD'; // Default
  };

  const calculateTotal = (): string => {
    const quantity = parseFloat(formData.quantity) || 0;
    const price = parseFloat(formData.price) || 0;
    const commission = parseFloat(formData.commission) || 0;
    const exchangeRate = parseFloat(formData.exchangeRate) || 1;
    
    if (quantity > 0 && price > 0) {
      const subtotal = quantity * price;
      const total = formData.transactionType === 'buy' 
        ? (subtotal + commission) * exchangeRate
        : (subtotal - commission) * exchangeRate;
      return total.toFixed(2);
    }
    return '0.00';
  };

  const handleSubmit = async () => {
    // Validate form
    if (!formData.symbol.trim()) {
      Alert.alert('Error', 'Please enter a stock symbol');
      return;
    }
    
    const quantity = parseFloat(formData.quantity);
    const price = parseFloat(formData.price);
    
    if (isNaN(quantity) || quantity <= 0) {
      Alert.alert('Error', 'Please enter a valid quantity');
      return;
    }
    
    if (isNaN(price) || price <= 0) {
      Alert.alert('Error', 'Please enter a valid price');
      return;
    }

    setLoading(true);
    try {
      const response = await api.post('/transactions', {
        transaction_type: formData.transactionType.toUpperCase(),
        symbol: formData.symbol.toUpperCase(),
        quantity: quantity,
        price: price,
        date: formData.date.toISOString().split('T')[0],
        currency: formData.currency,
        exchange_rate: parseFloat(formData.exchangeRate) || 1.0,
        commission: parseFloat(formData.commission) || 0,
        notes: formData.notes,
      });

      if (response.data) {
        Alert.alert('Success', 'Transaction added successfully', [
          {
            text: 'OK',
            onPress: () => navigation.goBack()
          }
        ]);
      }
    } catch (error: any) {
      Alert.alert(
        'Error',
        error.response?.data?.detail || 'Failed to add transaction'
      );
    } finally {
      setLoading(false);
    }
  };

  const onDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) {
      setFormData(prev => ({ ...prev, date: selectedDate }));
    }
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <GradientText style={styles.title}>
            Add Transaction
          </GradientText>
        </View>

        <View style={styles.form}>
          {/* Transaction Type */}
          <View style={styles.typeSelector}>
            <TouchableOpacity
              style={[
                styles.typeButton,
                formData.transactionType === 'buy' && styles.typeButtonActive
              ]}
              onPress={() => setFormData(prev => ({ ...prev, transactionType: 'buy' }))}
            >
              <Text style={[
                styles.typeButtonText,
                formData.transactionType === 'buy' && styles.typeButtonTextActive
              ]}>Buy</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.typeButton,
                formData.transactionType === 'sell' && styles.typeButtonActive
              ]}
              onPress={() => setFormData(prev => ({ ...prev, transactionType: 'sell' }))}
            >
              <Text style={[
                styles.typeButtonText,
                formData.transactionType === 'sell' && styles.typeButtonTextActive
              ]}>Sell</Text>
            </TouchableOpacity>
          </View>

          {/* Symbol */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Stock Symbol</Text>
            <TextInput
              style={styles.input}
              value={formData.symbol}
              onChangeText={(text) => setFormData(prev => ({ ...prev, symbol: text.toUpperCase() }))}
              placeholder="e.g., AAPL"
              placeholderTextColor={colors.textSecondary}
              autoCapitalize="characters"
              editable={!loading}
            />
          </View>

          {/* Date */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Date</Text>
            <TouchableOpacity
              style={styles.dateButton}
              onPress={() => setShowDatePicker(true)}
              disabled={loading}
            >
              <Text style={styles.dateText}>
                {formData.date.toLocaleDateString()}
              </Text>
            </TouchableOpacity>
            {showDatePicker && (
              <DateTimePicker
                value={formData.date}
                mode="date"
                display="default"
                onChange={onDateChange}
                maximumDate={new Date()}
              />
            )}
          </View>

          {/* Quantity */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Quantity</Text>
            <TextInput
              style={styles.input}
              value={formData.quantity}
              onChangeText={(text) => setFormData(prev => ({ ...prev, quantity: text }))}
              placeholder="0"
              placeholderTextColor={colors.textSecondary}
              keyboardType="decimal-pad"
              editable={!loading}
            />
          </View>

          {/* Price */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Price per Share ({stockCurrency})</Text>
            <TextInput
              style={styles.input}
              value={formData.price}
              onChangeText={(text) => setFormData(prev => ({ ...prev, price: text }))}
              placeholder="0.00"
              placeholderTextColor={colors.textSecondary}
              keyboardType="decimal-pad"
              editable={!loading}
            />
          </View>

          {/* Currency Section */}
          {stockCurrency !== userCurrency && (
            <View style={styles.currencySection}>
              <Text style={styles.sectionTitle}>Currency Conversion</Text>
              <Text style={styles.currencyInfo}>
                Converting from {stockCurrency} to {userCurrency}
              </Text>
              
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Exchange Rate</Text>
                <View style={styles.rateContainer}>
                  <TextInput
                    style={[styles.input, styles.rateInput]}
                    value={formData.exchangeRate}
                    onChangeText={(text) => setFormData(prev => ({ ...prev, exchangeRate: text }))}
                    placeholder="1.0"
                    placeholderTextColor={colors.textSecondary}
                    keyboardType="decimal-pad"
                    editable={!loading && !loadingRate}
                  />
                  {loadingRate && (
                    <ActivityIndicator 
                      size="small" 
                      color={colors.primary} 
                      style={styles.rateLoader}
                    />
                  )}
                </View>
                <Text style={styles.helperText}>
                  1 {stockCurrency} = {formData.exchangeRate} {userCurrency}
                </Text>
              </View>
            </View>
          )}

          {/* Commission */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Commission ({userCurrency})</Text>
            <TextInput
              style={styles.input}
              value={formData.commission}
              onChangeText={(text) => setFormData(prev => ({ ...prev, commission: text }))}
              placeholder="0.00"
              placeholderTextColor={colors.textSecondary}
              keyboardType="decimal-pad"
              editable={!loading}
            />
          </View>

          {/* Notes */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Notes (Optional)</Text>
            <TextInput
              style={[styles.input, styles.notesInput]}
              value={formData.notes}
              onChangeText={(text) => setFormData(prev => ({ ...prev, notes: text }))}
              placeholder="Add any notes..."
              placeholderTextColor={colors.textSecondary}
              multiline
              numberOfLines={3}
              editable={!loading}
            />
          </View>

          {/* Total */}
          <View style={styles.totalContainer}>
            <Text style={styles.totalLabel}>Total ({userCurrency})</Text>
            <Text style={styles.totalAmount}>{calculateTotal()}</Text>
          </View>

          {/* Submit Button */}
          <TouchableOpacity
            style={[styles.submitButton, loading && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={colors.background} />
            ) : (
              <Text style={styles.submitButtonText}>Add Transaction</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
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
  form: {
    padding: 20,
  },
  typeSelector: {
    flexDirection: 'row',
    marginBottom: 20,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  typeButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: colors.card,
  },
  typeButtonActive: {
    backgroundColor: colors.primary,
  },
  typeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  typeButtonTextActive: {
    color: colors.background,
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  input: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 15,
    fontSize: 16,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dateButton: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 15,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dateText: {
    fontSize: 16,
    color: colors.text,
  },
  currencySection: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 15,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  currencyInfo: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 15,
  },
  rateContainer: {
    position: 'relative',
  },
  rateInput: {
    paddingRight: 40,
  },
  rateLoader: {
    position: 'absolute',
    right: 15,
    top: 15,
  },
  helperText: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 5,
  },
  notesInput: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  totalContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  totalAmount: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.primary,
  },
  submitButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    color: colors.background,
    fontSize: 18,
    fontWeight: '600',
  },
});