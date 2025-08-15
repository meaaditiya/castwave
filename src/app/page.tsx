
"use client";

import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/Header';
import { ChatRoomCard } from '@/components/ChatRoomCard';
import { getChatRooms, ChatRoom, deleteChatRoomForHost, likeChatRoom } from '@/services/chatRoomService';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Search, Globe, Lock, Loader2, Phone } from 'lucide-react';
import { startChatRoom } from '@/services/chatRoomService';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LoadingScreen } from '@/components/LoadingScreen';
import { cn } from '@/lib/utils';
import Link from 'next/link';

function HomePageSkeleton() {
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 px-4">
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
    );
}

export default function Home() {
  const [allChatRooms, setAllChatRooms] = useState<ChatRoom[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(true);
  const { currentUser, loading: authLoading } = useAuth();
  const [chatRoomToDelete, setChatRoomToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [currentTab, setCurrentTab] = useState('public');
  const router = useRouter();

  useEffect(() => {
    if (authLoading) {
      return; // Wait for authentication to resolve
    }
    if (!currentUser) {
      router.push('/login');
      return;
    }

    setLoadingRooms(true);
    const unsubscribe = getChatRooms(
      (newChatRooms) => {
        setAllChatRooms(newChatRooms);
        setLoadingRooms(false);
      },
      (error) => {
        console.error("Failed to get chat rooms:", error);
        toast({ variant: 'destructive', title: 'Error', description: 'Could not load sessions.' });
        setAllChatRooms([]);
        setLoadingRooms(false);
      }
    );
    
    return () => {
        if (unsubscribe) {
            unsubscribe();
        }
    };
  }, [currentUser, authLoading, router, toast]);


  const filteredAndSortedRooms = useMemo(() => {
    // Filter based on search query first
    const searchResults = allChatRooms.filter(room =>
      room.title.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Then, filter based on the current tab
    let tabResults;
    if (currentTab === 'public') {
      tabResults = searchResults.filter(room => !room.isPrivate);
    } else { // 'my-sessions'
      tabResults = searchResults.filter(room => room.hostId === currentUser?.uid);
    }

    // Finally, sort the results
    return tabResults.sort((a, b) => {
        const dateA = a.createdAt?.toDate() || 0;
        const dateB = b.createdAt?.toDate() || 0;
        if (dateA > dateB) return -1;
        if (dateA < dateB) return 1;
        return 0;
    });

  }, [searchQuery, allChatRooms, currentTab, currentUser]);


  const handleDelete = async () => {
    if (!chatRoomToDelete || !currentUser) return;

    setIsDeleting(true);
    try {
        await deleteChatRoomForHost(chatRoomToDelete, currentUser.uid);
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

  const handleLike = async (chatRoomId: string, type: 'like' | 'dislike') => {
      if (!currentUser) return;
      try {
          await likeChatRoom(chatRoomId, currentUser.uid, type);
          // Optimistically update UI - note this won't reflect dislike counts
          setAllChatRooms(prevRooms => prevRooms.map(room => {
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
  
  if (authLoading || !currentUser) {
    return <LoadingScreen />;
  }

  const renderRoomList = (rooms: ChatRoom[]) => {
    if (loadingRooms) return <HomePageSkeleton />;
    if (rooms.length > 0) {
        return (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 px-4">
                {rooms.map(chatRoom => (
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
        );
    }
    const emptyStateMessages = {
      public: {
        icon: <Globe className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />,
        title: "No Public Sessions",
        description: "There are no public sessions available right now. Why not create one?"
      },
      'my-sessions': {
        icon: <Lock className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />,
        title: "No Sessions Found",
        description: "You haven't created any sessions yet, or none match your search."
      }
    }
    const currentEmptyState = emptyStateMessages[currentTab as keyof typeof emptyStateMessages];
    
    return (
        <div className="text-center py-16 text-muted-foreground border-2 border-dashed rounded-lg mx-4">
           {currentEmptyState.icon}
           <p className="font-semibold text-lg">{currentEmptyState.title}</p>
           <p>{currentEmptyState.description}</p>
        </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 w-full py-8">
         <div className="mb-8 px-2 text-sm text-left text-muted-foreground">
            <Link href="https://connectwithaaditiya.onrender.com/contact" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 hover:text-primary transition-colors">
                 <Phone className="h-3 w-3 text-black dark:text-white" />
                 Contact for help
            </Link>
        </div>
        
        <div className="flex flex-col md:flex-row gap-4 mb-8 px-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input 
              placeholder="Search for a session by title..."
              className="pl-10 text-base h-11"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Tabs value={currentTab} onValueChange={setCurrentTab} className="w-full md:w-auto">
              <TabsList className="grid w-full grid-cols-2 md:w-auto h-11">
                  <TabsTrigger value="public" className="text-base"><Globe className="mr-2 h-4 w-4"/>Public</TabsTrigger>
                  {currentUser && <TabsTrigger value="my-sessions" className="text-base"><Lock className="mr-2 h-4 w-4"/>My Sessions</TabsTrigger>}
              </TabsList>
          </Tabs>
        </div>

        {renderRoomList(filteredAndSortedRooms)}

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
  );
}
