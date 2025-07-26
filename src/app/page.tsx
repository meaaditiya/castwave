"use client";

import { useState, useEffect } from 'react';
import { Header } from '@/components/Header';
import { ChatRoomCard } from '@/components/ChatRoomCard';
import { getChatRooms, ChatRoom, deleteChatRoom as deleteChatRoomService } from '@/services/chatRoomService';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

export default function Home() {
  const [chatRooms, setChatRooms] = useState<ChatRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const { currentUser, loading: authLoading } = useAuth();
  const [chatRoomToDelete, setChatRoomToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const timer = setTimeout(() => {
        const unsubscribe = getChatRooms((newChatRooms) => {
          setChatRooms(newChatRooms);
          setLoading(false);
        });
        return () => unsubscribe();
    }, 500);

    return () => clearTimeout(timer);
  }, []);
  
  const handleDelete = async () => {
    if (!chatRoomToDelete) return;

    setIsDeleting(true);
    try {
        await deleteChatRoomService(chatRoomToDelete);
        toast({
            title: 'Chat Room Deleted',
            description: 'The chat room has been successfully deleted.',
        });
    } catch (error) {
        console.error('Failed to delete chat room', error);
        toast({
            variant: 'destructive',
            title: 'Error',
            description: 'Failed to delete the chat room.',
        });
    } finally {
        setIsDeleting(false);
        setChatRoomToDelete(null);
    }
  };


  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 container py-8">
        <h1 className="text-4xl font-headline font-bold mb-2">Active Chat Rooms</h1>
        <p className="text-muted-foreground mb-8">Join a live session or review a past broadcast.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {loading || authLoading ? (
            Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-48 w-full" />
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            ))
          ) : (
            chatRooms.map(chatRoom => (
              <ChatRoomCard 
                key={chatRoom.id} 
                {...chatRoom} 
                isOwner={currentUser?.uid === chatRoom.hostId}
                onDelete={() => setChatRoomToDelete(chatRoom.id)}
                />
            ))
          )}
        </div>
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
