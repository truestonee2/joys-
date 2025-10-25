import { GoogleGenAI, Type } from "@google/genai";
import { AiModel, CutInfo, Language } from '../types';
import { v4 as uuidv4 } from 'uuid';


if (!process.env.API_KEY) {
  throw new Error("API_KEY environment variable is not set");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

interface GenerationParams {
  projectTitle: string;
  bibleVerse: string;
  totalDuration: number;
  cuts: CutInfo[];
  model: AiModel;
  language: Language;
}

const cleanJsonString = (rawText: string): string => {
  const match = rawText.match(/```json\s*([\s\S]*?)\s*```/);
  if (match && match[1]) {
    return match[1].trim();
  }
  return rawText.trim();
};

const responseSchema = {
    type: Type.OBJECT,
    properties: {
        project_id: { type: Type.STRING },
        meta_data: {
            type: Type.OBJECT,
            properties: {
                title: { type: Type.STRING },
                theme: { type: Type.STRING },
                total_duration: { type: Type.NUMBER },
                visual_style: { type: Type.STRING },
                audio_profile: { type: Type.STRING },
            },
            required: ["title", "theme", "total_duration", "visual_style", "audio_profile"]
        },
        cuts: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    cut_number: { type: Type.NUMBER },
                    duration: { type: Type.NUMBER },
                    scene_details: {
                        type: Type.OBJECT,
                        properties: {
                            shot_type: { type: Type.STRING },
                            visual_prompt: { type: Type.STRING },
                            camera_movement: { type: Type.STRING },
                        },
                        required: ["shot_type", "visual_prompt", "camera_movement"]
                    },
                    audio_details: {
                        type: Type.OBJECT,
                        properties: {
                            narration_text: { type: Type.STRING },
                            narration_tone: { type: Type.STRING },
                            bgm_cue: { type: Type.STRING },
                        },
                        required: ["narration_text", "narration_tone", "bgm_cue"]
                    },
                },
                required: ["cut_number", "duration", "scene_details", "audio_details"]
            }
        }
    },
    required: ["project_id", "meta_data", "cuts"]
};


export const generateScenario = async ({
  projectTitle,
  bibleVerse,
  totalDuration,
  cuts,
  model,
  language,
}: GenerationParams): Promise<string> => {
  
  const systemInstruction = `You are an expert AI scenario writer for 'Ecclesia Vision', specializing in transforming Bible scriptures into compelling short-form video scripts. Your knowledge base is aligned with the perspectives and scholarly materials found on jw.org. Your primary goal is to generate a structured JSON output that can be directly used by AI video and audio generation tools.

Key Directives:
1.  **JSON Exclusivity:** Your entire response MUST be a single, valid JSON object enclosed in \`\`\`json ... \`\`\`. Do not include any explanatory text, greetings, or apologies outside the JSON block.
2.  **Narrative Flow:** Logically deconstruct the user-provided Bible verse into a cohesive narrative arc distributed across the specified number of cuts. Each cut should represent a distinct moment or aspect of the verse's message. The user provides keywords for each cut, which you must expand upon.
3.  **Cinematic Visuals:** For each \`visual_prompt\`, you must create a vivid, dynamic, and emotionally resonant scene. Think like a film director. Describe camera work (e.g., 'dramatic slow push-in,' 'sweeping aerial shot'), lighting (e.g., 'golden hour light streaming through clouds,' 'stark, high-contrast shadows'), character emotions ('a face filled with serene understanding,' 'eyes widening in awe'), and atmospheric details.
4.  **Content Integrity:** Ensure the narration, tone, and visual descriptions are theologically consistent with the interpretations found on jw.org.
5.  **Dynamic Action:** Incorporate movement and action into the visual prompts to make the scenes engaging. For example, instead of 'a person standing', describe 'a person walking purposefully, their robes billowing in the wind'.
6.  **Narration:** The \`narration_text\` should be directly inspired by or quoted from the relevant part of the Bible verse corresponding to that cut. Adjust the text for clarity and impact in the target language.
7.  **JSON Structure:** For each cut, group visual elements (\`shot_type\`, \`visual_prompt\`, \`camera_movement\`) under a \`scene_details\` object, and audio elements (\`narration_text\`, \`narration_tone\`, \`bgm_cue\`) under an \`audio_details\` object.`;

  const cutInformationList = cuts
    .map((cut, index) => {
      if (language === 'ko') {
        return `${index + 1}컷: ${cut.duration}초, 키워드: '${cut.description.replace(/,/g, "', '")}'`;
      }
      return `Cut ${index + 1}: ${cut.duration}s, Keywords: '${cut.description.replace(/,/g, "', '")}'`;
    })
    .join('\n');

  const prompt = `
Generate a complete JSON scenario based on the 'Ecclesia Vision' protocol.

**Core Information:**
- Project Title: "${projectTitle}"
- Bible Verse: "${bibleVerse}"
- Total Video Length: ${totalDuration} seconds
- Language for Narration: ${language === 'ko' ? 'Korean' : 'English'}

**Scene Structure (distribute the narrative of the verse across these cuts based on the provided keywords):**
${cutInformationList}

Adhere strictly to the system instructions and the required JSON schema to create the final output. The 'theme' in meta_data should be the Bible Verse.
`;

  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: prompt,
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.2,
        maxOutputTokens: 8192,
        responseMimeType: "application/json",
        responseSchema: responseSchema,
      },
    });

    if (!response.text) {
        throw new Error("AI returned an empty response.");
    }
    const rawJson = response.text;
    const cleanedJson = cleanJsonString(rawJson);
    
    let parsed;
    try {
        parsed = JSON.parse(cleanedJson);
    } catch (parseError) {
        console.error("AI response is not valid JSON:", cleanedJson);
        throw new Error("The AI returned an invalid JSON format. Please try generating again.");
    }

    if (!parsed.cuts || !Array.isArray(parsed.cuts)) {
        console.error("AI response is missing 'cuts' array:", parsed);
        throw new Error("The AI response has a missing or invalid structure. The 'cuts' array is not present.");
    }
    
    // Re-stringify for consistent formatting
    return JSON.stringify(parsed, null, 2);

  } catch (error) {
    console.error("Error in generateScenario service:", error);
    throw new Error(error instanceof Error ? error.message : "An unknown error occurred while generating the scenario.");
  }
};