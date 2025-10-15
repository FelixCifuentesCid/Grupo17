// index.js
import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";

import nutritionRoutes from "./src/routes/nutrition.routes.js";
import authRoutes from "./src/routes/auth.routes.js"; // nombre correcto

const app = express();

// Middlewares
app.use(express.json());

// Logging simple de peticiones (útil para debug)
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});

// CORS: permitir origen configurable para que otros puedan levantarla localmente.
// Si FRONTEND_URL no está definido permitimos todos (*) para desarrollo.
const allowedOrigin = process.env.FRONTEND_URL || "*";
app.use(cors({
    origin: allowedOrigin,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
}));

// Rutas
// keep nutrition routes mounted exactly as before to avoid romper nada
app.use("/api", nutritionRoutes);

// auth routes under /api/auth (register, login, check-email, ...)
app.use("/api/auth", authRoutes);

// Salud / status
app.get("/health", (_, res) => res.json({ ok: true, time: new Date().toISOString() }));

// Manejo básico de errores (no intrusivo)
app.use((err, req, res, next) => {
    console.error("Unhandled error:", err);
    res.status(500).json({ ok: false, message: "Error interno del servidor", detail: String(err) });
});

// Puerto desde .env o 3000 por defecto
const PORT = process.env.PORT || 3000;
// justo antes o dentro del app.listen:
console.log('API SUPABASE_URL =>', process.env.SUPABASE_URL);
app.listen(PORT, () => console.log(`Nutri API escuchando en :${PORT}`));
