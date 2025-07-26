
"use client";

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { createChatRoomFlow } from '@/ai/flows/create-chat-room';
import { generateUploadUrl } from '@/ai/flows/generate-upload-url';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Mic, Calendar as CalendarIcon, Clock, Image as ImageIcon, Upload } from 'lucide-react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import Image from 'next/image';

const formSchema = z.object({
  title: z.string().min(5, { message: 'Title must be at least 5 characters.' }),
  description: z.string().min(10, { message: 'Description must be at least 10 characters.' }),
  scheduleOption: z.enum(['now', 'later'], { required_error: 'You must select a schedule option.'}),
  scheduledAt: z.date().optional(),
  thumbnail: z.custom<FileList>().optional(),
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
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: '',
      description: '',
      scheduleOption: 'now',
    },
  });

  const scheduleOption = form.watch('scheduleOption');
  const thumbnailFile = form.watch('thumbnail');

  useEffect(() => {
    if (thumbnailFile && thumbnailFile[0]) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setThumbnailPreview(reader.result as string);
      };
      reader.readAsDataURL(thumbnailFile[0]);
    } else {
      setThumbnailPreview(null);
    }
  }, [thumbnailFile]);

  useEffect(() => {
    if (!authLoading && !currentUser) {
      router.push('/login');
    }
  }, [currentUser, authLoading, router]);


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
        let imageUrl: string | undefined = undefined;

        // 1. If a thumbnail is selected, get a signed URL and upload it
        if (values.thumbnail && values.thumbnail.length > 0) {
            const file = values.thumbnail[0];
            
            const { uploadUrl, downloadUrl } = await generateUploadUrl({
                fileName: file.name,
                contentType: file.type,
                userId: currentUser.uid,
                uploadType: 'thumbnail'
            });

            // Upload the file to the signed URL
            const uploadResponse = await fetch(uploadUrl, {
                method: 'PUT',
                body: file,
                headers: { 'Content-Type': file.type },
            });

            if (!uploadResponse.ok) {
                throw new Error('Thumbnail upload failed.');
            }
            
            imageUrl = downloadUrl;
        }

        // 2. Create the chat room with the image URL (or without)
        const isLive = values.scheduleOption === 'now';
        const result = await createChatRoomFlow({
            title: values.title,
            description: values.description,
            host: currentUser.email || 'Anonymous',
            hostId: currentUser.uid,
            isLive,
            scheduledAt: isLive ? undefined : values.scheduledAt,
            imageUrl: imageUrl,
        });
        
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
        <div className="flex items-center justify-center h-screen bg-muted/40">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 container py-8 flex items-center justify-center bg-muted/40">
        <Card className="w-full max-w-2xl shadow-xl">
          <CardHeader>
            <CardTitle className="text-2xl font-bold tracking-tight">Create a New Session</CardTitle>
            <CardDescription>Fill out the details below to start your new podcast session.</CardDescription>
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
                  name="thumbnail"
                  render={({ field: { onChange, value, ...rest } }) => (
                    <FormItem>
                      <FormLabel>Session Thumbnail (Optional)</FormLabel>
                      <FormControl>
                        <div className="flex items-center gap-4">
                           {thumbnailPreview ? (
                              <Image src={thumbnailPreview} alt="Thumbnail preview" width={100} height={100} className="rounded-md object-cover" />
                           ) : (
                              <div className="w-[100px] h-[100px] flex items-center justify-center bg-muted rounded-md">
                                <ImageIcon className="h-10 w-10 text-muted-foreground" />
                              </div>
                           )}
                           <Button type="button" variant="outline" asChild>
                              <label htmlFor="thumbnail-upload" className="cursor-pointer">
                                <Upload className="mr-2 h-4 w-4" />
                                {thumbnailPreview ? 'Change Image' : 'Upload Image'}
                                <Input 
                                  id="thumbnail-upload"
                                  type="file"
                                  accept="image/*"
                                  className="hidden"
                                  onChange={(e) => onChange(e.target.files)}
                                  {...rest}
                                />
                              </label>
                           </Button>
                        </div>
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
                                className="flex flex-col sm:flex-row sm:space-x-4 sm:space-y-0"
                            >
                                <FormItem className="flex items-center space-x-3 space-y-0 rounded-md border p-4 flex-1 has-[:checked]:border-primary">
                                    <FormControl>
                                        <RadioGroupItem value="now" />
                                    </FormControl>
                                    <FormLabel className="font-normal flex items-center gap-2">
                                        <Mic /> Go Live Now
                                    </FormLabel>
                                </FormItem>
                                <FormItem className="flex items-center space-x-3 space-y-0 rounded-md border p-4 flex-1 has-[:checked]:border-primary">
                                    <FormControl>
                                        <RadioGroupItem value="later" />
                                    </FormControl>
                                    <FormLabel className="font-normal flex items-center gap-2">
                                        <Clock /> Schedule for Later
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

                <Button type="submit" size="lg" className="w-full font-bold" disabled={isLoading}>
                  {isLoading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Mic className="mr-2 h-5 w-5" />}
                  {scheduleOption === 'now' ? 'Start Live Session' : 'Schedule Session'}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
