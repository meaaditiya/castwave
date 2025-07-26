
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

    // Theme colors (approximations from globals.css dark theme)
    const bgColor = "hsl(222.2, 84%, 4.9%)";
    const primaryColor = "hsl(217.2, 91.2%, 59.8%)";
    const secondaryColor = "hsl(217.2, 32.6%, 17.5%)";
    const textColor = "hsl(210, 40%, 98%)";

    const wrappedTitle = wrapText(title, 25);
    const titleLines = wrappedTitle.length;
    const fontSize = Math.max(24, 48 - (titleLines - 1) * 6);
    const lineHeight = fontSize * 1.2;
    const totalTextHeight = titleLines * lineHeight;
    const startY = (height - totalTextHeight) / 2 + fontSize - (titleLines > 1 ? (lineHeight/4) : 0);

    const titleTspans = wrappedTitle.map((line, index) => 
        `<tspan x="${width / 2}" y="${startY + index * lineHeight}" dy="${index > 0 ? '0.2em' : '0'}">${line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</tspan>`
    ).join('');

    return `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" style="font-family: 'Inter', sans-serif;">
        <defs>
            <radialGradient id="grad-bg" cx="50%" cy="50%" r="75%">
                <stop offset="0%" stop-color="${secondaryColor}" />
                <stop offset="100%" stop-color="${bgColor}" />
            </radialGradient>
            <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="15" result="coloredBlur"/>
                <feMerge>
                    <feMergeNode in="coloredBlur"/>
                    <feMergeNode in="SourceGraphic"/>
                </feMerge>
            </filter>
        </defs>
        <rect width="${width}" height="${height}" fill="url(#grad-bg)" />
        
        <!-- Abstract Shapes -->
        <g opacity="0.4" filter="url(#glow)">
            <circle cx="${width * 0.2}" cy="${height * 0.8}" r="120" fill="${primaryColor}"/>
            <circle cx="${width * 0.9}" cy="${height * 0.25}" r="160" fill="${primaryColor}" />
            <ellipse cx="${width * 0.5}" cy="${height * 0.5}" rx="220" ry="120" fill="${secondaryColor}" transform="rotate(25 ${width/2} ${height/2})" />
        </g>
        
        <text text-anchor="middle" fill="${textColor}" font-size="${fontSize}px" font-weight="bold" x="${width / 2}" y="${startY}">
            ${titleTspans}
        </text>
        
        <!-- Bottom Brand -->
        <text text-anchor="middle" fill="${textColor}" font-size="16px" opacity="0.7" x="${width / 2}" y="${height - 25}">
            CastWave
        </text>
    </svg>
    `;
}
