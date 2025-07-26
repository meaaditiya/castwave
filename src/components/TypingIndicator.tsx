
"use client";

interface TypingIndicatorProps {
    users: string[];
}

export function TypingIndicator({ users }: TypingIndicatorProps) {

    const names = users.slice(0, 2).join(', ');
    const andOthers = users.length > 2 ? ` and ${users.length - 2} ${users.length-2 === 1 ? 'other' : 'others'}` : '';
    const verb = users.length > 1 ? 'are' : 'is';

    return (
        <div className="flex items-center gap-2">
            <span className="typing-indicator">
                <span></span>
                <span></span>
                <span></span>
            </span>
            <p className="text-xs text-muted-foreground italic">
                <span className="font-semibold">{names}</span>
                {andOthers} {verb} typing...
            </p>
        </div>
    )
}
