import "dotenv/config";
import express from "express";
import { GoogleGenerativeAI } from "@google/generative-ai";
import path from "path";
import { fileURLToPath } from "url";
import bcrypt from "bcryptjs";
import session from "express-session";
import db from "./database.js";

const app = express();
const port = process.env.PORT || 3000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// =========================
// Gemini
// =========================

const hasGeminiKey = Boolean(process.env.GEMINI_API_KEY);

if (!hasGeminiKey) {
  console.warn("GEMINI_API_KEY is missing. AI generation is disabled.");
}

const genAI = hasGeminiKey
  ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  : null;

// =========================
// Middleware
// =========================

app.use(express.json({ limit: "1mb" }));

app.use(
  session({
    name: "codecraft.sid",
    secret:
      process.env.SESSION_SECRET ||
      "codecraft-development-secret-change-this",
    resave: false,
    saveUninitialized: false,

    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      maxAge: 7 * 24 * 60 * 60 * 1000
    }
  })
);

app.use(express.static(path.join(__dirname, "public")));

// =========================
// Login protection
// =========================

function requireLogin(req, res, next) {
  if (!req.session || !req.session.user) {
    return res.status(401).json({
      error: "يجب تسجيل الدخول أولاً."
    });
  }

  next();
}

// =========================
// Register
// =========================

app.post("/api/register", async (req, res) => {
  try {
    const { username, password } = req.body || {};

    if (!username || !password) {
      return res.status(400).json({
        error: "اكتب اسم المستخدم وكلمة المرور."
      });
    }

    const cleanUsername = String(username).trim();

    if (cleanUsername.length < 3) {
      return res.status(400).json({
        error: "اسم المستخدم يجب أن يكون 3 أحرف على الأقل."
      });
    }

    if (cleanUsername.length > 30) {
      return res.status(400).json({
        error: "اسم المستخدم طويل جدًا."
      });
    }

    if (String(password).length < 6) {
      return res.status(400).json({
        error: "كلمة المرور يجب أن تكون 6 أحرف على الأقل."
      });
    }

    const existingUser = db
      .prepare("SELECT id FROM users WHERE username = ?")
      .get(cleanUsername);

    if (existingUser) {
      return res.status(409).json({
        error: "اسم المستخدم موجود بالفعل."
      });
    }

    const hashedPassword = await bcrypt.hash(String(password), 10);
    const createdAt = new Date().toISOString();

    const result = db
      .prepare(`
        INSERT INTO users (username, password, created_at)
        VALUES (?, ?, ?)
      `)
      .run(cleanUsername, hashedPassword, createdAt);

    const user = {
      id: Number(result.lastInsertRowid),
      username: cleanUsername
    };

    req.session.user = user;

    req.session.save((error) => {
      if (error) {
        console.error("Register session save error:", error);

        return res.status(500).json({
          error: "تم إنشاء الحساب لكن حدث خطأ في جلسة الدخول."
        });
      }

      return res.status(201).json({
        message: "تم إنشاء الحساب بنجاح.",
        user
      });
    });
  } catch (error) {
    console.error("Register error:", error);

    return res.status(500).json({
      error: "حدث خطأ أثناء إنشاء الحساب."
    });
  }
});

// =========================
// Login
// =========================

app.post("/api/login", async (req, res) => {
  try {
    const { username, password } = req.body || {};

    if (!username || !password) {
      return res.status(400).json({
        error: "اكتب اسم المستخدم وكلمة المرور."
      });
    }

    const cleanUsername = String(username).trim();

    const user = db
      .prepare(`
        SELECT id, username, password
        FROM users
        WHERE username = ?
      `)
      .get(cleanUsername);

    if (!user) {
      return res.status(401).json({
        error: "اسم المستخدم أو كلمة المرور غير صحيحة."
      });
    }

    const passwordCorrect = await bcrypt.compare(
      String(password),
      user.password
    );

    if (!passwordCorrect) {
      return res.status(401).json({
        error: "اسم المستخدم أو كلمة المرور غير صحيحة."
      });
    }

    const sessionUser = {
      id: user.id,
      username: user.username
    };

    req.session.user = sessionUser;

    // مهم جدًا:
    // نتأكد أن الـ session اتحفظت قبل إرسال الرد للمتصفح.
    req.session.save((error) => {
      if (error) {
        console.error("Login session save error:", error);

        return res.status(500).json({
          error: "تم التحقق من الحساب لكن حدث خطأ في جلسة الدخول."
        });
      }

      return res.json({
        message: "تم تسجيل الدخول بنجاح.",
        user: sessionUser
      });
    });
  } catch (error) {
    console.error("Login error:", error);

    return res.status(500).json({
      error: "حدث خطأ أثناء تسجيل الدخول."
    });
  }
});

// =========================
// Current user
// =========================

app.get("/api/me", (req, res) => {
  if (!req.session || !req.session.user) {
    return res.status(401).json({
      error: "غير مسجل الدخول."
    });
  }

  return res.json({
    user: req.session.user
  });
});

// =========================
// Logout
// =========================

app.post("/api/logout", (req, res) => {
  req.session.destroy((error) => {
    if (error) {
      console.error("Logout error:", error);

      return res.status(500).json({
        error: "حدث خطأ أثناء تسجيل الخروج."
      });
    }

    res.clearCookie("codecraft.sid");

    return res.json({
      message: "تم تسجيل الخروج."
    });
  });
});

