import { GoogleGenAI, Modality, Type, FunctionDeclaration, LiveServerMessage } from "@google/genai";
import { AssistantStatus, FunctionCallInfo, GroundingSource } from '../types.ts';

// Type definition for the LiveSession object, which is not explicitly exported by the SDK
type LiveSession = {
  sendRealtimeInput: (params: { media: { data: string; mimeType: string } }) => void;
  sendToolResponse: (params: any) => void;
  close: () => void;
};

// --- Audio Helper Functions ---

function encode(bytes: Uint8Array) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

// --- Jarvis Service ---

const controlLightFunctionDeclaration: FunctionDeclaration = {
  name: 'setSmartHomeDeviceState',
  description: 'Sets the state of a smart home device, like a light or thermostat.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      deviceName: { type: Type.STRING, description: 'The name of the device, e.g., "living room light".' },
      state: { type: Type.STRING, description: 'The desired state, e.g., "on", "off", "dim".' },
      brightness: { type: Type.NUMBER, description: 'Optional brightness level from 0 to 100.' },
    },
    required: ['deviceName', 'state'],
  },
};

const generateImageFunctionDeclaration: FunctionDeclaration = {
  name: 'generateImageFromPrompt',
  description: 'Generates an image based on a detailed text description.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      prompt: { type: Type.STRING, description: 'A creative and descriptive prompt for the image to be generated.' },
    },
    required: ['prompt'],
  },
};

const generateStoryFunctionDeclaration: FunctionDeclaration = {
    name: 'generateStory',
    description: 'Generates a creative story based on a prompt.',
    parameters: {
        type: Type.OBJECT,
        properties: {
            prompt: { type: Type.STRING, description: 'The topic or theme for the story, e.g., "a story about a space pirate".' },
        },
        required: ['prompt'],
    },
};

const searchWebFunctionDeclaration: FunctionDeclaration = {
    name: 'searchWeb',
    description: 'Searches the web for up-to-date information on a given topic.',
    parameters: {
        type: Type.OBJECT,
        properties: {
            query: { type: Type.STRING, description: 'The search query.' },
        },
        required: ['query'],
    },
};


let sessionPromise: Promise<LiveSession> | null = null;
let mediaStream: MediaStream | null = null;
let inputAudioContext: AudioContext | null = null;
let scriptProcessor: ScriptProcessorNode | null = null;
let source: MediaStreamAudioSourceNode | null = null;

let outputAudioContext: AudioContext | null = null;
let outputNode: GainNode | null = null;
let nextStartTime = 0;
const sources = new Set<AudioBufferSourceNode>();

