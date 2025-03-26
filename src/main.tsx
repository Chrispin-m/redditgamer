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
        <vstack
          grow
          padding="small"
          backgroundGradient="linear-gradient(to bottom, #87CEEB, #4682B4)"
        >
          <vstack grow alignment="middle center">
            {/* Title with bold color and shadow */}
            <text
              size="xlarge"
              weight="bold"
              color="darkblue"
              textShadow="1px 1px 2px #000000"
              fontFamily="Roboto"
            >
              Multiplayer Games
            </text>
            <spacer />
            <vstack
              backgroundColor="#ffffff"
              padding="small"
              cornerRadius="small"
              shadow="0px 2px 4px rgba(0, 0, 0, 0.1)"
            >
              <hstack>
                <text size="medium" fontFamily="Open Sans">Username:</text>
                <text size="medium" weight="bold" fontFamily="Open Sans">{' '}{username ?? ''}</text>
              </hstack>
              <hstack>
                <text size="medium" fontFamily="Open Sans">Current counter:</text>
                <text size="medium" weight="bold" fontFamily="Open Sans">{' '}{counter ?? ''}</text>
              </hstack>
            </vstack>
            <spacer />

            {!selectedGame ? (
              <vstack alignment="middle center" gap="medium">
                <text size="medium" weight="bold" fontFamily="Roboto">Select a game to play:</text>
                <hstack gap="medium" width="100%">
                  <button
                    appearance="primary"
                    onPress={() => setSelectedGame('tictactoe')}
                    hover={{ backgroundColor: '#ADD8E6' }}
                  >
                    Tic Tac Toe
                  </button>
                  <button
                    appearance="primary"
                    onPress={() => setSelectedGame('gomoku')}
                    hover={{ backgroundColor: '#ADD8E6' }}
                  >
                    Gomoku
                  </button>
                  <button
                    appearance="primary"
                    onPress={() => setSelectedGame('dots')}
                    hover={{ backgroundColor: '#ADD8E6' }}
                  >
                    Ludo(beta)
                  </button>
                </hstack>
                <hstack gap="medium" width="100%">
                  <button
                    appearance="primary"
                    onPress={() => setSelectedGame('connect4')}
                    hover={{ backgroundColor: '#ADD8E6' }}
                  >
                    Connect Four
                  </button>
                  <button
                    appearance="primary"
                    onPress={() => setSelectedGame('reaction')}
                    hover={{ backgroundColor: '#ADD8E6' }}
                  >
                    Reaction
                  </button>
                </hstack>
              </vstack>
            ) : (
              <vstack
                alignment="middle center"
                gap="small"
                backgroundColor="#ffffff"
                padding="medium"
                cornerRadius="small"
                border="1px solid #cccccc"
                shadow="0px 2px 4px rgba(0, 0, 0, 0.1)"
              >
                <text size="medium" weight="bold" fontFamily="Roboto">Game selected: {selectedGame}</text>
                <hstack gap="small">
                  <button appearance="primary" onPress={() => webView?.mount()}>
                    Launch {selectedGame}
                  </button>
                  <button
                    appearance="secondary"
                    onPress={() => setSelectedGame(null)}
                    size="large"
                    color="red"
                  >
                    Back
                  </button>
                </hstack>
              </vstack>
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
