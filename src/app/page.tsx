
"use client";

import { useState, useEffect } from 'react';
import { Header } from '@/components/Header';
import { ChatRoomCard } from '@/components/ChatRoomCard';
import { getChatRooms, ChatRoom, deleteChatRoomForHost } from '@/services/chatRoomService';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Search, Globe, Lock } from 'lucide-react';
import { startChatRoom } from '@/services/chatRoomService';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

function HomePageSkeleton() {
    return (
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
    );
}

export default function Home() {
  const [allChatRooms, setAllChatRooms] = useState<ChatRoom[]>([]);
  const [filteredChatRooms, setFilteredChatRooms] = useState<ChatRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const { currentUser, loading: authLoading } = useAuth();
  const [chatRoomToDelete, setChatRoomToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [currentTab, setCurrentTab] = useState('public');

  useEffect(() => {
    if (authLoading) return;
    setLoading(true);

    const isPublic = currentTab === 'public';
    const hostId = currentTab === 'my-sessions' ? currentUser?.uid : undefined;

    const unsubscribe = getChatRooms(
      (newChatRooms) => {
        setAllChatRooms(newChatRooms);
        setLoading(false);
      },
      { isPublic, hostId },
      (error) => {
        console.error("Failed to get chat rooms:", error);
        toast({ variant: 'destructive', title: 'Error', description: 'Could not load sessions. Check permissions or network.' });
        setAllChatRooms([]);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, [currentTab, currentUser, authLoading, toast]);

  useEffect(() => {
    const results = allChatRooms.filter(room =>
      room.title.toLowerCase().includes(searchQuery.toLowerCase())
    );
    setFilteredChatRooms(results);
  }, [searchQuery, allChatRooms]);

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

  const renderRoomList = (rooms: ChatRoom[]) => {
    if (loading || authLoading) return <HomePageSkeleton />;
    if (rooms.length > 0) {
        return (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {rooms.map(chatRoom => (
                    <ChatRoomCard 
                        key={chatRoom.id} 
                        {...chatRoom} 
                        isOwner={currentUser?.uid === chatRoom.hostId}
                        onDelete={() => setChatRoomToDelete(chatRoom.id)}
                        onStartSession={() => handleStartSession(chatRoom.id)}
                    />
                ))}
            </div>
        );
    }
    return (
        <div className="text-center py-16">
            <p className="text-muted-foreground">No sessions found in this category. Why not create one?</p>
        </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 container py-8">
        <div className="mb-8">
            <h1 className="text-4xl font-bold tracking-tighter mb-2">Explore Sessions</h1>
            <p className="text-muted-foreground text-lg">Join a live session, review a past broadcast, or see what's scheduled.</p>
        </div>
        
        <div className="flex flex-col md:flex-row gap-4 mb-8">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input 
              placeholder="Search for a session by name..."
              className="pl-10 text-base"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Tabs value={currentTab} onValueChange={setCurrentTab} className="w-full md:w-auto">
              <TabsList className="grid w-full grid-cols-2 md:w-auto">
                  <TabsTrigger value="public"><Globe className="mr-2 h-4 w-4"/>Public</TabsTrigger>
                  {currentUser && <TabsTrigger value="my-sessions"><Lock className="mr-2 h-4 w-4"/>My Sessions</TabsTrigger>}
              </TabsList>
          </Tabs>
        </div>

        {renderRoomList(filteredChatRooms)}

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
            <AlertDialogAction onClick={handleDelete} disabled={isDeleting}>
              {isDeleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
