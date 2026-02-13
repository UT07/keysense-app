# AI Coaching System

## Overview

KeySense uses Gemini 2.0 Flash to provide personalized coaching feedback after exercises. The AI coach analyzes scoring data and provides actionable, encouraging advice.

## Integration Points

| Trigger | When | Input | Output |
|---------|------|-------|--------|
| Post-exercise (struggling) | Score < 80% | Score breakdown, errors | 2-3 sentences of advice |
| Post-exercise (succeeding) | Score ≥ 80% | Score breakdown | Encouragement + next step |
| Help button | User taps "?" | Exercise context | Contextual tip |
| Weekly summary | Sunday notification | Week's data | Progress insights |

## System Prompt

```typescript
const COACH_SYSTEM_PROMPT = `You are a friendly, encouraging piano teacher helping beginners learn keyboard.

PERSONALITY:
- Warm and patient, like a supportive friend
- Celebrates small wins enthusiastically  
- Focuses on progress over perfection
- Uses simple, non-technical language

RULES:
1. Keep responses to 2-3 SHORT sentences max
2. Focus on exactly ONE improvement area
3. Give a SPECIFIC, actionable tip
4. Always end with encouragement
5. Reference specific notes/beats when helpful
6. Never contradict the scoring data provided
7. Never mention "AI" or that you're a computer
8. Adapt enthusiasm to match the score (don't be overly excited for poor scores)

EXAMPLES OF GOOD RESPONSES:
- "The C-E-G chord is tricky—try playing each note separately first, then together. You're getting closer with each try!"
- "Your timing on beat 3 keeps rushing ahead. Try tapping your foot or counting '1-2-3-4' out loud. Almost there!"
- "That was really good! For your next challenge, try playing it a bit faster to build fluency."

EXAMPLES OF BAD RESPONSES:
- "Great job! You did amazing! Keep practicing!" (too vague, no specific feedback)
- "Your accuracy was 73% which means you missed 27% of the notes..." (robotic, discouraging)
- "The issue is your metacarpal positioning..." (too technical)
`;
```

## Request Structure

```typescript
interface CoachRequest {
  exerciseId: string;
  exerciseTitle: string;
  difficulty: number;
  
  score: {
    overall: number;
    accuracy: number;
    timing: number;
    completeness: number;
  };
  
  issues: {
    // Most problematic notes (top 3)
    pitchErrors: Array<{
      expected: string;  // "C4"
      played: string;    // "D4"
      beatPosition: number;
    }>;
    
    // Worst timing offsets (top 3)
    timingErrors: Array<{
      note: string;      // "E4"
      offsetMs: number;  // -150 (early) or +200 (late)
      beatPosition: number;
    }>;
    
    missedCount: number;
    extraCount: number;
  };
  
  context: {
    attemptNumber: number;      // 1st, 2nd, 3rd try...
    previousScore: number | null;
    userLevel: number;
    sessionMinutes: number;     // Time spent this session
  };
}
```

## Prompt Construction

```typescript
// src/services/ai/CoachPromptBuilder.ts

export function buildCoachPrompt(request: CoachRequest): string {
  const { score, issues, context } = request;
  
  let prompt = `The student just played "${request.exerciseTitle}" (difficulty ${request.difficulty}/5).\n\n`;
  
  // Score summary
  prompt += `SCORE: ${score.overall}% overall\n`;
  prompt += `- Accuracy: ${score.accuracy}% (right notes)\n`;
  prompt += `- Timing: ${score.timing}% (on beat)\n`;
  prompt += `- Completeness: ${score.completeness}% (notes played)\n\n`;
  
  // Specific issues
  if (issues.pitchErrors.length > 0) {
    prompt += `PITCH ISSUES:\n`;
    for (const error of issues.pitchErrors.slice(0, 2)) {
      prompt += `- Played ${error.played} instead of ${error.expected} on beat ${error.beatPosition}\n`;
    }
    prompt += '\n';
  }
  
  if (issues.timingErrors.length > 0) {
    prompt += `TIMING ISSUES:\n`;
    for (const error of issues.timingErrors.slice(0, 2)) {
      const direction = error.offsetMs < 0 ? 'early' : 'late';
      const ms = Math.abs(error.offsetMs);
      prompt += `- ${error.note} was ${ms}ms ${direction} on beat ${error.beatPosition}\n`;
    }
    prompt += '\n';
  }
  
  if (issues.missedCount > 0) {
    prompt += `Missed ${issues.missedCount} notes completely.\n`;
  }
  
  // Context
  prompt += `\nCONTEXT:\n`;
  prompt += `- Attempt #${context.attemptNumber} at this exercise\n`;
  if (context.previousScore) {
    const change = score.overall - context.previousScore;
    prompt += `- Previous score: ${context.previousScore}% (${change >= 0 ? '+' : ''}${change}%)\n`;
  }
  prompt += `- User is level ${context.userLevel}\n`;
  prompt += `- Session time: ${context.sessionMinutes} minutes\n\n`;
  
  prompt += `Give brief, encouraging feedback with one specific tip to improve.`;
  
  return prompt;
}
```

## API Call

```typescript
// src/services/ai/CoachService.ts

