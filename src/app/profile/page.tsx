
"use client";

import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import { Header } from "@/components/Header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { LogOut, Loader2, Mail, User, Edit, Check, ShieldCheck, KeyRound, MailCheck, AlertTriangle, CheckCircle, XCircle, X, Sparkles, Trash2, ArrowLeft } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { doc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Separator } from "@/components/ui/separator";
import { generateAvatar } from "@/ai/flows/generate-avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";


const passwordFormSchema = z.object({
  currentPassword: z.string().min(1, { message: 'Current password is required.' }),
  newPassword: z.string().min(6, { message: 'New password must be at least 6 characters.' }),
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "New passwords don't match",
  path: ['confirmPassword'],
});

const usernameFormSchema = z.object({
    username: z.string().min(3, "Username must be at least 3 characters.").max(20, "Username must be 20 characters or less."),
});

function ProfilePageSkeleton() {
    return (
        <div className="flex flex-col min-h-screen">
            <Header />
            <main className="flex-1 bg-muted/40">
                <div className="container max-w-2xl py-12 px-2 md:px-8">
                     <Card>
                        <CardHeader className="flex flex-row items-center gap-4">
                            <Skeleton className="h-20 w-20 rounded-full" />
                            <div className="flex-1 space-y-2">
                                <Skeleton className="h-6 w-48" />
                                <Skeleton className="h-4 w-24" />
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-4 pt-6">
                            <Skeleton className="h-10 w-full" />
                            <Skeleton className="h-10 w-full" />
                        </CardContent>
                    </Card>
                </div>
            </main>
        </div>
    )
}


