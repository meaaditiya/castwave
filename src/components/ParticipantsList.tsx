
"use client";

import { Participant, updateParticipantStatus } from "@/services/chatRoomService";
import { Avatar, AvatarFallback } from "./ui/avatar";
import { Button } from "./ui/button";
import { ScrollArea } from "./ui/scroll-area";
import { Badge } from "./ui/badge";
import { Check, Loader2, MinusCircle, User, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { Card, CardContent } from "./ui/card";

interface ParticipantsListProps {
    chatRoomId: string;
    participants: Participant[];
}

const statusOrder = ['pending', 'approved', 'denied', 'removed'];

const statusBadgeVariant = {
    pending: 'secondary',
    approved: 'default',
    denied: 'destructive',
    removed: 'destructive'
} as const;

export function ParticipantsList({ chatRoomId, participants }: ParticipantsListProps) {
    const { toast } = useToast();
    const [loadingStates, setLoadingStates] = useState<Record<string, boolean>>({});

    const sortedParticipants = [...participants].sort((a, b) => {
        return statusOrder.indexOf(a.status) - statusOrder.indexOf(b.status);
    });

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

    if (participants.length === 0) {
        return (
             <div className="text-center text-muted-foreground p-4 flex flex-col items-center justify-center h-full">
                <User className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <p className="font-medium">No participants yet</p>
                <p className="text-sm">Users who join will appear here.</p>
            </div>
        )
    }

    return (
        <ScrollArea className="h-full p-1 sm:p-4">
            <div className="space-y-2">
                {sortedParticipants.map(participant => (
                    <div key={participant.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                        <Avatar>
                            <AvatarFallback>{participant.displayName.substring(0,1)}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                            <p className="font-medium text-sm truncate">{participant.displayName}</p>
                            <Badge variant={statusBadgeVariant[participant.status]} className="capitalize mt-1 text-xs px-1.5 py-0">{participant.status}</Badge>
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
                                     <Button size="icon" variant="ghost" className="h-8 w-8 text-red-500 hover:text-red-500 hover:bg-red-500/10" onClick={() => handleUpdateStatus(participant.userId, 'removed')}>
                                        <MinusCircle className="h-4 w-4" />
                                    </Button>
                                )}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </ScrollArea>
    )
}
