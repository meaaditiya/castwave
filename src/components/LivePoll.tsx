
"use client";

import { useState, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import * as z from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { createPoll, getActivePoll, voteOnPoll, endPoll, togglePollResultsVisibility, Poll, PollOption } from '@/services/pollService';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Loader2, Plus, Trash2, Vote, Eye, EyeOff, TimerOff } from 'lucide-react';
import { Progress } from './ui/progress';
import { useToast } from '@/hooks/use-toast';
import { Badge } from './ui/badge';

interface LivePollProps {
    chatRoomId: string;
    isHost: boolean;
    currentUserId: string;
}

const pollFormSchema = z.object({
    question: z.string().min(5, 'Question must be at least 5 characters.'),
    options: z.array(z.object({ text: z.string().min(1, 'Option cannot be empty.') })).min(2, 'You need at least two options.'),
    duration: z.coerce.number().min(1, 'Duration must be at least 1 minute.').max(120, 'Duration cannot exceed 120 minutes.'),
});

export function LivePoll({ chatRoomId, isHost, currentUserId }: LivePollProps) {
    const [activePoll, setActivePoll] = useState<Poll | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isCreating, setIsCreating] = useState(false);
    const [isVoting, setIsVoting] = useState(false);
    const [userVote, setUserVote] = useState<string | null>(null);
    const [timeLeft, setTimeLeft] = useState<string>('');
    const { toast } = useToast();

    const form = useForm<z.infer<typeof pollFormSchema>>({
        resolver: zodResolver(pollFormSchema),
        defaultValues: {
            question: '',
            options: [{ text: '' }, { text: '' }],
            duration: 10,
        },
    });

    const { fields, append, remove } = useFieldArray({
        control: form.control,
        name: "options",
    });

    useEffect(() => {
        setIsLoading(true);
        const unsubscribe = getActivePoll(chatRoomId, (poll) => {
            setActivePoll(poll);
            if (poll && poll.voters && poll.voters[currentUserId]) {
                setUserVote(poll.voters[currentUserId]);
            } else {
                setUserVote(null);
            }
            setIsLoading(false);
        });
        return () => unsubscribe();
    }, [chatRoomId, currentUserId]);

    useEffect(() => {
        if (activePoll && activePoll.endsAt) {
            const interval = setInterval(() => {
                const now = new Date();
                const endsAt = activePoll.endsAt.toDate();
                const diff = endsAt.getTime() - now.getTime();

                if (diff <= 0) {
                    setTimeLeft('Poll ended');
                    clearInterval(interval);
                } else {
                    const minutes = Math.floor((diff / 1000 / 60) % 60);
                    const seconds = Math.floor((diff / 1000) % 60);
                    setTimeLeft(`${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')} left`);
                }
            }, 1000);
            return () => clearInterval(interval);
        }
    }, [activePoll]);


    const handleCreatePoll = async (values: z.infer<typeof pollFormSchema>) => {
        setIsCreating(true);
        try {
            await createPoll(chatRoomId, {
                question: values.question,
                options: values.options,
                durationMinutes: values.duration,
            });
            toast({ title: 'Poll Created', description: 'The live poll has started.' });
            form.reset();
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Error', description: error.message });
        } finally {
            setIsCreating(false);
        }
    };
    
    const handleVote = async (optionId: string) => {
        if (!activePoll || !activePoll.id) return;
        setIsVoting(true);
        try {
            await voteOnPoll(chatRoomId, activePoll.id, optionId, currentUserId);
            toast({ title: 'Vote Cast!', description: 'Your vote has been recorded.' });
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Error', description: error.message });
        } finally {
            setIsVoting(false);
        }
    };
    
    const handleEndPoll = async () => {
        if (!activePoll || !activePoll.id) return;
        try {
            await endPoll(chatRoomId, activePoll.id);
            toast({ title: 'Poll Ended', description: 'The poll has been closed.' });
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Error', description: error.message });
        }
    };

    const handleToggleVisibility = async () => {
        if (!activePoll || !activePoll.id) return;
        try {
            await togglePollResultsVisibility(chatRoomId, activePoll.id, !activePoll.resultsVisible);
            toast({ title: 'Visibility Updated' });
        } catch(e) {
            console.error(e);
        }
    }

    if (isLoading) {
        return (
            <Card>
                <CardContent className="p-6 flex items-center justify-center h-48">
                    <Loader2 className="animate-spin text-primary" />
                </CardContent>
            </Card>
        );
    }

    if (!activePoll) {
        if (isHost) {
            return (
                <Dialog>
                    <DialogTrigger asChild>
                        <Button variant="outline" className="w-full">
                            <Plus className="mr-2" /> Create a Poll
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Create a New Poll</DialogTitle>
                            <DialogDescription>
                                Engage your audience with a live poll.
                            </DialogDescription>
                        </DialogHeader>
                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(handleCreatePoll)} className="space-y-4">
                                <FormField control={form.control} name="question" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Poll Question</FormLabel>
                                        <FormControl><Input {...field} placeholder="e.g., What should we discuss next?" /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                                <div>
                                    <FormLabel>Options</FormLabel>
                                    <div className="space-y-2 mt-2">
                                    {fields.map((field, index) => (
                                        <FormField key={field.id} control={form.control} name={`options.${index}.text`} render={({ field }) => (
                                            <FormItem>
                                                <div className="flex items-center gap-2">
                                                    <FormControl><Input {...field} placeholder={`Option ${index + 1}`} /></FormControl>
                                                    <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)} disabled={fields.length <= 2}>
                                                        <Trash2 className="text-destructive h-4 w-4" />
                                                    </Button>
                                                </div>
                                                <FormMessage />
                                            </FormItem>
                                        )} />
                                    ))}
                                    </div>
                                    <Button type="button" variant="outline" size="sm" onClick={() => append({ text: '' })} className="mt-2">
                                        <Plus className="mr-2 h-4 w-4" /> Add Option
                                    </Button>
                                </div>
                                <FormField control={form.control} name="duration" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Duration (in minutes)</FormLabel>
                                        <FormControl><Input type="number" {...field} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                                <DialogFooter>
                                    <DialogClose asChild><Button variant="ghost">Cancel</Button></DialogClose>
                                    <Button type="submit" disabled={isCreating}>
                                        {isCreating && <Loader2 className="animate-spin mr-2" />} Start Poll
                                    </Button>
                                </DialogFooter>
                            </form>
                        </Form>
                    </DialogContent>
                </Dialog>
            );
        }
        return null;
    }

    const totalVotes = activePoll.options.reduce((sum, option) => sum + option.votes, 0);

    return (
        <Card className="shadow-lg">
            <CardHeader>
                <div className="flex justify-between items-start">
                    <div>
                        <CardTitle className="flex items-center gap-2">
                            <Vote /> Live Poll
                        </CardTitle>
                        <CardDescription className="mt-1">{activePoll.question}</CardDescription>
                    </div>
                    <Badge variant={activePoll.isActive ? 'default' : 'secondary'}>
                        {activePoll.isActive ? timeLeft : 'Poll Ended'}
                    </Badge>
                </div>
            </CardHeader>
            <CardContent>
                <div className="space-y-3">
                    {activePoll.options.map((option) => {
                        const percentage = totalVotes > 0 ? (option.votes / totalVotes) * 100 : 0;
                        const showResults = !activePoll.isActive || activePoll.resultsVisible || userVote || isHost;
                        return (
                            <div key={option.id}>
                                {userVote || !activePoll.isActive || isHost ? (
                                    <div className="space-y-1">
                                        <div className="flex justify-between text-sm font-medium">
                                            <p>{option.text} {userVote === option.id && <span className="text-primary font-bold ml-2">(Your Vote)</span>}</p>
                                            {showResults && <p>{Math.round(percentage)}% ({option.votes})</p>}
                                        </div>
                                        {showResults && <Progress value={percentage} />}
                                    </div>
                                ) : (
                                    <Button
                                        variant="outline"
                                        className="w-full justify-start"
                                        onClick={() => handleVote(option.id)}
                                        disabled={isVoting}
                                    >
                                        {isVoting && <Loader2 className="animate-spin mr-2" />}
                                        {option.text}
                                    </Button>
                                )}
                            </div>
                        )
                    })}
                </div>
            </CardContent>
            {isHost && activePoll.isActive && (
                <CardFooter className="flex justify-end gap-2 border-t pt-4">
                     <Button variant="ghost" onClick={handleToggleVisibility}>
                        {activePoll.resultsVisible ? <EyeOff className="mr-2" /> : <Eye className="mr-2" />}
                        {activePoll.resultsVisible ? 'Hide Results' : 'Show Results'}
                    </Button>
                    <Button variant="destructive" onClick={handleEndPoll}>
                        <TimerOff className="mr-2" /> End Poll
                    </Button>
                </CardFooter>
            )}
        </Card>
    );
}
