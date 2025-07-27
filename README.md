# CastWave: Live Audio Chat Rooms

CastWave is a modern, full-stack web application that allows users to create, manage, and participate in live audio chat rooms, referred to as "sessions." It's designed to be an interactive platform for live conversations, podcasts, and community engagement, complete with real-time features and host controls.

## Key Features

### 1. User Authentication & Profile Management
- **Sign-up & Login:** Secure email and password authentication system.
- **Profile Page:** A dedicated page for users to view their account details, including their email address.
- **Session-based Persistence:** Users remain logged in across browser sessions for a seamless experience.

### 2. Session (Chat Room) Management
- **Create Sessions:** Authenticated users can create new sessions, providing a title and description.
- **Public vs. Private:** Hosts can set sessions to be either public (discoverable on the homepage) or private (accessible only via a direct link).
- **Scheduling:** Sessions can be scheduled to "Go Live Now" or for a future date and time.
- **Session Dashboard:** The homepage displays lists of sessions, separated into "Public" and "My Sessions" tabs for easy navigation.
- **Host Controls:** Session creators (hosts) have exclusive rights to start scheduled sessions and delete their own sessions.

### 3. Interactive Live Session Experience
- **Live Screen:** The central view of a session, showing the host's details and the session title. It indicates whether the session is "LIVE" or has ended.
- **Featured Messages:** Hosts can select a message from the chat and "feature" it on the live screen for all participants to see, along with an optional reply.
- **Real-Time Live Chat:**
    - Participants can send and view messages in real-time.
    - User avatars and distinct colors for each user.
    - Timestamps for each message.
    - Real-time typing indicators to show when other users are writing a message.
- **Participant Management:**
    - A join request system where non-host users must be approved by the host to participate in the chat.
    - Hosts can view a list of participants and their status (pending, approved).
    - Hosts can approve or deny pending requests, and remove approved participants from the chat.
- **Message Voting:** Approved participants can upvote or downvote messages in the chat to highlight popular or controversial points.

### 4. Live Polling System
- **Host-Created Polls:** Hosts can create live polls within a session with custom questions, options, and a set duration.
- **Real-Time Voting:** Participants can cast their votes in real-time.
- **Dynamic Results:** Poll results are displayed dynamically as votes come in. The host controls whether results are visible to participants during the poll.

### 5. AI-Powered Features (Genkit)
- **Chat Summarization:** At any point, a user can click a button to generate a concise, AI-powered summary of the entire chat conversation up to that point.

## Technology Stack

- **Framework:** Next.js (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS with ShadCN UI components for a modern, responsive, and themeable (light/dark mode) design.
- **Backend & Database:** Firebase (Firestore) for real-time data synchronization, user authentication, and data storage.
- **Generative AI:** Google's Genkit for AI-powered features like chat summarization.
- **State Management:** React Hooks and Context API for managing application state, including authentication and theme.
