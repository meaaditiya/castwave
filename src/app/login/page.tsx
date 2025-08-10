
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
import { Waves, Loader2, LogIn as LogInIcon } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from '@/components/ui/dialog';

const emailLoginFormSchema = z.object({
  email: z.string().email({ message: 'Invalid email address.' }),
  password: z.string().min(6, { message: 'Password must be at least 6 characters.' }),
});

const passwordResetFormSchema = z.object({
    email: z.string().email({ message: 'Please enter a valid email address.'}),
});


export default function LoginPage() {
  const { loginWithEmail, currentUser, loading, sendPasswordReset } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);
  
  useEffect(() => {
    if (!loading && currentUser) {
        const timer = setTimeout(() => {
            router.push('/');
        }, 100);
        
        return () => clearTimeout(timer);
    }
  }, [currentUser, loading, router]);


  const emailLoginForm = useForm<z.infer<typeof emailLoginFormSchema>>({
    resolver: zodResolver(emailLoginFormSchema),
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

  async function onEmailLoginSubmit(values: z.infer<typeof emailLoginFormSchema>) {
    setIsSubmitting(true);
    try {
      await loginWithEmail(values.email, values.password);
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
          <Form {...emailLoginForm}>
            <form onSubmit={emailLoginForm.handleSubmit(onEmailLoginSubmit)} className="space-y-4 pt-4">
              <FormField
                control={emailLoginForm.control}
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
                control={emailLoginForm.control}
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
                Log In with Email
              </Button>
            </form>
          </Form>
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
