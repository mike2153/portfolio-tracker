import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { useNavigation } from '@react-navigation/native';
import { colors } from '../theme/colors';
import { api } from '../services/api';
import { useAuth } from '../components/AuthProvider';

interface ProfileData {
  firstName: string;
  lastName: string;
  country: string;
  baseCurrency: string;
}

// Country to currency mapping
const COUNTRY_CURRENCY_MAP: Record<string, string> = {
  'US': 'USD',
  'CA': 'CAD',
  'GB': 'GBP',
  'AU': 'AUD',
  'NZ': 'NZD',
  'JP': 'JPY',
  'CN': 'CNY',
  'HK': 'HKD',
  'SG': 'SGD',
  'IN': 'INR',
  'KR': 'KRW',
  'DE': 'EUR',
  'FR': 'EUR',
  'IT': 'EUR',
  'ES': 'EUR',
  'NL': 'EUR',
  'BE': 'EUR',
  'AT': 'EUR',
  'PT': 'EUR',
  'GR': 'EUR',
  'IE': 'EUR',
  'FI': 'EUR',
  'CH': 'CHF',
  'SE': 'SEK',
  'NO': 'NOK',
  'DK': 'DKK',
  'BR': 'BRL',
  'MX': 'MXN',
  'AR': 'ARS',
  'CL': 'CLP',
  'CO': 'COP',
  'ZA': 'ZAR',
  'RU': 'RUB',
  'TR': 'TRY',
  'IL': 'ILS',
  'AE': 'AED',
  'SA': 'SAR',
  'TH': 'THB',
  'MY': 'MYR',
  'ID': 'IDR',
  'PH': 'PHP',
  'VN': 'VND',
  'PL': 'PLN',
  'CZ': 'CZK',
  'HU': 'HUF',
  'RO': 'RON',
};

const COUNTRIES = [
  { code: 'US', name: 'United States' },
  { code: 'CA', name: 'Canada' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'AU', name: 'Australia' },
  { code: 'NZ', name: 'New Zealand' },
  { code: 'JP', name: 'Japan' },
  { code: 'CN', name: 'China' },
  { code: 'HK', name: 'Hong Kong' },
  { code: 'SG', name: 'Singapore' },
  { code: 'IN', name: 'India' },
  { code: 'KR', name: 'South Korea' },
  { code: 'DE', name: 'Germany' },
  { code: 'FR', name: 'France' },
  { code: 'IT', name: 'Italy' },
  { code: 'ES', name: 'Spain' },
  { code: 'NL', name: 'Netherlands' },
  { code: 'BE', name: 'Belgium' },
  { code: 'AT', name: 'Austria' },
  { code: 'PT', name: 'Portugal' },
  { code: 'GR', name: 'Greece' },
  { code: 'IE', name: 'Ireland' },
  { code: 'FI', name: 'Finland' },
  { code: 'CH', name: 'Switzerland' },
  { code: 'SE', name: 'Sweden' },
  { code: 'NO', name: 'Norway' },
  { code: 'DK', name: 'Denmark' },
  { code: 'BR', name: 'Brazil' },
  { code: 'MX', name: 'Mexico' },
  { code: 'AR', name: 'Argentina' },
  { code: 'CL', name: 'Chile' },
  { code: 'CO', name: 'Colombia' },
  { code: 'ZA', name: 'South Africa' },
  { code: 'RU', name: 'Russia' },
  { code: 'TR', name: 'Turkey' },
  { code: 'IL', name: 'Israel' },
  { code: 'AE', name: 'United Arab Emirates' },
  { code: 'SA', name: 'Saudi Arabia' },
  { code: 'TH', name: 'Thailand' },
  { code: 'MY', name: 'Malaysia' },
  { code: 'ID', name: 'Indonesia' },
  { code: 'PH', name: 'Philippines' },
  { code: 'VN', name: 'Vietnam' },
  { code: 'PL', name: 'Poland' },
  { code: 'CZ', name: 'Czech Republic' },
  { code: 'HU', name: 'Hungary' },
  { code: 'RO', name: 'Romania' },
];

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
  { code: 'DKK', name: 'Danish Krone' },
  { code: 'PLN', name: 'Polish Zloty' },
  { code: 'THB', name: 'Thai Baht' },
  { code: 'IDR', name: 'Indonesian Rupiah' },
  { code: 'CZK', name: 'Czech Koruna' },
  { code: 'ILS', name: 'Israeli Shekel' },
  { code: 'CLP', name: 'Chilean Peso' },
  { code: 'PHP', name: 'Philippine Peso' },
  { code: 'AED', name: 'UAE Dirham' },
  { code: 'COP', name: 'Colombian Peso' },
  { code: 'SAR', name: 'Saudi Riyal' },
  { code: 'MYR', name: 'Malaysian Ringgit' },
  { code: 'RON', name: 'Romanian Leu' },
];

