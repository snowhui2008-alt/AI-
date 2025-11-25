
export interface ImageAsset {
  id: string;
  url: string; // Base64 or Blob URL
  type: 'person' | 'garment' | 'result';
  prompt?: string; // If generated
}

export type ViewAngle = 'front' | 'back' | 'left45' | 'right45' | 'left90' | 'right90';

export interface AppState {
  selectedPerson: ImageAsset | null;
  selectedGarment: ImageAsset | null;
  tryOnResults: Record<ViewAngle, ImageAsset> | null; // Store all angles
  isGenerating: boolean;
  step: 1 | 2 | 3;
  viewAngle: ViewAngle; // Current view to display
}

export type GenerationType = 'person' | 'garment' | 'try-on';

export type CircuitMode = 'series' | 'parallel' | 'rc-delay';

export interface CircuitState {
  isSwitchClosed: boolean;
  voltage: number;
  resistance1: number;
  resistance2: number;
  capacitance: number;
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  isError?: boolean;
}
