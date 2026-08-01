// Thin loader for the official YouTube IFrame Player API. Loaded once (singleton),
// shared by every ContentCard so we get real playback control (mute/unmute state that
// persists across swipes) instead of a raw <iframe src> that reloads muted every time.

declare global {
  interface Window {
    YT?: {
      Player: new (elementId: HTMLElement | string, options: any) => any;
      PlayerState: { PLAYING: number; PAUSED: number; ENDED: number; BUFFERING: number; CUED: number };
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiPromise: Promise<NonNullable<Window["YT"]>> | null = null;

export function loadYouTubeIframeAPI(): Promise<NonNullable<Window["YT"]>> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("YouTube IFrame API can only load in a browser environment."));
  }
  if (window.YT?.Player) {
    return Promise.resolve(window.YT);
  }
  if (apiPromise) return apiPromise;

  apiPromise = new Promise((resolve) => {
    const previousReady = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previousReady?.();
      resolve(window.YT!);
    };

    if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
      const script = document.createElement("script");
      script.src = "https://www.youtube.com/iframe_api";
      script.async = true;
      document.head.appendChild(script);
    }
  });

  return apiPromise;
}
