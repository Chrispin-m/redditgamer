import { Devvit, useWebView } from '@devvit/public-api';
import { GameAPI } from './api.js';
import { GamePostForm } from './forms';
import type { GameAction, WebViewMessage, DevvitMessage, GameType } from './types';

Devvit.configure({
  redis: true,
  redditAPI: true,
});

Devvit.addMenuItem({
  label: 'Create Game Post',
  forUserType: 'moderator',
  location: 'subreddit',
  onPress: async (_, context) => {
    context.ui.showForm(GamePostForm);
  },
});

Devvit.addCustomPostType({
  name: 'Multiplayer Games',
  render: (context) => {
    const { mount } = useWebView<WebViewMessage, DevvitMessage>({
      url: 'index.html',
      onMessage: async (message, webView) => {
        try {
          switch (message.type) {
            case 'gameAction':
              await handleGameAction(message.data, context, webView);
              break;
            case 'requestState':
              await sendGameState(context, webView);
              break;
          }
        } catch (error) {
          webView.postMessage({
            type: 'error',
            code: 500,
            message: error instanceof Error ? error.message : 'Unknown error',
            recoverable: false,
          });
        }
      },
    });

    return Devvit.createElement("vstack", {
      padding: "medium",
      gap: "medium",
      children: [
        Devvit.createElement("text", {
          style: "heading",
          size: "xlarge",
          children: "Game Suite",
        }),
        Devvit.createElement("button", {
          onPress: mount,
          appearance: "primary",
          children: "Start Playing!",
        }),
      ],
    });
  },
});

async function handleGameAction(
  action: GameAction,
  context: Devvit.Context,
  webView: Devvit.WebViewHandler
) {
  const { redis } = context;
  const postId = context.postId!;
  let state = await GameAPI.getGameState(redis, postId);

  if (action.type === 'changeGame') {
    state.currentGame = action.game;
    // Reset game-specific state
    if (action.game === 'tictactoe') {
      state.tictactoe = Array(9).fill(null);
    } else if (action.game === 'gomoku') {
      state.gomoku = Array(225).fill(null);
    } else if (action.game === 'dots') {
      state.dots = { lines: [], boxes: {}, gridSize: 5 };
    } else if (action.game === 'connect4') {
      state.connect4 = Array.from({ length: 7 }, () => Array(6).fill(null));
    }
    state.status = 'waiting';
    state.winner = null;
    state.turn = '';
    await GameAPI.saveGameState(redis, postId, state);
    await webView.postMessage({
      type: 'gameState',
      data: state,
      sessionId: postId,
      timestamp: Date.now(),
    });
  } else if (action.type === 'move') {
    const newState = GameAPI.processMove(state, action);
    await GameAPI.saveGameState(redis, postId, newState);
    await webView.postMessage({
      type: 'gameState',
      data: newState,
      sessionId: postId,
      timestamp: Date.now(),
    });
  } else if (action.type === 'joinGame') {
    if (!state.players.includes(action.playerId)) {
      state.players.push(action.playerId);
      if (state.players.length === 1) {
        state.turn = action.playerId;
      }
      await GameAPI.saveGameState(redis, postId, state);
      await webView.postMessage({
        type: 'gameState',
        data: state,
        sessionId: postId,
        timestamp: Date.now(),
      });
    }
  }
}

async function sendGameState(
  context: Devvit.Context,
  webView: Devvit.WebViewHandler
) {
  const { redis } = context;
  const postId = context.postId!;
  const state = await GameAPI.getGameState(redis, postId);
  
  await webView.postMessage({
    type: 'gameState',
    data: state,
    sessionId: postId,
    timestamp: Date.now(),
  });
}

export default Devvit;