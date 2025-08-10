
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
import { Waves, Loader2, UserPlus, Phone, MessageSquare } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { ConfirmationResult, RecaptchaVerifier } from 'firebase/auth';

const emailFormSchema = z.object({
  email: z.string().email({ message: 'Invalid email address.' }),
  password: z.string().min(6, { message: 'Password must be at least 6 characters.' }),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

const phoneFormSchema = z.object({
  phoneNumber: z.string().min(10, { message: 'Please enter a valid phone number with country code.' }),
});

const otpFormSchema = z.object({
    otp: z.string().length(6, { message: "OTP must be 6 digits."})
})


export default function SignupPage() {
  const { signup, currentUser, loading, setupRecaptcha, signInWithPhone, confirmOtp } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [signupSuccess, setSignupSuccess] = useState(false);
  const [showOtpForm, setShowOtpForm] = useState(false);
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);

  useEffect(() => {
    // Add a small delay to ensure profile is loaded
    if (!loading && currentUser) {
        const timer = setTimeout(() => {
            router.push('/');
        }, 100);
        
        return () => clearTimeout(timer);
    }
  }, [currentUser, loading, router]);


  const emailForm = useForm<z.infer<typeof emailFormSchema>>({
    resolver: zodResolver(emailFormSchema),
    defaultValues: {
      email: '',
      password: '',
      confirmPassword: '',
    },
  });

  const phoneForm = useForm<z.infer<typeof phoneFormSchema>>({
    resolver: zodResolver(phoneFormSchema),
    defaultValues: {
      phoneNumber: '',
    },
  });

  const otpForm = useForm<z.infer<typeof otpFormSchema>>({
    resolver: zodResolver(otpFormSchema),
    defaultValues: {
        otp: ''
    }
  })

  async function onEmailSubmit(values: z.infer<typeof emailFormSchema>) {
    setIsSubmitting(true);
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
      setIsSubmitting(false);
    }
  }

  async function onPhoneSubmit(values: z.infer<typeof phoneFormSchema>) {
    setIsSubmitting(true);
    try {
        const appVerifier = setupRecaptcha('recaptcha-container');
        const result = await signInWithPhone(values.phoneNumber, appVerifier);
        setConfirmationResult(result);
        setShowOtpForm(true);
        toast({ title: 'OTP Sent', description: 'Please check your phone for the verification code.'});
    } catch (error: any) {
        console.error(error);
        toast({ variant: 'destructive', title: 'Failed to send OTP', description: error.message});
    } finally {
        setIsSubmitting(false);
    }
  }

  async function onOtpSubmit(values: z.infer<typeof otpFormSchema>) {
    if (!confirmationResult) return;
    setIsSubmitting(true);
    try {
        await confirmOtp(confirmationResult, values.otp);
        // Let the useEffect handle redirection
    } catch (error: any) {
        console.error(error);
        toast({ variant: 'destructive', title: 'Invalid OTP', description: 'The OTP you entered is incorrect. Please try again.'});
    } finally {
        setIsSubmitting(false);
    }
  }


  if (loading) {
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
      <div id="recaptcha-container"></div>
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
            <Tabs defaultValue="phone" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="phone">Phone</TabsTrigger>
                    <TabsTrigger value="email">Email</TabsTrigger>
                </TabsList>
                <TabsContent value="phone">
                    {!showOtpForm ? (
                         <Form {...phoneForm}>
                            <form onSubmit={phoneForm.handleSubmit(onPhoneSubmit)} className="space-y-4 pt-4">
                                <FormField
                                    control={phoneForm.control}
                                    name="phoneNumber"
                                    render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Phone Number</FormLabel>
                                        <FormControl>
                                        <Input placeholder="+1 123 456 7890" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                    )}
                                />
                                <Button type="submit" className="w-full" disabled={isSubmitting}>
                                    {isSubmitting ? <Loader2 className="animate-spin" /> : <Phone />}
                                    Send OTP
                                </Button>
                            </form>
                        </Form>
                    ) : (
                        <Form {...otpForm}>
                            <form onSubmit={otpForm.handleSubmit(onOtpSubmit)} className="space-y-4 pt-4">
                                <FormField
                                    control={otpForm.control}
                                    name="otp"
                                    render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Verification Code</FormLabel>
                                        <FormControl>
                                        <Input placeholder="123456" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                    )}
                                />
                                <Button type="submit" className="w-full" disabled={isSubmitting}>
                                    {isSubmitting ? <Loader2 className="animate-spin" /> : <MessageSquare />}
                                    Verify & Sign Up
                                </Button>
                                <Button variant="link" onClick={() => setShowOtpForm(false)}>Back</Button>
                            </form>
                        </Form>
                    )}
                   
                </TabsContent>
                <TabsContent value="email">
                     <Form {...emailForm}>
                        <form onSubmit={emailForm.handleSubmit(onEmailSubmit)} className="space-y-4 pt-4">
                        <FormField
                            control={emailForm.control}
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
                            control={emailForm.control}
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
                            control={emailForm.control}
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
                        <Button type="submit" className="w-full" disabled={isSubmitting}>
                            {isSubmitting ? <Loader2 className="animate-spin" /> : <UserPlus />}
                            Sign Up with Email
                        </Button>
                        </form>
                    </Form>
                </TabsContent>
            </Tabs>
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
