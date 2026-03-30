"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const cors_1 = __importDefault(require("cors"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const express_1 = __importDefault(require("express"));
const helmet_1 = __importDefault(require("helmet"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const morgan_1 = __importDefault(require("morgan"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const zod_1 = require("zod");
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
const app = (0, express_1.default)();
const PORT = Number(process.env.PORT || 4000);
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change";
const WEB_ORIGIN = process.env.WEB_ORIGIN || "http://localhost:3000";
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)({ origin: WEB_ORIGIN, credentials: true }));
app.use((0, morgan_1.default)("dev"));
app.use(express_1.default.json({ limit: "1mb" }));
app.use((0, cookie_parser_1.default)());
function signToken(user) {
    return jsonwebtoken_1.default.sign(user, JWT_SECRET, { expiresIn: "7d" });
}
function auth(requiredRole) {
    return (req, res, next) => {
        const raw = req.cookies.token || req.headers.authorization?.replace("Bearer ", "");
        if (!raw) {
            return res.status(401).json({ message: "Unauthorized" });
        }
        try {
            const payload = jsonwebtoken_1.default.verify(raw, JWT_SECRET);
            req.user = payload;
            if (payload.status !== "ACTIVE") {
                return res.status(403).json({ message: "Account suspended" });
            }
            if (requiredRole && payload.role !== requiredRole) {
                return res.status(403).json({ message: "Forbidden" });
            }
            return next();
        }
        catch {
            return res.status(401).json({ message: "Invalid token" });
        }
    };
}
app.get("/health", (_req, res) => {
    res.json({ ok: true, service: "api", at: new Date().toISOString() });
});
const registerSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(6),
});
app.post("/api/auth/register", async (req, res) => {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json(parsed.error.flatten());
    }
    const { email, password } = parsed.data;
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
        return res.status(409).json({ message: "Email already exists" });
    }
    const hash = await bcryptjs_1.default.hash(password, 10);
    const user = await prisma.user.create({
        data: { email, passwordHash: hash },
        select: { id: true, email: true, role: true, status: true, createdAt: true },
    });
    const token = signToken({ id: user.id, role: user.role, status: user.status });
    res.cookie("token", token, { httpOnly: true, sameSite: "lax" });
    return res.status(201).json({ user, token });
});
app.post("/api/auth/login", async (req, res) => {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json(parsed.error.flatten());
    }
    const { email, password } = parsed.data;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
        return res.status(401).json({ message: "Invalid credentials" });
    }
    const ok = await bcryptjs_1.default.compare(password, user.passwordHash);
    if (!ok) {
        return res.status(401).json({ message: "Invalid credentials" });
    }
    if (user.status !== "ACTIVE") {
        return res.status(403).json({ message: "Account suspended" });
    }
    const token = signToken({ id: user.id, role: user.role, status: user.status });
    res.cookie("token", token, { httpOnly: true, sameSite: "lax" });
    return res.json({
        token,
        user: { id: user.id, email: user.email, role: user.role, status: user.status, createdAt: user.createdAt },
    });
});
app.post("/api/auth/logout", (_req, res) => {
    res.clearCookie("token");
    res.json({ ok: true });
});
app.get("/api/auth/me", auth(), async (req, res) => {
    const user = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: {
            id: true,
            email: true,
            role: true,
            status: true,
            createdAt: true,
            subscriptions: {
                where: { isActive: true },
                orderBy: { endsAt: "desc" },
                take: 1,
            },
        },
    });
    return res.json(user);
});
const m3uSchema = zod_1.z.object({
    name: zod_1.z.string().min(2),
    sourceUrl: zod_1.z.string().url(),
});
app.post("/api/playlists/import/m3u", auth(), async (req, res) => {
    const parsed = m3uSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json(parsed.error.flatten());
    }
    const { name, sourceUrl } = parsed.data;
    const playlist = await prisma.playlist.create({
        data: {
            userId: req.user.id,
            name,
            sourceUrl,
            type: "M3U",
            status: "RUNNING",
        },
    });
    try {
        const response = await fetch(sourceUrl);
        const text = await response.text();
        const lines = text.split("\n");
        let currentMeta = "";
        let count = 0;
        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith("#EXTINF")) {
                currentMeta = trimmed;
            }
            if (trimmed && !trimmed.startsWith("#")) {
                const titleMatch = currentMeta.match(/,(.*)$/);
                const categoryMatch = currentMeta.match(/group-title=\"([^\"]+)\"/);
                const logoMatch = currentMeta.match(/tvg-logo=\"([^\"]+)\"/);
                const tvgIdMatch = currentMeta.match(/tvg-id=\"([^\"]+)\"/);
                await prisma.streamSource.create({
                    data: {
                        playlistId: playlist.id,
                        category: categoryMatch?.[1] || "General",
                        title: titleMatch?.[1]?.trim() || `Channel ${count + 1}`,
                        streamUrl: trimmed,
                        logo: logoMatch?.[1] || null,
                        tvgId: tvgIdMatch?.[1] || null,
                    },
                });
                count += 1;
            }
        }
        await prisma.playlist.update({
            where: { id: playlist.id },
            data: { status: "DONE", lastSyncAt: new Date() },
        });
        return res.status(201).json({ playlistId: playlist.id, importedChannels: count, status: "DONE" });
    }
    catch (error) {
        await prisma.playlist.update({
            where: { id: playlist.id },
            data: { status: "FAILED" },
        });
        return res.status(500).json({ message: "Import failed", error: error.message });
    }
});
const xtreamSchema = zod_1.z.object({
    name: zod_1.z.string().min(2),
    host: zod_1.z.string().url(),
    username: zod_1.z.string().min(2),
    password: zod_1.z.string().min(2),
});
app.post("/api/playlists/import/xtream", auth(), async (req, res) => {
    const parsed = xtreamSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json(parsed.error.flatten());
    }
    const { name, host, username, password } = parsed.data;
    const playlist = await prisma.playlist.create({
        data: {
            userId: req.user.id,
            name,
            sourceUrl: `${host}/player_api.php?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`,
            type: "XTREAM",
            host,
            username,
            password,
            status: "RUNNING",
        },
    });
    try {
        const liveUrl = `${host}/player_api.php?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}&action=get_live_streams`;
        const movieUrl = `${host}/player_api.php?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}&action=get_vod_streams`;
        const seriesUrl = `${host}/player_api.php?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}&action=get_series`;
        const [liveRaw, movieRaw, seriesRaw] = await Promise.all([
            fetch(liveUrl).then((r) => r.json()).catch(() => []),
            fetch(movieUrl).then((r) => r.json()).catch(() => []),
            fetch(seriesUrl).then((r) => r.json()).catch(() => []),
        ]);
        let imported = 0;
        const pushItems = async (items, fallbackCategory) => {
            for (const item of items.slice(0, 2000)) {
                const streamId = item.stream_id || item.series_id;
                const ext = item.container_extension || "m3u8";
                const isSeries = fallbackCategory === "Series";
                const streamUrl = isSeries
                    ? `${host}/series/${username}/${password}/${streamId}.${ext}`
                    : `${host}/${fallbackCategory === "Movies" ? "movie" : "live"}/${username}/${password}/${streamId}.${ext}`;
                await prisma.streamSource.create({
                    data: {
                        playlistId: playlist.id,
                        category: item.category_name || fallbackCategory,
                        title: item.name || `${fallbackCategory} ${streamId}`,
                        streamUrl,
                        logo: item.stream_icon || null,
                        tvgId: item.epg_channel_id || null,
                    },
                });
                imported += 1;
            }
        };
        await pushItems(Array.isArray(liveRaw) ? liveRaw : [], "Live TV");
        await pushItems(Array.isArray(movieRaw) ? movieRaw : [], "Movies");
        await pushItems(Array.isArray(seriesRaw) ? seriesRaw : [], "Series");
        await prisma.playlist.update({
            where: { id: playlist.id },
            data: { status: "DONE", lastSyncAt: new Date() },
        });
        return res.status(201).json({ playlistId: playlist.id, importedChannels: imported, status: "DONE" });
    }
    catch (error) {
        await prisma.playlist.update({ where: { id: playlist.id }, data: { status: "FAILED" } });
        return res.status(500).json({ message: "Xtream import failed", error: error.message });
    }
});
app.get("/api/playlists", auth(), async (req, res) => {
    const playlists = await prisma.playlist.findMany({
        where: { userId: req.user.id },
        orderBy: { createdAt: "desc" },
        include: {
            _count: { select: { streams: true } },
        },
    });
    res.json(playlists);
});
app.get("/api/streams", auth(), async (req, res) => {
    const category = String(req.query.category || "");
    const q = String(req.query.q || "");
    const playlistId = String(req.query.playlistId || "");
    const where = {
        playlist: { userId: req.user.id },
        ...(category ? { category } : {}),
        ...(playlistId ? { playlistId } : {}),
        ...(q ? { title: { contains: q, mode: "insensitive" } } : {}),
    };
    const streams = await prisma.streamSource.findMany({
        where,
        orderBy: { title: "asc" },
        take: 500,
    });
    res.json(streams);
});
app.get("/api/categories", auth(), async (req, res) => {
    const categories = await prisma.streamSource.findMany({
        where: { playlist: { userId: req.user.id } },
        select: { category: true },
        distinct: ["category"],
        orderBy: { category: "asc" },
    });
    res.json(categories.map((c) => c.category));
});
app.get("/api/ads", auth(), async (_req, res) => {
    const config = await prisma.adConfig.findFirst();
    res.json(config || { adsEnabled: false, bannerCode: "", interstitialCode: "", delayMs: 2000, cooldownMs: 60000 });
});
app.get("/api/announcements", auth(), async (_req, res) => {
    const now = new Date();
    const items = await prisma.announcement.findMany({
        where: {
            isActive: true,
            OR: [{ startAt: null }, { startAt: { lte: now } }],
            AND: [{ OR: [{ endAt: null }, { endAt: { gte: now } }] }],
        },
        orderBy: { createdAt: "desc" },
        take: 5,
    });
    res.json(items);
});
app.get("/api/proxy/stream", auth(), async (req, res) => {
    const url = String(req.query.url || "");
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
        return res.status(400).json({ message: "Invalid stream url" });
    }
    const upstream = await fetch(url);
    if (!upstream.ok) {
        return res.status(502).json({ message: "Upstream stream is unavailable" });
    }
    const contentType = upstream.headers.get("content-type") || "application/octet-stream";
    res.setHeader("content-type", contentType);
    res.setHeader("cache-control", "no-store");
    const body = await upstream.arrayBuffer();
    return res.status(200).send(Buffer.from(body));
});
app.get("/api/admin/users", auth("ADMIN"), async (_req, res) => {
    const users = await prisma.user.findMany({
        orderBy: { createdAt: "desc" },
        select: {
            id: true,
            email: true,
            role: true,
            status: true,
            createdAt: true,
            subscriptions: {
                where: { isActive: true },
                orderBy: { endsAt: "desc" },
                take: 1,
            },
        },
    });
    res.json(users);
});
app.patch("/api/admin/users/:id/suspend", auth("ADMIN"), async (req, res) => {
    const userId = String(req.params.id);
    const user = await prisma.user.update({
        where: { id: userId },
        data: { status: "SUSPENDED" },
        select: { id: true, email: true, status: true },
    });
    res.json(user);
});
app.patch("/api/admin/users/:id/activate", auth("ADMIN"), async (req, res) => {
    const userId = String(req.params.id);
    const user = await prisma.user.update({
        where: { id: userId },
        data: { status: "ACTIVE" },
        select: { id: true, email: true, status: true },
    });
    res.json(user);
});
app.post("/api/admin/subscriptions", auth("ADMIN"), async (req, res) => {
    const schema = zod_1.z.object({
        userId: zod_1.z.string().min(6),
        planName: zod_1.z.string().min(2),
        days: zod_1.z.number().int().min(1).max(3650),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json(parsed.error.flatten());
    }
    const now = new Date();
    const endsAt = new Date(now.getTime() + parsed.data.days * 24 * 60 * 60 * 1000);
    const subscription = await prisma.subscription.create({
        data: {
            userId: parsed.data.userId,
            planName: parsed.data.planName,
            startsAt: now,
            endsAt,
            isActive: true,
        },
    });
    res.status(201).json(subscription);
});
app.put("/api/admin/ads", auth("ADMIN"), async (req, res) => {
    const schema = zod_1.z.object({
        adsEnabled: zod_1.z.boolean(),
        bannerCode: zod_1.z.string().optional(),
        interstitialCode: zod_1.z.string().optional(),
        delayMs: zod_1.z.number().int().min(0).max(60000),
        cooldownMs: zod_1.z.number().int().min(1000).max(3600000),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json(parsed.error.flatten());
    }
    const existing = await prisma.adConfig.findFirst();
    const data = parsed.data;
    if (!existing) {
        const created = await prisma.adConfig.create({ data });
        return res.json(created);
    }
    const updated = await prisma.adConfig.update({ where: { id: existing.id }, data });
    return res.json(updated);
});
app.post("/api/admin/announcements", auth("ADMIN"), async (req, res) => {
    const schema = zod_1.z.object({
        title: zod_1.z.string().min(2),
        body: zod_1.z.string().min(2),
        isActive: zod_1.z.boolean().default(true),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json(parsed.error.flatten());
    }
    const created = await prisma.announcement.create({ data: parsed.data });
    res.status(201).json(created);
});
app.use((error, _req, res, _next) => {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
});
app.listen(PORT, () => {
    console.log(`API running on http://localhost:${PORT}`);
});
