const authScreen = document.getElementById("authScreen");
const mainApp = document.getElementById("mainApp");

const loginBox = document.getElementById("loginBox");
const registerBox = document.getElementById("registerBox");

const loginUsername = document.getElementById("loginUsername");
const loginPassword = document.getElementById("loginPassword");
const loginButton = document.getElementById("loginButton");
const loginStatus = document.getElementById("loginStatus");

const registerUsername = document.getElementById("registerUsername");
const registerPassword = document.getElementById("registerPassword");
const registerPasswordConfirm = document.getElementById("registerPasswordConfirm");
const registerButton = document.getElementById("registerButton");
const registerStatus = document.getElementById("registerStatus");

const showRegister = document.getElementById("showRegister");
const showLogin = document.getElementById("showLogin");

const currentUsername = document.getElementById("currentUsername");
const logoutButton = document.getElementById("logoutButton");

const modeSelect = document.getElementById("mode");
const languageSelect = document.getElementById("language");
const styleSelect = document.getElementById("style");

const promptInput = document.getElementById("prompt");
const generateButton = document.getElementById("generate");
const statusBox = document.getElementById("status");

const resultCode = document.getElementById("result");

const copyButton = document.getElementById("copy");
const downloadButton = document.getElementById("download");
const improveButton = document.getElementById("improve");

const historyList = document.getElementById("historyList");
const clearHistoryButton = document.getElementById("clearHistory");

const preview = document.getElementById("preview");
const fullscreenButton = document.getElementById("fullscreenPreview");
const refreshPreviewButton = document.getElementById("refreshPreview");

let currentProjectId = null;


// ========================================
// API
// ========================================

async function apiJSON(url, options = {}) {

  const response = await fetch(url, {
    ...options,

    credentials: "same-origin",

    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });

  let data = {};

  try {
    data = await response.json();
  } catch {
    data = {};
  }

  if (!response.ok) {

    const error = new Error(
      data.message || `Request failed: ${response.status}`
    );

    error.status = response.status;

    throw error;
  }

  return data;
}


// ========================================
// AUTH SCREEN
// ========================================

function showAuth() {

  if (authScreen) {
    authScreen.classList.remove("hidden");
  }

  if (mainApp) {
    mainApp.classList.add("hidden");
  }
}


function showApp(username) {

  if (authScreen) {
    authScreen.classList.add("hidden");
  }

  if (mainApp) {
    mainApp.classList.remove("hidden");
  }

  if (currentUsername) {
    currentUsername.textContent = username || "User";
  }

  loadProjects();
}


async function checkLogin() {

  try {

    const data = await apiJSON("/api/me");

    if (data.user) {

      showApp(data.user.username);

    } else {

      showAuth();
    }

  } catch (error) {

    console.log("Not logged in.");

    showAuth();
  }
}


// ========================================
// LOGIN
// ========================================

if (loginButton) {

  loginButton.addEventListener("click", async () => {

    const username = loginUsername.value.trim();
    const password = loginPassword.value;

    loginStatus.textContent = "";

    if (!username || !password) {

      loginStatus.textContent =
        "من فضلك اكتب اسم المستخدم وكلمة المرور.";

      return;
    }

    loginButton.disabled = true;

    loginButton.textContent =
      "جاري تسجيل الدخول...";

    try {

      const data = await apiJSON("/api/login", {

        method: "POST",

        body: JSON.stringify({
          username,
          password
        })

      });

      loginStatus.textContent =
        "تم تسجيل الدخول بنجاح.";

      loginUsername.value = "";
      loginPassword.value = "";

      showApp(data.user.username);

    } catch (error) {

      console.error("Login error:", error);

      loginStatus.textContent =
        error.message || "فشل تسجيل الدخول.";

    } finally {

      loginButton.disabled = false;

      loginButton.textContent =
        "🔐 تسجيل الدخول";
    }

  });
}


// ========================================
// REGISTER
// ========================================

