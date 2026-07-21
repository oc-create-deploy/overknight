import {
  RTNGodot,
  RTNGodotView,
  runOnGodotThread,
} from "@borndotcom/react-native-godot";
import { Ionicons } from "@expo/vector-icons";
import * as FileSystem from "expo-file-system/legacy";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  GestureResponderEvent,
  Platform,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";

const ACTION_JUMP = "jump";
const ACTION_MOVE_LEFT = "move_left";
const ACTION_MOVE_RIGHT = "move_right";

type Control = "jump" | "left" | "right" | "play";
type GodotAction =
  | typeof ACTION_JUMP
  | typeof ACTION_MOVE_LEFT
  | typeof ACTION_MOVE_RIGHT;

const BUTTON_BOTTOM = 40;
const BUTTON_LEFT = 30;
const BUTTON_GAP = 20;
const MOVE_BUTTON_SIZE = 70;
const JUMP_BUTTON_SIZE = 80;
const PLAY_BUTTON_SIZE = 60;
const HIT_SLOP = 18;

function initGodot() {
  runOnGodotThread(() => {
    "worklet";
    console.log("Initializing Godot");

    if (Platform.OS === "android") {
      RTNGodot.createInstance([
        "--verbose",
        "--path",
        "/main",
        "--rendering-driver",
        "opengl3",
        "--rendering-method",
        "gl_compatibility",
        "--display-driver",
        "embedded",
      ]);
    } else {
      RTNGodot.createInstance([
        "--verbose",
        "--main-pack",
        FileSystem.bundleDirectory + "main.pck",
        "--rendering-driver",
        "opengl3",
        "--rendering-method",
        "gl_compatibility",
        "--display-driver",
        "embedded",
      ]);
    }
  });
}

function pressAction(action: string) {
  runOnGodotThread(() => {
    "worklet";
    try {
      const Godot = RTNGodot.API();
      const Input = Godot.Input;
      Input.action_press(action);
    } catch (error) {
      console.error("Error pressing action:", error);
    }
  });
}

function releaseAction(action: string) {
  runOnGodotThread(() => {
    "worklet";
    try {
      const Godot = RTNGodot.API();
      const Input = Godot.Input;
      Input.action_release(action);
    } catch (error) {
      console.error("Error releasing action:", error);
    }
  });
}

