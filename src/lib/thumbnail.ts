
function wrapText(text: string, maxCharsPerLine: number): string[] {
    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = '';

    words.forEach(word => {
        if ((currentLine + word).length > maxCharsPerLine) {
            lines.push(currentLine.trim());
            currentLine = '';
        }
        currentLine += `${word} `;
    });
    lines.push(currentLine.trim());
    return lines;
}

export function generateThumbnailSvg(title: string): string {
    const width = 600;
    const height = 400;

    // Theme colors (approximations)
    const bgColor = "#1e293b"; // dark slate, similar to dark theme card
    const primaryColor = "rgb(79, 128, 255)"; // primary blue
    const textColor = "#f8fafc"; // light text

    const wrappedTitle = wrapText(title, 25);
    const titleLines = wrappedTitle.length;
    const fontSize = Math.max(24, 48 - (titleLines - 1) * 6);
    const lineHeight = fontSize * 1.2;
    const totalTextHeight = titleLines * lineHeight;
    const startY = (height - totalTextHeight) / 2 + fontSize - (titleLines > 1 ? (lineHeight/4) : 0);

    const titleTspans = wrappedTitle.map((line, index) => 
        `<tspan x="${width / 2}" y="${startY + index * lineHeight}" dy="${index > 0 ? '0.2em' : '0'}">${line}</tspan>`
    ).join('');

    return `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
            <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style="stop-color:${bgColor};stop-opacity:1" />
                <stop offset="100%" style="stop-color:#0f172a;stop-opacity:1" />
            </linearGradient>
            <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="8" result="coloredBlur"/>
                <feMerge>
                    <feMergeNode in="coloredBlur"/>
                    <feMergeNode in="SourceGraphic"/>
                </feMerge>
            </filter>
        </defs>
        <rect width="${width}" height="${height}" fill="url(#grad1)" />
        
        <!-- Abstract Shapes -->
        <circle cx="${width * 0.1}" cy="${height * 0.9}" r="80" fill="${primaryColor}" opacity="0.1" filter="url(#glow)"/>
        <circle cx="${width * 0.9}" cy="${height * 0.1}" r="120" fill="${primaryColor}" opacity="0.15" filter="url(#glow)"/>
        <rect x="${width * 0.7}" y="${height * 0.6}" width="150" height="150" fill="${primaryColor}" opacity="0.05" transform="rotate(30 ${width * 0.7} ${height * 0.6})" />


        <g style="font-family: 'Inter', sans-serif; text-anchor: middle;">
            <text fill="${textColor}" font-size="${fontSize}" font-weight="bold">
                ${titleTspans}
            </text>
        </g>
        
        <!-- Bottom Brand -->
        <text x="${width / 2}" y="${height - 20}" fill="${textColor}" font-size="16" style="font-family: 'Inter', sans-serif; text-anchor: middle;" opacity="0.5">
            CastWave
        </text>
    </svg>
    `;
}
