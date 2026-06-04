'use client'

import { useState } from 'react'

import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import type { Provider } from '@supabase/supabase-js'

export function LoginForm({ className, ...props }: React.ComponentPropsWithoutRef<'div'>) {
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState<Provider | null>(null)

  const handleSocialLogin = async (provider: Provider) => {
    const supabase = createClient()
    setIsLoading(provider)
    setError(null)

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/auth/oauth?next=/`,
        },
      })

      if (error) throw error
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : 'An error occurred')
      setIsLoading(null)
    }
  }

  return (
    <div className={cn('flex flex-col gap-6', className)} {...props}>
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Welcome!</CardTitle>
          <CardDescription>Sign in to your account to continue</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-3">
            {error && <p className="text-sm text-destructive-500">{error}</p>}
            <Button
              className="w-full"
              disabled={isLoading !== null}
              onClick={() => handleSocialLogin('google')}
            >
              {isLoading === 'google' ? 'Logging in...' : 'Continue with Google'}
            </Button>
            <Button
              variant="outline"
              className="w-full"
              disabled={isLoading !== null}
              onClick={() => handleSocialLogin('github')}
            >
              {isLoading === 'github' ? 'Logging in...' : 'Continue with GitHub'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}