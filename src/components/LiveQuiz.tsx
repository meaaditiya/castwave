
"use client";

import { useState, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import * as z from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { createQuiz, answerQuizQuestion, nextQuizQuestion, endQuiz, Quiz } from '@/services/pollService';
import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Loader2, Plus, Trash2, Trophy, Eye, EyeOff, TimerOff, ArrowRight, CheckCircle, XCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Badge } from './ui/badge';
import { ScrollArea } from './ui/scroll-area';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Participant } from '@/services/chatRoomService';

interface LiveQuizProps {
    chatRoomId: string;
    isHost: boolean;
    currentUserId: string;
    participants: Participant[];
    activeQuiz: Quiz | null;
    renderNoQuizContent: () => React.ReactNode;
}

const quizFormSchema = z.object({
    questions: z.array(z.object({
        question: z.string().min(5, 'Question must be at least 5 characters.'),
        options: z.array(z.object({ text: z.string().min(1, 'Option cannot be empty.') })).min(2, "At least 2 options").max(4, "Max 4 options"),
        correctOption: z.coerce.number().min(0).max(3),
        timeLimit: z.coerce.number().min(5, 'Min 5 seconds').max(120, 'Max 120 seconds'),
    })).min(1, 'You need at least one question.'),
});

const getInitials = (name: string) => {
    if (!name) return "..";
    const nameParts = name.split(' ');
    if (nameParts.length > 1) {
        return (nameParts[0][0] + nameParts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
}

export function LiveQuiz({ chatRoomId, isHost, currentUserId, participants, activeQuiz, renderNoQuizContent }: LiveQuizProps) {
    const [isCreating, setIsCreating] = useState(false);
    const [isAnswering, setIsAnswering] = useState(false);
    const [timeLeft, setTimeLeft] = useState(0);
    const { toast } = useToast();
    const [isCreateQuizOpen, setIsCreateQuizOpen] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);

    const form = useForm<z.infer<typeof quizFormSchema>>({
        resolver: zodResolver(quizFormSchema),
        defaultValues: {
            questions: [{ question: '', options: [{ text: '' }, { text: '' }], correctOption: 0, timeLimit: 30 }],
        },
    });

    const { fields, append, remove } = useFieldArray({
        control: form.control,
        name: "questions",
    });

    useEffect(() => {
        if (activeQuiz?.currentQuestionStartTime && activeQuiz.currentQuestion) {
            const interval = setInterval(() => {
                const startTime = activeQuiz.currentQuestionStartTime.toDate();
                const now = new Date();
                const elapsed = (now.getTime() - startTime.getTime()) / 1000;
                const remaining = Math.max(0, activeQuiz.currentQuestion.timeLimit - elapsed);
                setTimeLeft(Math.round(remaining));

                if (remaining <= 0) {
                    clearInterval(interval);
                }
            }, 1000);
            return () => clearInterval(interval);
        }
    }, [activeQuiz]);

    const handleCreateQuiz = async (values: z.infer<typeof quizFormSchema>) => {
        setIsCreating(true);
        try {
            await createQuiz(chatRoomId, values.questions);
            toast({ title: 'Quiz Created', description: 'The quiz is ready to be started.' });
            form.reset();
            setIsCreateQuizOpen(false);
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Error', description: error.message });
        } finally {
            setIsCreating(false);
        }
    };

    const handleAnswer = async (optionIndex: number) => {
        if (!activeQuiz || !activeQuiz.id || !activeQuiz.currentQuestion) return;
        setIsAnswering(true);
        try {
            await answerQuizQuestion(chatRoomId, currentUserId, optionIndex, timeLeft);
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Error', description: error.message });
        } finally {
            setIsAnswering(false);
        }
    };

    const handleNextQuestion = async () => {
        if (!activeQuiz?.id) return;
        setIsProcessing(true);
        try {
           await nextQuizQuestion(chatRoomId);
        } finally {
           setIsProcessing(false);
        }
    };
    
    const handleEndQuiz = async () => {
        if (!activeQuiz?.id) return;
        setIsProcessing(true);
        try {
            await endQuiz(chatRoomId, true); // end and show final results
        } finally {
            setIsProcessing(false);
        }
    }

    const handleClearQuiz = async () => {
         if (!activeQuiz?.id) return;
        setIsProcessing(true);
        try {
            await endQuiz(chatRoomId, false); // clear quiz
        } finally {
            setIsProcessing(false);
        }
    }
    
    if (!activeQuiz) {
        if (isHost) {
            return (
                <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
                    {renderNoQuizContent()}
                    <Dialog open={isCreateQuizOpen} onOpenChange={setIsCreateQuizOpen}>
                        <DialogTrigger asChild><Button variant="outline" className="mt-4"><Plus className="mr-2" /> Create Quiz</Button></DialogTrigger>
                        <DialogContent className="max-w-2xl">
                            <DialogHeader><DialogTitle>Create New Quiz</DialogTitle><DialogDescription>Build a list of questions for your session.</DialogDescription></DialogHeader>
                            <Form {...form}>
                                <form onSubmit={form.handleSubmit(handleCreateQuiz)} className="space-y-4">
                                    <ScrollArea className="h-96 pr-4">
                                        <div className="space-y-6">
                                            {fields.map((questionField, qIndex) => (
                                                <Card key={questionField.id} className="p-4">
                                                    <div className="flex justify-between items-center mb-2">
                                                        <h4 className="font-semibold">Question {qIndex + 1}</h4>
                                                        <Button type="button" size="icon" variant="ghost" onClick={() => remove(qIndex)}><Trash2 className="text-destructive h-4 w-4" /></Button>
                                                    </div>
                                                    <FormField control={form.control} name={`questions.${qIndex}.question`} render={({ field }) => (
                                                        <FormItem><FormLabel>Question Text</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                                                    )} />
                                                    <FormField control={form.control} name={`questions.${qIndex}.options`} render={() => (
                                                        <FormItem className="mt-2"><FormLabel>Options</FormLabel>
                                                          <div className="space-y-2">
                                                            <FieldArrayOptions qIndex={qIndex} form={form} />
                                                          </div>
                                                        <FormMessage /></FormItem>
                                                    )} />
                                                    <FormField control={form.control} name={`questions.${qIndex}.correctOption`} render={({ field }) => (
                                                         <FormItem className="mt-2"><FormLabel>Correct Option (0-based index)</FormLabel><FormControl><Input type="number" min="0" max="3" {...field} /></FormControl><FormMessage /></FormItem>
                                                    )}/>
                                                     <FormField control={form.control} name={`questions.${qIndex}.timeLimit`} render={({ field }) => (
                                                         <FormItem className="mt-2"><FormLabel>Time Limit (seconds)</FormLabel><FormControl><Input type="number" min="5" max="120" {...field} /></FormControl><FormMessage /></FormItem>
                                                    )}/>
                                                </Card>
                                            ))}
                                        </div>
                                    </ScrollArea>
                                    <Button type="button" variant="outline" onClick={() => append({ question: '', options: [{ text: '' }, { text: '' }], correctOption: 0, timeLimit: 30 })} className="mt-2"><Plus className="mr-2 h-4 w-4" /> Add Question</Button>
                                    <DialogFooter><DialogClose asChild><Button variant="ghost">Cancel</Button></DialogClose><Button type="submit" disabled={isCreating}>{isCreating && <Loader2 className="animate-spin mr-2" />} Create Quiz</Button></DialogFooter>
                                </form>
                            </Form>
                        </DialogContent>
                    </Dialog>
                </div>
            );
        }
        return renderNoQuizContent();
    }

    const currentQuestion = activeQuiz.currentQuestion;
    const isQuestionActive = activeQuiz.status === 'in_progress' && timeLeft > 0;
    const showLeaderboard = activeQuiz.status === 'in_progress' && timeLeft <= 0 && currentQuestion;
    
    const userAnswer = currentQuestion ? activeQuiz.answers?.[currentQuestion.id]?.[currentUserId] : undefined;
    const userHasAnswered = userAnswer !== undefined;
    
    const sortedLeaderboard = Object.entries(activeQuiz.leaderboard || {}).sort(([, a], [, b]) => b - a);

    if (activeQuiz.status === 'draft') {
         return (
             <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
                 <h3 className="text-xl font-bold">Quiz is Ready!</h3>
                 <p>{activeQuiz.questions.length} questions prepared.</p>
                 {isHost && <Button onClick={handleNextQuestion} disabled={isProcessing}>{isProcessing && <Loader2 className="animate-spin mr-2"/>}Start Quiz</Button>}
             </div>
         );
    }
    
    if (activeQuiz.status === 'ended') {
        const winnerId = sortedLeaderboard[0] ? sortedLeaderboard[0][0] : null;
        const winnerProfile = winnerId ? participants.find(p => p.userId === winnerId) : null;
        
        return (
             <div className="flex flex-col items-center justify-center h-full gap-2 text-center">
                 <Trophy className="w-16 h-16 text-yellow-500"/>
                 <h3 className="text-2xl font-bold">Quiz Finished!</h3>
                 {winnerProfile ? (
                     <>
                        <p className="text-lg">Winner is</p>
                        <Avatar className="h-20 w-20 border-4 border-yellow-500"><AvatarImage src={winnerProfile.photoURL} /><AvatarFallback>{getInitials(winnerProfile.displayName)}</AvatarFallback></Avatar>
                        <p className="text-xl font-bold">{winnerProfile.displayName}</p>
                     </>
                 ) : <p>No winner.</p>}
                 {isHost && <Button onClick={handleClearQuiz} variant="destructive" disabled={isProcessing}>{isProcessing && <Loader2 className="animate-spin mr-2"/>}Clear Quiz</Button>}
             </div>
        )
    }

    if (showLeaderboard && currentQuestion) {
        const isLastQuestion = activeQuiz.questions.length === activeQuiz.currentQuestionIndex + 1;
        return (
            <div className="w-full text-center">
                <CardHeader className="p-0 mb-2"><CardTitle>Leaderboard</CardTitle><CardDescription>After question {activeQuiz.currentQuestionIndex + 1}</CardDescription></CardHeader>
                <CardContent className="p-0">
                    <ScrollArea className="h-64">
                    <div className="space-y-2 pr-4">
                    {sortedLeaderboard.map(([userId, score], index) => {
                        const profile = participants.find(p => p.userId === userId);
                        return (
                            <div key={userId} className={cn("flex items-center gap-4 p-2 rounded-md", index === 0 && "bg-yellow-500/20")}>
                                <span className="font-bold w-6">{index + 1}</span>
                                <Avatar className="h-8 w-8"><AvatarImage src={profile?.photoURL} /><AvatarFallback>{getInitials(profile?.displayName || '??')}</AvatarFallback></Avatar>
                                <span className="flex-1 text-left">{profile?.displayName}</span>
                                <span className="font-bold">{score} pts</span>
                            </div>
                        )
                    })}
                    </div>
                    </ScrollArea>
                </CardContent>
                {isHost && (
                    <CardFooter className="p-0 pt-4 flex justify-end">
                        {isLastQuestion ?
                            <Button onClick={handleEndQuiz} disabled={isProcessing}>{isProcessing && <Loader2 className="animate-spin mr-2"/>}<Trophy className="mr-2"/>End Quiz & Show Winner</Button> :
                            <Button onClick={handleNextQuestion} disabled={isProcessing || timeLeft > 0}>{isProcessing && <Loader2 className="animate-spin mr-2"/>}<ArrowRight className="mr-2"/>Next Question</Button>
                        }
                    </CardFooter>
                )}
            </div>
        )
    }

    return (
        <div className="w-full">
            {currentQuestion && (
                <>
                <CardHeader className="p-0 mb-4">
                    <div className="flex justify-between items-start">
                        <div>
                            <CardTitle className="flex items-center gap-2 text-xl">Question {activeQuiz.currentQuestionIndex + 1}</CardTitle>
                            <CardDescription className="mt-1 text-lg">{currentQuestion.question}</CardDescription>
                        </div>
                        {isQuestionActive && <Badge variant={'default'}>{timeLeft}s</Badge>}
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="grid grid-cols-2 gap-3">
                        {currentQuestion.options.map((option, index) => {
                           const isThisAnswer = userHasAnswered && userAnswer.optionIndex === index;
                           const showResults = !isQuestionActive;
                           const isCorrectAnswer = showResults && index === currentQuestion.correctOption;
                           const wasCorrectSelection = isThisAnswer && userAnswer.isCorrect;
                           const wasIncorrectSelection = isThisAnswer && !userAnswer.isCorrect;

                            return (
                                <Button
                                    key={index}
                                    variant="outline"
                                    className={cn(
                                        "w-full h-20 justify-start text-base whitespace-normal p-4 relative",
                                        "transition-all duration-300",
                                        isAnswering && "opacity-50",
                                        userHasAnswered && !isThisAnswer && "opacity-30",
                                        userHasAnswered && isThisAnswer && "ring-2 ring-primary",
                                        showResults && isCorrectAnswer && "bg-green-500/20 border-green-500 text-green-800 dark:text-green-300",
                                        showResults && wasIncorrectSelection && "bg-destructive/20 border-destructive text-destructive",
                                    )}
                                    onClick={() => handleAnswer(index)}
                                    disabled={isAnswering || userHasAnswered || !isQuestionActive}
                                >
                                    {option.text}
                                    {isThisAnswer && !showResults && <div className="absolute top-1 right-1 h-5 w-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs">✓</div>}
                                    {showResults && wasCorrectSelection && <CheckCircle className="absolute top-1 right-1 h-5 w-5 text-green-500" />}
                                    {showResults && wasIncorrectSelection && <XCircle className="absolute top-1 right-1 h-5 w-5 text-destructive" />}
                                </Button>
                            )
                        })}
                    </div>
                </CardContent>
                </>
            )}
             {isHost && (
                <CardFooter className="flex justify-end gap-2 p-0 pt-4">
                     <Button variant="destructive" onClick={handleClearQuiz} disabled={isProcessing}><TimerOff className="mr-2" /> End Quiz</Button>
                </CardFooter>
            )}
        </div>
    );
}

// Helper component to handle nested useFieldArray
function FieldArrayOptions({ qIndex, form }: { qIndex: number, form: any }) {
    const { fields, append, remove } = useFieldArray({ control: form.control, name: `questions.${qIndex}.options` });

    return (
      <div className="space-y-2">
        {fields.map((field, oIndex) => (
          <div key={field.id} className="flex items-center gap-2">
              <FormField control={form.control} name={`questions.${qIndex}.options.${oIndex}.text`} render={({ field: f }) => (
                <FormItem className="flex-1"><FormControl><Input {...f} placeholder={`Option ${oIndex + 1}`} /></FormControl></FormItem>
              )}/>
            <Button type="button" variant="ghost" size="icon" onClick={() => remove(oIndex)} disabled={fields.length <= 2}>
              <Trash2 className="text-destructive h-4 w-4" />
            </Button>
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" onClick={() => append({ text: '' })} disabled={fields.length >= 4}>
            <Plus className="mr-2 h-4 w-4" /> Add Option
        </Button>
      </div>
    );
}
