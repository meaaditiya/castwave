import { Header } from '@/components/Header';
import { PodcastCard } from '@/components/PodcastCard';

const podcasts = [
  { id: '1', title: 'Tech Unfiltered', host: 'Alex & Ben', imageUrl: 'https://placehold.co/400x400.png', isLive: true, imageHint: 'tech podcast' },
  { id: '2', title: 'The Future of AI', host: 'Dr. Evelyn Reed', imageUrl: 'https://placehold.co/400x400.png', isLive: true, imageHint: 'artificial intelligence' },
  { id: '3', title: 'Cosmic Queries', host: 'Neil deGrasse Tyson', imageUrl: 'https://placehold.co/400x400.png', isLive: false, imageHint: 'space galaxy' },
  { id: '4', title: 'Design Matters', host: 'Debbie Millman', imageUrl: 'https://placehold.co/400x400.png', isLive: false, imageHint: 'graphic design' },
  { id: '5', title: 'Indie Hackers', host: 'Courtland Allen', imageUrl: 'https://placehold.co/400x400.png', isLive: true, imageHint: 'startup business' },
  { id: '6', title: 'Philosophize This!', host: 'Stephen West', imageUrl: 'https://placehold.co/400x400.png', isLive: false, imageHint: 'philosophy statue' },
];

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 container py-8">
        <h1 className="text-4xl font-headline font-bold mb-2">Active Podcasts</h1>
        <p className="text-muted-foreground mb-8">Join a live session and be part of the conversation.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {podcasts.map(podcast => (
            <PodcastCard key={podcast.id} {...podcast} />
          ))}
        </div>
      </main>
    </div>
  );
}
