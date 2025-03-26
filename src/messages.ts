/** Message from Devvit to the web view. */
export type DevvitMessage =
  | { type: 'initialData'; data: { username: string; currentCounter: number } }
  | { type: 'updateCounter'; data: { currentCounter: number } }
  | { type: 'gameState'; data: any; sessionId: string; timestamp: number }
  | { type: 'error'; code: number; message: string; recoverable: boolean }
  | { type: 'updateScore'; data: { score: number; avgTime: number; medianTime: number } };

/** Message from the web view to Devvit. */
export type WebViewMessage =
  | { type: 'webViewReady' }
  | { type: 'unmount' }
  | { type: 'setCounter'; data: { newCounter: number } };

/**
 * Devvit system message wrapper.
 */
export type DevvitSystemMessage = {
  data: { message: DevvitMessage };
  type?: 'devvit-message' | string;
};
