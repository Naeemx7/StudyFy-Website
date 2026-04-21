/**
 * Chat Models (DTOs)
 *
 * Match the Chat endpoints from the backend API (Apidog):
 * - POST   /chat/sessions              - Create a chat session
 * - GET    /chat/sessions              - List all sessions in a space
 * - POST   /chat/sessions/{id}/messages - Send message & get AI reply
 * - GET    /chat/sessions/{id}         - Get session with all messages
 * - DELETE /chat/sessions/{id}         - Delete a session
 */

// ============================================
// REQUEST DTOs
// ============================================

/** Request body for POST /chat/sessions */
export interface CreateChatSessionRequest {
  filesId: string[];
  title?: string;
}

/** Request body for POST /chat/sessions/{id}/messages */
export interface SendMessageRequest {
  message: string;
}

// ============================================
// RESPONSE DTOs
// ============================================

/** A single chat message (ChatMessageResponseDto) */
export interface ChatMessage {
  id: string;
  content: string;
  role: string;
  sentAt: string;
}

/** Full session with messages (ChatSessionDetailDto) */
export interface ChatSessionDetail {
  id: string;
  title: string;
  createdAt: string;
  fileNames: string[];
  messages: ChatMessage[];
}

/** Session list item (ChatSessionListDto) */
export interface ChatSessionListItem {
  id: string;
  title: string;
  createdAt: string;
  messageCount: number;
  fileNames: string[];
}

/** Response from sending a message (SendMessageResponseDto) */
export interface SendMessageResponse {
  sessionId: string;
  userMessage: ChatMessage;
  assistantMessage: ChatMessage;
}
