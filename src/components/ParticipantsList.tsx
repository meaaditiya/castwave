"use client";

import { Participant, updateParticipantStatus } from "@/services/chatRoomService";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Button } from "./ui/button";
import { ScrollArea } from "./ui/scroll-area";
import { Loader2, User, Check, X, Ban, UserCheck, ShieldX } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useState, useMemo } from "react";
import { useAuth } from "@/context/AuthContext";
import { Badge } from "./ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "./ui/alert-dialog";
import { writeBatch, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";

interface ParticipantsListProps {
    chatRoomId: string;
    participants: Participant[];
    hostId: string;
}

export function ParticipantsList({ chatRoomId, participants, hostId }: ParticipantsListProps) {
    const { toast } = useToast();
    const [loadingStates, setLoadingStates] = useState<Record<string, boolean>>({});
    const [isBulkUpdating, setIsBulkUpdating] = useState(false);

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

    const handleBulkUpdate = async (type: 'approveAll' | 'removeAll') => {
        setIsBulkUpdating(true);
        try {
            const batch = writeBatch(db);
            let action: 'approved' | 'removed' | null = null;
            let participantsToUpdate: Participant[] = [];

            if (type === 'approveAll') {
                action = 'approved';
                participantsToUpdate = participants.filter(p => p.status === 'pending');
            } else if (type === 'removeAll') {
                action = 'removed';
                participantsToUpdate = participants.filter(p => p.status === 'approved' && p.userId !== hostId);
            }
            
            if (!action || participantsToUpdate.length === 0) {
                 toast({ title: "No Action Needed", description: "There are no participants to update for this action." });
                 setIsBulkUpdating(false);
                 return;
            }
            
            participantsToUpdate.forEach(p => {
                 if (p.id) {
                    const participantRef = doc(db, 'chatRooms', chatRoomId, 'participants', p.id);
                    batch.update(participantRef, { status: action });
                 }
            });

            await batch.commit();
            toast({ title: "Bulk Update Successful", description: `${participantsToUpdate.length} participants have been updated.` });

        } catch (e) {
            console.error(e);
            toast({ variant: 'destructive', title: "Error", description: "Failed to perform bulk update."});
        } finally {
            setIsBulkUpdating(false);
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

    const visibleParticipants = useMemo(() => {
        const statusOrder = { 'pending': 1, 'approved': 2, 'denied': 3, 'removed': 4 };
        return [...participants]
            .filter(p => p.status !== 'removed' && p.status !== 'denied')
            .sort((a, b) => {
                if (a.userId === hostId) return -1;
                if (b.userId === hostId) return 1;
                const statusA = a.status || 'pending';
                const statusB = b.status || 'pending';
                if (statusOrder[statusA] !== statusOrder[statusB]) {
                    return statusOrder[statusA] - statusOrder[statusB];
                }
                if (a.displayName < b.displayName) return -1;
                if (a.displayName > b.displayName) return 1;
                return 0;
            });
    }, [participants, hostId]);
    
    const pendingCount = participants.filter(p => p.status === 'pending').length;
    const approvedCount = participants.filter(p => p.status === 'approved' && p.userId !== hostId).length;


    if (visibleParticipants.length <= 1 && pendingCount === 0) {
        return (
             <div className="text-center text-muted-foreground p-4 flex flex-col items-center justify-center h-full min-h-[10rem]">
                <User className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <p className="font-medium">No other participants</p>
                <p className="text-sm">Users who join will appear here.</p>
            </div>
        )
    }

    return (
        <div>
            <div className="px-2 pb-2 flex gap-2">
                 <AlertDialog>
                    <AlertDialogTrigger asChild>
                         <Button size="sm" variant="outline" className="flex-1" disabled={pendingCount === 0 || isBulkUpdating}>
                            {isBulkUpdating ? <Loader2 className="animate-spin" /> : <UserCheck className="mr-2 h-4 w-4" />}
                            Allow All ({pendingCount})
                        </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Allow All Pending Users?</AlertDialogTitle>
                            <AlertDialogDescription>
                                This will approve all {pendingCount} users currently waiting to join. Are you sure?
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleBulkUpdate('approveAll')}>Approve All</AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
                <AlertDialog>
                    <AlertDialogTrigger asChild>
                       <Button size="sm" variant="destructive" className="flex-1" disabled={approvedCount === 0 || isBulkUpdating}>
                           {isBulkUpdating ? <Loader2 className="animate-spin" /> : <ShieldX className="mr-2 h-4 w-4" />}
                            Remove All ({approvedCount})
                        </Button>
                    </AlertDialogTrigger>
                     <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Remove All Approved Users?</AlertDialogTitle>
                            <AlertDialogDescription>
                                This will remove all {approvedCount} approved participants (except you, the host) from the chat. They will have to request to join again.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleBulkUpdate('removeAll')} className="bg-destructive hover:bg-destructive/90">Remove All</AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </div>
            <ScrollArea className="h-64">
                <div className="space-y-0">
                    {visibleParticipants.map(participant => (
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
        </div>
    )
}
