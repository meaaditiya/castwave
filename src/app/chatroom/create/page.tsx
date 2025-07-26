
"use client";

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { createChatRoomFlow, CreateChatRoomFlowInput } from '@/ai/flows/create-chat-room';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Mic, Calendar as CalendarIcon } from 'lucide-react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

const formSchema = z.object({
  title: z.string().min(5, { message: 'Title must be at least 5 characters.' }),
  description: z.string().min(10, { message: 'Description must be at least 10 characters.' }),
  scheduleOption: z.enum(['now', 'later'], { required_error: 'You must select a schedule option.'}),
  scheduledAt: z.date().optional(),
}).refine((data) => {
    if (data.scheduleOption === 'later' && !data.scheduledAt) {
        return false;
    }
    return true;
}, {
    message: 'Scheduled date is required when scheduling for later.',
    path: ['scheduledAt'],
});

export default function CreateChatRoomPage() {
  const { currentUser, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!authLoading && !currentUser) {
      router.push('/login');
    }
  }, [currentUser, authLoading, router]);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: '',
      description: '',
      scheduleOption: 'now',
    },
  });

  const scheduleOption = form.watch('scheduleOption');

  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!currentUser) {
        toast({
            variant: 'destructive',
            title: 'Not Authenticated',
            description: 'You must be logged in to create a chat room.',
        });
        return;
    }

    setIsLoading(true);

    try {
      const isLive = values.scheduleOption === 'now';
      const input: CreateChatRoomFlowInput = {
        title: values.title,
        description: values.description,
        host: currentUser.email || 'Anonymous',
        hostId: currentUser.uid,
        isLive,
        scheduledAt: isLive ? undefined : values.scheduledAt,
      }
      
      const result = await createChatRoomFlow(input);
      
      toast({
        title: 'Chat Room Created!',
        description: isLive ? 'Your new chat room is now live.' : 'Your chat room has been scheduled.',
      });
      router.push(`/chatroom/${result.chatRoomId}`);
    } catch (error: any) {
      console.error(error);
      toast({
        variant: 'destructive',
        title: 'Failed to Create Chat Room',
        description: error.message || 'An unexpected error occurred.',
      });
    } finally {
      setIsLoading(false);
    }
  }

  if (authLoading || !currentUser) {
    return (
        <div className="flex items-center justify-center h-screen">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 container py-8 flex items-center justify-center">
        <Card className="w-full max-w-2xl">
          <CardHeader>
            <CardTitle>Create a New Chat Room</CardTitle>
            <CardDescription>Fill out the details below to start your session.</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Chat Room Title</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., The Future of Web Development" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Chat Room Description</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Describe what your chat room will be about..."
                          className="resize-none"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="scheduleOption"
                  render={({ field }) => (
                    <FormItem className="space-y-3">
                        <FormLabel>When to start?</FormLabel>
                        <FormControl>
                            <RadioGroup
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                            className="flex flex-col space-y-1"
                            >
                            <FormItem className="flex items-center space-x-3 space-y-0">
                                <FormControl>
                                <RadioGroupItem value="now" />
                                </FormControl>
                                <FormLabel className="font-normal">
                                Go Live Now
                                </FormLabel>
                            </FormItem>
                            <FormItem className="flex items-center space-x-3 space-y-0">
                                <FormControl>
                                <RadioGroupItem value="later" />
                                </FormControl>
                                <FormLabel className="font-normal">
                                Schedule for Later
                                </FormLabel>
                            </FormItem>
                            </RadioGroup>
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                  )}
                />
                {scheduleOption === 'later' && (
                  <FormField
                    control={form.control}
                    name="scheduledAt"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Scheduled Date & Time</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant={"outline"}
                                className={cn(
                                  "w-full pl-3 text-left font-normal",
                                  !field.value && "text-muted-foreground"
                                )}
                              >
                                {field.value ? (
                                  format(field.value, "PPP HH:mm")
                                ) : (
                                  <span>Pick a date and time</span>
                                )}
                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={field.value}
                              onSelect={field.onChange}
                              disabled={(date) => date < new Date() || date < new Date("1900-01-01")}
                              initialFocus
                            />
                             <div className="p-2 border-t border-border">
                                <Input type="time" onChange={(e) => {
                                    const time = e.target.value;
                                    const [hours, minutes] = time.split(':');
                                    const newDate = new Date(field.value || new Date());
                                    newDate.setHours(Number(hours), Number(minutes));
                                    field.onChange(newDate);
                                }}/>
                            </div>
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}


                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? <Loader2 className="animate-spin" /> : <Mic />}
                  {scheduleOption === 'now' ? 'Start Live Chat Room' : 'Schedule Chat Room'}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
