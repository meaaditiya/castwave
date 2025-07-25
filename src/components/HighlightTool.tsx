"use client";

import { useState } from 'react';
import { suggestHighlights, SuggestHighlightsOutput } from '@/ai/flows/suggest-highlights';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Sparkles, Loader2 } from 'lucide-react';
import { ScrollArea } from './ui/scroll-area';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { useToast } from '@/hooks/use-toast';

interface HighlightToolProps {
  chatLog: string;
}

export function HighlightTool({ chatLog }: HighlightToolProps) {
  const [topic, setTopic] = useState('AI reasoning abilities');
  const [highlights, setHighlights] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleSuggestHighlights = async () => {
    setIsLoading(true);
    setHighlights([]);
    try {
      const result: SuggestHighlightsOutput = await suggestHighlights({
        chatLog,
        currentTopic: topic,
      });
      if (result.highlights && result.highlights.length > 0) {
        setHighlights(result.highlights);
      } else {
        toast({
            title: "No highlights found",
            description: "The AI couldn't find any specific highlights for this topic.",
        })
      }
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to generate highlights. Please try again.",
      })
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full p-1 sm:p-4 space-y-4">
      <div>
        <Label htmlFor="topic">Current Topic</Label>
        <Input
          id="topic"
          placeholder="Enter the current discussion topic"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          className="mt-1"
        />
      </div>
      <Button onClick={handleSuggestHighlights} disabled={isLoading || !topic}>
        {isLoading ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Sparkles className="mr-2 h-4 w-4" />
        )}
        Suggest Highlights
      </Button>

      <div className="flex-1 min-h-0">
        <p className="text-sm font-medium mb-2">Suggestions</p>
        <ScrollArea className="h-full pr-4">
          {highlights.length > 0 && (
            <div className="space-y-2">
                {highlights.map((highlight, index) => (
                    <Card key={index} className="bg-primary/10 border-primary/30">
                        <CardContent className="p-3 text-sm text-primary-foreground/90">
                            {highlight}
                        </CardContent>
                    </Card>
                ))}
            </div>
          )}
           {isLoading && (
            <div className="flex items-center justify-center pt-10">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
           )}
           {!isLoading && highlights.length === 0 && (
                <div className="text-center text-muted-foreground pt-10 px-4">
                    <Sparkles className="mx-auto h-8 w-8 mb-2" />
                    <p className="text-sm">Click "Suggest Highlights" to see AI-powered suggestions based on the chat and topic.</p>
                </div>
           )}
        </ScrollArea>
      </div>
    </div>
  );
}
