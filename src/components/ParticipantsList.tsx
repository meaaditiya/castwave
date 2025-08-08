
"use client";

import { Participant, removeParticipant } from "@/services/chatRoomService";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Button } from "./ui/button";
import { ScrollArea } from "./ui/scroll-area";
import { Loader2, MinusCircle, User } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useState, useMemo } from "react";
import { useAuth } from "@/context/AuthContext";

interface ParticipantsListProps {
    chatRoomId: string;
    participants: Participant[];
    isHost: boolean;
}

export function ParticipantsList({ chatRoomId, participants, isHost }: ParticipantsListProps) {
    const { toast } = useToast();
    const { currentUser } = useAuth();
    const [loadingStates, setLoadingStates] = useState<Record<string, boolean>>({});

    const sortedParticipants = useMemo(() => {
        return participants
            .sort((a, b) => {
                // Host first
                if (a.userId === chatRoomId) return -1;
                if (b.userId === chatRoomId) return 1;
                // Then alphabetical
                if (a.displayName < b.displayName) return -1;
                if (a.displayName > b.displayName) return 1;
                return 0;
            });
    }, [participants, chatRoomId]);

    const handleRemoveParticipant = async (userId: string) => {
        setLoadingStates(prev => ({ ...prev, [userId]: true }));
        try {
            await removeParticipant(chatRoomId, userId);
            toast({ title: "Participant Removed" });
        } catch(e) {
            console.error(e);
            toast({ variant: 'destructive', title: "Error", description: `Failed to remove participant.`});
        } finally {
            setLoadingStates(prev => ({ ...prev, [userId]: false }));
        }
    }
    
    const getInitials = (name: string) => {
        if (!name) return "..";
        const nameParts = name.split(' ');
        if (nameParts.length > 1) {
            return (nameParts[0][0] + nameParts[1][0]).toUpperCase();
        }
        return name.substring(0, 2).toUpperCase();
    }

    if (sortedParticipants.length === 0) {
        return (
             <div className="text-center text-muted-foreground p-4 flex flex-col items-center justify-center h-full">
                <User className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <p className="font-medium">No participants yet</p>
                <p className="text-sm">Users who join will appear here.</p>
            </div>
        )
    }

    return (
        <ScrollArea className="h-48">
            <div className="space-y-0">
                {sortedParticipants.map(participant => (
                    <div key={participant.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                        <Avatar className="h-8 w-8">
                            <AvatarImage src={participant.photoURL} alt={participant.displayName} />
                            <AvatarFallback>{getInitials(participant.displayName)}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                            <div className="flex items-center gap-1.5">
                                <p className="font-medium text-sm truncate">{participant.displayName}</p>
                            </div>
                        </div>
                        {loadingStates[participant.userId] ? (
                            <Loader2 className="animate-spin h-5 w-5 text-muted-foreground" />
                        ) : (
                            isHost && currentUser && currentUser.uid !== participant.userId && (
                                <div className="flex gap-1">
                                    <Button size="icon" variant="ghost" className="h-8 w-8 text-red-500 hover:text-red-500 hover:bg-red-500/10" onClick={() => handleRemoveParticipant(participant.userId)}>
                                        <MinusCircle className="h-4 w-4" />
                                    </Button>
                                </div>
                            )
                        )}
                    </div>
                ))}
            </div>
        </ScrollArea>
    )
}
