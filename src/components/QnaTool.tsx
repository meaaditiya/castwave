"use client";

import { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  getQnaQuestionsStream,
  askQuestion,
  toggleUpvoteQuestion,
  markQuestionAsAnswered,
  QnaQuestion,
} from '@/services/qnaService';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Send, ThumbsUp, CheckCircle } from 'lucide-react';
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDistanceToNow } from 'date-fns';

interface QnaToolProps {
  chatRoomId: string;
  isHost: boolean;
  currentUserId: string;
}

const questionFormSchema = z.object({
  questionText: z.string().min(10, 'Question must be at least 10 characters.'),
});

function QuestionItem({
  question,
  currentUserId,
  isHost,
  onUpvote,
  onMarkAnswered,
}: {
  question: QnaQuestion;
  currentUserId: string;
  isHost: boolean;
  onUpvote: (questionId: string) => void;
  onMarkAnswered: (questionId: string) => void;
}) {
  const hasUpvoted = question.upvoterIds.includes(currentUserId);

  return (
    <div className="flex items-start gap-3 p-3 rounded-lg border bg-card">
      <div className="flex-1">
        <p className="text-sm text-foreground">{question.text}</p>
        <p className="text-xs text-muted-foreground mt-1">
          Asked by {question.authorName} • {formatDistanceToNow(question.createdAt.toDate(), { addSuffix: true })}
        </p>
      </div>
      <div className="flex flex-col items-center gap-1">
        <Button
          variant={hasUpvoted ? 'default' : 'outline'}
          size="sm"
          onClick={() => onUpvote(question.id)}
          className="flex items-center gap-2"
        >
          <ThumbsUp className="h-4 w-4" />
          <span>{question.upvotes}</span>
        </Button>
        {isHost && !question.isAnswered && (
          <Button
            variant="ghost"
            size="sm"
            className="text-green-600"
            onClick={() => onMarkAnswered(question.id)}
          >
            <CheckCircle className="h-4 w-4 mr-1" /> Mark as Answered
          </Button>
        )}
      </div>
    </div>
  );
}

export function QnaTool({ chatRoomId, isHost, currentUserId }: QnaToolProps) {
  const [questions, setQuestions] = useState<QnaQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { currentUser } = useAuth();
  const { toast } = useToast();

  const form = useForm<z.infer<typeof questionFormSchema>>({
    resolver: zodResolver(questionFormSchema),
    defaultValues: { questionText: '' },
  });

  useEffect(() => {
    const unsubscribe = getQnaQuestionsStream(
      chatRoomId,
      (newQuestions) => {
        setQuestions(newQuestions);
        setLoading(false);
      },
      (error) => {
        console.error('Failed to get Q&A questions:', error);
        toast({ variant: 'destructive', title: 'Error', description: 'Could not load Q&A.' });
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, [chatRoomId, toast]);

  const sortedQuestions = useMemo(() => {
    return [...questions].sort((a, b) => {
      // Unanswered questions come first
      if (a.isAnswered !== b.isAnswered) {
        return a.isAnswered ? 1 : -1;
      }
      // Then sort by upvotes
      return b.upvotes - a.upvotes;
    });
  }, [questions]);

  const handleAskQuestion = async (values: z.infer<typeof questionFormSchema>) => {
    if (!currentUser?.profile?.username) {
      toast({ variant: 'destructive', title: 'Error', description: 'Cannot post question without a username.' });
      return;
    }
    setIsSubmitting(true);
    try {
      await askQuestion(chatRoomId, values.questionText, currentUserId, currentUser.profile.username);
      form.reset();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpvote = async (questionId: string) => {
    try {
      await toggleUpvoteQuestion(chatRoomId, questionId, currentUserId);
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    }
  };

  const handleMarkAnswered = async (questionId: string) => {
    try {
      await markQuestionAsAnswered(chatRoomId, questionId);
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-full">
        <Loader2 className="animate-spin h-8 w-8" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col gap-4">
      <div className="flex-1 min-h-0">
        <ScrollArea className="h-full pr-4">
          <div className="space-y-3">
            {sortedQuestions.length > 0 ? (
              sortedQuestions.map((q) => (
                <div key={q.id} className={q.isAnswered ? 'opacity-50' : ''}>
                  <QuestionItem
                    question={q}
                    currentUserId={currentUserId}
                    isHost={isHost}
                    onUpvote={handleUpvote}
                    onMarkAnswered={handleMarkAnswered}
                  />
                </div>
              ))
            ) : (
              <div className="text-center text-muted-foreground pt-10">
                <p className="font-semibold">No questions yet.</p>
                <p>Be the first to ask something!</p>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      <div className="pt-2 border-t">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleAskQuestion)} className="flex items-start gap-2">
            <FormField
              control={form.control}
              name="questionText"
              render={({ field }) => (
                <FormItem className="flex-1">
                  <FormControl>
                    <Input {...field} placeholder="Ask a question..." disabled={isSubmitting} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="animate-spin h-4 w-4" /> : <Send className="h-4 w-4" />}
            </Button>
          </form>
        </Form>
      </div>
    </div>
  );
}
