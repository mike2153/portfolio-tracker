'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

// Debug helper function (disabled for production)
const debugLog = (context: string, data: any) => {
  // Debug logging disabled for cleaner production code
}

export default function AuthPage() {
  const [isSignUp, setIsSignUp] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  debugLog('page:render', { isSignUp, email: email ? '***filled***' : 'empty', loading })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    debugLog('form:submit:start', { 
      isSignUp, 
      email, 
      passwordLength: password.length,
      fullName: isSignUp ? fullName : 'N/A'
    })
    
    setLoading(true)
    setMessage('')

    try {
      if (isSignUp) {
        debugLog('signup:validation:start', { fullName: fullName.trim(), passwordLength: password.length })
        
        // Validate signup requirements
        if (!fullName.trim()) {
          debugLog('signup:validation:error', { error: 'Full name is required' })
          setMessage('Full name is required')
          return
        }
        
        if (password.length < 8) {
          debugLog('signup:validation:error', { error: 'Password too short', length: password.length })
          setMessage('Password must be at least 8 characters long')
          return
        }

        debugLog('signup:api:calling', { email: email.trim() })
        
        // Sign up new user
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: {
              full_name: fullName.trim(),
            }
          }
        })

        debugLog('signup:api:response', { 
          success: !error, 
          error: error?.message,
          userCreated: !!data?.user,
          emailConfirmed: data?.user?.email_confirmed_at
        })

        if (error) {
          setMessage(`Registration failed: ${error.message}`)
          return
        }

        if (data.user && !data.user.email_confirmed_at) {
          setMessage('Please check your email and click the verification link to complete registration.')
        } else {
          setMessage('Registration successful! You can now sign in.')
          setIsSignUp(false)
        }
      } else {
        debugLog('signin:api:calling', { email: email.trim() })
        
        // Sign in existing user
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        })

        debugLog('signin:api:response', { 
          success: !error, 
          error: error?.message,
          errorCode: error?.code,
          errorStatus: error?.status,
          user: data?.user ? { id: data.user.id, email: data.user.email, confirmed: data.user.email_confirmed_at } : null,
          session: data?.session ? { expires_at: data.session.expires_at } : null
        })

        if (error) {
          debugLog('signin:error:handling', { errorMessage: error.message })
          
          if (error.message.includes('email not confirmed')) {
            setMessage('Please check your email and click the verification link before signing in.')
          } else if (error.message.includes('Invalid login credentials')) {
            setMessage('Invalid email or password. Please try again.')
          } else {
            setMessage(`Sign in failed: ${error.message}`)
          }
          return
        }

        if (data.user) {
          debugLog('signin:success', { userId: data.user.id, email: data.user.email })
          setMessage('Sign in successful! Redirecting...')
          
          debugLog('signin:redirect:scheduled', { target: '/dashboard', delay: 1500 })
          setTimeout(() => {
            debugLog('signin:redirect:executing', { target: '/dashboard' })
            window.location.href = '/dashboard'
          }, 1500)
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      debugLog('auth:error:catch', { error: errorMessage, stack: error instanceof Error ? error.stack : 'N/A' })
      setMessage(`Authentication error: ${errorMessage}`)
    } finally {
      debugLog('form:submit:complete', { loading: false })
      setLoading(false)
    }
  }

  const resetForm = () => {
    debugLog('form:reset', { previousEmail: email })
    setEmail('')
    setPassword('')
    setFullName('')
    setMessage('')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 py-12 px-4 sm:px-6 lg:px-8 text-gray-100">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            {isSignUp ? 'Create your account' : 'Sign in to your account'}
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Professional portfolio analytics platform
          </p>
        </div>
        
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4">
            {isSignUp && (
              <div>
                <label htmlFor="fullName" className="block text-sm font-medium text-gray-700">
                  Full Name *
                </label>
                <input
                  id="fullName"
                  name="fullName"
                  type="text"
                  required={isSignUp}
                  value={fullName}
                  onChange={(e) => {
                    debugLog('input:fullName:change', { value: e.target.value })
                    setFullName(e.target.value)
                  }}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-black focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter your full name"
                />
              </div>
            )}
            
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email Address *
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => {
                  debugLog('input:email:change', { value: e.target.value })
                  setEmail(e.target.value)
                }}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-black focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter your email"
              />
            </div>
            
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Password *
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete={isSignUp ? "new-password" : "current-password"}
                required
                value={password}
                onChange={(e) => {
                  debugLog('input:password:change', { length: e.target.value.length })
                  setPassword(e.target.value)
                }}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-black focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder={isSignUp ? "Create a password (8+ characters)" : "Enter your password"}
                minLength={isSignUp ? 8 : undefined}
              />
              {isSignUp && (
                <p className="mt-1 text-xs text-gray-500">
                  Password must be at least 8 characters long
                </p>
              )}
            </div>
          </div>

          {message && (
            <div className={`p-3 rounded-md text-sm ${
              message.includes('successful') || message.includes('check your email') 
                ? 'bg-green-100 text-green-700' 
                : 'bg-red-100 text-red-700'
            }`}>
              {message}
            </div>
          )}

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <div className="flex items-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  {isSignUp ? 'Creating Account...' : 'Signing In...'}
                </div>
              ) : (
                isSignUp ? 'Create Account' : 'Sign In'
              )}
            </button>
          </div>

          <div className="text-center">
            <button
              type="button"
              onClick={() => {
                debugLog('toggle:signup:click', { from: isSignUp ? 'signup' : 'signin', to: !isSignUp ? 'signup' : 'signin' })
                setIsSignUp(!isSignUp)
                resetForm()
              }}
              className="text-blue-600 hover:text-blue-700 text-sm font-medium"
            >
              {isSignUp 
                ? 'Already have an account? Sign in' 
                : "Don't have an account? Create one"
              }
            </button>
          </div>
        </form>

        {/* Production Notice */}
        <div className="mt-6 p-4 bg-blue-900/20 rounded-md">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-blue-300">
                Professional Platform
              </h3>
              <div className="mt-2 text-sm text-blue-200">
                <p>
                  This is a production-grade financial analytics platform. All data is real-time and all user information is securely stored with enterprise-level security.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
} 