export default function Index() {
  const [isPaused, setIsPaused] = useState(false);
  const [pressedControls, setPressedControls] = useState<Set<Control>>(
    () => new Set(),
  );
  const { width, height } = useWindowDimensions();
  const touchesById = useRef(new Map<string, Control>());
  const activeActionCounts = useRef(new Map<GodotAction, number>());

  useEffect(() => {
    initGodot();
    return () => {
      for (const action of activeActionCounts.current.keys()) {
        releaseAction(action);
      }
      activeActionCounts.current.clear();
      touchesById.current.clear();
    };
  }, []);

  const handlePlayPause = useCallback(() => {
    if (isPaused) {
      RTNGodot.resume();
      setIsPaused(false);
    } else {
      RTNGodot.pause();
      setIsPaused(true);
    }
  }, [isPaused]);

  const setControlPressed = useCallback((control: Control, pressed: boolean) => {
    setPressedControls((current) => {
      const next = new Set(current);
      if (pressed) {
        next.add(control);
      } else {
        next.delete(control);
      }
      return next;
    });
  }, []);

  const actionForControl = (control: Control): GodotAction | null => {
    if (control === "jump") {
      return ACTION_JUMP;
    }

    if (control === "left") {
      return ACTION_MOVE_LEFT;
    }

    if (control === "right") {
      return ACTION_MOVE_RIGHT;
    }

    return null;
  };

  const pressControl = useCallback(
    (control: Control) => {
      if (control === "play") {
        handlePlayPause();
        setControlPressed(control, true);
        return;
      }

      const action = actionForControl(control);
      if (!action) {
        return;
      }

      const count = activeActionCounts.current.get(action) ?? 0;
      activeActionCounts.current.set(action, count + 1);
      if (count === 0) {
        pressAction(action);
      }
      setControlPressed(control, true);
    },
    [handlePlayPause, setControlPressed],
  );

  const releaseControl = useCallback(
    (control: Control) => {
      if (control === "play") {
        setControlPressed(control, false);
        return;
      }

      const action = actionForControl(control);
      if (!action) {
        return;
      }

      const count = activeActionCounts.current.get(action) ?? 0;
      if (count <= 1) {
        activeActionCounts.current.delete(action);
        releaseAction(action);
        setControlPressed(control, false);
      } else {
        activeActionCounts.current.set(action, count - 1);
      }
    },
    [setControlPressed],
  );

  const controlAtPoint = useCallback(
    (x: number, y: number): Control | null => {
      const bottomTop = height - BUTTON_BOTTOM - JUMP_BUTTON_SIZE - HIT_SLOP;
      const bottomBottom = height - BUTTON_BOTTOM + HIT_SLOP;

      const inVerticalBottom = y >= bottomTop && y <= bottomBottom;

      if (inVerticalBottom) {
        const leftX1 = BUTTON_LEFT - HIT_SLOP;
        const leftX2 = BUTTON_LEFT + MOVE_BUTTON_SIZE + HIT_SLOP;
        const rightX1 =
          BUTTON_LEFT + MOVE_BUTTON_SIZE + BUTTON_GAP - HIT_SLOP;
        const rightX2 =
          BUTTON_LEFT + MOVE_BUTTON_SIZE * 2 + BUTTON_GAP + HIT_SLOP;
        const jumpX1 = width - BUTTON_LEFT - JUMP_BUTTON_SIZE - HIT_SLOP;
        const jumpX2 = width - BUTTON_LEFT + HIT_SLOP;

        if (x >= leftX1 && x <= leftX2) {
          return "left";
        }

        if (x >= rightX1 && x <= rightX2) {
          return "right";
        }

        if (x >= jumpX1 && x <= jumpX2) {
          return "jump";
        }
      }

      const playX1 = width - BUTTON_LEFT - PLAY_BUTTON_SIZE - HIT_SLOP;
      const playX2 = width - BUTTON_LEFT + HIT_SLOP;
      const playY1 = 40 - HIT_SLOP;
      const playY2 = 40 + PLAY_BUTTON_SIZE + HIT_SLOP;

      if (x >= playX1 && x <= playX2 && y >= playY1 && y <= playY2) {
        return "play";
      }

      return null;
    },
    [height, width],
  );

  const onControlTouchStart = useCallback(
    (event: GestureResponderEvent) => {
      for (const touch of event.nativeEvent.changedTouches) {
        const control = controlAtPoint(touch.pageX, touch.pageY);
        if (control) {
          touchesById.current.set(String(touch.identifier), control);
          pressControl(control);
        }
      }
    },
    [controlAtPoint, pressControl],
  );

  const onControlTouchMove = useCallback(
    (event: GestureResponderEvent) => {
      for (const touch of event.nativeEvent.changedTouches) {
        const touchId = String(touch.identifier);
        const previous = touchesById.current.get(touchId);
        const next = controlAtPoint(touch.pageX, touch.pageY);

        if (previous === next) {
          continue;
        }

        if (previous) {
          releaseControl(previous);
          touchesById.current.delete(touchId);
        }

        if (next) {
          touchesById.current.set(touchId, next);
          pressControl(next);
        }
      }
    },
    [controlAtPoint, pressControl, releaseControl],
  );

  const onControlTouchEnd = useCallback(
    (event: GestureResponderEvent) => {
      for (const touch of event.nativeEvent.changedTouches) {
        const touchId = String(touch.identifier);
        const control = touchesById.current.get(touchId);

        if (control) {
          releaseControl(control);
          touchesById.current.delete(touchId);
        }
      }
    },
    [releaseControl],
  );

  return (
    <View style={styles.container}>
      <RTNGodotView style={styles.gameView} />

      <View
        style={styles.touchLayer}
        onTouchStart={onControlTouchStart}
        onTouchMove={onControlTouchMove}
        onTouchEnd={onControlTouchEnd}
        onTouchCancel={onControlTouchEnd}
      />

      <View pointerEvents="none" style={styles.topControls}>
        <View
          style={[
            styles.playPauseButton,
            pressedControls.has("play") && styles.pressedButton,
          ]}
        >
          <Ionicons
            name={isPaused ? "play" : "pause"}
            size={28}
            color="white"
          />
        </View>
      </View>

      <View pointerEvents="none" style={styles.leftControls}>
        <View
          style={[
            styles.button,
            pressedControls.has("left") && styles.pressedButton,
          ]}
        >
          <Ionicons name="chevron-back" size={32} color="white" />
        </View>
        <View
          style={[
            styles.button,
            pressedControls.has("right") && styles.pressedButton,
          ]}
        >
          <Ionicons name="chevron-forward" size={32} color="white" />
        </View>
      </View>

      <View pointerEvents="none" style={styles.rightControls}>
        <View
          style={[
            styles.button,
            styles.jumpButton,
            pressedControls.has("jump") && styles.pressedButton,
          ]}
        >
          <Ionicons name="arrow-up" size={36} color="white" />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gameView: {
    flex: 1,
  },
  touchLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10,
  },
  topControls: {
    position: "absolute",
    top: 40,
    right: 30,
    zIndex: 20,
  },
  playPauseButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    borderColor: "rgba(255, 255, 255, 0.3)",
  },
  leftControls: {
    position: "absolute",
    bottom: 40,
    left: 30,
    flexDirection: "row",
    gap: 20,
    zIndex: 20,
  },
  rightControls: {
    position: "absolute",
    bottom: 40,
    right: 30,
    zIndex: 20,
  },
  button: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    borderColor: "rgba(255, 255, 255, 0.3)",
  },
  jumpButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(220, 38, 38, 0.7)",
    borderColor: "rgba(255, 255, 255, 0.4)",
  },
  pressedButton: {
    opacity: 0.65,
    transform: [{ scale: 0.95 }],
  },
});
