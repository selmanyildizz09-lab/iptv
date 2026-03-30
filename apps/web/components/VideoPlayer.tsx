"use client";

import Hls from "hls.js";
import { useEffect, useRef } from "react";

type Props = {
  src?: string;
};

export function VideoPlayer({ src }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) {
      return;
    }

    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = src;
      return;
    }

    if (Hls.isSupported()) {
      const hls = new Hls();
      hls.loadSource(src);
      hls.attachMedia(video);
      return () => hls.destroy();
    }
  }, [src]);

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-black shadow-[0_20px_60px_rgba(0,0,0,0.55)]">
      <video
        ref={videoRef}
        controls
        playsInline
        autoPlay
        className="aspect-video w-full bg-black"
      />
    </div>
  );
}
