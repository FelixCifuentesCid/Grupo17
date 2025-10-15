// src/controllers/auth.controller.js
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();
const SUPA_URL = process.env.SUPABASE_URL;
const SUPA_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;


if (!SUPA_URL || !SUPA_SERVICE_KEY) {
  console.error("Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env");
  process.exit(1);
}

const supa = createClient(SUPA_URL, SUPA_SERVICE_KEY);

/**
 * registerController:
 * Body esperado: { email, password, nombre_usuario, codigo }
 */
export async function registerController(req, res) {
  try {
    const { email, password, nombre_usuario, codigo_preferencia, codigo_rol } = req.body || {};

    if (!email || !password || !nombre_usuario || !codigo_preferencia || !codigo_rol) {
      return res.status(400).json({ ok: false, message: "Faltan campos. Requerido: email, password, nombre_usuario, codigo_preferencia, codigo_rol" });
    }

    // 1) Crear usuario en auth (admin)
    const createResp = await supa.auth.admin.createUser({
      email: email.trim(),
      password,
      user_metadata: { name: nombre_usuario },
    });

    // Manejo robusto según versión de supabase-js
    const createdUser = createResp.user ?? createResp.data?.user ?? createResp.data ?? null;
    const userId = createdUser?.id ?? null;
    if (!userId) {
      return res.status(500).json({ ok: false, message: "No se obtuvo id del usuario creado", detail: createResp });
    }

    const { data: preferenciaData, error: errorPref } = await supa
      .from("preferencias")
      .select("id_preferencia")
      .eq("codigo", codigo_preferencia)
      .single();
    const id_preferencia = preferenciaData.id_preferencia;

    const { data: rolData, error: errorRol } = await supa
      .from("roles")
      .select("id_rol")
      .eq("codigo", codigo_rol)
      .single();
    const id_rol = rolData.id_rol;

    // 2) Upsert perfil en table 'perfiles'
    const upsertResp = await supa
      .from("perfiles")
      .upsert({
        id: userId,
        nombre_usuario,
        id_rol,
        fecha_creacion: new Date().toISOString(),
        id_preferencia
      })
      .select()
      .maybeSingle();


    if (upsertResp.error) {
      return res.status(500).json({ ok: false, message: "Usuario creado pero error al crear perfil", detail: upsertResp.error.message ?? upsertResp.error });
    }

    return res.status(201).json({
      ok: true,
      message: "Usuario creado correctamente",
      user: { id: userId, email: email.trim(), nombre_usuario },
      profile: upsertResp.data ?? null
    });

  } catch (err) {
    console.error("registerController error:", err);
    return res.status(500).json({ ok: false, message: "Error interno", detail: String(err) });
  }
}


export async function loginController(req, res) {
  try {
    const rawEmail = (req.body?.email ?? '').toString();
    const password = (req.body?.password ?? '').toString();

    if (!rawEmail || !password) {
      return res.status(400).json({ ok: false, message: "Faltan email o password" });
    }

    const email = rawEmail.trim().toLowerCase();



    const signResp = await supa.auth.signInWithPassword({ email, password });

    if (signResp.error) {
      // Mapea mensajes más claros según código
      const code = signResp.error?.status ?? signResp.error?.error ?? '';
      const msg = signResp.error?.message ?? 'Credenciales inválidas';

      // Errores comunes: Invalid login credentials, Email not confirmed, etc.
      const friendly =
        /invalid/i.test(msg) ? 'Credenciales inválidas'
          : /confirm/i.test(msg) ? 'Email no confirmado'
            : /not.*found|exist/i.test(msg) ? 'Usuario no existe'
              : 'No se pudo iniciar sesión';

      return res.status(401).json({
        ok: false,
        message: friendly,
        detail: msg,
        code
      });
    }

    const session = signResp.data?.session ?? null;
    const user = signResp.data?.user ?? null;

    if (!session || !user) {
      return res.status(401).json({ ok: false, message: "No se pudo crear sesión" });
    }

    return res.json({
      ok: true,
      message: "Login exitoso",
      session, // access_token, refresh_token, etc.
      user     // id, email, etc.
    });
  } catch (err) {
    console.error("loginController error:", err);
    return res.status(500).json({ ok: false, message: "Error interno", detail: String(err) });
  }
}



export async function checkEmailController(req, res) {
  try {
    const rawEmail = (req.body?.email ?? '').toString();
    if (!rawEmail) return res.status(400).json({ ok: false, message: "Falta email" });

    const qEmail = rawEmail.trim().toLowerCase();

    // 1) Si existe getUserByEmail, úsalo
    const hasGetByEmail =
      supa?.auth?.admin && typeof supa.auth.admin.getUserByEmail === 'function';

    if (hasGetByEmail) {
      const { data, error } = await supa.auth.admin.getUserByEmail(qEmail);
      if (error) {
        return res.status(500).json({ ok: false, message: "Error consultando usuarios (admin)", detail: error.message ?? error });
      }
      return res.json({ ok: true, exists: !!data?.user, userId: data?.user?.id ?? null });
    }

    // 2) Compatibilidad: paginar listUsers y filtrar por email en memoria
    //    (Requiere SERVICE_ROLE en el backend)
    let page = 1;
    const perPage = 100; // ajusta si necesitas
    let found = null;

    while (!found) {
      const resp = await supa.auth.admin.listUsers({ page, perPage });
      const users = resp?.users ?? resp?.data?.users ?? [];
      if (Array.isArray(users) && users.length > 0) {
        found = users.find(u => (u.email || '').toLowerCase() === qEmail) || null;
        if (found) break;
        if (users.length < perPage) break; // no hay más páginas
      } else {
        break; // sin usuarios o respuesta vacía
      }
      page += 1;
      if (page > 20) break; // corta por seguridad
    }

    return res.json({ ok: true, exists: !!found, userId: found?.id ?? null });

  } catch (err) {
    console.error("checkEmailController error:", err);
    return res.status(500).json({ ok: false, message: "Error interno", detail: String(err) });
  }
}


