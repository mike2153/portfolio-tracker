import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../api/supabase';
import type { User, Session } from '@supabase/supabase-js';
import { useNavigation } from '@react-navigation/native';
import type { NavigationProp } from '@react-navigation/native';

interface AuthContextValue {
  user: User | null
  session: Session | null  // Full session with access_token
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return ctx
}

// Define navigation types - adjust based on your navigation structure
type RootStackParamList = {
  Auth: undefined
  Dashboard: undefined
  // Add other screens as needed
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const navigation = useNavigation<NavigationProp<RootStackParamList>>()

  useEffect(() => {
    const init = async () => {
      // Get initial session
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        setUser(session.user)
        setSession(session)
      } else {
        // Navigate to auth screen if not authenticated
        navigation.navigate('Auth')
      }
    }

    init()

    // Set up auth state change listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser(session.user)
        setSession(session)
        // Navigate to dashboard on successful auth
        if (_event === 'SIGNED_IN') {
          navigation.navigate('Dashboard')
        }
      } else {
        setUser(null)
        setSession(null)
        // Navigate to auth screen on sign out
        navigation.navigate('Auth')
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [navigation])

  return (
    <AuthContext.Provider value={{ user, session }}>
      {children}
    </AuthContext.Provider>
  )
}