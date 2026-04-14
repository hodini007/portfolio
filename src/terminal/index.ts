// @ts-ignore
import titleText from "../file-system/home/user/title/title.md?raw";
import Bash from "./bash";
export type Change = {
  type: "add" | "del" | "none";
  loc: number | "end" | "none";
  str: string;
};
export default function Terminal(screenTextEngine: {
  tick: (deltaTime: number, elapsedTime: number) => void;
  userInput: (change: Change, selectionPos: number) => void;
  placeMarkdown: (md: string) => number;
  placeText: (str: string) => number;
  scroll(
    val: number,
    units: "lines" | "px",
    options?: {
      updateMaxScroll: boolean;
      moveView: boolean;
    }
  ): void;
  scrollToEnd: () => void;
  freezeInput: () => void;
}) {
  const canvas = document.querySelector("canvas.webgl") as HTMLCanvasElement;
  const textarea = document.getElementById("textarea") as HTMLTextAreaElement;
  textarea.value = "";
  textarea.readOnly = true;
  textarea.blur();
  const initialTitleHeight = screenTextEngine.placeMarkdown(titleText);
  screenTextEngine.scroll(initialTitleHeight, "px", {
    updateMaxScroll: true,
    moveView: false,
  });

  const initialPromptHeight = screenTextEngine.placeText("user:~$");
  screenTextEngine.scroll(initialPromptHeight, "lines", {
    updateMaxScroll: true,
    moveView: false,
  });

  screenTextEngine.scrollToEnd();

  const bash = Bash((s, md = false) => {
    if (md) {
      const numOfpx = screenTextEngine.placeMarkdown(s);
      screenTextEngine.scroll(numOfpx, "px", {
        updateMaxScroll: true,
        moveView: false,
      });
      screenTextEngine.scroll(12, "lines", {
        updateMaxScroll: false,
        moveView: true,
      });
    } else {
      const numOfLines = screenTextEngine.placeText(s);
      screenTextEngine.scroll(numOfLines, "lines");
    }
  });

  let oldText = "";
  function onInput() {
    const change = stringEditDistance(oldText, textarea.value);
    oldText = textarea.value;
    if (change) screenTextEngine.userInput(change, textarea.selectionStart);
    screenTextEngine.scrollToEnd();
  }
  textarea.addEventListener("input", onInput, false);

  // ── Mobile bar scroll-rotation sync ────────────────────────────────
  const mobileBar = document.getElementById("mobile-terminal") as HTMLElement | null;
  // Treat as touch/mobile if touch capable OR viewport is phone-sized
  const isTouch = navigator.maxTouchPoints > 0 || window.innerWidth <= 768;

  function updateBarRotation() {
    if (!mobileBar || !isTouch) return;
    const isPortraitNow = window.innerWidth < window.innerHeight;
    if (!isPortraitNow) {
      // Landscape/desktop: fully visible, normal
      mobileBar.style.opacity = "1";
      mobileBar.style.pointerEvents = "all";
      mobileBar.style.transform = "";
      mobileBar.style.width = "";
      mobileBar.style.right = "";
      return;
    }
    const viewH = window.innerHeight;
    // Rotate along with the 3D model (scroll 0 to 0.6)
    const scrollProgress = Math.min(window.scrollY / (viewH * 0.6), 1);
    
    // -90deg at scroll=0, 0deg when scrollProgress=1
    const angleDeg = -90 * (1 - scrollProgress);
    mobileBar.style.setProperty("--bar-rot", `${angleDeg}deg`);

    mobileBar.style.opacity = "1";
    mobileBar.style.pointerEvents = "all";

    if (scrollProgress >= 1) {
      // Fully upright: snap to bottom like normal
      mobileBar.style.left   = "0";
      mobileBar.style.right  = "0";
      mobileBar.style.width  = "";
      mobileBar.style.bottom = "0";
      mobileBar.style.transform = "none";
    } else {
      // Still rotating: positioned along left edge, acting as landscape bar
      mobileBar.style.right  = "auto";
      mobileBar.style.width  = "100vh"; // full screen width since it's rotated
      mobileBar.style.transform = "rotate(var(--bar-rot, -90deg))";
    }
  }

  if (isTouch) {
    updateBarRotation();
    window.addEventListener("scroll", updateBarRotation, { passive: true });
    window.addEventListener("resize", updateBarRotation, { passive: true });
  }
  // ───────────────────────────────────────────────────────────────────

  // ── Mobile command bar ──────────────────────────────────────────────
  const mobileInput = document.getElementById("mobile-input") as HTMLInputElement | null;
  const mobileSendBtn = document.getElementById("mobile-send-btn") as HTMLButtonElement | null;
  const mobilePath = document.getElementById("mobile-path") as HTMLElement | null;
  const mobileChips = document.querySelectorAll<HTMLButtonElement>(".mobile-cmd-chip");

  function submitMobileCommand(cmd: string) {
    if (!cmd.trim()) return;

    // Mirror command into the 3D terminal as typed text then freeze
    const fakeAdd = stringEditDistance("", cmd);
    if (fakeAdd) {
      oldText = "";
      textarea.value = cmd;
      screenTextEngine.userInput(fakeAdd, cmd.length);
    }

    screenTextEngine.freezeInput();
    bash.input(cmd);

    oldText = "";
    textarea.value = "";
    screenTextEngine.userInput(
      stringEditDistance(cmd, "")!,
      0
    );
    screenTextEngine.scrollToEnd();

    // Update path label
    if (mobilePath) {
      mobilePath.textContent = document.title; // fallback
      // Read from the last printed prompt line by checking bash state
    }
    if (mobileInput) mobileInput.value = "";
  }

  if (mobileSendBtn && mobileInput) {
    mobileSendBtn.addEventListener("click", () => {
      submitMobileCommand(mobileInput.value);
    });
    mobileInput.addEventListener("keydown", (e) => {
      // Prevent keystrokes from leaking to the window keypress handler
      e.stopPropagation();
      if (e.key === "Enter") {
        e.preventDefault();
        submitMobileCommand(mobileInput.value);
      }
    });
  }

  mobileChips.forEach((chip) => {
    chip.addEventListener("click", () => {
      const cmd = chip.dataset.cmd ?? "";
      submitMobileCommand(cmd);
    });
  });
  // ────────────────────────────────────────────────────────────────────

  canvas.addEventListener("pointerup", (ev) => {
    if (ev.pointerType === "mouse") {
      textarea.readOnly = false;
      textarea.focus();
      textarea.setSelectionRange(lastSelection, lastSelection);
    } else {
      textarea.readOnly = true;
      textarea.blur();
    }
  });
  window.addEventListener("keypress", (e) => {
    // Don't intercept keystrokes when mobile input bar is focused
    if (document.activeElement?.id === "mobile-input") return;

    if (
      textarea.readOnly === true ||
      document.activeElement?.id !== "textarea"
    ) {
      textarea.readOnly = false;
      textarea.focus();

      if (e.key.length === 1) {
        textarea.value =
          textarea.value.slice(0, lastSelection) +
          e.key +
          textarea.value.slice(lastSelection);
        lastSelection += 1;
        onInput();
      }
      textarea.setSelectionRange(lastSelection, lastSelection);
    }
    // textarea
    if (e.key === "Enter") {
      screenTextEngine.freezeInput();
      bash.input(textarea.value);
      oldText = "";
      textarea.value = "";
      const change = stringEditDistance(oldText, textarea.value);
      if (change) screenTextEngine.userInput(change, textarea.selectionStart);
      screenTextEngine.scrollToEnd();
    }
  });

  window.addEventListener("keydown", (e) => {
    switch (e.key) {
      case "ArrowUp":
        e.preventDefault();
        screenTextEngine.scroll(-1, "lines", {
          moveView: true,
          updateMaxScroll: false,
        });
        break;
      case "ArrowDown":
        e.preventDefault();
        screenTextEngine.scroll(1, "lines", {
          moveView: true,
          updateMaxScroll: false,
        });
        break;
    }
  });

  let lastSelection = 0;
  document.addEventListener("selectionchange", () => {
    if (textarea.selectionStart !== textarea.selectionEnd)
      textarea.setSelectionRange(lastSelection, lastSelection);
    lastSelection = textarea.selectionStart;
    screenTextEngine.userInput(
      { type: "none", loc: "none", str: "" },
      textarea.selectionStart
    );
  });

  function stringEditDistance(oldStr: string, newStr: string) {
    const lenDiff = oldStr.length - newStr.length;

    let change: Change = {
      type: "none",
      loc: "none",
      str: "",
    };
    let op = 0;
    let np = 0;

    if (lenDiff === 0) {
    } else if (lenDiff > 0) {
      change.type = "del";
      while (op < oldStr.length || np < newStr.length) {
        if (op >= oldStr.length) {
          console.error("add and del");
          return;
        }
        if (oldStr.charAt(op) !== newStr.charAt(np)) {
          if (change.loc === "none")
            change.loc = np === newStr.length ? "end" : np;
          change.str += oldStr.charAt(op);
          op++;
        } else {
          op++;
          np++;
        }
      }
    } else if (lenDiff < 0) {
      change.type = "add";
      while (op < oldStr.length || np < newStr.length) {
        if (np >= newStr.length) {
          console.error("add and del");
          return;
        }
        if (oldStr.charAt(op) !== newStr.charAt(np)) {
          if (change.loc === "none")
            change.loc = op === oldStr.length ? "end" : op;
          change.str += newStr.charAt(np);
          np++;
        } else {
          op++;
          np++;
        }
      }
    }
    return change;
  }
}
