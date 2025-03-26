import './createPost.js';
import { Devvit, useState, useWebView } from '@devvit/public-api';
import type { DevvitMessage, WebViewMessage } from './messages';
import { GameAPI } from './api';
import { GamePostForm } from './forms';

Devvit.configure({
  redditAPI: true,
  redis: true,
});

// Add a custom post type for Multiplayer Games.
Devvit.addCustomPostType({
  name: 'Multiplayer Games',
  height: 'tall',
  render: (context) => {
    // Load the actual Reddit username once.
    const [username] = useState(async () => {
      const name = await context.reddit.getCurrentUsername();
      return name ?? 'anon';
    });

    // Load a counter (or other state) from Redis.
    const [counter, setCounter] = useState(async () => {
      const redisCount = await context.redis.get(`counter_${context.postId}`);
      return Number(redisCount ?? 0);
    });

    // Local state for which game is selected.
    const [selectedGame, setSelectedGame] = useState<string | null>(async () => null);

    // Map the selected game to its dedicated web view HTML file.
    const getWebViewUrl = (): string => {
      switch (selectedGame) {
        case 'tictactoe':
          return 'index_tictactoe.html';
        case 'gomoku':
          return 'index_gomoku.html';
        case 'dots':
          return 'index_dots.html';
        case 'connect4':
          return 'index_connect4.html';
        case 'reaction':
          return 'index_reaction.html';
        default:
          return 'index_default.html';
      }
    };

    // Create the web view only after a game is selected.
    const webView = selectedGame
      ? useWebView<WebViewMessage, DevvitMessage>({
          url: getWebViewUrl(),
          async onMessage(message, webView) {
            switch (message.type) {
              case 'webViewReady':
                // Pass along the actual username along with the counter.
                webView.postMessage({
                  type: 'initialData',
                  data: {
                    username,
                    currentCounter: counter,
                  },
                });
                break;
              case 'setCounter': {
                await context.redis.set(`counter_${context.postId}`, message.data.newCounter.toString());
                setCounter(message.data.newCounter);
                webView.postMessage({
                  type: 'updateCounter',
                  data: { currentCounter: message.data.newCounter },
                });
                break;
              }
              case 'updateScore': {
                // For Reaction game, update scores in Redis.
                const { score, avgTime, medianTime } = message.data;
                await context.redis.set(
                  `reaction_${context.postId}_score`,
                  JSON.stringify({ score, avgTime, medianTime })
                );
                webView.postMessage({
                  type: 'leaderboardUpdate',
                  data: { score, avgTime, medianTime },
                });
                break;
              }
              case 'unmount':
                webView.unmount();
                break;
              default:
                throw new Error(`Unknown message type: ${message}`);
            }
          },
          onUnmount() {
            context.ui.showToast('Web view closed!');
          },
        })
      : null;

    return (
      <blocks>
        <vstack grow padding="small">
          <vstack grow alignment="middle center">
            <text size="xlarge" weight="bold">
              Multiplayer Games
            </text>
            <spacer />
            <vstack alignment="start middle">
              <hstack>
                <text size="medium">Username:</text>
                <text size="medium" weight="bold">{' '}{username ?? ''}</text>
              </hstack>
              <hstack>
                <text size="medium">Current counter:</text>
                <text size="medium" weight="bold">{' '}{counter ?? ''}</text>
              </hstack>
            </vstack>
            <spacer />
            {!selectedGame ? (
              <vstack alignment="middle center" gap="small">
                <text size="medium">Select a game to play:</text>
                <hstack gap="small">
                  <button onPress={() => setSelectedGame('tictactoe')}>Tic Tac Toe</button>
                  <button onPress={() => setSelectedGame('gomoku')}>Gomoku</button>
                </hstack>
                <hstack gap="small">
                  <button onPress={() => setSelectedGame('dots')}>Dots & Boxes</button>
                  <button onPress={() => setSelectedGame('connect4')}>Connect Four</button>
                </hstack>
                <hstack gap="small">
                  <button onPress={() => setSelectedGame('reaction')}>Reaction</button>
                </hstack>
              </vstack>
            ) : (
              <>
                <text size="medium">Game selected: {selectedGame}</text>
                <spacer />
                <button onPress={() => webView?.mount()}>Launch {selectedGame}</button>
              </>
            )}
          </vstack>
        </vstack>
      </blocks>
    );
  },
});

async function handleGameAction(
  action: any,
  context: Devvit.Context,
  webView: Devvit.WebViewHandler
) {
  const { redis } = context;
  const postId = context.postId!;

  if (action.type === 'reaction') {
    // For Reaction game, update scores in Redis and notify the web view.
    const { score, avgTime, medianTime } = action.data;
    await redis.set(`reaction_${postId}_score`, JSON.stringify({ score, avgTime, medianTime }));
    await webView.postMessage({
      type: 'leaderboardUpdate',
      data: { score, avgTime, medianTime },
    });
  } else {
    const state = await GameAPI.getGameState(redis, postId);
    const newState = GameAPI.processMove(state, action);
    await GameAPI.saveGameState(redis, postId, newState);
    await webView.postMessage({
      type: 'gameState',
      data: newState,
      sessionId: postId,
      timestamp: Date.now(),
    });
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
