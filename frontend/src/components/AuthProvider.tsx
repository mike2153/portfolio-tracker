'use client'
import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import type { User } from '@supabase/supabase-js'
import { usePathname, useRouter } from 'next/navigation'

interface AuthContextValue {
  user: User | null
  session: any | null  // Full session with access_token
  signOut: () => Promise<void>
  isLoading: boolean
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return ctx
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<any | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()
  const pathname = usePathname()

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
      
      // Clear state
      setUser(null)
      setSession(null)
      
      // Redirect to auth page
      router.push('/auth')
    } catch (error) {
      console.error('Error signing out:', error)
    }
  }

  useEffect(() => {
    const init = async () => {
      try {
        // Get initial session
        const { data: { session } } = await supabase.auth.getSession()
        
        if (session?.user) {
          setUser(session.user)
          setSession(session)
        } else if (pathname !== '/auth' && pathname !== '/') {
          // Only redirect if we're done loading and there's no session
          // Skip redirect for home page and auth page
          router.replace('/auth')
        }
      } catch (error) {
        console.error('Error getting session:', error)
      } finally {
        // Always set loading to false after initial check
        setIsLoading(false)
      }
    }

    init()
    
    // Set up auth state change listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log(`[AuthProvider] Auth state changed: ${event}`, { 
        hasSession: !!session, 
        hasUser: !!session?.user,
        userId: session?.user?.id,
        pathname 
      })
      
      if (session?.user) {
        setUser(session.user)
        setSession(session)
        setIsLoading(false)
      } else {
        setUser(null)
        setSession(null)
        // Only redirect if not already on auth page or home page
        if (pathname !== '/auth' && pathname !== '/') {
          router.replace('/auth')
        }
        setIsLoading(false)
      }
    })
    
    return () => {
      subscription.unsubscribe()
    }
  }, [router, pathname])

  return (
    <AuthContext.Provider value={{ user, session, signOut, isLoading }}>
      {children}
    </AuthContext.Provider>
  )
}
