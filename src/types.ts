export type MessageType = "text" | "file";

export interface Message {
  id: string;
  type: MessageType;
  content: string;
  originalName?: string;
  mimeType?: string;
  size?: number;
  createdAt: number;
  updatedAt?: number;
}