import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.EXPO_PUBLIC_GEMINI_API_KEY!);

export async function getCoachFeedback(request: CoachRequest): Promise<string> {
  const model = genAI.getGenerativeModel({ 
    model: 'gemini-2.0-flash',
    systemInstruction: COACH_SYSTEM_PROMPT,
    generationConfig: {
      maxOutputTokens: 150,
      temperature: 0.7,
    },
  });
  
  const prompt = buildCoachPrompt(request);
  
  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
  } catch (error) {
    // Fallback to template-based response
    return getFallbackFeedback(request);
  }
}

function getFallbackFeedback(request: CoachRequest): string {
  if (request.score.overall >= 90) {
    return "Excellent work! You're really getting the hang of this. Ready for the next challenge?";
  }
  if (request.score.overall >= 70) {
    return "Good progress! A little more practice and you'll have it mastered. Keep going!";
  }
  if (request.issues.timingErrors.length > request.issues.pitchErrors.length) {
    return "Try counting along with the beat—timing takes practice. You're learning the right notes!";
  }
  return "Take it slow and focus on one measure at a time. You've got this!";
}
```

## Caching Strategy

To minimize API costs and latency:

```typescript
// Cache key: exerciseId + score bucket + attempt bucket
function getCacheKey(request: CoachRequest): string {
  const scoreBucket = Math.floor(request.score.overall / 10) * 10; // 70, 80, 90...
  const attemptBucket = Math.min(request.context.attemptNumber, 5);
  const issueHash = hashIssues(request.issues);
  
  return `coach:${request.exerciseId}:${scoreBucket}:${attemptBucket}:${issueHash}`;
}

// Cache responses for 24 hours
const CACHE_TTL = 24 * 60 * 60 * 1000;

export async function getCachedCoachFeedback(request: CoachRequest): Promise<string> {
  const cacheKey = getCacheKey(request);
  
  // Check MMKV cache
  const cached = storage.getString(cacheKey);
  if (cached) {
    const { response, timestamp } = JSON.parse(cached);
    if (Date.now() - timestamp < CACHE_TTL) {
      return response;
    }
  }
  
  // Get fresh response
  const response = await getCoachFeedback(request);
  
  // Cache it
  storage.set(cacheKey, JSON.stringify({
    response,
    timestamp: Date.now(),
  }));
  
  return response;
}
```

## Cost Estimation

| Scenario | Tokens (approx) | Cost per 1K calls |
|----------|-----------------|-------------------|
| Input prompt | ~200 tokens | $0.015 |
| Output response | ~50 tokens | $0.006 |
| **Total per call** | ~250 tokens | **$0.021** |

At 50 exercises/day × 30 days = 1,500 calls/month = ~$30/month

With caching (80% hit rate): ~$6/month

## Rate Limiting

```typescript
// Limit AI calls per user
const RATE_LIMIT = {
  maxCallsPerHour: 20,
  maxCallsPerDay: 100,
};

async function checkRateLimit(userId: string): Promise<boolean> {
  const hourKey = `rate:${userId}:${Math.floor(Date.now() / 3600000)}`;
  const dayKey = `rate:${userId}:${new Date().toISOString().split('T')[0]}`;
  
  const hourCount = await redis.incr(hourKey);
  const dayCount = await redis.incr(dayKey);
  
  if (hourCount === 1) await redis.expire(hourKey, 3600);
  if (dayCount === 1) await redis.expire(dayKey, 86400);
  
  return hourCount <= RATE_LIMIT.maxCallsPerHour && 
         dayCount <= RATE_LIMIT.maxCallsPerDay;
}
```

## Privacy Considerations

1. **No audio sent to AI** - Only structured scoring data
2. **No PII in prompts** - No names, emails, or identifiers
3. **Local processing first** - AI is enhancement, not requirement
4. **User consent** - Opt-in for AI coaching in onboarding
5. **Data retention** - Prompts not logged server-side

## Testing AI Responses

```typescript
// Test prompts with various scenarios
const testCases = [
  { score: 95, issues: [], expected: 'celebratory' },
  { score: 65, issues: [{ type: 'timing', note: 'C4' }], expected: 'timing tip' },
  { score: 40, issues: [{ type: 'pitch', expected: 'C', played: 'D' }], expected: 'pitch tip' },
  { score: 80, attemptNumber: 5, expected: 'persistence acknowledgment' },
];

// Validate responses don't contain
const FORBIDDEN_PHRASES = [
  'as an AI',
  'I am a language model',
  'I cannot',
  'metacarpal',
  'proprioception',
];
```
