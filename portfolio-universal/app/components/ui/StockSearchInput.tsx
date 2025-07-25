import React, { useRef, useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  Modal,
  Dimensions,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { useStockSearch, StockSymbol } from '../../hooks/useStockSearch';
import CompanyIcon from './CompanyIcon';
import { useTheme } from '../../contexts/ThemeContext';

const { height: screenHeight } = Dimensions.get('window');

interface StockSearchInputProps {
  onSelectSymbol: (symbol: StockSymbol) => void;
  placeholder?: string;
  autoFocus?: boolean;
  value?: string;
  onChange?: (value: string) => void;
  required?: boolean;
  error?: string;
  style?: any;
}

export default function StockSearchInput({
  onSelectSymbol,
  placeholder = "Search by ticker or company name...",
  autoFocus = false,
  value,
  onChange,
  required = false,
  error,
  style,
}: StockSearchInputProps) {
  const {
    searchQuery,
    suggestions,
    setSuggestions,
    isLoading,
    showSuggestions,
    setShowSuggestions,
    handleSearch,
    clearSuggestions,
  } = useStockSearch();

  const { theme } = useTheme();
  const styles = getStyles(theme);
  const inputRef = useRef<TextInput>(null);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  // Handle input change
  const handleInputChange = (newValue: string) => {
    const upperValue = newValue.toUpperCase();
    
    // In controlled mode, notify parent
    if (onChange) {
      onChange(upperValue);
    }
    
    // Always perform search
    handleSearch(upperValue);
  };

  // Handle suggestion selection
  const handleSuggestionClick = (symbol: StockSymbol) => {
    onSelectSymbol(symbol);
    
    if (value === undefined) {
      // Uncontrolled mode - clear everything
      clearSuggestions();
    } else {
      // Controlled mode - just hide suggestions
      setShowSuggestions(false);
      setSuggestions([]);
    }
    
    if (onChange) {
      onChange(symbol.symbol);
    }
  };

  // When in controlled mode and value changes externally, update search
  useEffect(() => {
    if (value !== undefined && value !== searchQuery) {
      handleSearch(value);
    }
  }, [value]);

  return (
    <View style={[styles.container, style]}>
      <TextInput
        ref={inputRef}
        style={[styles.input, error && styles.inputError]}
        value={value !== undefined ? value : searchQuery}
        onChangeText={handleInputChange}
        onFocus={() => setShowSuggestions(true)}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.secondaryText}
        autoCapitalize="characters"
        autoCorrect={false}
        autoFocus={autoFocus}
      />
      
      {error && (
        <Text style={styles.errorText}>{error}</Text>
      )}

      {/* Suggestions Modal/Dropdown */}
      {showSuggestions && (searchQuery.length > 0 || suggestions.length > 0) && (
        <Modal
          visible={true}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowSuggestions(false)}
        >
          <TouchableOpacity 
            style={styles.modalOverlay} 
            activeOpacity={1}
            onPress={() => setShowSuggestions(false)}
          >
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              style={styles.modalContent}
            >
              <TouchableOpacity activeOpacity={1}>
                <View style={styles.suggestionsContainer}>
                  {isLoading ? (
                    <View style={styles.loadingContainer}>
                      <ActivityIndicator size="small" color={theme.colors.buttonBackground} />
                      <Text style={styles.loadingText}>Searching...</Text>
                    </View>
                  ) : suggestions.length > 0 ? (
                    <ScrollView 
                      style={styles.suggestionsList}
                      keyboardShouldPersistTaps="handled"
                      showsVerticalScrollIndicator={false}
                    >
                      {suggestions.map((symbol, index) => (
                        <TouchableOpacity
                          key={`${symbol.symbol}-${index}`}
                          style={[
                            styles.suggestionItem,
                            highlightedIndex === index && styles.suggestionItemHighlighted
                          ]}
                          onPress={() => handleSuggestionClick(symbol)}
                          onPressIn={() => setHighlightedIndex(index)}
                          onPressOut={() => setHighlightedIndex(-1)}
                        >
                          <CompanyIcon 
                            symbol={symbol.symbol} 
                            size={32}
                            style={styles.companyIcon}
                          />
                          <View style={styles.suggestionTextContainer}>
                            <View style={styles.suggestionHeader}>
                              <Text style={styles.suggestionSymbol}>
                                {symbol.symbol}
                              </Text>
                              {symbol.region && symbol.region !== 'United States' && (
                                <Text style={styles.suggestionRegion}>
                                  {symbol.region}
                                </Text>
                              )}
                            </View>
                            <Text 
                              style={styles.suggestionName}
                              numberOfLines={1}
                              ellipsizeMode="tail"
                            >
                              {symbol.name}
                            </Text>
                          </View>
                          {symbol.currency && symbol.currency !== 'USD' && (
                            <View style={styles.currencyBadge}>
                              <Text style={styles.currencyText}>{symbol.currency}</Text>
                            </View>
                          )}
                        </TouchableOpacity>
                      ))}
                      <View style={styles.resultsFooter}>
                        <Text style={styles.resultsFooterText}>
                          Showing top {suggestions.length} results
                        </Text>
                      </View>
                    </ScrollView>
                  ) : searchQuery.length > 0 ? (
                    <View style={styles.noResultsContainer}>
                      <Text style={styles.noResultsText}>
                        No results found for "{searchQuery}"
                      </Text>
                    </View>
                  ) : null}
                </View>
              </TouchableOpacity>
            </KeyboardAvoidingView>
          </TouchableOpacity>
        </Modal>
      )}
    </View>
  );
}

const getStyles = (theme: any) => StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  input: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: theme.colors.primaryText,
  },
  inputError: {
    borderColor: theme.colors.negative,
  },
  errorText: {
    color: theme.colors.negative,
    fontSize: 12,
    marginTop: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  suggestionsContainer: {
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    maxHeight: screenHeight * 0.5,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  loadingContainer: {
    padding: 24,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 8,
    color: theme.colors.secondaryText,
    fontSize: 14,
  },
  suggestionsList: {
    paddingVertical: 8,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  suggestionItemHighlighted: {
    backgroundColor: theme.colors.border,
  },
  companyIcon: {
    marginRight: 12,
  },
  suggestionTextContainer: {
    flex: 1,
  },
  suggestionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  suggestionSymbol: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.primaryText,
  },
  suggestionRegion: {
    fontSize: 12,
    color: theme.colors.secondaryText,
    marginLeft: 8,
  },
  suggestionName: {
    fontSize: 14,
    color: theme.colors.secondaryText,
    marginTop: 2,
  },
  currencyBadge: {
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 8,
  },
  currencyText: {
    fontSize: 12,
    color: theme.colors.secondaryText,
  },
  resultsFooter: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginTop: 8,
  },
  resultsFooterText: {
    fontSize: 12,
    color: theme.colors.secondaryText,
    textAlign: 'center',
  },
  noResultsContainer: {
    padding: 32,
    alignItems: 'center',
  },
  noResultsText: {
    color: theme.colors.secondaryText,
    fontSize: 16,
  },
});