import express from 'express';
import type { Request, Response } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json({ limit: '20mb' }));

const apiKey = process.env.GEMINI_API_KEY;

const ai = new GoogleGenAI({
  apiKey: apiKey,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

app.post('/api/analyze', async (req: Request, res: Response) => {
  try {
    const { text, imageBase64, mimeType, category } = req.body;

    if (!text && !imageBase64) {
      return res.status(400).json({ error: 'Please provide either text evidence or an uploaded screenshot.' });
    }

    const parts: any[] = [];

    if (imageBase64 && mimeType) {
      parts.push({
        inlineData: {
          mimeType: mimeType,
          data: imageBase64,
        },
      });
    }

    const categoryText = category ? `Case Category: ${category}` : 'Case Category: General Suspicion';
    const contentText = text
      ? `EVIDENCE CONTENT:\n"""\n${text}\n"""`
      : 'EVIDENCE CONTENT: [Screenshot image provided above]';

    parts.push({
      text: `${categoryText}\n${contentText}\n\nPlease analyze this Indian context communication/claim strictly according to your system instructions. Return concise JSON fast.`,
    });

    const systemInstruction = `You are a fraud and misinformation analyst focused on India. Analyze the user's input. Return ONLY valid JSON: { score: number 0-100 (0 = definitely fake, 100 = looks safe), verdict: 'Likely Fake' | 'Suspicious' | 'Looks Safe', summary: string, redFlags: [{ title, reason, quote }], verifySteps: [string], extractedText: string }. Keep output concise and fast: summary under 20 words, maximum 4 red flags, each reason under 20 words, maximum 4 verify steps. 'quote' must be the exact phrase copied from the user's input that triggered the flag. Describe signals only, never accuse named companies or people. Official bank alerts with no links, no urgency and no request for personal data should score 80+ and be 'Looks Safe'. Verify steps must be India-relevant (call 1930, use official websites, never share UPI PIN or OTP). If an image was submitted, transcribe all legible text from the screenshot into 'extractedText'. If text was pasted, set 'extractedText' to the user's text verbatim.`;

    let response: any;
    // Fastest Flash model available first ('gemini-3.1-flash-lite')
    const candidateModels = ['gemini-3.1-flash-lite', 'gemini-flash-latest', 'gemini-3.8-flash'];
    let lastError: any = null;

    for (const model of candidateModels) {
      try {
        response = await ai.models.generateContent({
          model,
          contents: { parts },
          config: {
            systemInstruction,
            temperature: 0.2,
            thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                score: {
                  type: Type.INTEGER,
                  description: '0 to 100 (0 = definitely fake, 100 = looks safe)',
                },
                verdict: {
                  type: Type.STRING,
                  description: "Must be exactly 'Likely Fake', 'Suspicious', or 'Looks Safe'",
                },
                summary: {
                  type: Type.STRING,
                  description: 'Concise summary under 20 words',
                },
                redFlags: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      title: { type: Type.STRING, description: 'Short bold title for the red flag' },
                      reason: { type: Type.STRING, description: 'One-line reason under 20 words' },
                      quote: { type: Type.STRING, description: 'Exact phrase copied from the input' },
                    },
                    required: ['title', 'reason', 'quote'],
                  },
                },
                verifySteps: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: 'Max 4 India-relevant verification steps (call 1930, official apps, never enter UPI PIN)',
                },
                extractedText: {
                  type: Type.STRING,
                  description: 'The verbatim text of the case evidence',
                },
              },
              required: ['score', 'verdict', 'summary', 'redFlags', 'verifySteps'],
            },
          },
        });
        if (response && response.text) {
          break; // Successfully got response
        }
      } catch (err: any) {
        lastError = err;
        console.warn(`Model ${model} failed, attempting candidate fallback...`, err?.message || err);
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
    }

    if (!response || !response.text) {
      throw lastError || new Error('All model candidates failed to respond.');
    }

    let rawText = response.text || '{}';
    // Strip any markdown code fences if present
    rawText = rawText.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim();

    let data: any;
    try {
      data = JSON.parse(rawText);
    } catch (parseError) {
      console.error('Failed to parse model output as JSON:', rawText);
      return res.status(500).json({ error: 'Failed to parse model analysis output.' });
    }

    // Normalizations & sanity checks
    if (typeof data.score !== 'number' || isNaN(data.score)) {
      data.score = 50;
    }
    data.score = Math.max(0, Math.min(100, Math.round(data.score)));

    if (!['Likely Fake', 'Suspicious', 'Looks Safe'].includes(data.verdict)) {
      if (data.score <= 35) data.verdict = 'Likely Fake';
      else if (data.score <= 75) data.verdict = 'Suspicious';
      else data.verdict = 'Looks Safe';
    }

    if (!Array.isArray(data.redFlags)) {
      data.redFlags = [];
    } else {
      data.redFlags = data.redFlags.slice(0, 4);
    }

    if (!Array.isArray(data.verifySteps) || data.verifySteps.length === 0) {
      data.verifySteps = [
        'Call 1930 (National Cyber Crime Helpline) if funds were debited.',
        'Never share or enter UPI PIN when receiving refunds or claims.',
        'Verify transactions solely via your official mobile banking app.'
      ];
    } else {
      data.verifySteps = data.verifySteps.slice(0, 4);
    }

    if (!data.extractedText) {
      data.extractedText = text || 'Screenshot image analysis';
    }

    return res.json(data);
  } catch (err: any) {
    console.error('API /api/analyze error:', err);
    return res.status(500).json({
      error: err?.message || 'The desk could not complete analysis. Please try again.',
    });
  }
});

// Vite middleware for development, static server for production
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== 'true',
        watch: process.env.DISABLE_HMR === 'true' ? null : {},
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`TrustLens Desk running on port ${PORT}`);
  });
}

startServer();
