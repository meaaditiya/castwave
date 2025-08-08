
"use client";

import { useState, useEffect, use } from 'react';
import { Header } from '@/components/Header';
import { ChatRoomCard } from '@/components/ChatRoomCard';
import { getChatRooms, ChatRoom } from '@/services/chatRoomService';
import { getUserProfile, UserProfileData } from '@/services/userService';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { CheckCircle, XCircle, Mic } from 'lucide-react';
import { notFound, useRouter } from 'next/navigation';

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
                                <Skeleton className="h-[170px] w-full rounded-xl" />
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
    const { currentUser } = useAuth();
    const router = useRouter();

    const [userProfile, setUserProfile] = useState<UserProfileData | null>(null);
    const [publicRooms, setPublicRooms] = useState<ChatRoom[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const userId = resolvedParams.id;
        if (!userId) return;

        // Redirect to main profile page if viewing own profile
        if (currentUser && userId === currentUser.uid) {
            router.replace('/profile');
            return;
        }

        async function fetchProfileData() {
            try {
                setLoading(true);
                const profile = await getUserProfile(userId);
                if (!profile) {
                    notFound();
                    return;
                }
                setUserProfile(profile);

                const unsubscribe = getChatRooms(
                    (rooms) => setPublicRooms(rooms),
                    { hostId: userId, isPublic: true }
                );
                
                // This is a simple implementation. For a real app, you'd want to manage this unsubscribe more carefully.
                // For now, we'll just let it run.

            } catch (error) {
                console.error("Failed to fetch profile", error);
                notFound();
            } finally {
                setLoading(false);
            }
        }

        fetchProfileData();

    }, [resolvedParams.id, currentUser, router]);

     if (loading) {
        return <PublicProfileSkeleton />;
    }

    if (!userProfile) {
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

                    <h2 className="text-2xl font-bold tracking-tight mb-6">Public Sessions by {userProfile.username}</h2>
                    
                    {publicRooms.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                            {publicRooms.map(chatRoom => (
                                <ChatRoomCard 
                                    key={chatRoom.id} 
                                    {...chatRoom} 
                                    isOwner={currentUser?.uid === chatRoom.hostId}
                                    onDelete={() => { /* No delete on public page */ }}
                                    onStartSession={() => { /* No start on public page */ }}
                                />
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-16 text-muted-foreground border-2 border-dashed rounded-lg">
                           <Mic className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
                           <p className="font-semibold">{userProfile.username} hasn't hosted any public sessions yet.</p>
                        </div>
                    )}
                </div>
            </main>
        </div>
    )
}

    