
"use client";

import { useAuth, UserProfile } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Header } from "@/components/Header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { LogOut, Loader2, Mail, User, Edit, Check } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { doc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';
import { Input } from "@/components/ui/input";

function ProfilePageSkeleton() {
    return (
        <div className="flex flex-col min-h-screen">
            <Header />
            <main className="flex-1 bg-muted/40">
                <div className="container max-w-2xl py-12">
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
    const { currentUser, loading, logout } = useAuth();
    const router = useRouter();
    const { toast } = useToast();
    const [isEditing, setIsEditing] = useState(false);
    const [newUsername, setNewUsername] = useState(currentUser?.profile?.username || '');
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (!loading && !currentUser) {
            router.push('/login');
        }
         if (currentUser?.profile?.username) {
            setNewUsername(currentUser.profile.username);
        }
    }, [currentUser, loading, router]);

    const handleLogout = async () => {
        try {
          await logout();
          router.push('/login');
        } catch (error) {
          console.error("Failed to log out", error);
        }
    };
    
    const handleUpdateUsername = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentUser || !newUsername || newUsername.trim().length < 3) {
             toast({
                variant: 'destructive',
                title: 'Invalid Username',
                description: 'Username must be at least 3 characters.',
            });
            return;
        }
        setIsSaving(true);
        const userDocRef = doc(db, 'users', currentUser.uid);
        try {
            // Use setDoc with merge: true to create the document if it doesn't exist,
            // or update it if it does. This handles users created before the profile feature.
            await setDoc(userDocRef, {
                username: newUsername.trim(),
                email: currentUser.email // Also ensure email is present in the profile
            }, { merge: true });

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
    }


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
                <div className="container max-w-2xl py-12">
                    <Card className="shadow-lg">
                        <CardHeader className="flex flex-col sm:flex-row items-center gap-6 text-center sm:text-left">
                            <Avatar className="h-24 w-24 text-3xl border-2 border-primary">
                                <AvatarFallback>{getInitials(currentUser.profile?.username || currentUser.email)}</AvatarFallback>
                            </Avatar>
                            <div className="flex-1">
                                <CardTitle className="text-2xl">{currentUser.profile?.username || 'My Profile'}</CardTitle>
                                <CardDescription>Manage your account details below.</CardDescription>
                            </div>
                        </CardHeader>
                        <CardContent className="pt-6 space-y-4">
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
                                        <Edit className="h-4 w-4" />
                                    </Button>
                                )}
                            </div>
                             <div className="flex items-center space-x-4 rounded-md border p-4">
                                <Mail className="h-5 w-5 text-muted-foreground" />
                                <div className="flex-1 space-y-1">
                                    <p className="text-sm font-medium leading-none">Email</p>
                                    <p className="text-sm text-muted-foreground">{currentUser.email}</p>
                                </div>
                            </div>
                            <Button onClick={handleLogout} variant="outline" className="w-full mt-4">
                                <LogOut className="mr-2 h-4 w-4" /> Logout
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </main>
        </div>
    )
}
