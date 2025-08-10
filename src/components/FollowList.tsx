
"use client";

import { useState, useEffect } from 'react';
import { UserProfileData, getFollowerProfiles, getFollowingProfiles, getMultipleFollowStatus, followUser, unfollowUser } from '@/services/userService';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Loader2, UserPlus, UserCheck } from 'lucide-react';
import { ScrollArea } from './ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';

interface FollowListProps {
    userId: string;
    type: 'followers' | 'following' | null;
    onClose: () => void;
    currentUserId?: string;
}

export function FollowList({ userId, type, onClose, currentUserId }: FollowListProps) {
    const [list, setList] = useState<UserProfileData[]>([]);
    const [loading, setLoading] = useState(false);
    const [followStatuses, setFollowStatuses] = useState<Record<string, boolean>>({});
    const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});
    const { toast } = useToast();
    const { currentUser } = useAuth();

    useEffect(() => {
        if (!type || !userId) {
            setList([]);
            return;
        }

        const fetchList = async () => {
            setLoading(true);
            try {
                const fetchedList = type === 'followers'
                    ? await getFollowerProfiles(userId)
                    : await getFollowingProfiles(userId);
                setList(fetchedList);

                if (currentUserId && fetchedList.length > 0) {
                    const userIds = fetchedList.map(u => u.uid).filter(uid => !!uid);
                    if (userIds.length > 0) {
                        const statuses = await getMultipleFollowStatus(currentUserId, userIds);
                        setFollowStatuses(statuses);
                    }
                }
            } catch (error) {
                console.error(`Failed to fetch ${type}`, error);
                toast({ variant: 'destructive', title: 'Error', description: `Could not load ${type} list.` });
            } finally {
                setLoading(false);
            }
        };

        fetchList();
    }, [userId, type, currentUserId, toast]);

    const handleFollowToggle = async (targetUserId: string) => {
        if (!currentUserId) return;
        setActionLoading(prev => ({ ...prev, [targetUserId]: true }));
        try {
            const isFollowing = followStatuses[targetUserId];
            if (isFollowing) {
                await unfollowUser(currentUserId, targetUserId);
                setFollowStatuses(prev => ({ ...prev, [targetUserId]: false }));
            } else {
                await followUser(currentUserId, targetUserId);
                setFollowStatuses(prev => ({ ...prev, [targetUserId]: true }));
            }
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Error', description: error.message });
        } finally {
            setActionLoading(prev => ({ ...prev, [targetUserId]: false }));
        }
    };

    const getInitials = (name: string) => {
        if (!name) return "..";
        const nameParts = name.split(' ');
        if (nameParts.length > 1) {
            return (nameParts[0][0] + nameParts[1][0]).toUpperCase();
        }
        return name.substring(0, 2).toUpperCase();
    }

    return (
        <Dialog open={!!type} onOpenChange={(isOpen) => !isOpen && onClose()}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle className="capitalize">{type}</DialogTitle>
                </DialogHeader>
                <ScrollArea className="h-72">
                    <div className="p-1">
                        {loading ? (
                            <div className="flex items-center justify-center h-full">
                                <Loader2 className="animate-spin" />
                            </div>
                        ) : list.length > 0 ? (
                            <div className="space-y-2">
                                {list.filter(user => user && user.uid).map(user => (
                                    <div key={user.uid} className="flex items-center gap-4 p-2 rounded-md hover:bg-muted/50">
                                        <Link href={user.uid === currentUser?.uid ? '/profile' : `/profile/${user.uid}`} onClick={onClose} className="flex items-center gap-3 flex-1">
                                            <Avatar>
                                                <AvatarImage src={user.photoURL} alt={user.username} />
                                                <AvatarFallback>{getInitials(user.username)}</AvatarFallback>
                                            </Avatar>
                                            <span className="font-medium hover:underline">{user.username}</span>
                                        </Link>
                                        {currentUserId && currentUserId !== user.uid && (
                                            <Button
                                                size="sm"
                                                variant={followStatuses[user.uid] ? 'secondary' : 'default'}
                                                onClick={() => handleFollowToggle(user.uid)}
                                                disabled={actionLoading[user.uid]}
                                            >
                                                {actionLoading[user.uid] ? (
                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                ) : followStatuses[user.uid] ? (
                                                    <>
                                                        <UserCheck className="mr-2 h-4 w-4"/> Following
                                                    </>
                                                ) : (
                                                    <>
                                                       <UserPlus className="mr-2 h-4 w-4"/> Follow
                                                    </>
                                                )}
                                            </Button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center text-muted-foreground pt-10">
                                No users to display.
                            </div>
                        )}
                    </div>
                </ScrollArea>
            </DialogContent>
        </Dialog>
    );
}
