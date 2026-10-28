# TrustLens

**An AI trust checker that analyzes messages, screenshots, and claims, flags scam or misleading signals, and tells users what to verify before they act.**

**Live demo:** https://trustlens-india.ai.studio
**Built for:** InnoVortex 4.0

---

## Problem
Millions of Indians receive fake UPI refund messages, fake internship offers, phishing links, KYC scams, and misleading "eco-friendly" claims. Most people cannot tell real from fake in time, and by the time they do, the money or data is gone.

## Solution
Paste a message or upload a screenshot. In seconds TrustLens returns:
- A **Trust Score (0-100)** and a verdict: Likely Fake, Suspicious, or Looks Safe
- The **exact suspicious phrases**, highlighted in your own text
- A **red flags list** with a short reason for each
- A **"Before you act" checklist** with India-specific steps (call 1930, use official websites, never share your UPI PIN or OTP)

## Features
- Text and screenshot analysis (Gemini vision)
- Phrase-level highlighting with numbered red flags
- Category modes for different kinds of messages
- Case log of the last 5 checks, stored only on the user's device
- No login, no database, no personal data stored on a server
- Editorial "case file" interface designed to feel calm and trustworthy

## How it works
1. The user pastes text or uploads a screenshot and picks a category.
2. The app sends it to a Gemini model with a fraud-analyst system instruction focused on India.
3. The model returns structured JSON: score, verdict, summary, red flags with exact quotes, and verify steps.
4. The UI renders a case report with a verdict stamp, a score ruler, and highlighted phrases.

## Tech stack
| Layer | Tool |
|---|---|
| App | Built with Google AI Studio (Build), React + TypeScript |
| AI | Gemini Flash (text and vision) |
| Storage | Browser localStorage (case log) |
| Hosting | AI Studio publish |

## Testing
We tested TrustLens with 7 real-style inputs (3 scams, 2 suspicious claims, 2 genuine messages) and edge cases: very short text, Hinglish, long text, screenshot upload, and page refresh.


## Limitations
- AI can be wrong. TrustLens gives a risk indication, not proof.
- It does not verify live sender identity or check links against databases.
- It describes signals only and never accuses named people or companies.

## Future scope
- Supabase backend for community scam reports and live statistics
- Hindi and regional language support
- WhatsApp / Telegram bot
- Browser extension for links and messages
- Direct reporting to the 1930 helpline and cybercrime portal

## Team TriNetra

- **Ayush Raj**, DSEU
- **Harshita Goyal**, IGDTUW
- **Sharyansh Gupta**, DTU
- **Anjali Singh**, DSEU
- 
## Disclaimer
TrustLens is an educational project built for a hackathon. Always verify through official sources before acting on any message.
