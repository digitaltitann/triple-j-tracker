export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        return res.status(500).json({ error: 'API key not configured' });
    }

    const { image, mediaType } = req.body;
    if (!image) {
        return res.status(400).json({ error: 'No image provided' });
    }

    const prompt = `Extract all bets from this sportsbook screenshot. For each bet, output one line in this exact format:

For player props: "PlayerName Target+ StatType"
Examples: "LeBron James 25+ points", "Mahomes 300+ passing yards", "Josh Giddey 15+ points assists"

For combo stats use these formats:
- Points + Assists → "Name 15+ points assists"
- Points + Rebounds → "Name 20+ points rebounds"
- Points + Rebounds + Assists → "Name 30+ points rebounds assists"

For spreads: "TeamName -3.5" or "TeamName +7"
For moneyline: "TeamName ML"
For game totals: "Over 220.5 Team1 Team2"

Use the team's common name (Knicks, Lakers, Chiefs, etc), not abbreviations.
Output ONLY the bet lines, one per line. No other text.`;

    try {
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        parts: [
                            {
                                inlineData: {
                                    mimeType: mediaType || 'image/jpeg',
                                    data: image
                                }
                            },
                            { text: prompt }
                        ]
                    }]
                })
            }
        );

        if (!response.ok) {
            const error = await response.json();
            console.error('Gemini API error:', error);
            return res.status(response.status).json({
                error: error.error?.message || 'Gemini API error'
            });
        }

        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

        if (!text.trim()) {
            return res.status(200).json({ bets: [] });
        }

        const bets = text.trim().split('\n').filter(l => l.trim().length > 0);
        return res.status(200).json({ bets });

    } catch (error) {
        console.error('Scan error:', error);
        return res.status(500).json({ error: 'Failed to process image' });
    }
}
