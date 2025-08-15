
"use client";

import { useState, useEffect, use } from 'react';
import { Header } from '@/components/Header';
import { getUserProfile, UserProfileData, followUser, unfollowUser, getFollowStatus, getFollowCounts, getFollowerProfiles, getFollowingProfiles } from '@/services/userService';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { CheckCircle, XCircle, Mic, ArrowLeft, UserPlus, UserCheck, Loader2 } from 'lucide-react';
import { notFound, useRouter } from 'next/navigation';
import { getChatRooms, ChatRoom, likeChatRoom, startChatRoom, deleteChatRoomForHost } from '@/services/chatRoomService';
import { ChatRoomCard } from '@/components/ChatRoomCard';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { FollowList } from '@/components/FollowList';

function PublicProfileSkeleton() {
    return (
        <div className="flex flex-col min-h-screen">
            <Header />
            <main className="flex-1 bg-muted/40">
                <div className="w-full max-w-4xl mx-auto py-12">
                    <Card className="mb-8">
                        <CardHeader className="flex flex-col sm:flex-row items-center gap-6 text-center sm:text-left p-6">
                            <Skeleton className="h-24 w-24 rounded-full" />
                            <div className="flex-1 space-y-2">
                                <Skeleton className="h-6 w-48" />
                                <Skeleton className="h-4 w-24" />
                                <div className="flex gap-4 pt-2">
                                    <Skeleton className="h-5 w-20" />
                                    <Skeleton className="h-5 w-20" />
                                </div>
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
    const { toast } = useToast();

    const [userProfile, setUserProfile] = useState<UserProfileData | null>(null);
    const [userSessions, setUserSessions] = useState<ChatRoom[]>([]);
    const [loading, setLoading] = useState(true);
    const [isFollowing, setIsFollowing] = useState(false);
    const [followLoading, setFollowLoading] = useState(true);
    const [followCounts, setFollowCounts] = useState({ followers: 0, following: 0 });
    
    const [followListType, setFollowListType] = useState<'followers' | 'following' | null>(null);

    const userId = resolvedParams.id;

    useEffect(() => {
        if (authLoading) {
            return; 
        }

        if (currentUser && userId === currentUser.uid) {
            router.replace('/profile');
            return;
        }

        let isMounted = true;
        let unsubscribeRooms: (() => void) | undefined;
        let unsubscribeFollow: (() => void) | undefined;
        let unsubscribeCounts: (() => void) | undefined;

        async function fetchProfileData() {
            setLoading(true);
            setFollowLoading(true);
            try {
                const profile = await getUserProfile(userId);

                if (!isMounted) return;

                if (!profile) {
                    notFound();
                    return;
                }
                setUserProfile(profile);

                // Fetch user's public sessions
                unsubscribeRooms = getChatRooms(
                    (allChatRooms) => {
                        if (isMounted) {
                            const userPublicSessions = allChatRooms.filter(room => room.hostId === userId && !room.isPrivate);
                            setUserSessions(userPublicSessions);
                        }
                    },
                    (error) => {
                        console.error("Failed to get chat rooms for profile:", error);
                    }
                );

                if (currentUser) {
                    unsubscribeFollow = getFollowStatus(currentUser.uid, userId, (status) => {
                        if(isMounted) setIsFollowing(status);
                    });
                }
                
                unsubscribeCounts = getFollowCounts(userId, (counts) => {
                    if(isMounted) setFollowCounts(counts);
                });

            } catch (err) {
                console.error("Failed to fetch profile", err);
                if (isMounted) notFound();
            } finally {
                if (isMounted) {
                    setLoading(false);
                    setFollowLoading(false);
                }
            }
        }

        fetchProfileData();
        
        return () => {
            isMounted = false;
            if (unsubscribeRooms) unsubscribeRooms();
            if (unsubscribeFollow) unsubscribeFollow();
            if (unsubscribeCounts) unsubscribeCounts();
        };

    }, [userId, currentUser, authLoading, router]);

    const handleFollowToggle = async () => {
        if (!currentUser) {
            toast({ variant: 'destructive', title: 'Please log in to follow users.'});
            return;
        }
        setFollowLoading(true);
        try {
            if (isFollowing) {
                await unfollowUser(currentUser.uid, userId);
                toast({ title: 'Unfollowed', description: `You are no longer following ${userProfile?.username}.` });
            } else {
                await followUser(currentUser.uid, userId);
                toast({ title: 'Followed!', description: `You are now following ${userProfile?.username}.` });
            }
        } catch (error) {
            console.error(error);
            toast({ variant: 'destructive', title: 'Error', description: 'Could not complete the action.' });
        } finally {
            setFollowLoading(false);
        }
    }

    const handleLike = async (chatRoomId: string, type: 'like' | 'dislike') => {
        if (!currentUser) return;
        try {
            await likeChatRoom(chatRoomId, currentUser.uid, type);
             // Optimistically update UI
            setUserSessions(prevRooms => prevRooms.map(room => {
                if (room.id === chatRoomId) {
                    const alreadyLiked = room.likers?.includes(currentUser.uid);
                    
                    if (type === 'like' && !alreadyLiked) {
                        return { ...room, likes: (room.likes || 0) + 1, likers: [...(room.likers || []), currentUser.uid] };
                    }
                }
                return room;
            }));

        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Error', description: error.message });
        }
    }


     if (loading || authLoading) {
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
                <div className="w-full max-w-4xl mx-auto py-12">
                     <div className="mb-8 px-4">
                         <Button variant="outline" size="sm" onClick={() => router.back()} className="rounded-full">
                            <ArrowLeft className="mr-2" />
                            Back
                         </Button>
                     </div>
                     <Card className="shadow-md">
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
                                <div className="flex gap-4 mt-2 justify-center sm:justify-start">
                                    <button onClick={() => setFollowListType('followers')} className="text-sm hover:underline"><span className="font-bold">{followCounts.followers}</span> Followers</button>
                                    <button onClick={() => setFollowListType('following')} className="text-sm hover:underline"><span className="font-bold">{followCounts.following}</span> Following</button>
                                </div>
                            </div>
                            {currentUser && (
                                <Button onClick={handleFollowToggle} disabled={followLoading} className="w-full sm:w-auto">
                                    {followLoading ? (
                                        <Loader2 className="animate-spin" />
                                    ) : isFollowing ? (
                                        <><UserCheck className="mr-2" /> Following</>
                                    ) : (
                                        <><UserPlus className="mr-2" /> Follow</>
                                    )}
                                </Button>
                            )}
                        </CardHeader>
                    </Card>


                    <h2 className="text-2xl font-bold tracking-tight my-6 px-4">Public Sessions</h2>
                    
                    {userSessions.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                            {userSessions.map(chatRoom => (
                                <ChatRoomCard 
                                    key={chatRoom.id} 
                                    {...chatRoom} 
                                    isOwner={false}
                                    onDelete={() => {}} // Not needed on public profile
                                    onStartSession={() => {}} // Not needed on public profile
                                    onLike={(type) => handleLike(chatRoom.id, type)}
                                    currentUserId={currentUser?.uid}
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

            <FollowList
                userId={userId}
                type={followListType}
                onClose={() => setFollowListType(null)}
                currentUserId={currentUser?.uid}
            />
        </div>
    )
}
