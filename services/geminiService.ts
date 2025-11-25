
import { GoogleGenAI, Content } from "@google/genai";
import { CircuitMode, CircuitState, ViewAngle } from "../types";

// Helper to clean base64 string
const cleanBase64 = (data: string) => {
  return data.replace(/^data:image\/(png|jpeg|jpg|webp);base64,/, '');
};

const getClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API Key not found");
  }
  return new GoogleGenAI({ apiKey });
};

/**
 * Generates an image based on a text prompt using Nano Banana (gemini-2.5-flash-image).
 */
export const generateImageAsset = async (prompt: string): Promise<string> => {
  const ai = getClient();
  
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [{ text: prompt }]
      },
      config: {
        // Nano banana does not support responseMimeType or tools
        // It outputs base64 in inlineData
      }
    });

    // Extract image
    for (const candidate of response.candidates || []) {
      for (const part of candidate.content.parts) {
        if (part.inlineData && part.inlineData.data) {
          return `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
        }
      }
    }
    throw new Error("No image generated");
  } catch (error) {
    console.error("Image generation failed:", error);
    throw error;
  }
};

/**
 * Internal helper to generate a single angle try-on.
 */
const generateSingleAngleTryOn = async (
  personBase64: string, 
  garmentBase64: string, 
  viewAngle: ViewAngle,
  clothingContext?: string
): Promise<string> => {
  const ai = getClient();

  const anglePrompts: Record<ViewAngle, string> = {
    'front': "front view, facing camera directly",
    'back': "back view, showing the back of the outfit",
    'left45': "45-degree side view from the left",
    'right45': "45-degree side view from the right",
    'left90': "90-degree profile view from the left side",
    'right90': "90-degree profile view from the right side"
  };

  const angleText = anglePrompts[viewAngle] || anglePrompts['front'];
  
  // Construct a prompt that asks for a context-aware background
  const contextInstruction = clothingContext 
    ? `The clothing is described as: "${clothingContext}".` 
    : "Analyze the style of the clothing to determine a suitable setting.";

  const prompt = `Generate a high-quality, photorealistic full-body image of the person in the first image wearing the clothing shown in the second image. The person should have an Asian face.
  
  ${contextInstruction}
  
  **View Angle**: ${angleText}.
  
  **Background & Atmosphere**: 
  Instead of a plain studio background, place the model in a realistic, high-quality environment that perfectly matches the style and occasion of the outfit. 
  - If the outfit is casual/streetwear, use a blurred city street, cafe, or urban park.
  - If the outfit is formal/evening wear, use a luxury hotel lobby, gala, or red carpet background.
  - If the outfit is swimwear/resort wear, use a beach or pool setting.
  - If the outfit is business attire, use a modern office or architectural background.
  
  Ensure the lighting on the person matches the generated environment. The result should look like a professional fashion magazine photo.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          { 
            inlineData: { 
              mimeType: 'image/png', 
              data: cleanBase64(personBase64) 
            } 
          },
          { 
            inlineData: { 
              mimeType: 'image/png', 
              data: cleanBase64(garmentBase64) 
            } 
          },
          { text: prompt }
        ]
      }
    });

    // Extract image
    for (const candidate of response.candidates || []) {
      for (const part of candidate.content.parts) {
        if (part.inlineData && part.inlineData.data) {
          return `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
        }
      }
    }
    throw new Error(`Try-on generation failed for angle ${viewAngle}`);
  } catch (error) {
    console.error(`Try-on failed for ${viewAngle}:`, error);
    throw error;
  }
};

/**
 * Performs the "Try On" operation for ALL defined angles in parallel.
 */
export const generateBatchTryOn = async (
  personBase64: string, 
  garmentBase64: string,
  angles: ViewAngle[],
  clothingContext?: string
): Promise<Record<ViewAngle, string>> => {
  
  // Create an array of promises
  const promises = angles.map(angle => 
    generateSingleAngleTryOn(personBase64, garmentBase64, angle, clothingContext)
      .then(result => ({ angle, result }))
  );

  const results = await Promise.all(promises);

  // Reduce to map
  const resultMap: Partial<Record<ViewAngle, string>> = {};
  results.forEach(({ angle, result }) => {
    resultMap[angle] = result;
  });

  return resultMap as Record<ViewAngle, string>;
};

/**
 * Sends a chat message to Gemini with circuit context.
 */
export const sendMessageToGemini = async (
  message: string,
  history: Content[],
  mode: CircuitMode,
  state: CircuitState
): Promise<string> => {
  const ai = getClient();

  const systemInstruction = `You are Ampere, a physics tutor assistant helping a student with a circuit simulator.
  
  Current Circuit Status:
  - Mode: ${mode}
  - Switch: ${state.isSwitchClosed ? 'Closed' : 'Open'}
  - Voltage: ${state.voltage}V
  - Resistance 1: ${state.resistance1}Ω
  - Resistance 2: ${state.resistance2}Ω
  - Capacitance: ${state.capacitance}μF
  
  Answer questions based on this state. If the switch is open, remind the user that no current flows (unless discharging in RC).
  Keep answers concise, encouraging, and educational.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [...history, { role: 'user', parts: [{ text: message }] }],
      config: {
        systemInstruction: systemInstruction,
      }
    });

    return response.text || "I couldn't understand that.";
  } catch (error) {
    console.error("Chat error:", error);
    throw error;
  }
};
