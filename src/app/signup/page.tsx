
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
import { Waves, Loader2, UserPlus, Phone, MessageSquare, KeyRound } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { ConfirmationResult } from 'firebase/auth';

const phoneFormSchema = z.object({
  phoneNumber: z.string().min(10, { message: 'Please enter a valid phone number with country code.' }),
});

const otpFormSchema = z.object({
  otp: z.string().length(6, { message: "OTP must be 6 digits."})
});

const passwordFormSchema = z.object({
  password: z.string().min(6, { message: 'Password must be at least 6 characters.' }),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});


export default function SignupPage() {
  const { signupWithEmail, currentUser, loading, setupRecaptcha, sendPhoneOtp, confirmPhoneOtp, completePhoneSignup } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [signupSuccess, setSignupSuccess] = useState(false);
  const [currentStep, setCurrentStep] = useState<'phone' | 'otp' | 'password'>('phone');
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);

  useEffect(() => {
    if (!loading && currentUser) {
        const timer = setTimeout(() => {
            router.push('/');
        }, 100);
        return () => clearTimeout(timer);
    }
  }, [currentUser, loading, router]);


  const phoneForm = useForm<z.infer<typeof phoneFormSchema>>({
    resolver: zodResolver(phoneFormSchema),
    defaultValues: { phoneNumber: '' },
  });

  const otpForm = useForm<z.infer<typeof otpFormSchema>>({
    resolver: zodResolver(otpFormSchema),
    defaultValues: { otp: '' }
  });

  const passwordForm = useForm<z.infer<typeof passwordFormSchema>>({
    resolver: zodResolver(passwordFormSchema),
    defaultValues: { password: '', confirmPassword: '' }
  });


  async function onPhoneSubmit(values: z.infer<typeof phoneFormSchema>) {
    setIsSubmitting(true);
    try {
        const appVerifier = setupRecaptcha('recaptcha-container-signup');
        const result = await sendPhoneOtp(values.phoneNumber, appVerifier);
        setConfirmationResult(result);
        setCurrentStep('otp');
        toast({ title: 'OTP Sent', description: 'Please check your phone for the verification code. (Use 911911 for +917351102036)'});
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
        await confirmPhoneOtp(confirmationResult, values.otp);
        setCurrentStep('password');
        toast({ title: 'Phone Verified!', description: 'Please create a password to secure your account.' });
    } catch (error: any) {
        console.error(error);
        toast({ variant: 'destructive', title: 'Invalid OTP', description: 'The OTP you entered is incorrect. Please try again.'});
    } finally {
        setIsSubmitting(false);
    }
  }

  async function onPasswordSubmit(values: z.infer<typeof passwordFormSchema>) {
    setIsSubmitting(true);
    try {
        await completePhoneSignup(values.password);
        toast({ title: 'Account Created!', description: 'You have been logged in successfully.' });
        // The main useEffect will handle the redirect
    } catch (error: any) {
        console.error(error);
        toast({ variant: 'destructive', title: 'Error', description: 'Could not create your account.' });
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

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
      <div id="recaptcha-container-signup"></div>
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
          {currentStep === 'phone' && (
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
          )}
          {currentStep === 'otp' && (
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
                          Verify Phone
                      </Button>
                      <Button variant="link" onClick={() => setCurrentStep('phone')}>Back</Button>
                  </form>
              </Form>
          )}
          {currentStep === 'password' && (
              <Form {...passwordForm}>
                  <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)} className="space-y-4 pt-4">
                      <FormField
                          control={passwordForm.control}
                          name="password"
                          render={({ field }) => (
                          <FormItem>
                              <FormLabel>Create Password</FormLabel>
                              <FormControl>
                                <Input type="password" placeholder="••••••••" {...field} />
                              </FormControl>
                              <FormMessage />
                          </FormItem>
                          )}
                      />
                      <FormField
                          control={passwordForm.control}
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
                          {isSubmitting ? <Loader2 className="animate-spin" /> : <KeyRound />}
                          Create Account
                      </Button>
                  </form>
              </Form>
          )}

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
