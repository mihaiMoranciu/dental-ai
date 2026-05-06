export interface Prediction {
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
  class: string;
  class_id: number;
  detection_id: string;
  points?: { x: number; y: number }[];
}

export interface XrayAnalysis {
  imageSrc: string;
  dentalProblems: Prediction[];
  teethSeg: Prediction[];
  imageWidth: number;
  imageHeight: number;
  interpretation: string;
  interpretationLoading: boolean;
}
