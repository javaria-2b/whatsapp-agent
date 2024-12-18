import { NextRequest, NextResponse } from 'next/server';
import twilio from 'twilio';
import OpenAI from 'openai';
import { z } from 'zod';

// Zod schema for input validation
const WhatsAppMessageSchema = z.object({
  Body: z.string().min(1, 'Message cannot be empty'),
  From: z.string().startsWith('whatsapp:')
});

// Configure Twilio client
const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID, 
  process.env.TWILIO_AUTH_TOKEN
);

// Configure OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Conversation context interface
interface ConversationContext {
  id: string;
  messages: Array<{
    role: 'user' | 'assistant' | 'system';
    content: string;
  }>;
  createdAt: Date;
}

// In-memory context storage (replace with Redis/database in production)
const contextStore = new Map<string, ConversationContext>();

export async function POST(req: NextRequest) {
  try {
    // Correctly await and parse FormData
    const formData = await req.formData();
    
    // Convert FormData to a plain object
    const body = Object.fromEntries(formData.entries());

    // Validate payload
    const validatedData = WhatsAppMessageSchema.parse({
      Body: body.Body,
      From: body.From
    });

    // Retrieve or create conversation context
    const conversationId = validatedData.From;
    const context = contextStore.get(conversationId) || {
      id: conversationId,
      messages: [
        { 
          role: 'system', 
          content: 'You are a helpful WhatsApp assistant. Provide concise and helpful responses.' 
        }
      ],
      createdAt: new Date()
    };

    // Add user message to context
    context.messages.push({
      role: 'user',
      content: validatedData.Body
    });

    // Generate AI response
    const aiResponse = await generateAIResponse(context);

    // Add AI response to context
    context.messages.push({
      role: 'assistant',
      content: aiResponse
    });

    // Store updated context
    contextStore.set(conversationId, context);

    // Send WhatsApp response via Twilio
    await twilioClient.messages.create({
      from: `whatsapp:${process.env.TWILIO_PHONE_NUMBER}`,
      body: aiResponse,
      to: conversationId
    });

    // Respond to Twilio webhook
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    // Comprehensive error handling
    console.error('WhatsApp Bot Error:', error);

    // Handle Zod validation errors
    if (error instanceof z.ZodError) {
      return NextResponse.json({ 
        error: 'Invalid request',
        details: error.errors 
      }, { status: 400 });
    }

    // Send error message via Twilio
    if (error instanceof Error) {
      try {
        await twilioClient.messages.create({
          from: `whatsapp:${process.env.TWILIO_PHONE_NUMBER}`,
          body: 'Sorry, I encountered an error processing your request.',
          to: 'whatsapp:+1234567890' // Fallback number
        });
      } catch (twilioError) {
        console.error('Failed to send Twilio error message:', twilioError);
      }
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function generateAIResponse(context: ConversationContext): Promise<string> {
  try {
    // Limit context to prevent token overflow
    const recentMessages = context.messages.slice(-6);

    // OpenAI API call with streaming support
    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: recentMessages.map(msg => ({
        role: msg.role,
        content: msg.content
      })),
      max_tokens: 150,
      temperature: 0.7
    });

    return completion.choices[0]?.message?.content || 'I could not generate a response.';
  } catch (error) {
    console.error('AI Response Generation Error:', error);
    return 'Sorry, I am unable to generate a response right now.';
  }
}