export const ProfileCompletionScreen: React.FC = () => {
  const navigation = useNavigation();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<ProfileData>({
    firstName: '',
    lastName: '',
    country: 'US',
    baseCurrency: 'USD'
  });

  // Auto-update currency when country changes
  useEffect(() => {
    const suggestedCurrency = COUNTRY_CURRENCY_MAP[formData.country] || 'USD';
    setFormData(prev => ({ ...prev, baseCurrency: suggestedCurrency }));
  }, [formData.country]);

  const handleSubmit = async () => {
    // Validate form
    if (!formData.firstName.trim() || !formData.lastName.trim()) {
      Alert.alert('Error', 'Please enter your first and last name');
      return;
    }

    setLoading(true);
    try {
      const response = await api.post('/profile', {
        first_name: formData.firstName.trim(),
        last_name: formData.lastName.trim(),
        country: formData.country,
        base_currency: formData.baseCurrency
      });

      if (response.data) {
        Alert.alert('Success', 'Profile created successfully', [
          {
            text: 'OK',
            onPress: () => navigation.navigate('Dashboard' as never)
          }
        ]);
      }
    } catch (error: any) {
      Alert.alert(
        'Error',
        error.response?.data?.detail || 'Failed to create profile'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Complete Your Profile</Text>
          <Text style={styles.subtitle}>
            Help us personalize your portfolio experience
          </Text>
        </View>

        <View style={styles.form}>
          <View style={styles.inputContainer}>
            <Text style={styles.label}>First Name</Text>
            <TextInput
              style={styles.input}
              value={formData.firstName}
              onChangeText={(text) => setFormData(prev => ({ ...prev, firstName: text }))}
              placeholder="Enter your first name"
              placeholderTextColor={colors.textSecondary}
              editable={!loading}
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Last Name</Text>
            <TextInput
              style={styles.input}
              value={formData.lastName}
              onChangeText={(text) => setFormData(prev => ({ ...prev, lastName: text }))}
              placeholder="Enter your last name"
              placeholderTextColor={colors.textSecondary}
              editable={!loading}
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Country</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={formData.country}
                onValueChange={(value) => setFormData(prev => ({ ...prev, country: value }))}
                style={styles.picker}
                enabled={!loading}
              >
                {COUNTRIES.map(country => (
                  <Picker.Item 
                    key={country.code} 
                    label={country.name} 
                    value={country.code} 
                  />
                ))}
              </Picker>
            </View>
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Base Currency</Text>
            <Text style={styles.helperText}>
              This will be your default currency for portfolio values
            </Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={formData.baseCurrency}
                onValueChange={(value) => setFormData(prev => ({ ...prev, baseCurrency: value }))}
                style={styles.picker}
                enabled={!loading}
              >
                {CURRENCIES.map(currency => (
                  <Picker.Item 
                    key={currency.code} 
                    label={`${currency.code} - ${currency.name}`} 
                    value={currency.code} 
                  />
                ))}
              </Picker>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.submitButton, loading && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={colors.background} />
            ) : (
              <Text style={styles.submitButtonText}>Complete Profile</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.skipButton}
            onPress={() => navigation.navigate('Dashboard' as never)}
            disabled={loading}
          >
            <Text style={styles.skipButtonText}>Skip for now</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 20,
  },
  header: {
    marginTop: 40,
    marginBottom: 30,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  form: {
    flex: 1,
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
  helperText: {
    fontSize: 14,
    color: colors.textSecondary,
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
  pickerContainer: {
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  picker: {
    color: colors.text,
    height: 50,
  },
  submitButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 30,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    color: colors.background,
    fontSize: 18,
    fontWeight: '600',
  },
  skipButton: {
    alignItems: 'center',
    marginTop: 20,
    padding: 10,
  },
  skipButtonText: {
    color: colors.textSecondary,
    fontSize: 16,
  },
});