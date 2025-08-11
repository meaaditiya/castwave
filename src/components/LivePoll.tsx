
"use client";

import { useState, useEffect } from 'react';
import * as z from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createPoll, voteOnPoll, endPoll, Poll, PollOption } from '@/services/pollService';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from '@/components/ui/dialog';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Loader2, Plus, Trash2, Eye, EyeOff, TimerOff } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { Badge } from './ui/badge';
import { cn } from '@/lib/utils';


interface LivePollProps {
    chatRoomId: string;
    isHost: boolean;
    currentUserId: string;
    activePoll: Poll | null;
    renderNoPollContent: () => React.ReactNode;
}

const pollFormSchema = z.object({
  question: z.string().min(5, 'Question must be at least 5 characters.'),
  options: z.array(z.string().min(1, "Option text can't be empty.")).min(2, 'You need at least 2 options.'),
  duration: z.coerce.number().min(10, 'Duration must be at least 10 seconds.').max(300, 'Duration cannot exceed 300 seconds.'),
  showResults: z.boolean().default(true),
});

export function LivePoll({ chatRoomId, isHost, currentUserId, activePoll, renderNoPollContent }: LivePollProps) {
    const [isCreating, setIsCreating] = useState(false);
    const [isVoting, setIsVoting] = useState(false);
    const [timeLeft, setTimeLeft] = useState(0);
    const { toast } = useToast();
    const [isCreatePollOpen, setIsCreatePollOpen] = useState(false);

    const form = useForm<z.infer<typeof pollFormSchema>>({
        resolver: zodResolver(pollFormSchema),
        defaultValues: {
            question: '',
            options: ['', ''],
            duration: 60,
            showResults: true,
        },
    });

    useEffect(() => {
        if (activePoll && activePoll.endsAt) {
            const interval = setInterval(() => {
                const now = new Date().getTime();
                const ends = activePoll.endsAt.toDate().getTime();
                const remaining = Math.max(0, ends - now);
                setTimeLeft(remaining / 1000);
                 if (remaining <= 0) {
                    clearInterval(interval);
                }
            }, 1000);
            return () => clearInterval(interval);
        }
    }, [activePoll]);

    const handleCreatePoll = async (values: z.infer<typeof pollFormSchema>) => {
        setIsCreating(true);
        try {
            await createPoll(chatRoomId, values.question, values.options, values.duration, values.showResults);
            toast({ title: 'Poll Created', description: 'The poll is now live for participants.' });
            form.reset();
            setIsCreatePollOpen(false);
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Error', description: error.message });
        } finally {
            setIsCreating(false);
        }
    };
    
    const handleVote = async (optionIndex: number) => {
        if (!activePoll || !activePoll.id) return;
        setIsVoting(true);
        try {
            await voteOnPoll(chatRoomId, activePoll.id, currentUserId, optionIndex);
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Error', description: error.message });
        } finally {
            setIsVoting(false);
        }
    };

    const handleEndPoll = async () => {
        if (!activePoll?.id) return;
        await endPoll(chatRoomId, activePoll.id);
    }
    
    if (!activePoll) {
        if (isHost) {
            return (
                <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
                    {renderNoPollContent()}
                    <Dialog open={isCreatePollOpen} onOpenChange={setIsCreatePollOpen}>
                        <DialogTrigger asChild><Button variant="outline" className="mt-4"><Plus className="mr-2" /> Create Poll</Button></DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Create New Poll</DialogTitle>
                                <DialogDescription>Ask a question and see results in real-time.</DialogDescription>
                            </DialogHeader>
                            <Form {...form}>
                                <form onSubmit={form.handleSubmit(handleCreatePoll)} className="space-y-4">
                                    <FormField control={form.control} name="question" render={({ field }) => (
                                        <FormItem><FormLabel>Question</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                                    )} />
                                    <div>
                                        <FormLabel>Options</FormLabel>
                                        <div className="space-y-2 mt-2">
                                        {form.getValues('options').map((_, index) => (
                                            <FormField key={index} control={form.control} name={`options.${index}`} render={({ field }) => (
                                                <FormItem><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                                            )}/>
                                        ))}
                                        </div>
                                    </div>
                                    <FormField control={form.control} name="duration" render={({ field }) => (
                                        <FormItem><FormLabel>Duration (seconds)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                                    )}/>
                                     <FormField control={form.control} name="showResults" render={({ field }) => (
                                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                                            <div className="space-y-0.5">
                                                <FormLabel>Show Results Live</FormLabel>
                                                <FormDescription>Allow participants to see results as they vote.</FormDescription>
                                            </div>
                                            <FormControl><Switch checked={field.value} onCheckedChange={field.onChange}/></FormControl>
                                        </FormItem>
                                    )}/>
                                    <DialogFooter>
                                        <DialogClose asChild><Button variant="ghost">Cancel</Button></DialogClose>
                                        <Button type="submit" disabled={isCreating}>{isCreating && <Loader2 className="animate-spin mr-2"/>} Create Poll</Button>
                                    </DialogFooter>
                                </form>
                            </Form>
                        </DialogContent>
                    </Dialog>
                </div>
            );
        }
        return renderNoPollContent();
    }
    
    const totalVotes = activePoll.options.reduce((sum, opt) => sum + opt.votes, 0);
    const userHasVoted = activePoll.voters && activePoll.voters[currentUserId] !== undefined;
    const canSeeResults = isHost || activePoll.showResults || timeLeft <= 0 || userHasVoted;

    return (
        <div className="w-full">
            <CardHeader className="p-0 mb-4">
                 <div className="flex justify-between items-start">
                    <div>
                        <CardTitle className="flex items-center gap-2 text-xl">Poll</CardTitle>
                        <CardDescription className="mt-1 text-lg">{activePoll.question}</CardDescription>
                    </div>
                    {timeLeft > 0 && <Badge variant={'secondary'} className="text-base">{Math.ceil(timeLeft)}s</Badge>}
                </div>
            </CardHeader>
             <CardContent className="space-y-3 p-0">
                {activePoll.options.map((option, index) => (
                    <div key={index}>
                        {canSeeResults && (
                            <div className="text-sm flex justify-between mb-1">
                                <span className="font-medium">{option.text}</span>
                                <span className="text-muted-foreground">{((option.votes / totalVotes) * 100 || 0).toFixed(0)}%</span>
                            </div>
                        )}
                        <button
                            className={cn(
                                "w-full rounded-md border p-3 text-left transition-all disabled:opacity-50 relative overflow-hidden",
                                "hover:bg-accent focus:bg-accent",
                                userHasVoted && activePoll.voters[currentUserId] === index && "border-primary ring-2 ring-primary",
                                !canSeeResults && "flex justify-center"
                            )}
                            onClick={() => handleVote(index)}
                            disabled={isVoting || userHasVoted || timeLeft <= 0}
                        >
                            {canSeeResults &&
                                <Progress value={(option.votes / totalVotes) * 100 || 0} className="absolute h-full left-0 top-0 -z-10 bg-accent rounded-md" />
                            }
                           {!canSeeResults ? option.text : null}
                           {canSeeResults && <span className="relative z-10 font-medium">{option.text}</span>}
                        </button>
                    </div>
                ))}
            </CardContent>
            {isHost && (
                <CardFooter className="flex justify-end gap-2 p-0 pt-4">
                     <Button variant="ghost" disabled><Eye className="mr-2"/>{totalVotes} Votes</Button>
                     <Button variant="destructive" onClick={handleEndPoll}><TimerOff className="mr-2" /> End Poll</Button>
                </CardFooter>
            )}
        </div>
    );
}