if (registerButton) {

  registerButton.addEventListener("click", async () => {

    const username =
      registerUsername.value.trim();

    const password =
      registerPassword.value;

    const confirmPassword =
      registerPasswordConfirm.value;

    registerStatus.textContent = "";

    if (!username || !password || !confirmPassword) {

      registerStatus.textContent =
        "من فضلك املأ جميع البيانات.";

      return;
    }

    if (password !== confirmPassword) {

      registerStatus.textContent =
        "كلمتا المرور غير متطابقتين.";

      return;
    }

    if (password.length < 6) {

      registerStatus.textContent =
        "كلمة المرور يجب أن تكون 6 أحرف على الأقل.";

      return;
    }

    registerButton.disabled = true;

    registerButton.textContent =
      "جاري إنشاء الحساب...";

    try {

      const data = await apiJSON("/api/register", {

        method: "POST",

        body: JSON.stringify({
          username,
          password
        })

      });

      registerStatus.textContent =
        "تم إنشاء الحساب بنجاح.";

      registerUsername.value = "";
      registerPassword.value = "";
      registerPasswordConfirm.value = "";

      showApp(data.user.username);

    } catch (error) {

      console.error("Register error:", error);

      registerStatus.textContent =
        error.message || "فشل إنشاء الحساب.";

    } finally {

      registerButton.disabled = false;

      registerButton.textContent =
        "🚀 إنشاء الحساب";
    }

  });
}


// ========================================
// SWITCH LOGIN / REGISTER
// ========================================

if (showRegister) {

  showRegister.addEventListener("click", (event) => {

    event.preventDefault();

    loginBox.classList.add("hidden");

    registerBox.classList.remove("hidden");

    loginStatus.textContent = "";
  });
}


if (showLogin) {

  showLogin.addEventListener("click", (event) => {

    event.preventDefault();

    registerBox.classList.add("hidden");

    loginBox.classList.remove("hidden");

    registerStatus.textContent = "";
  });
}


// ========================================
// LOGOUT
// ========================================

if (logoutButton) {

  logoutButton.addEventListener("click", async () => {

    try {

      await apiJSON("/api/logout", {
        method: "POST"
      });

    } catch (error) {

      console.error("Logout error:", error);
    }

    currentProjectId = null;

    showAuth();
  });
}


// ========================================
// PREVIEW
// ========================================

function updatePreview(code) {

  if (!preview) {
    return;
  }

  preview.srcdoc = code || "";
}


// ========================================
// SAVE PROJECT
// ========================================

async function saveProject(title, prompt, code) {

  try {

    const data = await apiJSON("/api/projects", {

      method: "POST",

      body: JSON.stringify({

        title,

        prompt,

        code,

        language:
          languageSelect
            ? languageSelect.value
            : "HTML/CSS/JavaScript",

        style:
          styleSelect
            ? styleSelect.value
            : "modern"

      })

    });

    currentProjectId =
      data.project?.id || null;

    await loadProjects();

  } catch (error) {

    console.error(
      "Save project error:",
      error
    );

    if (error.status === 401) {

      alert(
        "انتهت جلسة تسجيل الدخول. سجل الدخول مرة أخرى."
      );

      showAuth();
    }
  }
}


// ========================================
// GENERATE AI
// ========================================

async function generateAI() {

  const prompt =
    promptInput
      ? promptInput.value.trim()
      : "";

  if (!prompt) {

    alert("اكتب طلبك أولًا.");

    return;
  }

  if (!generateButton) {

    console.error(
      "Generate button was not found."
    );

    return;
  }

  generateButton.disabled = true;

  generateButton.textContent =
    "⏳ جاري التوليد...";

  if (statusBox) {

    statusBox.textContent =
      "جاري إنشاء الكود بالذكاء الاصطناعي...";
  }

  if (resultCode) {

    resultCode.textContent =
      "Generating...";
  }

  try {

    const data = await apiJSON(
      "/api/generate",
      {

        method: "POST",

        body: JSON.stringify({

          prompt,

          mode:
            modeSelect
              ? modeSelect.value
              : "code",

          language:
            languageSelect
              ? languageSelect.value
              : "HTML/CSS/JavaScript",

          style:
            styleSelect
              ? styleSelect.value
              : "modern"

        })

      }
    );

    const code =
      data.code ||
      data.result ||
      "";

    if (!code) {

      throw new Error(
        "لم يرجع الذكاء الاصطناعي أي كود."
      );
    }

    if (resultCode) {

      resultCode.textContent =
        code;
    }

    updatePreview(code);

    if (statusBox) {

      statusBox.textContent =
        "✅ تم إنشاء الكود بنجاح.";
    }

    await saveProject(

      prompt.substring(0, 60) ||
        "CodeCraft Project",

      prompt,

      code
    );

  } catch (error) {

    console.error(
      "Generation error:",
      error
    );

    if (error.status === 401) {

      if (statusBox) {

        statusBox.textContent =
          "❌ يجب تسجيل الدخول أولًا.";
      }

      showAuth();

    } else {

      if (statusBox) {

        statusBox.textContent =
          `❌ ${error.message}`;
      }

      if (resultCode) {

        resultCode.textContent =
          `Error: ${error.message}`;
      }
    }

  } finally {

    generateButton.disabled = false;

    generateButton.textContent =
      "✨ Generate";
  }
}


