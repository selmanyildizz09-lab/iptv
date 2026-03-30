export type AuthUser = {
  id: string;
  email: string;
  role: "USER" | "ADMIN";
  status: "ACTIVE" | "SUSPENDED";
};

export type Playlist = {
  id: string;
  name: string;
  type: "M3U" | "XTREAM";
  status: string;
  createdAt: string;
  _count?: { streams: number };
};

export type Stream = {
  id: string;
  category: string;
  title: string;
  streamUrl: string;
  logo?: string | null;
};

export type AdConfig = {
  adsEnabled: boolean;
  bannerCode?: string;
  interstitialCode?: string;
  delayMs: number;
  cooldownMs: number;
};

export type Announcement = {
  id: string;
  title: string;
  body: string;
};
