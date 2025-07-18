'use client'
import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import type { User } from '@supabase/supabase-js'
import { usePathname, useRouter } from 'next/navigation'

interface AuthContextValue {
  user: User | null
  session: any | null  // Full session with access_token
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
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        setUser(session.user)
        setSession(session)
      } else if (pathname !== '/auth') {
        router.replace('/auth')
      }
    }

    init()
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser(session.user)
        setSession(session)
      } else {
        setUser(null)
        setSession(null)
        if (pathname !== '/auth') {
          router.replace('/auth')
        }
      }
    })
    return () => {
      subscription.unsubscribe()
    }
  }, [router, pathname])

  return (
    <AuthContext.Provider value={{ user, session }}>
      {children}
    </AuthContext.Provider>
  )
}
