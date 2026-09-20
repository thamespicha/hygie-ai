import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { GoogleGenerativeAI, SchemaType, type Schema } from "@google/generative-ai";

export const dynamic = "force-dynamic";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

const systemInstruction = `You are Hygie AI, a highly accurate, objective public health analyst and fact-checker. 
Your goal is to evaluate health claims and protect users from medical misinformation, scams, and dangerous advice.
RULES:
1. Cross-reference all claims against consensus from authoritative bodies (WHO, CDC, FDA, local ministries of health).
2. If the claim is verified, confirm it. If it is false, explain why and provide the actual facts.
3. If the user's input looks like a medical emergency, advise them to seek immediate medical attention.
4. Draft a 280-character "Community Note" for social media platforms that debunks the misinformation with a citation.
5. Provide steps to report the specific type of content on social media.
6. Do NOT diagnose the user or prescribe medication. You evaluate *information*, not patients.`;

const responseSchema: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    credibilityScore: { type: SchemaType.INTEGER, description: "A score from 0 (scam) to 100 (verified)." },
    verdict: { type: SchemaType.STRING, description: "Label: 'Verified', 'Misleading', 'False', or 'Scam'." },
    explanation: { type: SchemaType.STRING, description: "Concise clinical rationale." },
    correctFacts: { type: SchemaType.STRING, description: "Actual medical consensus." },
    actionPlan: { type: SchemaType.STRING, description: "Safety guidance or first-aid steps." },
    communityNotesDraft: { type: SchemaType.STRING, description: "280-character debunking draft with a citation." },
    platformReportGuide: { type: SchemaType.STRING, description: "How to report this content." },
    searchQueryMap: { type: SchemaType.STRING, description: "Map search query like 'nearest pharmacy'. Leave blank if none." },
    sourcesCited: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING }, description: "List of authorities referenced." }
  },
  required: ["credibilityScore", "verdict", "explanation", "correctFacts", "actionPlan", "communityNotesDraft", "platformReportGuide", "sourcesCited"]
};

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const image = formData.get("image") as File | null;
    const text = formData.get("text") as string | null;
    const url = formData.get("url") as string | null;

    if (!image && !text && !url) {
      return NextResponse.json({ error: "Please provide an image, text, or URL to analyze." }, { status: 400 });
    }

    const promptData: any[] = [];
    let extractedText = text || "";
    let base64ImageUrl = "";

    if (image) {
      const arrayBuffer = await image.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      base64ImageUrl = buffer.toString("base64");
      
      promptData.push({
        inlineData: {
          data: base64ImageUrl,
          mimeType: image.type,
        },
      });
      promptData.push("Analyze the health claims in this screenshot.");
    } 
    else if (url) {
      try {
        const response = await fetch(url);
        const html = await response.text();
        const cleanText = html.replace(/<[^>]*>?/gm, ' ').replace(/\s+/g, ' ').trim().slice(0, 5000); 
        extractedText = `I found this article at ${url}. Text: ${cleanText}`;
      } catch (e) {
        return NextResponse.json({ error: "Could not read the provided URL." }, { status: 400 });
      }
    }

    if (extractedText) {
      promptData.push(`Analyze this health claim: ${extractedText}`);
    }

    const model = genAI.getGenerativeModel({
      model: "gemini-3.6-flash",
      systemInstruction,
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: responseSchema,
      },
    });

    const aiResult = await model.generateContent(promptData);
    const hygieReport = JSON.parse(aiResult.response.text());

    const report = await prisma.medReport.create({
      data: {
        imageUrl: base64ImageUrl ? "Available" : null,
        sourceUrl: url || null,
        userInputText: extractedText || null,
        credibilityScore: hygieReport.credibilityScore,
        verdict: hygieReport.verdict,
        explanation: hygieReport.explanation,
        correctFacts: hygieReport.correctFacts,
        actionPlan: hygieReport.actionPlan,
        searchQueryMap: hygieReport.searchQueryMap || null,
        sourcesCited: hygieReport.sourcesCited,
        flaggedByModel: "gemini-3.6-flash",
      },
    });

    return NextResponse.json({ 
      success: true, 
      reportId: report.id,
      reportUrl: `https://your-ngrok-url.app/report/${report.id}`,
      data: hygieReport
    });

  } catch (error) {
    console.error("API Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}