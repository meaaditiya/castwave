
"use client";

import { Participant, updateParticipantStatus } from "@/services/chatRoomService";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Button } from "./ui/button";
import { ScrollArea } from "./ui/scroll-area";
import { Loader2, User, Check, X, Ban } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useState, useMemo } from "react";
import { useAuth } from "@/context/AuthContext";
import { Badge } from "./ui/badge";

interface ParticipantsListProps {
    chatRoomId: string;
    participants: Participant[];
    hostId: string;
}

export function ParticipantsList({ chatRoomId, participants, hostId }: ParticipantsListProps) {
    const { toast } = useToast();
    const [loadingStates, setLoadingStates] = useState<Record<string, boolean>>({});

    const sortedParticipants = useMemo(() => {
        const statusOrder = { 'approved': 1, 'pending': 2, 'denied': 3, 'removed': 4 };
        return [...participants] // Create a new array to avoid mutating the prop
            .sort((a, b) => {
                // Host first
                if (a.userId === hostId) return -1;
                if (b.userId === hostId) return 1;
                // Then by status
                const statusA = a.status || 'pending';
                const statusB = b.status || 'pending';
                if (statusOrder[statusA] !== statusOrder[statusB]) {
                    return statusOrder[statusA] - statusOrder[statusB];
                }
                // Then alphabetical
                if (a.displayName < b.displayName) return -1;
                if (a.displayName > b.displayName) return 1;
                return 0;
            });
    }, [participants, hostId]);

    const handleUpdateStatus = async (userId: string, newStatus: 'approved' | 'denied' | 'removed') => {
        setLoadingStates(prev => ({ ...prev, [userId]: true }));
        try {
            await updateParticipantStatus(chatRoomId, userId, newStatus);
            toast({ title: "Participant Updated" });
        } catch(e) {
            console.error(e);
            toast({ variant: 'destructive', title: "Error", description: `Failed to update participant.`});
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
    
    const getStatusBadge = (status: Participant['status']) => {
        switch(status) {
            case 'approved': return <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300">Approved</Badge>;
            case 'pending': return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300">Pending</Badge>;
            case 'denied': return <Badge variant="destructive">Denied</Badge>;
            case 'removed': return <Badge variant="destructive">Removed</Badge>;
            default: return null;
        }
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
        <ScrollArea className="h-64">
            <div className="space-y-0">
                {sortedParticipants.map(participant => (
                    <div key={participant.userId} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                        <Avatar className="h-8 w-8">
                            <AvatarImage src={participant.photoURL} alt={participant.displayName} />
                            <AvatarFallback>{getInitials(participant.displayName)}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                             <p className="font-medium text-sm truncate">{participant.displayName}</p>
                             {getStatusBadge(participant.status)}
                        </div>
                        {loadingStates[participant.userId] ? (
                            <Loader2 className="animate-spin h-5 w-5 text-muted-foreground" />
                        ) : (
                            participant.userId !== hostId && (
                                <div className="flex gap-1">
                                    {participant.status === 'pending' && (
                                        <>
                                            <Button size="icon" variant="ghost" className="h-8 w-8 text-green-600 hover:text-green-600 hover:bg-green-500/10" onClick={() => handleUpdateStatus(participant.userId, 'approved')}>
                                                <Check className="h-4 w-4" />
                                            </Button>
                                            <Button size="icon" variant="ghost" className="h-8 w-8 text-red-500 hover:text-red-500 hover:bg-red-500/10" onClick={() => handleUpdateStatus(participant.userId, 'denied')}>
                                                <X className="h-4 w-4" />
                                            </Button>
                                        </>
                                    )}
                                     {participant.status === 'approved' && (
                                        <Button size="icon" variant="ghost" className="h-8 w-8 text-red-500 hover:text-red-500 hover:bg-red-500/10" onClick={() => handleUpdateStatus(participant.userId, 'removed')}>
                                            <Ban className="h-4 w-4" />
                                        </Button>
                                    )}
                                </div>
                            )
                        )}
                    </div>
                ))}
            </div>
        </ScrollArea>
    )
}
