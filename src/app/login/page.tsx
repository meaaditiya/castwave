
"use client";

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Waves, Loader2, LogIn as LogInIcon, Mail } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';

const loginFormSchema = z.object({
  email: z.string().email({ message: 'Invalid email address.' }),
  password: z.string().min(6, { message: 'Password must be at least 6 characters.' }),
});

const passwordResetFormSchema = z.object({
    email: z.string().email({ message: 'Please enter a valid email address.'}),
});

const GoogleIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" {...props}>
        <title>Google</title>
        <path d="M12.48 10.92v3.28h7.84c-.24 1.84-.85 3.18-1.73 4.1-1.02 1.02-2.62 1.98-4.66 1.98-3.56 0-6.47-2.91-6.47-6.47s2.91-6.47 6.47-6.47c1.98 0 3.06.82 4.06 1.76l2.58-2.58C17.7 2.2 15.48 1 12.48 1 7.01 1 3 5.02 3 10.5s4.01 9.5 9.48 9.5c2.73 0 4.93-.91 6.57-2.55 1.73-1.73 2.3-4.25 2.3-6.47 0-.91-.08-1.48-.18-2.08H12.48z" />
    </svg>
);


export default function LoginPage() {
  const { login, loginWithGoogle, currentUser, loading, sendPasswordReset } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);

  useEffect(() => {
    if (!loading && currentUser) {
      router.push('/');
    }
  }, [currentUser, loading, router]);


  const loginForm = useForm<z.infer<typeof loginFormSchema>>({
    resolver: zodResolver(loginFormSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const passwordResetForm = useForm<z.infer<typeof passwordResetFormSchema>>({
      resolver: zodResolver(passwordResetFormSchema),
      defaultValues: {
          email: '',
      }
  })

  async function onLoginSubmit(values: z.infer<typeof loginFormSchema>) {
    setIsSubmitting(true);
    try {
      await login(values.email, values.password);
      // The useEffect will handle redirection
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Login Failed',
        description: error.message,
      });
    } finally {
        setIsSubmitting(false);
    }
  }

  const handleGoogleLogin = async () => {
    setIsSubmitting(true);
    try {
        await loginWithGoogle();
        // The useEffect hook will handle redirection once currentUser is set.
    } catch (error: any) {
        if (error.code !== 'auth/popup-closed-by-user') {
            toast({
                variant: 'destructive',
                title: 'Login Failed',
                description: 'Could not log in with Google. Please try again.',
            });
            console.error("Google Login Error in Component:", error);
        }
    } finally {
        setIsSubmitting(false);
    }
  }


  async function onPasswordResetSubmit(values: z.infer<typeof passwordResetFormSchema>) {
      setIsResetting(true);
      try {
          await sendPasswordReset(values.email);
          toast({
              title: 'Password Reset Email Sent',
              description: 'Please check your inbox for a link to reset your password.',
          });
          setIsResetDialogOpen(false);
      } catch (error: any) {
          toast({
              variant: 'destructive',
              title: 'Error',
              description: error.message,
          })
      } finally {
          setIsResetting(false);
      }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
        <Link href="/" className="flex items-center space-x-2 mb-8">
          <Waves className="h-8 w-8 text-primary" />
          <span className="font-bold text-2xl font-headline">CastWave</span>
        </Link>
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Log In</CardTitle>
          <CardDescription>Access your account to join live chat rooms.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...loginForm}>
            <form onSubmit={loginForm.handleSubmit(onLoginSubmit)} className="space-y-4">
              <FormField
                control={loginForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input placeholder="you@example.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={loginForm.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="••••••••" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="animate-spin" /> : <LogInIcon />}
                Log In
              </Button>
            </form>
          </Form>
            <div className="relative my-4">
                <Separator />
                <div className="absolute top-1/2 -translate-y-1/2 left-1/2 -translate-x-1/2 bg-background px-2">
                    <span className="text-muted-foreground text-sm">OR</span>
                </div>
            </div>

            <Button variant="outline" className="w-full" onClick={handleGoogleLogin} disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="animate-spin" /> : <GoogleIcon className="h-4 w-4" />}
                Continue with Google
            </Button>


           <div className="mt-4 text-center text-sm">
                <Dialog open={isResetDialogOpen} onOpenChange={setIsResetDialogOpen}>
                    <DialogTrigger asChild>
                        <Button variant="link" className="p-0 h-auto font-normal">
                            Forgot password?
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Reset Your Password</DialogTitle>
                            <DialogDescription>
                                Enter your email address and we'll send you a link to reset your password.
                            </DialogDescription>
                        </DialogHeader>
                        <Form {...passwordResetForm}>
                            <form onSubmit={passwordResetForm.handleSubmit(onPasswordResetSubmit)} className="space-y-4">
                                <FormField
                                    control={passwordResetForm.control}
                                    name="email"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Email</FormLabel>
                                            <FormControl>
                                                <Input type="email" placeholder="you@example.com" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <DialogFooter>
                                    <Button type="submit" disabled={isResetting}>
                                        {isResetting && <Loader2 className="animate-spin" />}
                                        Send Reset Link
                                    </Button>
                                </DialogFooter>
                            </form>
                        </Form>
                    </DialogContent>
                </Dialog>
           </div>
          <div className="mt-4 text-center text-sm">
            Don't have an account?{' '}
            <Link href="/signup" className="underline text-primary">
              Sign up
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