// ========================================
// GENERATE BUTTON
// ========================================

if (generateButton) {

  generateButton.addEventListener(
    "click",
    generateAI
  );
}


// ========================================
// IMPROVE CODE
// ========================================

if (improveButton) {

  improveButton.addEventListener(
    "click",
    async () => {

      const currentCode =
        resultCode
          ? resultCode.textContent.trim()
          : "";

      if (
        !currentCode ||
        currentCode === "النتيجة ستظهر هنا..."
      ) {

        alert(
          "قم بتوليد الكود أولًا."
        );

        return;
      }

      improveButton.disabled = true;

      improveButton.textContent =
        "⏳ جاري التحسين...";

      try {

        const data = await apiJSON(
          "/api/generate",
          {

            method: "POST",

            body: JSON.stringify({

              prompt: `
Improve the following code.

Make it cleaner, modern,
responsive and professional.

Return only the complete final code.

Current code:

${currentCode}
              `,

              mode: "code",

              language:
                languageSelect
                  ? languageSelect.value
                  : "HTML/CSS/JavaScript",

              style:
                styleSelect
                  ? styleSelect.value
                  : "modern"

            })

          }
        );

        const improvedCode =
          data.code ||
          data.result ||
          "";

        if (!improvedCode) {

          throw new Error(
            "لم يرجع الذكاء الاصطناعي كودًا."
          );
        }

        resultCode.textContent =
          improvedCode;

        updatePreview(
          improvedCode
        );

        if (statusBox) {

          statusBox.textContent =
            "✅ تم تحسين الكود.";
        }

        await saveProject(

          "Improved Project",

          promptInput
            ? promptInput.value
            : "Improved Project",

          improvedCode
        );

      } catch (error) {

        console.error(
          "Improve error:",
          error
        );

        if (error.status === 401) {

          showAuth();

        } else if (statusBox) {

          statusBox.textContent =
            `❌ ${error.message}`;
        }

      } finally {

        improveButton.disabled = false;

        improveButton.textContent =
          "✨ تحسين الكود";
      }
    }
  );
}


// ========================================
// COPY
// ========================================

if (copyButton) {

  copyButton.addEventListener(
    "click",
    async () => {

      const code =
        resultCode
          ? resultCode.textContent
          : "";

      if (
        !code ||
        code === "النتيجة ستظهر هنا..."
      ) {

        return;
      }

      try {

        await navigator.clipboard.writeText(
          code
        );

        const oldText =
          copyButton.textContent;

        copyButton.textContent =
          "✅ تم النسخ";

        setTimeout(() => {

          copyButton.textContent =
            oldText;

        }, 1500);

      } catch (error) {

        console.error(error);

        alert(
          "تعذر نسخ الكود."
        );
      }
    }
  );
}


// ========================================
// DOWNLOAD
// ========================================

if (downloadButton) {

  downloadButton.addEventListener(
    "click",
    () => {

      const code =
        resultCode
          ? resultCode.textContent
          : "";

      if (
        !code ||
        code === "النتيجة ستظهر هنا..."
      ) {

        alert(
          "لا يوجد كود لتحميله."
        );

        return;
      }

      const blob = new Blob(
        [code],
        {
          type:
            "text/html;charset=utf-8"
        }
      );

      const url =
        URL.createObjectURL(blob);

      const link =
        document.createElement("a");

      link.href = url;

      link.download =
        "codecraft-project.html";

      document.body.appendChild(
        link
      );

      link.click();

      link.remove();

      URL.revokeObjectURL(url);
    }
  );
}


// ========================================
// FULLSCREEN
// ========================================

