
"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/Header';
import { ChatRoomCard } from '@/components/ChatRoomCard';
import { getFeedForUser, getUserSuggestions, UserProfileData, followUser, unfollowUser } from '@/services/userService';
import { ChatRoom, deleteChatRoomForHost, likeChatRoom, startChatRoom } from '@/services/chatRoomService';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2, UserPlus, Rss } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';


function FeedPageSkeleton() {
    return (
        <div className="space-y-8">
            <div>
                <Skeleton className="h-8 w-48 mb-4" />
                <div className="flex space-x-4">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <Skeleton key={i} className="h-32 w-64 rounded-xl" />
                    ))}
                </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {Array.from({ length: 8 }).map((_, i) => (
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
    )
}

function Suggestions({ suggestions }: { suggestions: UserProfileData[] }) {
    const { currentUser } = useAuth();
    const { toast } = useToast();

    const getInitials = (name: string) => {
        if (!name) return "..";
        const nameParts = name.split(' ');
        if (nameParts.length > 1) {
            return (nameParts[0][0] + nameParts[1][0]).toUpperCase();
        }
        return name.substring(0, 2).toUpperCase();
    }
    
    const handleFollow = async (e: React.MouseEvent, targetUserId: string) => {
        e.preventDefault();
        e.stopPropagation();
        if (!currentUser) return;
        try {
            await followUser(currentUser.uid, targetUserId);
            toast({title: 'Followed!', description: 'You are now following this user.'});
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Error', description: error.message });
        }
    }

    if (suggestions.length === 0) {
        return null;
    }

    return (
        <div className="mb-12">
            <h2 className="text-2xl font-bold tracking-tight mb-4">Suggestions For You</h2>
             <Carousel opts={{ align: "start", dragFree: true }}>
                <CarouselContent className="-ml-4">
                    {suggestions.map(user => (
                        <CarouselItem key={user.uid} className="basis-auto pl-4">
                             <Card className="w-64 hover:border-primary/50 transition-colors">
                                <CardContent className="flex flex-col items-center text-center p-6">
                                     <Link href={`/profile/${user.uid}`} className="flex flex-col items-center gap-3 flex-1">
                                        <Avatar className="h-16 w-16 text-xl">
                                            <AvatarImage src={user.photoURL} alt={user.username} />
                                            <AvatarFallback>{getInitials(user.username)}</AvatarFallback>
                                        </Avatar>
                                        <div>
                                            <p className="font-semibold hover:underline">{user.username}</p>
                                            <p className="text-xs text-muted-foreground">{user.email}</p>
                                        </div>
                                    </Link>
                                    <Button size="sm" variant="outline" className="mt-4 w-full" onClick={(e) => handleFollow(e, user.uid)}>
                                        <UserPlus className="mr-2" /> Follow
                                    </Button>
                                </CardContent>
                             </Card>
                        </CarouselItem>
                    ))}
                </CarouselContent>
                <CarouselPrevious />
                <CarouselNext />
            </Carousel>
        </div>
    )
}


export default function FeedPage() {
    const { currentUser, loading: authLoading } = useAuth();
    const router = useRouter();
    const { toast } = useToast();

    const [feedRooms, setFeedRooms] = useState<ChatRoom[]>([]);
    const [suggestions, setSuggestions] = useState<UserProfileData[]>([]);
    const [loadingFeed, setLoadingFeed] = useState(true);
    const [chatRoomToDelete, setChatRoomToDelete] = useState<string | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    useEffect(() => {
        if (authLoading) return;
        if (!currentUser) {
            router.push('/login');
            return;
        }

        async function loadFeed() {
            setLoadingFeed(true);
            try {
                const rooms = await getFeedForUser(currentUser!.uid);
                setFeedRooms(rooms);
            } catch (error) {
                console.error("Error fetching feed:", error);
                toast({ variant: 'destructive', title: 'Error', description: 'Could not load your feed.' });
            }
            try {
                 const userSuggestions = await getUserSuggestions(currentUser!.uid);
                 setSuggestions(userSuggestions);
            } catch (error) {
                 console.error("Error fetching suggestions:", error);
                 toast({ variant: 'destructive', title: 'Error', description: 'Could not load suggestions.' });
            } finally {
                setLoadingFeed(false);
            }
        }

        loadFeed();
    }, [currentUser, authLoading, router, toast]);

    if (authLoading || !currentUser) {
        return (
            <div className="flex items-center justify-center h-screen bg-muted/40">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }
    
    const handleDelete = async () => {
        if (!chatRoomToDelete || !currentUser) return;

        setIsDeleting(true);
        try {
            await deleteChatRoomForHost(chatRoomToDelete, currentUser.uid);
            setFeedRooms(prev => prev.filter(room => room.id !== chatRoomToDelete));
            toast({
                title: 'Chat Room Deleted',
                description: 'The chat room has been successfully deleted.',
            });
        } catch (error) {
            console.error('Failed to delete chat room', error);
            toast({ variant: 'destructive', title: 'Error', description: 'Failed to delete chat room.' });
        } finally {
            setIsDeleting(false);
            setChatRoomToDelete(null);
        }
    };
    
    const handleLike = async (chatRoomId: string, type: 'like' | 'dislike') => {
        if (!currentUser) return;
        try {
            await likeChatRoom(chatRoomId, currentUser.uid, type);
             // Optimistically update UI
            setFeedRooms(prevRooms => prevRooms.map(room => {
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

    const handleStartSession = async (chatRoomId: string) => {
        try {
          await startChatRoom(chatRoomId);
          toast({
            title: 'Session Started!',
            description: 'The chat room is now live.',
          });
        } catch (error) {
          console.error('Failed to start chat room', error);
          toast({
            variant: 'destructive',
            title: 'Error',
            description: 'Failed to start the chat room session.',
          });
        }
    };


    const renderFeed = () => {
        if (loadingFeed) {
            return <FeedPageSkeleton />;
        }
        
        return (
             <div className="space-y-12">
                <Suggestions suggestions={suggestions} />
                
                <div>
                     <h2 className="text-2xl font-bold tracking-tight mb-4">From Your Network</h2>
                    {feedRooms.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                            {feedRooms.map(chatRoom => (
                                <ChatRoomCard 
                                    key={chatRoom.id} 
                                    {...chatRoom} 
                                    isOwner={currentUser?.uid === chatRoom.hostId}
                                    onDelete={() => setChatRoomToDelete(chatRoom.id)}
                                    onStartSession={() => handleStartSession(chatRoom.id)}
                                    onLike={(type) => handleLike(chatRoom.id, type)}
                                    currentUserId={currentUser.uid}
                                />
                            ))}
                        </div>
                    ) : (
                         <div className="text-center py-16 text-muted-foreground border-2 border-dashed rounded-lg flex flex-col items-center justify-center h-full min-h-[400px]">
                           <Rss className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
                           <p className="font-semibold text-lg">Your Feed is Empty</p>
                           <p>Follow people from the suggestions above to see their public sessions here.</p>
                        </div>
                    )}
                </div>
            </div>
        )

    }

    return (
        <div className="min-h-screen flex flex-col">
            <Header />
            <main className="flex-1 container py-8 px-2 md:px-8">
                 <div className="mb-8">
                    <h1 className="text-3xl md:text-4xl font-bold tracking-tighter">Your Feed</h1>
                    <p className="text-muted-foreground">Catch up on the latest sessions from people you follow.</p>
                </div>
                {renderFeed()}
            </main>

            <AlertDialog open={!!chatRoomToDelete} onOpenChange={(open) => !open && setChatRoomToDelete(null)}>
                <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete the chat room and all of its associated data.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete} disabled={isDeleting} className="bg-destructive hover:bg-destructive/90">
                    {isDeleting ? 'Deleting...' : 'Delete'}
                    </AlertDialogAction>
                </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}
