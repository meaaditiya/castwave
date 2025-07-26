
"use client";

import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Header } from "@/components/Header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { LogOut, Loader2, Mail, ShieldCheck } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

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

    useEffect(() => {
        if (!loading && !currentUser) {
            router.push('/login');
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

    if (loading || !currentUser) {
        return <ProfilePageSkeleton />;
    }

    const getInitials = (email: string) => {
        if (!email) return "..";
        return email.substring(0, 2).toUpperCase();
    }
    
    return (
        <div className="flex flex-col min-h-screen">
            <Header />
            <main className="flex-1 bg-muted/40">
                <div className="container max-w-2xl py-12">
                    <Card className="shadow-lg">
                        <CardHeader className="flex flex-col sm:flex-row items-center gap-6 text-center sm:text-left">
                            <Avatar className="h-24 w-24 text-3xl border-2 border-primary">
                                <AvatarFallback>{getInitials(currentUser.email!)}</AvatarFallback>
                            </Avatar>
                            <div className="flex-1">
                                <CardTitle className="text-2xl">My Profile</CardTitle>
                                <CardDescription>Manage your account details below.</CardDescription>
                            </div>
                        </CardHeader>
                        <CardContent className="pt-6 space-y-4">
                            <div className="flex items-center space-x-4 rounded-md border p-4">
                                <Mail className="h-5 w-5 text-muted-foreground" />
                                <div className="flex-1 space-y-1">
                                    <p className="text-sm font-medium leading-none">Email</p>
                                    <p className="text-sm text-muted-foreground">{currentUser.email}</p>
                                </div>
                            </div>
                            <div className="flex items-center space-x-4 rounded-md border p-4">
                                <ShieldCheck className="h-5 w-5 text-muted-foreground" />
                                <div className="flex-1 space-y-1">
                                    <p className="text-sm font-medium leading-none">Account Status</p>
                                    <p className="text-sm text-green-600 dark:text-green-400">Verified</p>
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
