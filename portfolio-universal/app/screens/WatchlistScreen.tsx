import React from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity
} from 'react-native';
import { MainTabScreenProps } from '../navigation/types';
import { COLORS } from '@portfolio-tracker/shared';

type Props = MainTabScreenProps<'Watchlist'>;

export default function WatchlistScreen({ navigation }: Props): React.JSX.Element {
  // TODO: Implement watchlist functionality when API is available
  
  return (
    <View style={styles.container}>
      <View style={styles.comingSoonContainer}>
        <Text style={styles.comingSoonIcon}>👀</Text>
        <Text style={styles.comingSoonTitle}>Watchlist Coming Soon</Text>
        <Text style={styles.comingSoonSubtitle}>
          Track your favorite stocks and set price alerts.
          This feature will be available once the watchlist API is implemented.
        </Text>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.navigate('Dashboard')}
        >
          <Text style={styles.backButtonText}>Back to Dashboard</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1f2937',
  },
  comingSoonContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  comingSoonIcon: {
    fontSize: 64,
    marginBottom: 24,
  },
  comingSoonTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 16,
  },
  comingSoonSubtitle: {
    fontSize: 16,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
  },
  backButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  backButtonText: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '600',
  },
});