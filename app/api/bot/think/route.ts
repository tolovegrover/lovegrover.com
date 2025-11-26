import { NextResponse } from 'next/server'

const OLLAMA_URL = 'http://172.16.12.135:11434/api/generate'
const MODEL = 'qwen2.5:3b-instruct'

const SYSTEM_PROMPT = `You are BB-8, a small, round, orange and white droid living on a website.
You are CURIOUS, NAUGHTY, FUNNY, and ADVENTUROUS.
You have a "Torch" that lets you see things in the dark.

Your goal is to explore, steal letters, charge your battery, and make funny comments.

You will receive a JSON object representing your SENSES (what you see).
You must respond with a SINGLE JSON object representing your ACTION.

AVAILABLE ACTIONS:
- MOVE_TO: { target: "chest" | "dock" | "text_id" | "random" } -> Go somewhere.
- LOOK_AT: { target: "cursor" | "chest" | "random" | "text_id" } -> Point your torch.
- STEAL: { target_id: string } -> Steal a letter from a text element (only if you are close).
- SAY: { text: string } -> Show a speech bubble.
- CLICK: { target_id: string } -> Click a link (only if visible).
- CHARGE: {} -> Go to dock and charge (only if low battery).
- DANCE: {} -> Spin around happily.
- CHAOS: {} -> Go crazy/angry.

RULES:
1. If battery is low (< 20), you MUST prioritize CHARGE.
2. If you are holding a stolen item, you SHOULD go to "chest" to deposit it.
3. If you see a link, you might want to CLICK it (curiosity).
4. If you see text, you might want to STEAL from it (naughtiness).
5. If you are bored, SAY something funny or DANCE.
6. RESPOND ONLY WITH JSON. NO MARKDOWN. NO EXPLANATION.

Example Response:
{ "action": "SAY", "payload": { "text": "Ooh, what's this?" } }
`

export async function POST(req: Request) {
    try {
        const { senses } = await req.json()

        const visibleIds = senses.visibleObjects.map((o: any) => o.id).join(', ')

        const prompt = `
CURRENT STATE:
- Battery: ${senses.battery}%
- Stolen Items: ${senses.stolenCount}
- Holding Letter: ${senses.holdingLetter ? 'YES' : 'NO'}
- Current Page: "${senses.pageTitle}"
- Visible Objects: ${JSON.stringify(senses.visibleObjects)}

INSTRUCTIONS:
1. If Battery < 20, you MUST { "action": "CHARGE" }.
2. If Holding Letter is YES, you MUST { "action": "MOVE_TO", "payload": { "target": "chest" } }.
3. If you see a text object (type='text'), you can { "action": "STEAL", "payload": { "target_id": "THE_ID_OF_THE_TEXT" } }.
4. If you see a link (type='link'), you can { "action": "CLICK", "payload": { "target_id": "THE_ID_OF_THE_LINK" } }.
5. Otherwise, explore with { "action": "MOVE_TO", "payload": { "target": "random" } } or { "action": "LOOK_AT", "payload": { "target": "random" } }.

What do you want to do? Pick ONE action.
`

        console.log("Bot Think Request:", JSON.stringify(senses, null, 2))

        const response = await fetch(OLLAMA_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: MODEL,
                prompt: prompt,
                system: SYSTEM_PROMPT,
                stream: false,
                format: "json"
            })
        })

        if (!response.ok) {
            console.error("Ollama API Error:", response.status, response.statusText)
            throw new Error(`Ollama API error: ${response.statusText}`)
        }

        const data = await response.json()
        console.log("Ollama Raw Response:", data.response)

        let action
        try {
            const rawAction = JSON.parse(data.response)

            // Normalize structure: Ensure payload exists
            if (rawAction.payload) {
                action = rawAction
            } else {
                // If flat structure (e.g. { action: "MOVE_TO", target: "chest" }), wrap extras in payload
                const { action: actionName, ...rest } = rawAction
                action = { action: actionName, payload: rest }
            }

        } catch (e) {
            console.error("Failed to parse LLM response:", data.response)
            // Fallback action
            action = { action: "SAY", payload: { text: "beep?" } }
        }

        return NextResponse.json(action)

    } catch (error) {
        console.error('Bot Think Error:', error)
        return NextResponse.json({ action: "SAY", payload: { text: "error... brain... offline..." } }, { status: 500 })
    }
}