export const startJarvisSession = async (callbacks: {
  onStatusUpdate: (status: AssistantStatus, message: string) => void;
  onUserTranscript: (transcript: string, isFinal: boolean) => void;
  onJarvisTranscript: (transcript: string, isFinal: boolean) => void;
  onFunctionCall: (functionCall: FunctionCallInfo) => void;
  onImageGenerated: (imageUrl: string, prompt: string) => void;
  onGroundingSources: (sources: GroundingSource[]) => void;
  onError: (error: string) => void;
}) => {
  try {
    callbacks.onStatusUpdate('connecting', 'Starting Jarvis...');
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });

    let currentInputTranscription = '';
    let currentOutputTranscription = '';

    outputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    outputNode = outputAudioContext.createGain();
    outputNode.connect(outputAudioContext.destination);

    sessionPromise = ai.live.connect({
      model: 'gemini-2.5-flash-native-audio-preview-09-2025',
      callbacks: {
        onopen: async () => {
          callbacks.onStatusUpdate('listening', 'Listening...');
          mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          inputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
          source = inputAudioContext.createMediaStreamSource(mediaStream);
          scriptProcessor = inputAudioContext.createScriptProcessor(4096, 1, 1);
          
          scriptProcessor.onaudioprocess = (audioProcessingEvent) => {
            const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
            const l = inputData.length;
            const int16 = new Int16Array(l);
            for (let i = 0; i < l; i++) {
              int16[i] = inputData[i] * 32768;
            }
            const pcmBlob = {
              data: encode(new Uint8Array(int16.buffer)),
              mimeType: 'audio/pcm;rate=16000',
            };
            if (sessionPromise) {
              sessionPromise.then((session) => {
                session.sendRealtimeInput({ media: pcmBlob });
              });
            }
          };
          source.connect(scriptProcessor);
          scriptProcessor.connect(inputAudioContext.destination);
        },
        onmessage: async (message: LiveServerMessage) => {
           if (message.serverContent?.modelTurn) {
                callbacks.onStatusUpdate('speaking', 'Speaking...');
            }

            if (message.serverContent?.inputTranscription) {
                currentInputTranscription += message.serverContent.inputTranscription.text;
                callbacks.onUserTranscript(currentInputTranscription, false);
            }
            if (message.serverContent?.outputTranscription) {
                currentOutputTranscription += message.serverContent.outputTranscription.text;
                callbacks.onJarvisTranscript(currentOutputTranscription, false);
            }

            if(message.serverContent?.turnComplete) {
                callbacks.onUserTranscript(currentInputTranscription, true);
                callbacks.onJarvisTranscript(currentOutputTranscription, true);
                currentInputTranscription = '';
                currentOutputTranscription = '';
                callbacks.onStatusUpdate('listening', 'Listening...');
            }
          
            const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (base64Audio && outputAudioContext && outputNode) {
              if (outputAudioContext.state === 'suspended') {
                  await outputAudioContext.resume();
              }
              nextStartTime = Math.max(nextStartTime, outputAudioContext.currentTime);
              const audioBuffer = await decodeAudioData(decode(base64Audio), outputAudioContext, 24000, 1);
              const sourceNode = outputAudioContext.createBufferSource();
              sourceNode.buffer = audioBuffer;
              sourceNode.connect(outputNode);
              sourceNode.addEventListener('ended', () => {
                sources.delete(sourceNode);
                 if (sources.size === 0) {
                     callbacks.onStatusUpdate('listening', 'Listening...');
                 }
              });
              sourceNode.start(nextStartTime);
              nextStartTime += audioBuffer.duration;
              sources.add(sourceNode);
            }
            
            if (message.toolCall?.functionCalls) {
                for (const fc of message.toolCall.functionCalls) {
                    callbacks.onFunctionCall({ name: fc.name, args: fc.args });
                    const session = await sessionPromise;
                    if (!session) return;

                    switch (fc.name) {
                        case 'generateImageFromPrompt':
                          callbacks.onStatusUpdate('thinking', `Generating image: ${fc.args.prompt}`);
                          try {
                              const imageGenResponse = await ai.models.generateContent({
                                  model: 'gemini-2.5-flash-image',
                                  contents: { parts: [{ text: fc.args.prompt }] },
                                  config: { responseModalities: [Modality.IMAGE] },
                              });
                              const imagePart = imageGenResponse.candidates?.[0]?.content?.parts?.find(part => part.inlineData);
                              if (imagePart?.inlineData) {
                                  const base64ImageBytes = imagePart.inlineData.data;
                                  const imageUrl = `data:${imagePart.inlineData.mimeType};base64,${base64ImageBytes}`;
                                  callbacks.onImageGenerated(imageUrl, fc.args.prompt);
                                  session.sendToolResponse({ functionResponses: { id: fc.id, name: fc.name, response: { result: "OK, the image has been generated and displayed." } } });
                              } else { throw new Error("No image data returned from API."); }
                          } catch (error) {
                              const errorMessage = error instanceof Error ? error.message : "Unknown error.";
                              callbacks.onError(`Image generation failed.`);
                              session.sendToolResponse({ functionResponses: { id: fc.id, name: fc.name, response: { error: `Failed to generate image: ${errorMessage}` } } });
                          }
                          break;

                        case 'generateStory':
                            callbacks.onStatusUpdate('thinking', 'Writing story...');
                            try {
                                const storyResponse = await ai.models.generateContent({ model: 'gemini-2.5-pro', contents: `Tell a creative story about: ${fc.args.prompt}. The story should be engaging and suitable for being read aloud.` });
                                const storyText = storyResponse.text;
                                session.sendToolResponse({ functionResponses: { id: fc.id, name: fc.name, response: { result: storyText } } });
                            } catch (error) {
                                const errorMessage = error instanceof Error ? error.message : "Unknown error.";
                                callbacks.onError(`Story generation failed.`);
                                session.sendToolResponse({ functionResponses: { id: fc.id, name: fc.name, response: { error: `I was unable to write a story: ${errorMessage}` } } });
                            }
                            break;

                        case 'searchWeb':
                            callbacks.onStatusUpdate('thinking', `Searching for: ${fc.args.query}`);
                            try {
                                const searchResponse = await ai.models.generateContent({
                                    model: 'gemini-2.5-flash',
                                    contents: fc.args.query,
                                    config: { tools: [{googleSearch: {}}] },
                                });
                                const summary = searchResponse.text;
                                const groundingChunks = searchResponse.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
                                const sources = groundingChunks
                                    .map(chunk => chunk.web)
                                    .filter((source): source is { uri: string; title: string; } => !!source && !!source.uri && !!source.title);
                                
                                callbacks.onGroundingSources(sources);
                                session.sendToolResponse({ functionResponses: { id: fc.id, name: fc.name, response: { result: `Here is what I found about ${fc.args.query}: ${summary}` } } });
                            } catch (error) {
                                const errorMessage = error instanceof Error ? error.message : "Unknown error.";
                                callbacks.onError(`Web search failed.`);
                                session.sendToolResponse({ functionResponses: { id: fc.id, name: fc.name, response: { error: `I was unable to search the web: ${errorMessage}` } } });
                            }
                            break;
                            
                        case 'setSmartHomeDeviceState':
                            session.sendToolResponse({ functionResponses: { id: fc.id, name: fc.name, response: { result: "OK, command executed." } } });
                            break;
                    }
                }
            }

            if (message.serverContent?.interrupted) {
                for (const source of sources.values()) {
                    source.stop();
                    sources.delete(source);
                }
                nextStartTime = 0;
            }
        },
        onerror: (e: any) => {
          console.error('Gemini session error:', e);
          callbacks.onError(`Connection error: ${e.message}`);
          stopJarvisSession();
        },
        onclose: () => {
          callbacks.onStatusUpdate('idle', 'Session closed.');
        },
      },
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Puck' } } },
        inputAudioTranscription: {},
        outputAudioTranscription: {},
        tools: [{ functionDeclarations: [
            controlLightFunctionDeclaration, 
            generateImageFunctionDeclaration,
            generateStoryFunctionDeclaration,
            searchWebFunctionDeclaration,
        ] }],
        systemInstruction: "You are Jarvis, a sophisticated AI assistant that communicates primarily through spoken voice. Your verbal responses are concise and helpful for general tasks, but you can be creative and detailed when asked to write a story. You can control smart home devices, generate images, write stories, and search the web for up-to-date information using the tools provided.",
      },
    });

    return sessionPromise;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
    console.error("Failed to start Jarvis session:", errorMessage);
    callbacks.onError(errorMessage);
    stopJarvisSession();
  }
};

export const stopJarvisSession = async () => {
    if (sessionPromise) {
        const session = await sessionPromise;
        session.close();
        sessionPromise = null;
    }

    if (mediaStream) {
        mediaStream.getTracks().forEach(track => track.stop());
        mediaStream = null;
    }
    if(scriptProcessor) {
        scriptProcessor.disconnect();
        scriptProcessor = null;
    }
    if(source) {
        source.disconnect();
        source = null;
    }
    if (inputAudioContext && inputAudioContext.state !== 'closed') {
        await inputAudioContext.close();
        inputAudioContext = null;
    }
    if (outputAudioContext && outputAudioContext.state !== 'closed') {
        await outputAudioContext.close();
        outputAudioContext = null;
    }
    for (const source of sources.values()) {
        source.stop();
    }
    sources.clear();
    nextStartTime = 0;
};