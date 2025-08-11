
"use client";
import React from 'react';

interface LivePollProps {
    chatRoomId: string;
    isHost: boolean;
    currentUserId: string;
    renderNoPollContent: () => React.ReactNode;
}

// This component is now a placeholder. The quiz functionality will be in LiveQuiz.tsx
export function LivePoll({ chatRoomId, isHost, currentUserId, renderNoPollContent }: LivePollProps) {
    return renderNoPollContent();
}
