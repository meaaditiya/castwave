import Link from 'next/link';
import Image from 'next/image';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Podcast } from '@/services/podcastService';

export function PodcastCard({ id, title, host, imageUrl, isLive, imageHint }: Podcast) {
  return (
    <Link href={`/podcast/${id}`} className="group">
      <Card className="hover:border-primary transition-colors duration-300 overflow-hidden h-full flex flex-col">
        <CardHeader className="p-0 relative">
          <Image
            src={imageUrl || 'https://placehold.co/400x400.png'}
            alt={title}
            width={400}
            height={400}
            className="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-300"
            data-ai-hint={imageHint}
          />
          {isLive && (
            <Badge className="absolute top-2 right-2 bg-accent text-accent-foreground border-accent-foreground/20 shadow-lg">
               <span className="relative flex h-2 w-2 mr-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
              </span>
              LIVE
            </Badge>
          )}
        </CardHeader>
        <CardContent className="p-4 flex-1 flex flex-col">
          <CardTitle className="text-lg font-headline truncate">{title}</CardTitle>
          <p className="text-muted-foreground text-sm mt-1">{host}</p>
        </CardContent>
      </Card>
    </Link>
  );
}
