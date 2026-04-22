'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { FieldGroup, Field, FieldLabel } from '@/components/ui/field'
import { Spinner } from '@/components/ui/spinner'
import { Eye, EyeOff } from 'lucide-react'

type AuthStep = 'idle' | 'setup-password' | 'link-google'

export default function LoginForm() {
  const router = useRouter()
  const { login, loginWithGoogle, setupPasswordForCurrentUser, isLoading, isAuthenticated } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [authStep, setAuthStep] = useState<AuthStep>('idle')

  useEffect(() => {
    if (isAuthenticated && authStep === 'idle') {
      router.push('/dashboard')
    }
  }, [authStep, isAuthenticated, router])

  if (isAuthenticated && authStep === 'idle') {
    return null
  }

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setAuthStep('idle')

    if (!email || !password) {
      setError('Please fill in all fields')
      return
    }

    const success = await login(email, password)
    if (success) {
      router.push('/dashboard')
    } else {
      setError('Invalid email or password')
    }
  }

  const handleGoogleLogin = async (e?: React.FormEvent) => {
    e?.preventDefault()
    setError('')

    if (authStep === 'link-google' && !password) {
      setError('Please enter your password to link Google sign-in')
      return
    }

    const result = await loginWithGoogle(authStep === 'link-google' ? password : undefined)

    if (result.success) {
      setAuthStep('idle')
      router.push('/dashboard')
      return
    }

    if (result.requiresPasswordSetup) {
      setAuthStep('setup-password')
      setEmail(result.email ?? '')
      setPassword('')
      setShowPassword(false)
      setError(result.error ?? 'Set a password to enable email sign-in for this account.')
      return
    }

    if (result.requiresPasswordLink) {
      setAuthStep('link-google')
      setEmail(result.email ?? email)
      setPassword('')
      setShowPassword(false)
      setError(result.error ?? 'Enter your password to link Google sign-in with this account.')
      return
    }

    setError(result.error ?? 'Google sign-in failed. Please try again.')
  }

  const handlePasswordSetup = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!password) {
      setError('Please enter a password')
      return
    }

    const result = await setupPasswordForCurrentUser(password)
    if (result.success) {
      setAuthStep('idle')
      router.push('/dashboard')
      return
    }

    setError(result.error ?? 'Unable to set password for this account.')
  }

  const resetAuthStep = () => {
    setAuthStep('idle')
    setError('')
    setPassword('')
    setShowPassword(false)
  }

  const isSetupPasswordStep = authStep === 'setup-password'
  const isLinkGoogleStep = authStep === 'link-google'

  return (
    <main className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center gap-4 mb-8">
          <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-primary text-primary-foreground overflow-hidden">
            <img src="/SSMI.svg" alt="SSMI Logo" className="w-full h-full object-contain" />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold text-foreground">ພະນັກງານ SSMILaos</h1>
            <p className="text-muted-foreground mt-1">ລະບົບການຄຸ້ມຄອງພະນັກງານ</p>
          </div>
        </div>

        <Card className="border-border/50 shadow-lg">
          <CardContent className="pt-6">
            {(isSetupPasswordStep || isLinkGoogleStep) && (
              <div className="mb-4 rounded-lg border border-border/60 bg-muted/40 p-3 text-sm text-muted-foreground">
                {isSetupPasswordStep
                  ? 'ເຂົ້າສູ່ລະບົບແລ້ວ. ກະລຸນາປ້ອນລະຫັດຜ່ານໃໝ່ ເພື່ອເຊື່ອມຕໍ່ Google ແລະ email/password ໃນບັນຊີດຽວກັນ.'
                  : 'ອີເມວນີ້ມີບັນຊີລະຫັດຜ່ານຢູ່ແລ້ວ. ກະລຸນາປ້ອນລະຫັດຜ່ານນັ້ນເພື່ອເຊື່ອມຕໍ່ Google sign-in ກັບບັນຊີດຽວກັນ.'}
              </div>
            )}

            <form
              onSubmit={isSetupPasswordStep ? handlePasswordSetup : isLinkGoogleStep ? handleGoogleLogin : handleEmailLogin}
              className="space-y-4"
            >
              <FieldGroup>
                <Field>
                  <FieldLabel>ອີເມວ</FieldLabel>
                  <Input
                    type="email"
                    placeholder="ປ້ອນອີເມວຂອງທ່ານ"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={isSetupPasswordStep || isLinkGoogleStep}
                  />
                </Field>
                <Field>
                  <div className="flex items-center justify-between">
                    <FieldLabel>{isSetupPasswordStep ? 'ສ້າງລະຫັດຜ່ານ' : 'ລະຫັດຜ່ານ'}</FieldLabel>
                    {!isSetupPasswordStep && !isLinkGoogleStep && (
                      <button
                        type="button"
                        className="text-sm text-primary hover:underline min-h-[48px] min-w-[48px] flex items-center justify-end"
                        onClick={() => {}}
                      >
                        ລືມລະຫັດຜ່ານ?
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="ປ້ອນລະຫັດຜ່ານ"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center justify-center w-10 h-10 text-muted-foreground hover:text-foreground transition-colors"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </Field>
              </FieldGroup>

              {error && (
                <p className="text-sm text-destructive text-center">
                  ຕັ້ງລະຫັດຜ່ານເພື່ອເປີດໃຊ້ Google sign-in + email/password
                </p>
              )}

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? <Spinner className="mr-2" /> : null}
                {isSetupPasswordStep ? 'ປ່ຽນລະຫັດຜ່ານ' : isLinkGoogleStep ? 'Link Google Account' : 'Sign In'}
              </Button>

              {(isSetupPasswordStep || isLinkGoogleStep) && (
                <button
                  type="button"
                  onClick={resetAuthStep}
                  className="w-full text-sm text-muted-foreground hover:text-foreground min-h-[48px]"
                >
                  Back to sign in
                </button>
              )}
            </form>

            {!isSetupPasswordStep && !isLinkGoogleStep && (
              <>
                <div className="relative my-6">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-border" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-2 text-muted-foreground">OR</span>
                  </div>
                </div>

                <Button
                  variant="outline"
                  className="w-full gap-2"
                  onClick={() => handleGoogleLogin()}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <Spinner className="mr-2" />
                  ) : (
                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      />
                    </svg>
                  )}
                  Continue with Google
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  )
}