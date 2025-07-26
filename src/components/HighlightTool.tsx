
"use client";

import { useState } from 'react';
import { summarizeChat, SummarizeChatOutput } from '@/ai/flows/summarize-chat';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Sparkles, Loader2 } from 'lucide-react';
import { ScrollArea } from './ui/scroll-area';
import { useToast } from '@/hooks/use-toast';

interface HighlightToolProps {
  chatLog: string;
}

export function HighlightTool({ chatLog }: HighlightToolProps) {
  const [summary, setSummary] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleSummarize = async () => {
    if (!chatLog) {
        toast({
            variant: "destructive",
            title: "Chat log is empty",
            description: "There's nothing to summarize yet.",
        });
        return;
    }
    setIsLoading(true);
    setSummary('');
    try {
      const result: SummarizeChatOutput = await summarizeChat({ chatLog });
      if (result.summary) {
        setSummary(result.summary);
      } else {
        toast({
            title: "No summary could be generated",
            description: "The AI couldn't find anything to summarize.",
        })
      }
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to generate summary. Please try again.",
      })
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">AI Chat Summary</CardTitle>
        <CardDescription>Get a quick summary of the conversation.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button onClick={handleSummarize} disabled={isLoading} className="w-full">
            {isLoading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
            <Sparkles className="mr-2 h-4 w-4" />
            )}
            Generate Summary
        </Button>
        <ScrollArea className="h-48 pr-4">
          {summary && (
            <Card className="bg-muted border-dashed">
                <CardContent className="p-4 text-sm whitespace-pre-wrap font-sans">
                    {summary}
                </CardContent>
            </Card>
          )}
           {isLoading && (
            <div className="flex items-center justify-center pt-10">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
           )}
           {!isLoading && !summary && (
                <div className="text-center text-muted-foreground pt-10 px-4">
                    <Sparkles className="mx-auto h-8 w-8 mb-2" />
                    <p className="text-sm">Click "Generate Summary" to get an AI-powered overview of the chat.</p>
                </div>
           )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