// =========================
// AI Generate
// =========================

app.post("/api/generate", requireLogin, async (req, res) => {
  try {
    const {
      prompt,
      mode = "code",
      language = "html",
      style = "professional"
    } = req.body || {};

    if (!prompt || typeof prompt !== "string" || prompt.trim().length < 2) {
      return res.status(400).json({
        error: "اكتب طلبًا واضحًا أولاً."
      });
    }

    if (!genAI) {
      return res.status(503).json({
        error: "مفتاح Gemini غير موجود في ملف .env"
      });
    }

    const system =
      mode === "code"
        ? `You are CodeCraft AI, an expert software engineer.
Understand Arabic or English user requests.
Return production-quality code when possible.
Target language: ${language}.
Explain briefly in the user's language, then put the complete code in ONE fenced code block.
Do not put extra code blocks in the response.
Style preference: ${style}.`
        : `You are CodeCraft AI, an expert social-media copywriter.
Understand Arabic or English.
Create polished, ready-to-publish content.
Use the requested style: ${style}.
Keep the answer in the user's language unless the user asks otherwise.`;

    const models = [
      "gemini-3.5-flash-lite",
      "gemini-2.5-flash-lite",
      "gemini-2.5-flash"
    ];

    const fullPrompt = `${system}\n\nUser request:\n${prompt.trim()}`;

    let lastError = null;

    for (const modelName of models) {
      try {
        console.log(`Trying Gemini model: ${modelName}`);

        const model = genAI.getGenerativeModel({
          model: modelName
        });

        const result = await model.generateContent(fullPrompt);

        const text = result.response.text();

        return res.json({
          result: text || "لم يتم إنشاء نتيجة."
        });
      } catch (error) {
        lastError = error;

        const errorMessage = error?.message || "";

        console.error(
          `Gemini error with ${modelName}:`,
          errorMessage
        );

        if (
          errorMessage.includes("503") ||
          errorMessage.includes("high demand") ||
          errorMessage.includes("Service Unavailable") ||
          errorMessage.includes("404") ||
          errorMessage.includes("not found")
        ) {
          console.log(
            `Model ${modelName} unavailable. Trying next model...`
          );

          continue;
        }

        throw error;
      }
    }

    const lastErrorMessage = lastError?.message || "";

    if (
      lastErrorMessage.includes("503") ||
      lastErrorMessage.includes("high demand") ||
      lastErrorMessage.includes("Service Unavailable")
    ) {
      return res.status(503).json({
        error: "Gemini مشغول حاليًا. جرّب مرة أخرى بعد قليل."
      });
    }

    throw lastError;
  } catch (error) {
    console.error(
      "AI generation error:",
      error?.message || error
    );

    return res.status(500).json({
      error:
        "حدث خطأ أثناء الاتصال بالذكاء الاصطناعي. جرّب مرة أخرى."
    });
  }
});

// =========================
// Save project
// =========================

app.post("/api/projects", requireLogin, (req, res) => {
  try {
    const {
      title,
      prompt,
      code,
      language = "html",
      style = "professional"
    } = req.body || {};

    if (!prompt || !code) {
      return res.status(400).json({
        error: "بيانات المشروع غير مكتملة."
      });
    }

    const result = db
      .prepare(`
        INSERT INTO projects
        (user_id, title, prompt, code, language, style, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        req.session.user.id,
        title || "مشروع جديد",
        prompt,
        code,
        language,
        style,
        new Date().toISOString()
      );

    const project = db
      .prepare("SELECT * FROM projects WHERE id = ?")
      .get(result.lastInsertRowid);

    return res.status(201).json({
      project
    });
  } catch (error) {
    console.error("Save project error:", error);

    return res.status(500).json({
      error: "حدث خطأ أثناء حفظ المشروع."
    });
  }
});

// =========================
// Get projects
// =========================

app.get("/api/projects", requireLogin, (req, res) => {
  try {
    const projects = db
      .prepare(`
        SELECT *
        FROM projects
        WHERE user_id = ?
        ORDER BY id DESC
      `)
      .all(req.session.user.id);

    return res.json({
      projects
    });
  } catch (error) {
    console.error("Get projects error:", error);

    return res.status(500).json({
      error: "حدث خطأ أثناء تحميل المشاريع."
    });
  }
});

// =========================
// Delete project
// =========================

app.delete("/api/projects/:id", requireLogin, (req, res) => {
  try {
    const projectId = Number(req.params.id);

    if (!Number.isInteger(projectId)) {
      return res.status(400).json({
        error: "معرّف المشروع غير صحيح."
      });
    }

    const result = db
      .prepare(`
        DELETE FROM projects
        WHERE id = ? AND user_id = ?
      `)
      .run(projectId, req.session.user.id);

    if (result.changes === 0) {
      return res.status(404).json({
        error: "المشروع غير موجود."
      });
    }

    return res.json({
      message: "تم حذف المشروع."
    });
  } catch (error) {
    console.error("Delete project error:", error);

    return res.status(500).json({
      error: "حدث خطأ أثناء حذف المشروع."
    });
  }
});

// =========================
// Start server
// =========================

app.listen(port, () => {
  console.log(
    `CodeCraft AI running at http://localhost:${port}`
  );
});