export default function ProfilePage() {
    const { currentUser, loading, logout, reauthenticate, updateUserPassword, sendVerificationEmail } = useAuth();
    const router = useRouter();
    const { toast } = useToast();
    const [isEditing, setIsEditing] = useState(false);
    const [newUsername, setNewUsername] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [isSendingVerification, setIsSendingVerification] = useState(false);
    const [isGeneratingAvatar, setIsGeneratingAvatar] = useState(false);
    
    const passwordForm = useForm<z.infer<typeof passwordFormSchema>>({
        resolver: zodResolver(passwordFormSchema),
        defaultValues: {
            currentPassword: '',
            newPassword: '',
            confirmPassword: '',
        }
    });

    useEffect(() => {
        if (!loading && !currentUser) {
            router.replace('/login');
        }
         if (currentUser?.profile?.username) {
            setNewUsername(currentUser.profile.username);
        }
    }, [currentUser, loading, router]);

    const handleLogout = async () => {
        try {
          await logout();
        } catch (error) {
          console.error("Failed to log out", error);
        }
    };
    
    const handleUpdateUsername = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentUser || !currentUser.profile) return;

        const trimmedUsername = newUsername.trim();

        if (trimmedUsername === currentUser.profile.username) {
            setIsEditing(false);
            return;
        }

        if (!trimmedUsername || trimmedUsername.length < 3) {
             toast({
                variant: 'destructive',
                title: 'Invalid Username',
                description: 'Username must be at least 3 characters.',
            });
            return;
        }

        setIsSaving(true);
        try {
            const userDocRef = doc(db, 'users', currentUser.uid);
            await updateDoc(userDocRef, { username: trimmedUsername });
            toast({
                title: 'Success!',
                description: 'Your username has been updated.',
            });
            setIsEditing(false);

        } catch (error) {
             toast({
                variant: 'destructive',
                title: 'Error',
                description: 'Failed to update username. Please try again.',
            });
            console.error("Failed to update username", error);
        } finally {
            setIsSaving(false);
        }
    };

    const handleChangePassword = async (values: z.infer<typeof passwordFormSchema>) => {
        if (!currentUser) return;
        
        try {
            await reauthenticate(values.currentPassword);
            await updateUserPassword(values.newPassword);
            toast({
                title: 'Password Updated',
                description: 'Your password has been changed successfully.',
            });
            passwordForm.reset();
        } catch (error: any) {
             toast({
                variant: 'destructive',
                title: 'Error updating password',
                description: error.message,
            });
        }
    }
    
    const handleSendVerificationEmail = async () => {
        setIsSendingVerification(true);
        try {
            await sendVerificationEmail();
            toast({
                title: 'Verification Email Sent',
                description: 'Please check your inbox to verify your email address.',
            });
        } catch (error: any) {
            toast({
                variant: 'destructive',
                title: 'Error',
                description: error.message,
            });
        } finally {
            setIsSendingVerification(false);
        }
    }

    const handleGenerateAvatar = async () => {
        if (!currentUser || !currentUser.profile) return;
        setIsGeneratingAvatar(true);
        try {
            const result = await generateAvatar({ prompt: currentUser.profile.username });
            if (!result.dataUri) {
                throw new Error("AI did not return an image.");
            }
            
            const userDocRef = doc(db, 'users', currentUser.uid);
            await updateDoc(userDocRef, {
                 photoURL: result.dataUri,
            });
            
            toast({
                title: 'Avatar Generated!',
                description: 'Your new avatar has been saved.',
            });
        } catch (error: any) {
            toast({
                variant: 'destructive',
                title: 'Avatar Generation Failed',
                description: error.message || 'An unexpected error occurred.',
            });
        } finally {
            setIsGeneratingAvatar(false);
        }
    };

     const handleRemoveAvatar = async () => {
        if (!currentUser) return;
        try {
            const userDocRef = doc(db, 'users', currentUser.uid);
            await updateDoc(userDocRef, { photoURL: '' });
            toast({
                title: 'Avatar Removed',
                description: 'Your avatar has been reset to the default.',
            });
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Error',
                description: 'Could not remove your avatar.',
            });
        }
    };


    if (loading || !currentUser) {
        return <ProfilePageSkeleton />;
    }
    
    const getInitials = (usernameOrEmail: string | undefined | null) => {
        if (!usernameOrEmail) return "..";
        const username = usernameOrEmail.split('@')[0];
        if (username.length > 2) {
            return username.substring(0, 2).toUpperCase();
        }
        return username.toUpperCase();
    }

    return (
        <div className="flex flex-col min-h-screen">
            <Header />
            <main className="flex-1 bg-muted/40">
                <div className="container max-w-2xl py-12 px-2 md:px-8">
                    <div className="w-full max-w-2xl mb-4">
                        <Button variant="outline" size="sm" onClick={() => router.back()} className="rounded-full">
                            <ArrowLeft className="mr-2" />
                            Back
                        </Button>
                    </div>
                    <Card className="shadow-lg">
                        <CardHeader className="flex flex-col sm:flex-row items-center gap-6 text-center sm:text-left">
                           <div className="relative group">
                                <Avatar className="h-24 w-24 text-3xl border-2 border-primary">
                                     <AvatarImage src={currentUser.profile?.photoURL} alt={currentUser.profile?.username} />
                                    <AvatarFallback>{getInitials(currentUser.profile?.username || currentUser.email)}</AvatarFallback>
                                </Avatar>
                           </div>
                            <div className="flex-1">
                                <div className="flex items-center justify-center sm:justify-start gap-2">
                                    <CardTitle className="text-2xl">{currentUser.profile?.username || 'My Profile'}</CardTitle>
                                    {currentUser.emailVerified ? (
                                        <CheckCircle className="h-6 w-6 text-green-500" />
                                    ) : (
                                        <XCircle className="h-6 w-6 text-red-500" />
                                    )}
                                </div>
                                <CardDescription>Manage your account details and security settings.</CardDescription>
                            </div>
                        </CardHeader>
                        <CardContent className="pt-6 space-y-6">
                             <div>
                                <h3 className="text-lg font-semibold mb-4">Avatar Settings</h3>
                                <div className="flex flex-col sm:flex-row gap-2 rounded-md border p-4">
                                     {currentUser.profile?.photoURL && (
                                        <Button onClick={handleRemoveAvatar} variant="outline" className="flex-1">
                                            <Trash2 /> Remove Avatar
                                        </Button>
                                    )}
                                    <div className="flex-1"> 
                                        <Button onClick={handleGenerateAvatar} disabled={isGeneratingAvatar} className="w-full">
                                            {isGeneratingAvatar ? <Loader2 className="animate-spin" /> : <Sparkles />}
                                            Generate New Avatar
                                        </Button>
                                    </div>
                                </div>
                            </div>
                            
                            <Separator />

                            <div>
                                <h3 className="text-lg font-semibold mb-4">Profile Information</h3>
                                <div className="space-y-4">
                                    <div className="flex items-center space-x-4 rounded-md border p-4">
                                        <User className="h-5 w-5 text-muted-foreground" />
                                        <div className="flex-1 space-y-1">
                                            <p className="text-sm font-medium leading-none">Username</p>
                                            {!isEditing ? (
                                                <p className="text-sm text-muted-foreground">{currentUser.profile?.username || 'Not set'}</p>
                                            ) : (
                                                <form onSubmit={handleUpdateUsername} className="flex gap-2 items-center">
                                                    <Input 
                                                        value={newUsername}
                                                        onChange={(e) => setNewUsername(e.target.value)}
                                                        className="h-8"
                                                        disabled={isSaving}
                                                    />
                                                    <Button size="icon" className="h-8 w-8" disabled={isSaving}>
                                                        {isSaving ? <Loader2 className="animate-spin" /> : <Check />}
                                                    </Button>
                                                </form>
                                            )}
                                        </div>
                                        {!isEditing ? (
                                            <Button variant="ghost" size="icon" className="w-8 h-8" onClick={() => setIsEditing(true)}>
                                                <Edit className="h-4 w-4" />
                                            </Button>
                                        ) : (
                                            <Button variant="ghost" size="icon" className="w-8 h-8" onClick={() => setIsEditing(false)}>
                                                <X className="h-4 w-4" />
                                            </Button>
                                        )}
                                    </div>
                                    <div className="flex items-center space-x-4 rounded-md border p-4">
                                        <Mail className="h-5 w-5 text-muted-foreground" />
                                        <div className="flex-1 space-y-1">
                                            <p className="text-sm font-medium leading-none">Email</p>
                                            <p className="text-sm text-muted-foreground">{currentUser.email}</p>
                                        </div>
                                         {currentUser.emailVerified ? (
                                            <CheckCircle className="h-5 w-5 text-green-500" />
                                        ) : (
                                            <XCircle className="h-5 w-5 text-red-500" />
                                        )}
                                    </div>
                                </div>
                            </div>
                            
                            <Separator />

                            <div>
                                <h3 className="text-lg font-semibold mb-4">Security Settings</h3>
                                <div className="space-y-4">
                                     <div className="flex items-center space-x-4 rounded-md border p-4">
                                        {currentUser.emailVerified ? (
                                            <>
                                                <MailCheck className="h-5 w-5 text-green-500" />
                                                <div className="flex-1 space-y-1">
                                                    <p className="text-sm font-medium leading-none">Email Verification</p>
                                                    <p className="text-sm text-muted-foreground">Your email address has been verified.</p>
                                                </div>
                                            </>
                                        ) : (
                                            <>
                                                <AlertTriangle className="h-5 w-5 text-yellow-500" />
                                                <div className="flex-1 space-y-1">
                                                    <p className="text-sm font-medium leading-none">Email Not Verified</p>
                                                    <p className="text-sm text-muted-foreground">Please check your inbox for a verification link. It might take a moment to update here after you click it.</p>
                                                </div>
                                                <Button variant="secondary" onClick={handleSendVerificationEmail} disabled={isSendingVerification}>
                                                    {isSendingVerification ? <Loader2 className="animate-spin mr-2" /> : null}
                                                    Resend Email
                                                </Button>
                                            </>
                                        )}
                                    </div>

                                    <div className="flex items-center space-x-4 rounded-md border p-4">
                                        <KeyRound className="h-5 w-5 text-muted-foreground" />
                                        <div className="flex-1 space-y-1">
                                            <p className="text-sm font-medium leading-none">Password</p>
                                            <p className="text-sm text-muted-foreground">Change your account password.</p>
                                        </div>
                                        <Dialog>
                                            <DialogTrigger asChild>
                                                <Button variant="secondary">Change Password</Button>
                                            </DialogTrigger>
                                            <DialogContent>
                                                <DialogHeader>
                                                    <DialogTitle>Change Your Password</DialogTitle>
                                                    <DialogDescription>Enter your current password and a new password below.</DialogDescription>
                                                </DialogHeader>
                                                <Form {...passwordForm}>
                                                    <form onSubmit={passwordForm.handleSubmit(handleChangePassword)} className="space-y-4 py-4">
                                                         <FormField
                                                            control={passwordForm.control}
                                                            name="currentPassword"
                                                            render={({ field }) => (
                                                            <FormItem>
                                                                <FormLabel>Current Password</FormLabel>
                                                                <FormControl>
                                                                    <Input type="password" {...field} />
                                                                </FormControl>
                                                                <FormMessage />
                                                            </FormItem>
                                                            )}
                                                        />
                                                         <FormField
                                                            control={passwordForm.control}
                                                            name="newPassword"
                                                            render={({ field }) => (
                                                            <FormItem>
                                                                <FormLabel>New Password</FormLabel>
                                                                <FormControl>
                                                                    <Input type="password" {...field} />
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
                                                                <FormLabel>Confirm New Password</FormLabel>
                                                                <FormControl>
                                                                    <Input type="password" {...field} />
                                                                </FormControl>
                                                                <FormMessage />
                                                            </FormItem>
                                                            )}
                                                        />
                                                        <DialogFooter>
                                                            <Button type="submit" disabled={passwordForm.formState.isSubmitting}>
                                                                {passwordForm.formState.isSubmitting && <Loader2 className="animate-spin" />}
                                                                Update Password
                                                            </Button>
                                                        </DialogFooter>
                                                    </form>
                                                </Form>
                                            </DialogContent>
                                        </Dialog>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                         <CardFooter className="border-t pt-6">
                            <Button onClick={handleLogout} variant="outline" className="w-full">
                                <LogOut className="mr-2 h-4 w-4" /> Logout
                            </Button>
                        </CardFooter>
                    </Card>
                </div>
            </main>
        </div>
    )

    
}
