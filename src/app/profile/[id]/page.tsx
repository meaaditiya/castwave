
"use client";

import { useState, useEffect } from 'react';
import { use } from 'react';
import { Header } from '@/components/Header';
import { getUserProfile, UserProfileData } from '@/services/userService';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { CheckCircle, XCircle, Mic } from 'lucide-react';
import { notFound, useRouter } from 'next/navigation';
import { getChatRooms, ChatRoom } from '@/services/chatRoomService';
import { ChatRoomCard } from '@/components/ChatRoomCard';

function PublicProfileSkeleton() {
    return (
        <div className="flex flex-col min-h-screen">
            <Header />
            <main className="flex-1 bg-muted/40">
                <div className="container max-w-4xl py-12">
                    <Card className="mb-8">
                        <CardHeader className="flex flex-row items-center gap-4">
                            <Skeleton className="h-20 w-20 rounded-full" />
                            <div className="flex-1 space-y-2">
                                <Skeleton className="h-6 w-48" />
                                <Skeleton className="h-4 w-24" />
                            </div>
                        </CardHeader>
                    </Card>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {Array.from({ length: 3 }).map((_, i) => (
                             <div key={i} className="flex flex-col space-y-3">
                                <Skeleton className="h-[225px] w-full rounded-xl" />
                                <div className="space-y-2">
                                    <Skeleton className="h-4 w-3/4" />
                                    <Skeleton className="h-4 w-1/2" />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </main>
        </div>
    );
}


export default function PublicProfilePage({ params }: { params: { id: string } }) {
    const resolvedParams = use(params);
    const { currentUser, loading: authLoading } = useAuth();
    const router = useRouter();

    const [userProfile, setUserProfile] = useState<UserProfileData | null>(null);
    const [userSessions, setUserSessions] = useState<ChatRoom[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    const userId = resolvedParams.id;

    useEffect(() => {
        // Wait until auth state is fully determined.
        if (authLoading) {
            return;
        }

        // If auth is resolved and there's no user, redirect to login.
        if (!currentUser) {
            router.push('/login');
            return;
        }
        
        // If the user is viewing their own profile, redirect to the main profile page.
        if (userId === currentUser.uid) {
            router.replace('/profile');
            return;
        }

        async function fetchProfileData() {
            setLoading(true);
            try {
                const profile = await getUserProfile(userId);
                if (!profile) {
                    setError(true); // Mark as not found
                    return;
                }
                setUserProfile(profile);

            } catch (err) {
                console.error("Failed to fetch profile", err);
                setError(true); // Mark as error
            } finally {
                setLoading(false);
            }
        }

        fetchProfileData();

    }, [userId, currentUser, authLoading, router]);

    useEffect(() => {
        if (!userId) return;

        const unsubscribe = getChatRooms(
            (allChatRooms) => {
                const userPublicSessions = allChatRooms.filter(room => room.hostId === userId && !room.isPrivate);
                setUserSessions(userPublicSessions);
            },
            (error) => {
                console.error("Failed to get chat rooms for profile:", error);
            }
        );

        return () => {
            if (unsubscribe) {
                unsubscribe();
            }
        };

    }, [userId]);

     if (authLoading || (loading && !error)) {
        return <PublicProfileSkeleton />;
    }
    
    // If we had an error or the user was not found, trigger Next.js notFound UI
    if (error || !userProfile) {
        return notFound();
    }

    const getInitials = (username: string) => {
        if (!username) return "..";
        const nameParts = username.split(' ');
        if (nameParts.length > 1) {
            return (nameParts[0][0] + nameParts[1][0]).toUpperCase();
        }
        return username.substring(0, 2).toUpperCase();
    }

    return (
        <div className="flex flex-col min-h-screen">
            <Header />
            <main className="flex-1 bg-muted/40">
                <div className="container max-w-4xl py-12">
                     <Card className="mb-8 shadow-md">
                        <CardHeader className="flex flex-col sm:flex-row items-center gap-6 text-center sm:text-left">
                            <Avatar className="h-24 w-24 text-3xl border-2 border-primary">
                                <AvatarImage src={userProfile.photoURL} alt={userProfile.username} />
                                <AvatarFallback>{getInitials(userProfile.username)}</AvatarFallback>
                            </Avatar>
                            <div className="flex-1">
                                <div className="flex items-center justify-center sm:justify-start gap-2">
                                    <CardTitle className="text-2xl">{userProfile.username}</CardTitle>
                                    {userProfile.emailVerified ? (
                                        <CheckCircle className="h-6 w-6 text-green-500" />
                                    ) : (
                                        <XCircle className="h-6 w-6 text-red-500" />
                                    )}
                                </div>
                                <CardDescription>{userProfile.email}</CardDescription>
                            </div>
                        </CardHeader>
                    </Card>

                    <h2 className="text-2xl font-bold tracking-tight mb-6">Public Sessions</h2>
                    
                    {userSessions.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                            {userSessions.map(chatRoom => (
                                <ChatRoomCard 
                                    key={chatRoom.id} 
                                    {...chatRoom} 
                                    isOwner={currentUser?.uid === chatRoom.hostId}
                                    onDelete={() => {}} // Not needed on public profile
                                    onStartSession={() => {}} // Not needed on public profile
                                />
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-16 text-muted-foreground border-2 border-dashed rounded-lg">
                            <Mic className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
                            <p className="font-semibold">{userProfile.username} has no active public sessions.</p>
                        </div>
                    )}
                </div>
            </main>
        </div>
    )
}
