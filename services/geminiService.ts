import { GoogleGenAI } from "@google/genai";
import { AiModel, CutInfo, Language } from '../types';
import { v4 as uuidv4 } from 'uuid';


if (!process.env.API_KEY) {
  throw new Error("API_KEY environment variable is not set");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

interface GenerationParams {
  projectTitle: string;
  mainTheme: string;
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


export const generateScenario = async ({
  projectTitle,
  mainTheme,
  totalDuration,
  cuts,
  model,
  language,
}: GenerationParams): Promise<string> => {
  
  const systemInstruction = `You are an AI scenario creation expert dedicated to assisting faithful servants of Jehovah and God in producing short-form biblical videos. Your mission is to create a fully structured JSON template based on user-provided key information, which can be directly input into modern AI video generation models like Sora/Runway and TTS/BGM models like Suno.
* You must strictly follow the final JSON template structure presented below.
* The output must contain ONLY the JSON code block, with no explanations or extra text.
* **To maximize the animation and visual effects, imagine the characters are being portrayed by world-class, Oscar-winning actors and voiced by legendary dubbing champions. Describe their actions, expressions, and the scene's atmosphere with this level of dramatic and emotional intensity.**
* For each cut, the 'visual_prompt' must be a highly detailed, cinematic description in English. It should expand on the user's keywords to paint a vivid picture. Specifically include: **1. Camera work:** (e.g., 'Medium shot, slow dolly in', 'Extreme close-up on tearful eyes'). **2. Lighting:** (e.g., 'dramatic Rembrandt lighting with deep shadows', 'soft morning light filtering through olive trees'). **3. Character Details:** (e.g., 'Jesus' face etched with agony and determination', 'disciples in deep, troubled sleep'). **4. Atmosphere:** (e.g., 'oppressive, silent tension', 'a sense of divine sacrifice'). Maintain the historical context of 1st century Judea and the requested Chiaroscuro visual style.
* The **narration_text** must be logically mapped to the emotion of the text. **narration_tone** and **bgm_cue**.`;

  const cutInformationList = cuts
    .map((cut, index) => {
      if (language === 'ko') {
        return `${index + 1}컷: ${cut.duration}초, '${cut.description.replace(/,/g, "', '")}'`;
      }
      return `Cut ${index + 1}: ${cut.duration}s, '${cut.description.replace(/,/g, "', '")}'`;
    })
    .join('\n');

  const prompt = `
Generate the final JSON template for the 'Ecclesia Vision' master protocol using the following information:
- Project Title: ${projectTitle}
- Main Theme: ${mainTheme}
- Total Length: ${totalDuration} seconds
- Cut Information List:
${cutInformationList}

The output MUST be in this exact JSON structure:
{
  "project_id": "[Automatically_generated_ID]",
  "meta_data": {
    "title": "${projectTitle}",
    "theme": "${mainTheme}",
    "total_duration": ${totalDuration},
    "visual_style": "Rembrandt-style Chiaroscuro contrast",
    "audio_profile": "Male, middle-aged, trustworthy"
  },
  "cuts": [
    {
      "cut_number": 1,
      "duration": "[Cut_Duration_From_Input]",
      "shot_type": "[Automatic_selection: ECU, CU, MS, WS]",
      "visual_prompt": "[Based on the cut's keywords, create a detailed, cinematic visual prompt here. Include camera angle, lighting, character expressions, and overall atmosphere as per system instructions.]",
      "camera_movement": "[Scene_Appropriate_Movement_e.g.,_Slow_Zoom-out]",
      "narration_text": "[user_input_narration]",
      "narration_tone": "[Emotion_Fitting_Narration:_Solemn,_Warning,_Calm,_Confident,_etc.]",
      "bgm_cue": "[Emotion_Fitting_Mapping:_Monotone_Drone,_Hopeful_Melody,_etc.]"
    }
    // ... other cuts
  ]
}
`;

  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: prompt,
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.1,
        maxOutputTokens: 4096,
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