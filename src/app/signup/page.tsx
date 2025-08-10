
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
import { Waves, Loader2, UserPlus } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';

const formSchema = z.object({
  email: z.string().email({ message: 'Invalid email address.' }),
  password: z.string().min(6, { message: 'Password must be at least 6 characters.' }),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

const GoogleIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" {...props}>
        <title>Google</title>
        <path d="M12.48 10.92v3.28h7.84c-.24 1.84-.85 3.18-1.73 4.1-1.02 1.02-2.62 1.98-4.66 1.98-3.56 0-6.47-2.91-6.47-6.47s2.91-6.47 6.47-6.47c1.98 0 3.06.82 4.06 1.76l2.58-2.58C17.7 2.2 15.48 1 12.48 1 7.01 1 3 5.02 3 10.5s4.01 9.5 9.48 9.5c2.73 0 4.93-.91 6.57-2.55 1.73-1.73 2.3-4.25 2.3-6.47 0-.91-.08-1.48-.18-2.08H12.48z" />
    </svg>
);


export default function SignupPage() {
  const { signup, loginWithGoogle, currentUser, loading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [isSigningUp, setIsSigningUp] = useState(false);
  const [signupSuccess, setSignupSuccess] = useState(false);

  useEffect(() => {
    if (!loading && currentUser) {
      router.push('/');
    }
  }, [currentUser, loading, router]);


  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: '',
      password: '',
      confirmPassword: '',
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsSigningUp(true);
    try {
      await signup(values.email, values.password);
      setSignupSuccess(true);
    } catch (error: any) {
        let errorMessage = "An unexpected error occurred.";
        if (error.code === 'auth/email-already-in-use') {
            errorMessage = "This email is already registered. Please log in or use a different email.";
        } else if (error.message) {
            errorMessage = error.message;
        }
      toast({
        variant: 'destructive',
        title: 'Sign Up Failed',
        description: errorMessage,
      });
    } finally {
      setIsSigningUp(false);
    }
  }

  const handleGoogleSignup = async () => {
    setIsSigningUp(true);
    try {
        await loginWithGoogle();
        // The useEffect hook will handle redirection once currentUser is set.
    } catch (error: any) {
        if (error.code !== 'auth/popup-closed-by-user') {
            toast({
                variant: 'destructive',
                title: 'Sign Up Failed',
                description: error.message,
            });
        }
    } finally {
        setIsSigningUp(false);
    }
  }


  if (loading || currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (signupSuccess) {
    return (
       <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
          <Link href="/" className="flex items-center space-x-2 mb-8">
            <Waves className="h-8 w-8 text-primary" />
            <span className="font-bold text-2xl font-headline">CastWave</span>
          </Link>
          <Card className="w-full max-w-sm">
            <CardHeader>
                <CardTitle>Check Your Email</CardTitle>
                <CardDescription>We've sent a verification link to your email address.</CardDescription>
            </CardHeader>
            <CardContent>
                <Alert>
                    <AlertTitle>Verification Required</AlertTitle>
                    <AlertDescription>
                        Please click the link in the email to verify your account. You can log in, and the app will automatically update once you're verified.
                    </AlertDescription>
                </Alert>
                <Button asChild className="w-full mt-4">
                  <Link href="/login">Go to Login</Link>
                </Button>
            </CardContent>
          </Card>
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
          <CardTitle>Create Account</CardTitle>
          <CardDescription>Sign up to start listening and interacting.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
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
                control={form.control}
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
              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirm Password</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="••••••••" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" disabled={isSigningUp}>
                 {isSigningUp ? <Loader2 className="animate-spin" /> : <UserPlus />}
                Sign Up with Email
              </Button>
            </form>
          </Form>

           <div className="relative my-4">
                <Separator />
                <div className="absolute top-1/2 -translate-y-1/2 left-1/2 -translate-x-1/2 bg-background px-2">
                    <span className="text-muted-foreground text-sm">OR</span>
                </div>
            </div>

            <Button variant="outline" className="w-full" onClick={handleGoogleSignup} disabled={isSigningUp}>
                {isSigningUp ? <Loader2 className="animate-spin" /> : <GoogleIcon className="h-4 w-4" />}
                Continue with Google
            </Button>

          <div className="mt-4 text-center text-sm">
            Already have an account?{' '}
            <Link href="/login" className="underline text-primary">
              Log in
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
