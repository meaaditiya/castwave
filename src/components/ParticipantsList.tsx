
"use client";

import { Participant, updateParticipantStatus } from "@/services/chatRoomService";
import { Avatar, AvatarFallback } from "./ui/avatar";
import { Button } from "./ui/button";
import { ScrollArea } from "./ui/scroll-area";
import { Badge } from "./ui/badge";
import { Check, Loader2, Mic, MicOff, MinusCircle, User, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useState, useMemo } from "react";

interface ParticipantsListProps {
    chatRoomId: string;
    participants: Participant[];
}

const statusBadgeVariant = {
    pending: 'secondary',
    approved: 'default',
    denied: 'destructive',
    removed: 'destructive',
    speaker: 'default'
} as const;


export function ParticipantsList({ chatRoomId, participants }: ParticipantsListProps) {
    const { toast } = useToast();
    const [loadingStates, setLoadingStates] = useState<Record<string, boolean>>({});

    const activeParticipants = useMemo(() => {
        return participants
            .filter(p => p.status !== 'removed' && p.status !== 'denied')
            .sort((a, b) => {
                // Speakers first
                if (a.status === 'speaker' && b.status !== 'speaker') return -1;
                if (b.status === 'speaker' && a.status !== 'speaker') return 1;
                // Then pending
                if (a.status === 'pending' && b.status !== 'pending') return -1;
                if (b.status === 'pending' && a.status !== 'pending') return 1;
                // Then alphabetical
                if (a.displayName < b.displayName) return -1;
                if (a.displayName > b.displayName) return 1;
                return 0;
            });
    }, [participants]);

    const handleUpdateStatus = async (userId: string, status: Participant['status']) => {
        setLoadingStates(prev => ({ ...prev, [userId]: true }));
        try {
            await updateParticipantStatus(chatRoomId, userId, status);
        } catch(e) {
            console.error(e);
            toast({ variant: 'destructive', title: "Error", description: `Failed to update status for user ${userId}`});
        } finally {
            setLoadingStates(prev => ({ ...prev, [userId]: false }));
        }
    }

    if (activeParticipants.length === 0) {
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
                {activeParticipants.map(participant => (
                    <div key={participant.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                        <Avatar className="h-8 w-8">
                            <AvatarFallback>{participant.displayName.substring(0,1).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                            <p className="font-medium text-sm truncate">{participant.displayName}</p>
                            <Badge variant={participant.status === 'speaker' ? 'default' : statusBadgeVariant[participant.status]} className="capitalize mt-1 text-xs px-1.5 py-0.5">
                               {participant.status === 'speaker' && <Mic className="h-3 w-3 mr-1"/>}
                               {participant.status}
                            </Badge>
                        </div>
                        {loadingStates[participant.userId] ? (
                            <Loader2 className="animate-spin h-5 w-5 text-muted-foreground" />
                        ) : (
                            <div className="flex gap-1">
                                {participant.status === 'pending' && (
                                    <>
                                        <Button size="icon" variant="ghost" className="h-8 w-8 text-green-500 hover:text-green-500 hover:bg-green-500/10" onClick={() => handleUpdateStatus(participant.userId, 'approved')}>
                                            <Check className="h-4 w-4"/>
                                        </Button>
                                        <Button size="icon" variant="ghost" className="h-8 w-8 text-red-500 hover:text-red-500 hover:bg-red-500/10" onClick={() => handleUpdateStatus(participant.userId, 'denied')}>
                                            <X className="h-4 w-4"/>
                                        </Button>
                                    </>
                                )}
                                {participant.status === 'approved' && (
                                    <>
                                        <Button size="icon" variant="ghost" className="h-8 w-8 text-primary hover:text-primary hover:bg-primary/10" onClick={() => handleUpdateStatus(participant.userId, 'speaker')}>
                                            <Mic className="h-4 w-4"/>
                                        </Button>
                                        <Button size="icon" variant="ghost" className="h-8 w-8 text-red-500 hover:text-red-500 hover:bg-red-500/10" onClick={() => handleUpdateStatus(participant.userId, 'removed')}>
                                            <MinusCircle className="h-4 w-4" />
                                        </Button>
                                    </>
                                )}
                                 {participant.status === 'speaker' && (
                                     <>
                                        <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10" onClick={() => handleUpdateStatus(participant.userId, 'approved')}>
                                            <MicOff className="h-4 w-4"/>
                                        </Button>
                                        <Button size="icon" variant="ghost" className="h-8 w-8 text-red-500 hover:text-red-500 hover:bg-red-500/10" onClick={() => handleUpdateStatus(participant.userId, 'removed')}>
                                            <MinusCircle className="h-4 w-4" />
                                        </Button>
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </ScrollArea>
    )
}
