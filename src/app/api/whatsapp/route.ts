import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { Twilio } from "twilio";

// Initialize Twilio Client
const twilioClient = new Twilio(
  process.env.TWILIO_ACCOUNT_SID!,
  process.env.TWILIO_AUTH_TOKEN!
);

// Initialize OpenAI Client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log("Incoming Twilio request:", body);

    const { Body, From } = body; // Extract message text and sender's number

    if (!Body || !From) {
      return NextResponse.json(
        { error: "Invalid request payload." },
        { status: 400 }
      );
    }

    // Step 1: Send the message to OpenAI GPT-4
    const aiResponse = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [{ role: "user", content: Body }],
      max_tokens: 200,
    });

    const replyText = aiResponse.choices[0]?.message?.content || "I'm here to help!";

    // Step 2: Send the response back via Twilio WhatsApp API
    await twilioClient.messages.create({
        from: `whatsapp:${process.env.TWILIO_PHONE_NUMBER}`, // Twilio Sandbox Number (e.g., whatsapp:+14155238886)
        to: "whatsapp:+923020012190", // Replace with your actual WhatsApp number
        body: replyText,
      });
      

    // Return success response
    return NextResponse.json({
      success: true,
      message: "Message processed and reply sent.",
    });
  } catch (error: any) {
    console.error("Error processing request:", error);
    return NextResponse.json(
      { error: "Failed to process request", details: error.message },
      { status: 500 }
    );
  }
}




