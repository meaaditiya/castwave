
"use client";

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { getChatRoomStream, updateChatRoom, ChatRoom } from '@/services/chatRoomService';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Mic, Calendar as CalendarIcon, Clock, Lock, ArrowLeft, Save } from 'lucide-react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';


const formSchema = z.object({
  title: z.string().min(5, { message: 'Title must be at least 5 characters.' }),
  description: z.string().min(10, { message: 'Description must be at least 10 characters.' }),
  scheduleOption: z.enum(['now', 'later'], { required_error: 'You must select a schedule option.'}),
  scheduledAt: z.date().optional(),
  isPrivate: z.boolean().default(false),
}).refine((data) => {
    if (data.scheduleOption === 'later' && !data.scheduledAt) {
        return false;
    }
    return true;
}, {
    message: 'Scheduled date is required when scheduling for later.',
    path: ['scheduledAt'],
});

function EditPageSkeleton() {
    return (
        <div className="flex flex-col min-h-screen">
            <Header />
            <main className="flex-1 w-full py-8 flex flex-col items-center bg-muted/40 px-2">
                 <div className="w-full mb-4">
                    <Skeleton className="h-8 w-24 rounded-full" />
                </div>
                 <Card className="w-full">
                    <CardHeader>
                        <Skeleton className="h-8 w-3/5 mx-auto" />
                        <Skeleton className="h-4 w-4/5 mx-auto" />
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="space-y-2">
                             <Skeleton className="h-4 w-24" />
                             <Skeleton className="h-10 w-full" />
                        </div>
                         <div className="space-y-2">
                             <Skeleton className="h-4 w-24" />
                             <Skeleton className="h-20 w-full" />
                        </div>
                        <Skeleton className="h-24 w-full" />
                        <Skeleton className="h-10 w-full" />
                    </CardContent>
                 </Card>
            </main>
        </div>
    )
}


export default function EditChatRoomPage() {
  const { currentUser, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [chatRoom, setChatRoom] = useState<ChatRoom | null>(null);

  const chatRoomId = params.id as string;

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: '',
      description: '',
      scheduleOption: 'now',
      isPrivate: false,
    },
  });

  useEffect(() => {
    if (authLoading) return;
    if (!currentUser) {
      router.push('/login');
    }
  }, [currentUser, authLoading, router]);

  useEffect(() => {
    if (!chatRoomId || !currentUser) return;
    
    const unsubscribe = getChatRoomStream(chatRoomId, (roomData) => {
        if (roomData) {
            if (roomData.hostId !== currentUser.uid) {
                toast({ variant: 'destructive', title: 'Unauthorized', description: 'You do not have permission to edit this session.' });
                router.push(`/chatroom/${chatRoomId}`);
                return;
            }
            setChatRoom(roomData);
            form.reset({
                title: roomData.title,
                description: roomData.description,
                isPrivate: roomData.isPrivate,
                scheduleOption: roomData.scheduledAt?.toDate() > new Date() ? 'later' : 'now',
                scheduledAt: roomData.scheduledAt?.toDate(),
            });
            setPageLoading(false);
        } else {
            toast({ variant: 'destructive', title: 'Not Found', description: 'This session does not exist.' });
            router.push('/');
        }
    });

    return () => unsubscribe();

  }, [chatRoomId, currentUser, router, toast, form]);

  const scheduleOption = form.watch('scheduleOption');

  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!currentUser) return;

    setIsLoading(true);

    try {
        const isLive = values.scheduleOption === 'now' ? chatRoom?.isLive ?? false : false;
        
        await updateChatRoom(chatRoomId, {
            title: values.title,
            description: values.description,
            isLive: isLive,
            scheduledAt: values.scheduleOption === 'later' ? values.scheduledAt : undefined,
            isPrivate: values.isPrivate,
        });
        
        toast({
            title: 'Session Updated!',
            description: 'Your session details have been saved.',
        });
        router.push(`/chatroom/${chatRoomId}`);

    } catch (error: any) {
        console.error(error);
        toast({
            variant: 'destructive',
            title: 'Failed to Update Session',
            description: error.message || 'An unexpected error occurred.',
        });
    } finally {
        setIsLoading(false);
    }
  }

  if (authLoading || pageLoading || !currentUser) {
    return <EditPageSkeleton />;
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 w-full py-8 bg-muted/40 px-2">
        <div className="w-full max-w-2xl mx-auto">
            <div className="w-full mb-4">
                <Button variant="outline" size="sm" onClick={() => router.back()} className="rounded-full">
                    <ArrowLeft className="mr-2" />
                    Back
                </Button>
            </div>
            <Card className="w-full shadow-xl">
            <CardHeader>
                <CardTitle className="text-2xl font-bold tracking-tight text-center">Edit Session</CardTitle>
                <CardDescription className="text-center">Update the details for your podcast session below.</CardDescription>
            </CardHeader>
            <CardContent>
                <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Session Title</FormLabel>
                        <FormControl>
                            <Input placeholder="e.g., The Future of Artificial Intelligence" {...field} />
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
                        <FormLabel>Session Description</FormLabel>
                        <FormControl>
                            <Textarea
                            placeholder="Describe what your session will be about in a few sentences..."
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
                                    value={field.value}
                                    className="flex flex-col sm:flex-row sm:space-x-4 sm:space-y-0"
                                >
                                    <FormItem className="flex items-center space-x-3 space-y-0 rounded-md border p-4 flex-1 has-[:checked]:border-primary">
                                        <FormControl>
                                            <RadioGroupItem value="now" />
                                        </FormControl>
                                        <FormLabel className="font-normal flex items-center gap-2">
                                            <Mic /> Keep Live Status
                                        </FormLabel>
                                    </FormItem>
                                    <FormItem className="flex items-center space-x-3 space-y-0 rounded-md border p-4 flex-1 has-[:checked]:border-primary">
                                        <FormControl>
                                            <RadioGroupItem value="later" />
                                        </FormControl>
                                        <FormLabel className="font-normal flex items-center gap-2">
                                            <Clock /> Re-schedule for Later
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
                            <FormLabel>Scheduled Date & Time (IST)</FormLabel>
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
                                disabled={(date) => date < new Date(new Date().setHours(0,0,0,0))}
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

                    <FormField
                    control={form.control}
                    name="isPrivate"
                    render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                            <FormLabel className="text-base flex items-center gap-2">
                            <Lock className="h-4 w-4" />
                            Private Session
                            </FormLabel>
                            <FormDescription>
                            Private sessions will not be shown on the homepage. Only users with a direct link can join.
                            </FormDescription>
                        </div>
                        <FormControl>
                            <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            />
                        </FormControl>
                        </FormItem>
                    )}
                    />

                    <Button type="submit" size="lg" className="w-full font-bold" disabled={isLoading}>
                    {isLoading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Save className="mr-2 h-5 w-5" />}
                    Save Changes
                    </Button>
                </form>
                </Form>
            </CardContent>
            </Card>
        </div>
      </main>
    </div>
  );
}
