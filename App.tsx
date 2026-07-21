import React from 'react';
import {
  Dimensions,
  Image,
  ImageSourcePropType,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';

type Rect = { x: number; y: number; w: number; h: number };
type Coin = Rect & { id: string; taken: boolean };
type Slime = Rect & { id: string; minX: number; maxX: number; dir: 1 | -1 };
type GameState = {
  player: Rect & { vx: number; vy: number; facing: 1 | -1; grounded: boolean };
  coins: Coin[];
  slimes: Slime[];
  lives: number;
  won: boolean;
  hurtAt: number;
};

const knight = require('./assets/sprites/knight.png') as ImageSourcePropType;
const coinSprite = require('./assets/sprites/coin.png') as ImageSourcePropType;
const slimeSprite = require('./assets/sprites/slime_green.png') as ImageSourcePropType;
const fruitSprite = require('./assets/sprites/fruit.png') as ImageSourcePropType;

const WORLD_W = 2200;
const WORLD_H = 540;
const GRAVITY = 1200;
const MOVE_SPEED = 235;
const JUMP = -520;
const PLAYER_START = { x: 90, y: 350 };

const platforms: Rect[] = [
  { x: 0, y: 492, w: 360, h: 80 },
  { x: 420, y: 430, w: 210, h: 110 },
  { x: 705, y: 370, w: 200, h: 170 },
  { x: 970, y: 315, w: 160, h: 225 },
  { x: 1220, y: 430, w: 260, h: 110 },
  { x: 1555, y: 358, w: 220, h: 182 },
  { x: 1840, y: 300, w: 240, h: 240 },
  { x: 2120, y: 410, w: 230, h: 130 },
  { x: 285, y: 335, w: 92, h: 30 },
  { x: 650, y: 265, w: 118, h: 30 },
  { x: 1175, y: 230, w: 118, h: 30 },
  { x: 1475, y: 285, w: 118, h: 30 },
];

const initialCoins: Coin[] = [
  { id: 'c1', x: 312, y: 292, w: 28, h: 28, taken: false },
  { id: 'c2', x: 672, y: 218, w: 28, h: 28, taken: false },
  { id: 'c3', x: 820, y: 318, w: 28, h: 28, taken: false },
  { id: 'c4', x: 1248, y: 180, w: 28, h: 28, taken: false },
  { id: 'c5', x: 1370, y: 382, w: 28, h: 28, taken: false },
  { id: 'c6', x: 1510, y: 236, w: 28, h: 28, taken: false },
  { id: 'c7', x: 1965, y: 248, w: 28, h: 28, taken: false },
  { id: 'c8', x: 2170, y: 362, w: 28, h: 28, taken: false },
];

const initialSlimes: Slime[] = [
  { id: 's1', x: 500, y: 394, w: 48, h: 36, minX: 450, maxX: 590, dir: 1 },
  { id: 's2', x: 1275, y: 394, w: 48, h: 36, minX: 1230, maxX: 1440, dir: -1 },
  { id: 's3', x: 1900, y: 264, w: 48, h: 36, minX: 1860, maxX: 2040, dir: 1 },
];

const makeInitialState = (): GameState => ({
  player: {
    x: PLAYER_START.x,
    y: PLAYER_START.y,
    w: 34,
    h: 42,
    vx: 0,
    vy: 0,
    facing: 1,
    grounded: false,
  },
  coins: initialCoins.map((coin) => ({ ...coin })),
  slimes: initialSlimes.map((slime) => ({ ...slime })),
  lives: 3,
  won: false,
  hurtAt: 0,
});

function intersects(a: Rect, b: Rect) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function resolvePlatforms(player: GameState['player'], previous: Rect) {
  let next = { ...player, grounded: false };

  for (const platform of platforms) {
    if (!intersects(next, platform)) continue;

    const wasAbove = previous.y + previous.h <= platform.y;
    const wasBelow = previous.y >= platform.y + platform.h;
    const wasLeft = previous.x + previous.w <= platform.x;
    const wasRight = previous.x >= platform.x + platform.w;

    if (wasAbove && next.vy >= 0) {
      next.y = platform.y - next.h;
      next.vy = 0;
      next.grounded = true;
    } else if (wasBelow && next.vy < 0) {
      next.y = platform.y + platform.h;
      next.vy = 0;
    } else if (wasLeft && next.vx > 0) {
      next.x = platform.x - next.w;
      next.vx = 0;
    } else if (wasRight && next.vx < 0) {
      next.x = platform.x + platform.w;
      next.vx = 0;
    }
  }

  return next;
}

function Sprite({
  source,
  frame,
  frameSize,
  sheetSize,
  scale,
  flip,
}: {
  source: ImageSourcePropType;
  frame: { x: number; y: number };
  frameSize: { w: number; h: number };
  sheetSize: { w: number; h: number };
  scale: number;
  flip?: boolean;
}) {
  return (
    <View
      style={{
        width: frameSize.w * scale,
        height: frameSize.h * scale,
        overflow: 'hidden',
        transform: [{ scaleX: flip ? -1 : 1 }],
      }}
    >
      <Image
        source={source}
        style={{
          position: 'absolute',
          left: -frame.x * frameSize.w * scale,
          top: -frame.y * frameSize.h * scale,
          width: sheetSize.w * scale,
          height: sheetSize.h * scale,
          resizeMode: 'stretch',
        }}
      />
    </View>
  );
}

function TileBlock({ rect, scale, cameraX }: { rect: Rect; scale: number; cameraX: number }) {
  return (
    <View
      style={[
        styles.platform,
        {
          left: (rect.x - cameraX) * scale,
          top: rect.y * scale,
          width: rect.w * scale,
          height: rect.h * scale,
          borderWidth: Math.max(2, 4 * scale),
        },
      ]}
    >
      <View style={[styles.grass, { height: Math.max(8, 18 * scale) }]} />
    </View>
  );
}

export default function App() {
  const [screen, setScreen] = React.useState(Dimensions.get('window'));
  const stateRef = React.useRef<GameState>(makeInitialState());
  const input = React.useRef({ left: false, right: false, jump: false });
  const [frame, setFrame] = React.useState(0);

  React.useEffect(() => {
    const sub = Dimensions.addEventListener('change', ({ window }) => setScreen(window));
    return () => sub.remove();
  }, []);

  React.useEffect(() => {
    let last = Date.now();
    const timer = setInterval(() => {
      const now = Date.now();
      const dt = Math.min(0.033, (now - last) / 1000);
      last = now;
      const state = stateRef.current;

      if (state.won) {
        setFrame((value) => value + 1);
        return;
      }

      const previous = { ...state.player };
      const direction = (input.current.right ? 1 : 0) - (input.current.left ? 1 : 0);
      state.player.vx = direction * MOVE_SPEED;
      if (direction) state.player.facing = direction as 1 | -1;
      if (input.current.jump && state.player.grounded) {
        state.player.vy = JUMP;
        state.player.grounded = false;
      }

      state.player.vy += GRAVITY * dt;
      state.player.x = Math.max(0, Math.min(WORLD_W - state.player.w, state.player.x + state.player.vx * dt));
      state.player.y += state.player.vy * dt;
      state.player = resolvePlatforms(state.player, previous);

      if (state.player.y > WORLD_H + 80) {
        state.lives -= 1;
        state.player = { ...makeInitialState().player, x: Math.max(60, state.player.x - 180) };
        state.hurtAt = now;
      }

      state.slimes = state.slimes.map((slime) => {
        let x = slime.x + slime.dir * 82 * dt;
        let dir = slime.dir;
        if (x < slime.minX) {
          x = slime.minX;
          dir = 1;
        } else if (x > slime.maxX) {
          x = slime.maxX;
          dir = -1;
        }
        return { ...slime, x, dir };
      });

      for (const slime of state.slimes) {
        if (!intersects(state.player, slime) || now - state.hurtAt < 1200) continue;
        state.lives -= 1;
        state.player.x = Math.max(60, state.player.x - 120);
        state.player.y -= 60;
        state.player.vy = -300;
        state.hurtAt = now;
      }

      state.coins = state.coins.map((coin) =>
        !coin.taken && intersects(state.player, coin) ? { ...coin, taken: true } : coin
      );
      state.won = state.coins.every((coin) => coin.taken) || state.player.x > WORLD_W - 105;

      if (state.lives <= 0) {
        stateRef.current = makeInitialState();
      }

      setFrame((value) => value + 1);
    }, 16);

    return () => clearInterval(timer);
  }, []);

  const game = stateRef.current;
  const width = screen.width;
  const height = screen.height;
  const scale = Math.min(width / 960, height / 540);
  const stageW = width / scale;
  const playerCenter = game.player.x + game.player.w / 2;
  const cameraX = Math.max(0, Math.min(WORLD_W - stageW, playerCenter - stageW * 0.46));
  const collected = game.coins.filter((coin) => coin.taken).length;
  const runFrame = Math.floor(frame / 6) % 4;
  const knightFrame = game.player.grounded
    ? game.player.vx === 0
      ? { x: 0, y: 0 }
      : { x: runFrame, y: 3 }
    : { x: 1, y: 1 };

  const setButton = (key: keyof typeof input.current, value: boolean) => {
    input.current[key] = value;
  };

  const reset = () => {
    stateRef.current = makeInitialState();
    setFrame((value) => value + 1);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar hidden />
      <View style={styles.root}>
        <View style={styles.sky}>
          <View style={[styles.cloud, { left: width * 0.08, top: height * 0.12 }]} />
          <View style={[styles.cloud, { left: width * 0.46, top: height * 0.07 }]} />
          <View style={[styles.cloud, { left: width * 0.78, top: height * 0.15 }]} />

          <View style={{ width, height, overflow: 'hidden' }}>
            <View style={{ width: WORLD_W * scale, height: WORLD_H * scale, transform: [{ translateX: -cameraX * scale }] }}>
              {platforms.map((platform, index) => (
                <TileBlock key={`p-${index}`} rect={platform} scale={scale} cameraX={0} />
              ))}

              {game.coins.map((coin) =>
                coin.taken ? null : (
                  <View key={coin.id} style={{ position: 'absolute', left: coin.x * scale, top: coin.y * scale }}>
                    <Sprite
                      source={coinSprite}
                      frame={{ x: Math.floor(frame / 5) % 12, y: 0 }}
                      frameSize={{ w: 16, h: 16 }}
                      sheetSize={{ w: 192, h: 16 }}
                      scale={1.8 * scale}
                    />
                  </View>
                )
              )}

              {game.slimes.map((slime) => (
                <View key={slime.id} style={{ position: 'absolute', left: slime.x * scale, top: slime.y * scale }}>
                  <Sprite
                    source={slimeSprite}
                    frame={{ x: Math.floor(frame / 10) % 3, y: 0 }}
                    frameSize={{ w: 32, h: 24 }}
                    sheetSize={{ w: 96, h: 72 }}
                    scale={1.7 * scale}
                    flip={slime.dir < 0}
                  />
                </View>
              ))}

              <View style={{ position: 'absolute', left: game.player.x * scale, top: game.player.y * scale }}>
                <Sprite
                  source={knight}
                  frame={knightFrame}
                  frameSize={{ w: 32, h: 32 }}
                  sheetSize={{ w: 256, h: 256 }}
                  scale={1.8 * scale}
                  flip={game.player.facing < 0}
                />
              </View>

              <Image
                source={fruitSprite}
                style={{
                  position: 'absolute',
                  left: (WORLD_W - 100) * scale,
                  top: 346 * scale,
                  width: 54 * scale,
                  height: 54 * scale,
                }}
              />
            </View>
          </View>
        </View>

        <View style={styles.hud}>
          <Text style={styles.brand}>OverKnight</Text>
          <Text style={styles.stat}>Coins {collected}/{game.coins.length}</Text>
          <Text style={styles.stat}>Lives {Math.max(0, game.lives)}</Text>
        </View>

        {game.won && (
          <View style={styles.overlay}>
            <Text style={styles.winTitle}>Quest Cleared</Text>
            <Text style={styles.winText}>The knight escaped with every coin in the realm.</Text>
            <Pressable style={styles.restart} onPress={reset}>
              <Text style={styles.restartText}>Restart</Text>
            </Pressable>
          </View>
        )}

        <View style={styles.controlsLeft}>
          <Pressable
            style={styles.controlButton}
            onPressIn={() => setButton('left', true)}
            onPressOut={() => setButton('left', false)}
          >
            <Text style={styles.controlText}>‹</Text>
          </Pressable>
          <Pressable
            style={styles.controlButton}
            onPressIn={() => setButton('right', true)}
            onPressOut={() => setButton('right', false)}
          >
            <Text style={styles.controlText}>›</Text>
          </Pressable>
        </View>

        <View style={styles.controlsRight}>
          <Pressable
            style={[styles.controlButton, styles.jumpButton]}
            onPressIn={() => setButton('jump', true)}
            onPressOut={() => setButton('jump', false)}
          >
            <Text style={styles.jumpText}>JUMP</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#07164A',
  },
  root: {
    flex: 1,
    backgroundColor: '#0D5AD3',
    overflow: 'hidden',
  },
  sky: {
    flex: 1,
    backgroundColor: '#0A66D8',
  },
  cloud: {
    position: 'absolute',
    width: 130,
    height: 34,
    borderRadius: 4,
    backgroundColor: 'rgba(129, 218, 255, 0.22)',
  },
  platform: {
    position: 'absolute',
    backgroundColor: '#B86D31',
    borderColor: '#26150F',
  },
  grass: {
    backgroundColor: '#43D20E',
    borderBottomColor: '#167A09',
    borderBottomWidth: 4,
  },
  hud: {
    position: 'absolute',
    left: 18,
    right: 18,
    top: 12,
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  brand: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '900',
    textShadowColor: '#06113B',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 0,
  },
  stat: {
    color: '#E8F7FF',
    fontSize: 15,
    fontWeight: '800',
    backgroundColor: 'rgba(5, 18, 63, 0.55)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  controlsLeft: {
    position: 'absolute',
    left: 22,
    bottom: 22,
    flexDirection: 'row',
    gap: 12,
  },
  controlsRight: {
    position: 'absolute',
    right: 24,
    bottom: 22,
  },
  controlButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(7, 16, 48, 0.62)',
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.72)',
  },
  jumpButton: {
    width: 96,
  },
  controlText: {
    color: '#FFFFFF',
    fontSize: 48,
    lineHeight: 52,
    fontWeight: '900',
  },
  jumpText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '900',
  },
  overlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(4, 9, 28, 0.62)',
  },
  winTitle: {
    color: '#FFE16B',
    fontSize: 38,
    fontWeight: '900',
    textAlign: 'center',
  },
  winText: {
    marginTop: 8,
    marginBottom: 18,
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  restart: {
    backgroundColor: '#43D20E',
    borderColor: '#0F4510',
    borderWidth: 3,
    borderRadius: 7,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  restartText: {
    color: '#07112E',
    fontSize: 18,
    fontWeight: '900',
  },
});