if (fullscreenButton) {

  fullscreenButton.addEventListener(
    "click",
    async () => {

      if (!preview) {
        return;
      }

      try {

        if (!document.fullscreenElement) {

          await preview.requestFullscreen();

        } else {

          await document.exitFullscreen();
        }

      } catch (error) {

        console.error(
          "Fullscreen error:",
          error
        );
      }
    }
  );
}


// ========================================
// REFRESH PREVIEW
// ========================================

if (refreshPreviewButton) {

  refreshPreviewButton.addEventListener(
    "click",
    () => {

      const code =
        resultCode
          ? resultCode.textContent
          : "";

      updatePreview(code);
    }
  );
}


// ========================================
// ESCAPE HTML
// ========================================

function escapeHTML(value) {

  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}


// ========================================
// LOAD PROJECTS
// ========================================

async function loadProjects() {

  if (!historyList) {
    return;
  }

  try {

    const data =
      await apiJSON("/api/projects");

    const projects =
      data.projects || [];

    historyList.innerHTML = "";

    if (projects.length === 0) {

      historyList.innerHTML = `
        <p class="emptyHistory">
          لا توجد مشاريع محفوظة حتى الآن.
        </p>
      `;

      return;
    }

    projects.forEach((project) => {

      const item =
        document.createElement("div");

      item.className =
        "historyItem";

      item.innerHTML = `
        <div>
          <strong>
            ${escapeHTML(project.title)}
          </strong>

          <small>
            ${escapeHTML(project.created_at || "")}
          </small>
        </div>

        <div>

          <button
            class="loadProject"
            data-id="${project.id}"
          >
            فتح
          </button>

          <button
            class="deleteProject"
            data-id="${project.id}"
          >
            حذف
          </button>

        </div>
      `;

      historyList.appendChild(item);
    });


    document
      .querySelectorAll(".loadProject")
      .forEach((button) => {

        button.addEventListener(
          "click",
          () => {

            const id =
              Number(button.dataset.id);

            const project =
              projects.find(
                (item) =>
                  item.id === id
              );

            if (project) {

              loadProject(project);
            }
          }
        );
      });


    document
      .querySelectorAll(".deleteProject")
      .forEach((button) => {

        button.addEventListener(
          "click",
          async () => {

            const id =
              Number(button.dataset.id);

            await deleteProject(id);
          }
        );
      });

  } catch (error) {

    console.error(
      "Load projects error:",
      error
    );

    if (error.status === 401) {

      showAuth();
    }
  }
}


// ========================================
// LOAD PROJECT
// ========================================

function loadProject(project) {

  currentProjectId =
    project.id;

  if (promptInput) {

    promptInput.value =
      project.prompt || "";
  }

  if (resultCode) {

    resultCode.textContent =
      project.code || "";
  }

  if (
    languageSelect &&
    project.language
  ) {

    languageSelect.value =
      project.language;
  }

  if (
    styleSelect &&
    project.style
  ) {

    styleSelect.value =
      project.style;
  }

  updatePreview(
    project.code || ""
  );

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}


// ========================================
// DELETE PROJECT
// ========================================

async function deleteProject(id) {

  try {

    await apiJSON(
      `/api/projects/${id}`,
      {
        method: "DELETE"
      }
    );

    if (currentProjectId === id) {

      currentProjectId = null;
    }

    await loadProjects();

  } catch (error) {

    console.error(
      "Delete project error:",
      error
    );

    if (error.status === 401) {

      showAuth();

      return;
    }

    alert(
      error.message ||
      "تعذر حذف المشروع."
    );
  }
}


// ========================================
// CLEAR HISTORY
// ========================================

if (clearHistoryButton) {

  clearHistoryButton.addEventListener(
    "click",
    async () => {

      try {

        const data =
          await apiJSON("/api/projects");

        const projects =
          data.projects || [];

        for (const project of projects) {

          await apiJSON(
            `/api/projects/${project.id}`,
            {
              method: "DELETE"
            }
          );
        }

        currentProjectId = null;

        await loadProjects();

      } catch (error) {

        console.error(error);

        if (error.status === 401) {

          showAuth();

        } else {

          alert(
            "تعذر مسح السجل."
          );
        }
      }
    }
  );
}


// ========================================
// START APP
// ========================================

document.addEventListener(
  "DOMContentLoaded",
  () => {

    checkLogin();

  }
);