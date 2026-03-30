"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";
import { AdConfig, Announcement, AuthUser, Playlist, Stream } from "@/lib/types";
import { VideoPlayer } from "@/components/VideoPlayer";

export default function Home() {
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [user, setUser] = useState<AuthUser | null>(null);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [streams, setStreams] = useState<Stream[]>([]);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [query, setQuery] = useState("");
  const [selectedStream, setSelectedStream] = useState<Stream | null>(null);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [ads, setAds] = useState<AdConfig | null>(null);
  const [status, setStatus] = useState("Hazır");

  const [m3uName, setM3uName] = useState("");
  const [m3uUrl, setM3uUrl] = useState("");
  const [xtreamName, setXtreamName] = useState("");
  const [xtreamHost, setXtreamHost] = useState("");
  const [xtreamUser, setXtreamUser] = useState("");
  const [xtreamPass, setXtreamPass] = useState("");

  const isAdmin = user?.role === "ADMIN";

  const visibleStreams = useMemo(() => streams.slice(0, 400), [streams]);

  async function bootstrap() {
    try {
      const me = await apiFetch<AuthUser>("/api/auth/me");
      setUser(me);
      await Promise.all([loadPlaylists(), loadCategories(), loadAnnouncements(), loadAds()]);
    } catch {
      setUser(null);
    }
  }

  async function loadPlaylists() {
    const data = await apiFetch<Playlist[]>("/api/playlists");
    setPlaylists(data);
    if (!selectedPlaylistId && data[0]) {
      setSelectedPlaylistId(data[0].id);
    }
  }

  async function loadCategories() {
    const data = await apiFetch<string[]>("/api/categories");
    setCategories(data);
    if (!selectedCategory && data[0]) {
      setSelectedCategory(data[0]);
    }
  }

  async function loadStreams() {
    if (!user) {
      return;
    }
    const params = new URLSearchParams();
    if (selectedCategory) params.set("category", selectedCategory);
    if (query) params.set("q", query);
    if (selectedPlaylistId) params.set("playlistId", selectedPlaylistId);
    const data = await apiFetch<Stream[]>(`/api/streams?${params.toString()}`);
    setStreams(data);
    if (data[0] && !selectedStream) {
      setSelectedStream(data[0]);
    }
  }

  async function loadAnnouncements() {
    const data = await apiFetch<Announcement[]>("/api/announcements");
    setAnnouncements(data);
  }

  async function loadAds() {
    const data = await apiFetch<AdConfig>("/api/ads");
    setAds(data);
  }

  useEffect(() => {
    bootstrap();
  }, []);

  useEffect(() => {
    loadStreams().catch(() => {
      setStreams([]);
    });
  }, [selectedCategory, query, selectedPlaylistId, user]);

  async function submitAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("Kimlik doğrulama yapılıyor...");
    try {
      const result = await apiFetch<{ token: string }>(`/api/auth/${authMode}`, {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      localStorage.setItem("token", result.token);
      setStatus("Giriş başarılı");
      await bootstrap();
    } catch (error) {
      setStatus(`Hata: ${(error as Error).message}`);
    }
  }

  async function importM3u(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("M3U içe aktarılıyor...");
    try {
      await apiFetch("/api/playlists/import/m3u", {
        method: "POST",
        body: JSON.stringify({ name: m3uName, sourceUrl: m3uUrl }),
      });
      setM3uName("");
      setM3uUrl("");
      await Promise.all([loadPlaylists(), loadCategories(), loadStreams()]);
      setStatus("M3U içe aktarıldı");
    } catch (error) {
      setStatus(`M3U hatası: ${(error as Error).message}`);
    }
  }

  async function importXtream(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("Xtream içe aktarılıyor...");
    try {
      await apiFetch("/api/playlists/import/xtream", {
        method: "POST",
        body: JSON.stringify({
          name: xtreamName,
          host: xtreamHost,
          username: xtreamUser,
          password: xtreamPass,
        }),
      });
      setXtreamName("");
      setXtreamHost("");
      setXtreamUser("");
      setXtreamPass("");
      await Promise.all([loadPlaylists(), loadCategories(), loadStreams()]);
      setStatus("Xtream içe aktarıldı");
    } catch (error) {
      setStatus(`Xtream hatası: ${(error as Error).message}`);
    }
  }

  async function logout() {
    localStorage.removeItem("token");
    setUser(null);
    setStreams([]);
    setStatus("Çıkış yapıldı");
  }

  async function suspendUser(userId: string) {
    await apiFetch(`/api/admin/users/${userId}/suspend`, { method: "PATCH" });
    setStatus("Kullanıcı askıya alındı");
  }

  async function activateUser(userId: string) {
    await apiFetch(`/api/admin/users/${userId}/activate`, { method: "PATCH" });
    setStatus("Kullanıcı aktifleştirildi");
  }

  if (!user) {
    return (
      <main className="min-h-screen bg-[radial-gradient(circle_at_20%_10%,#1f436d_0%,#0f172a_40%,#0b1020_100%)] p-6 text-white md:p-10">
        <section className="mx-auto grid w-full max-w-6xl gap-8 md:grid-cols-[1.2fr_1fr]">
          <div className="rounded-3xl border border-cyan-300/20 bg-white/5 p-8 backdrop-blur">
            <p className="mb-3 inline-block rounded-full border border-cyan-300/30 px-3 py-1 text-xs uppercase tracking-[0.25em] text-cyan-200">
              IPTV Control Center
            </p>
            <h1 className="text-4xl font-black leading-tight md:text-6xl">Smarters Pro Seviye Web Oynatıcı</h1>
            <p className="mt-5 max-w-xl text-cyan-100/80">
              Xtream API ve M3U desteği, admin yönetimi, abonelik kontrolü ve reklam modülü ile üretime uygun temel sürüm.
            </p>
          </div>

          <form onSubmit={submitAuth} className="rounded-3xl border border-white/10 bg-slate-950/70 p-6 shadow-2xl">
            <h2 className="text-2xl font-bold">{authMode === "login" ? "Giriş Yap" : "Kayıt Ol"}</h2>
            <p className="mt-1 text-sm text-white/70">Durum: {status}</p>
            <div className="mt-5 space-y-3">
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="E-posta"
                className="w-full rounded-xl border border-white/15 bg-white/10 px-4 py-3 outline-none focus:border-cyan-300"
              />
              <input
                value={password}
                type="password"
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Şifre"
                className="w-full rounded-xl border border-white/15 bg-white/10 px-4 py-3 outline-none focus:border-cyan-300"
              />
            </div>
            <button className="mt-5 w-full rounded-xl bg-cyan-400 px-4 py-3 font-bold text-slate-950 hover:bg-cyan-300">
              {authMode === "login" ? "Giriş" : "Kayıt"}
            </button>
            <button
              type="button"
              onClick={() => setAuthMode(authMode === "login" ? "register" : "login")}
              className="mt-3 w-full rounded-xl border border-white/20 px-4 py-3 font-semibold"
            >
              {authMode === "login" ? "Hesabın yok mu? Kayıt ol" : "Hesabın var mı? Giriş yap"}
            </button>
          </form>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#090f1d] text-slate-100">
      {ads?.adsEnabled && ads.bannerCode && (
        <div className="border-b border-cyan-500/20 bg-[#071327] px-4 py-2 text-center text-sm text-cyan-200">Banner: {ads.bannerCode}</div>
      )}

      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-[#0d1730] px-4 py-4 md:px-8">
        <div>
          <h1 className="text-2xl font-black">IPTV Dashboard</h1>
          <p className="text-sm text-slate-300">{user.email} • {user.role}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => bootstrap()} className="rounded-lg border border-white/20 px-3 py-2 text-sm">Yenile</button>
          <button onClick={logout} className="rounded-lg bg-rose-500 px-3 py-2 text-sm font-semibold text-white">Çıkış</button>
        </div>
      </header>

      {announcements.length > 0 && (
        <section className="mx-4 mt-4 space-y-2 rounded-2xl border border-amber-300/30 bg-amber-200/10 p-4 md:mx-8">
          {announcements.map((a) => (
            <article key={a.id}>
              <h3 className="font-bold text-amber-200">{a.title}</h3>
              <p className="text-sm text-amber-100/90">{a.body}</p>
            </article>
          ))}
        </section>
      )}

      <section className="grid gap-4 p-4 md:grid-cols-[300px_1fr_330px] md:p-8">
        <aside className="space-y-4">
          <div className="rounded-2xl border border-white/10 bg-[#111d3a] p-4">
            <h2 className="mb-3 text-lg font-bold">Playlists</h2>
            <select
              value={selectedPlaylistId}
              onChange={(e) => setSelectedPlaylistId(e.target.value)}
              className="w-full rounded-lg border border-white/20 bg-[#1a2747] px-3 py-2"
            >
              <option value="">Tümü</option>
              {playlists.map((p) => (
                <option value={p.id} key={p.id}>
                  {p.name} ({p._count?.streams || 0})
                </option>
              ))}
            </select>
          </div>

          <div className="rounded-2xl border border-white/10 bg-[#111d3a] p-4">
            <h2 className="mb-3 text-lg font-bold">Kategoriler</h2>
            <div className="max-h-52 space-y-2 overflow-auto pr-1">
              {categories.map((category) => (
                <button
                  key={category}
                  onClick={() => setSelectedCategory(category)}
                  className={`w-full rounded-lg px-3 py-2 text-left text-sm ${selectedCategory === category ? "bg-cyan-400 text-slate-950" : "bg-[#1a2747]"}`}
                >
                  {category}
                </button>
              ))}
            </div>
          </div>
        </aside>

        <section className="space-y-4">
          <VideoPlayer src={selectedStream?.streamUrl} />

          <div className="rounded-2xl border border-white/10 bg-[#111d3a] p-4">
            <div className="mb-3 flex gap-2">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Kanal ara"
                className="w-full rounded-lg border border-white/20 bg-[#1a2747] px-3 py-2"
              />
              <button onClick={() => loadStreams()} className="rounded-lg bg-cyan-400 px-4 py-2 font-semibold text-slate-950">Ara</button>
            </div>
            <div className="grid max-h-[420px] gap-2 overflow-auto sm:grid-cols-2">
              {visibleStreams.map((stream) => (
                <button
                  key={stream.id}
                  onClick={() => setSelectedStream(stream)}
                  className={`rounded-xl border px-3 py-3 text-left ${selectedStream?.id === stream.id ? "border-cyan-300 bg-cyan-300/10" : "border-white/10 bg-[#16274b]"}`}
                >
                  <p className="font-semibold">{stream.title}</p>
                  <p className="text-xs text-slate-300">{stream.category}</p>
                </button>
              ))}
            </div>
          </div>
        </section>

        <aside className="space-y-4">
          <form onSubmit={importM3u} className="rounded-2xl border border-white/10 bg-[#111d3a] p-4">
            <h2 className="mb-3 text-lg font-bold">M3U İçe Aktar</h2>
            <div className="space-y-2">
              <input value={m3uName} onChange={(e) => setM3uName(e.target.value)} placeholder="Liste adı" className="w-full rounded-lg border border-white/20 bg-[#1a2747] px-3 py-2" />
              <input value={m3uUrl} onChange={(e) => setM3uUrl(e.target.value)} placeholder="https://...m3u" className="w-full rounded-lg border border-white/20 bg-[#1a2747] px-3 py-2" />
            </div>
            <button className="mt-3 w-full rounded-lg bg-cyan-400 px-3 py-2 font-bold text-slate-950">Aktar</button>
          </form>

          <form onSubmit={importXtream} className="rounded-2xl border border-white/10 bg-[#111d3a] p-4">
            <h2 className="mb-3 text-lg font-bold">Xtream İçe Aktar</h2>
            <div className="space-y-2">
              <input value={xtreamName} onChange={(e) => setXtreamName(e.target.value)} placeholder="Liste adı" className="w-full rounded-lg border border-white/20 bg-[#1a2747] px-3 py-2" />
              <input value={xtreamHost} onChange={(e) => setXtreamHost(e.target.value)} placeholder="https://panel.domain" className="w-full rounded-lg border border-white/20 bg-[#1a2747] px-3 py-2" />
              <input value={xtreamUser} onChange={(e) => setXtreamUser(e.target.value)} placeholder="Username" className="w-full rounded-lg border border-white/20 bg-[#1a2747] px-3 py-2" />
              <input value={xtreamPass} onChange={(e) => setXtreamPass(e.target.value)} placeholder="Password" className="w-full rounded-lg border border-white/20 bg-[#1a2747] px-3 py-2" />
            </div>
            <button className="mt-3 w-full rounded-lg bg-cyan-400 px-3 py-2 font-bold text-slate-950">İçe Aktar</button>
          </form>

          {isAdmin && <AdminPanel onSuspend={suspendUser} onActivate={activateUser} />}
        </aside>
      </section>
      <footer className="px-4 pb-6 text-sm text-slate-300 md:px-8">Durum: {status}</footer>
    </main>
  );
}

function AdminPanel({
  onSuspend,
  onActivate,
}: {
  onSuspend: (userId: string) => Promise<void>;
  onActivate: (userId: string) => Promise<void>;
}) {
  const [users, setUsers] = useState<Array<{ id: string; email: string; status: string }>>([]);
  const [loading, setLoading] = useState(false);

  async function loadUsers() {
    setLoading(true);
    try {
      const data = await apiFetch<Array<{ id: string; email: string; status: string }>>("/api/admin/users");
      setUsers(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUsers();
  }, []);

  return (
    <div className="rounded-2xl border border-white/10 bg-[#111d3a] p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-bold">Admin Kullanıcıları</h2>
        <button onClick={loadUsers} className="rounded-lg border border-white/20 px-2 py-1 text-xs">Yenile</button>
      </div>
      {loading ? <p className="text-sm text-slate-300">Yükleniyor...</p> : null}
      <div className="max-h-64 space-y-2 overflow-auto">
        {users.map((u) => (
          <article key={u.id} className="rounded-lg border border-white/10 bg-[#1a2747] p-2 text-sm">
            <p>{u.email}</p>
            <p className="text-xs text-slate-300">{u.status}</p>
            <div className="mt-2 flex gap-2">
              <button onClick={() => onSuspend(u.id)} className="rounded bg-rose-500 px-2 py-1 text-xs font-semibold">Suspend</button>
              <button onClick={() => onActivate(u.id)} className="rounded bg-emerald-500 px-2 py-1 text-xs font-semibold">Activate</button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
