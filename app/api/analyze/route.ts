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

async function generateWithFallback(promptData: any[], systemInstruction: string, responseSchema: Schema) {
  // Ordered from fastest/cheapest to most advanced/experimental
  const fallbackChain = [
    "gemini-2.5-flash",
    "gemini-2.5-flash-lite",
    "gemini-2.5-pro",
    "gemini-3-flash-preview",
    "gemini-3.1-flash-lite",
    "gemini-3.5-flash",
    "gemini-3.1-flash-live-preview" 
  ];

  let lastError = null;

  // Loop through the models sequentially
  for (const modelName of fallbackChain) {
    try {
      console.log(`🔄 Attempting to use model: ${modelName}`);
      
      const currentModel = genAI.getGenerativeModel({
        model: modelName,
        systemInstruction,
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: responseSchema,
        },
      });

      // If this succeeds, it returns the result and instantly exits the loop
      const result = await currentModel.generateContent(promptData);
      console.log(`✅ Success with model: ${modelName}`);
      
      return result; 

    } catch (error: any) {
      // If it fails (e.g., 503 error), catch it, log it, and let the loop continue to the next model
      console.warn(`⚠️ Model ${modelName} failed. Reason: ${error.message}`);
      lastError = error;
    }
  }

  // If the loop finishes and absolutely every model failed, throw a final error so the API doesn't hang
  console.error("❌ All models in the fallback chain failed.");
  throw new Error(`Fallback cascade exhausted. Last error: ${lastError?.message}`);
}

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get("content-type") || "";
    
    let image: File | null = null;
    let text: string | null = null;
    let url: string | null = null;
    let latRaw: string | number | null = null;
    let lonRaw: string | number | null = null;
    let jsonBase64Image: string | null = null;

    if (contentType.includes("application/json")) {
      const json = await req.json();
      text = json.text || null;
      url = json.url || null;
      latRaw = json.latitude || null;
      lonRaw = json.longitude || null;
      jsonBase64Image = json.imageBase64 || json.image || null; 
    } else {
      const formData = await req.formData();
      image = formData.get("image") as File | null;
      text = formData.get("text") as string | null;
      url = formData.get("url") as string | null;
      latRaw = formData.get("latitude") as string | null;
      lonRaw = formData.get("longitude") as string | null;
    }

    const latitude = latRaw ? parseFloat(latRaw.toString()) : null;
    const longitude = lonRaw ? parseFloat(lonRaw.toString()) : null;

    if (!image && !jsonBase64Image && !text && !url) {
      return NextResponse.json({ error: "Please provide an image, text, or URL to analyze." }, { status: 400 });
    }

    const promptData: any[] = [];
    let extractedText = text || "";
    let base64ImageUrl = "";

    if (image || jsonBase64Image) {
      let mimeType = "image/jpeg"; // default for json base64
      
      if (image) {
        const arrayBuffer = await image.arrayBuffer();
        base64ImageUrl = Buffer.from(arrayBuffer)
          .toString("base64")
          .replace(/\s+/g, ""); // Strip any rogue whitespace
        mimeType = image.type;
      } else if (jsonBase64Image) {
        // Try to extract mimeType if provided in a data URL prefix
        const matches = jsonBase64Image.match(/^data:(image\/\w+);base64,/);
        if (matches) {
          mimeType = matches[1];
        }
        
        // Clean the incoming Base64 string from the iOS Shortcut (or elsewhere)
        base64ImageUrl = jsonBase64Image
          .replace(/^data:image\/\w+;base64,/, "") // 1. Strip the data:image prefix
          .replace(/\s+/g, "");                    // 2. Strip all line breaks and spaces
      }
      
      promptData.push({
        inlineData: {
          data: base64ImageUrl,
          mimeType: mimeType,
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

    if (latitude && longitude) {
      promptData.push(
        `User geographic coordinates: Latitude ${latitude}, Longitude ${longitude}. Tailor any emergency numbers, regional health authority citations, and facility recommendations to this location.`
      );
    }

    const aiResult = await generateWithFallback(promptData, systemInstruction, responseSchema);
    const hygieReport = JSON.parse(aiResult.response.text());

    const report = await prisma.medReport.create({
      data: {
        imageUrl: base64ImageUrl ? "Available" : null,
        sourceUrl: url || null,
        userInputText: extractedText || null,
        latitude: latitude || null,
        longitude: longitude || null,
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
      verdict: hygieReport.verdict,
      credibilityScore: hygieReport.credibilityScore,
      explanation: hygieReport.explanation,
      reportUrl: `https://hygie-ai.vercel.app/report/${report.id}`,
      data: hygieReport
    });

  } catch (error) {
    console.error("API Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}