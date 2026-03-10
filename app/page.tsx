'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { FieldGroup, Field, FieldLabel } from '@/components/ui/field'
import { Spinner } from '@/components/ui/spinner'
import { Building2, Mail, Lock, Chrome } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const { login, loginWithGoogle, isLoading, isAuthenticated } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  // Redirect if already authenticated - must be in useEffect to avoid setState during render
  useEffect(() => {
    if (isAuthenticated) {
      router.push('/dashboard')
    }
  }, [isAuthenticated, router])

  // Show nothing while redirecting
  if (isAuthenticated) {
    return null
  }

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    
    if (!email || !password) {
      setError('Please fill in all fields')
      return
    }
    
    const success = await login(email, password)
    if (success) {
      router.push('/dashboard')
    } else {
      setError('Invalid credentials')
    }
  }

  const handleGoogleLogin = async () => {
    setError('')
    const success = await loginWithGoogle()
    if (success) {
      router.push('/dashboard')
    } else {
      setError('Google login failed')
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center gap-4 mb-8">
          <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-primary text-primary-foreground">
            <Building2 className="w-8 h-8" />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold text-foreground">Employee Portal</h1>
            <p className="text-muted-foreground mt-1">Human Resource Management System</p>
          </div>
        </div>

        <Card className="border-border/50 shadow-lg">
          <CardHeader className="text-center pb-4">
            <CardTitle className="text-lg">Sign In</CardTitle>
            <CardDescription>Access your employee dashboard</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="email" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="email">Email</TabsTrigger>
                <TabsTrigger value="google">Google SSO</TabsTrigger>
              </TabsList>
              
              <TabsContent value="email">
                <form onSubmit={handleEmailLogin} className="space-y-4">
                  <FieldGroup>
                    <Field>
                      <FieldLabel>Email</FieldLabel>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          type="email"
                          placeholder="you@company.com"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="pl-10"
                        />
                      </div>
                    </Field>
                    <Field>
                      <FieldLabel>Password</FieldLabel>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          type="password"
                          placeholder="Enter your password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="pl-10"
                        />
                      </div>
                    </Field>
                  </FieldGroup>
                  
                  {error && (
                    <p className="text-sm text-destructive text-center">{error}</p>
                  )}
                  
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? <Spinner className="mr-2" /> : null}
                    Sign In
                  </Button>
                </form>
              </TabsContent>
              
              <TabsContent value="google">
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground text-center">
                    Sign in with your company Google account for quick access
                  </p>
                  <Button 
                    variant="outline" 
                    className="w-full gap-2"
                    onClick={handleGoogleLogin}
                    disabled={isLoading}
                  >
                    {isLoading ? <Spinner className="mr-2" /> : <Chrome className="w-4 h-4" />}
                    Continue with Google
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
            
            <p className="text-xs text-muted-foreground text-center mt-6">
              Demo Mode: Enter any email/password to sign in
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
