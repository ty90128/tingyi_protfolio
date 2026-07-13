/**
 * admin.js｜個人作品集管理後台
 * 1. 初始化與 Supabase 連線
 * 2. 登入、註冊、忘記密碼與管理員驗證
 * 3. 後台分頁與資料載入
 * 4. 作品、分類、工具、圖片、外部連結管理
 * 5. 個人資料、核心能力、經歷、學歷、證照、聯絡管理
 * 6. 網站設定、圖片與履歷上傳
 */
(() => {
  "use strict";

  const config = window.APP_CONFIG || {};
  const hasConfig = /^https:\/\//.test(config.SUPABASE_URL || "") && !String(config.SUPABASE_ANON_KEY || "").includes("填入");
  const supabaseClient = hasConfig && window.supabase
    ? window.supabase.createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        storage: window.sessionStorage,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    })
    : null;
  const $ = id => document.getElementById(id);

  let projects = [];
  let projectCategories = [];
  let toolOptions = [];
  let selectedToolIds = [];
  let projectImages = [];
  let projectLinks = [];
  let skills = [];
  let experiences = [];
  let educationItems = [];
  let certificates = [];
  let contactLinks = [];
  let contactMessages = [];
  let siteSettings = {};
  let projectSortable = null;
  let imageSortable = null;
  let currentEditor = { table: "", item: null };
  let currentManager = "";

  const schemas = {
    skills: { title: "核心能力", fields: [field("title", "能力名稱", "text", true), field("description", "能力說明", "textarea"), field("icon", "圖示／Emoji"), field("sort_order", "排序", "number"), field("is_visible", "顯示", "checkbox")] },
    experiences: { title: "經歷", fields: [field("organization", "公司／組織", "text", true), field("position", "職稱／角色", "text", true), field("start_date", "開始時間"), field("end_date", "結束時間"), field("is_current", "目前仍在此職務", "checkbox"), field("location", "地點"), field("description", "工作內容", "textarea", false, "wide"), field("achievements_text", "主要成果（每行一項）", "textarea", false, "wide"), field("sort_order", "排序", "number"), field("is_visible", "顯示", "checkbox")] },
    education: { title: "學歷", fields: [field("school", "學校名稱", "text", true), field("degree", "學位"), field("department", "科系"), field("start_date", "開始時間"), field("end_date", "結束時間"), field("is_current", "就讀中", "checkbox"), field("description", "補充說明", "textarea", false, "wide"), field("sort_order", "排序", "number"), field("is_visible", "顯示", "checkbox")] },
    certificates: { title: "證照與獎項", fields: [selectField("type", "類型", ["專業證照", "語言證照", "競賽獎項", "課程證書", "其他"]), field("title", "名稱", "text", true), field("issuer", "發證／主辦單位"), field("issue_date", "取得日期"), field("expiry_date", "到期日期"), field("credential_id", "證書編號"), field("credential_url", "驗證連結", "url"), field("description", "說明", "textarea", false, "wide"), field("sort_order", "排序", "number"), field("is_visible", "顯示", "checkbox")] },
    contact_links: { title: "聯絡方式", fields: [selectField("type", "類型", ["Email", "電話", "LINE", "Instagram", "Facebook", "LinkedIn", "GitHub", "Behance", "個人網站", "其他"]), field("title", "顯示名稱", "text", true), field("value", "Email、電話或網址", "text", true), field("sort_order", "排序", "number"), field("is_visible", "顯示", "checkbox")] }
  };

  function field(name, label, type = "text", required = false, className = "") { return { name, label, type, required, className }; }
  function selectField(name, label, options) { return { name, label, type: "select", options }; }
  function toast(message) { const el = $("toast"); if (!el) return; el.textContent = message; el.classList.add("show"); clearTimeout(el.hideTimer); el.hideTimer = setTimeout(() => el.classList.remove("show"), 2400); }
  function setMessage(message, isError = false) { const el = $("authMessage"); if (!el) return; el.textContent = message; el.style.color = isError ? "#994a3e" : "#627b63"; }
  function safeUrl(value) { const raw = String(value || "").trim(); if (!raw) return ""; try { const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`); return ["http:", "https:"].includes(url.protocol) ? url.href : ""; } catch { return ""; } }
  function sanitizeFileName(name) { const dot = name.lastIndexOf("."); const ext = dot >= 0 ? name.slice(dot + 1).toLowerCase().replace(/[^a-z0-9]/g, "") : ""; const base = (dot >= 0 ? name.slice(0, dot) : name).toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9\u4e00-\u9fff-]/g, "").replace(/-+/g, "-").replace(/^-|-$/g, "") || "file"; return `${Date.now()}-${base}.${ext}`; }
  function createSlug(value) { return String(value || "").trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9\u4e00-\u9fff-]/g, "").replace(/-+/g, "-").replace(/^-|-$/g, "") || `project-${Date.now()}`; }
  async function query(request) { const { data, error } = await request; if (error) { console.error(error); throw error; } return data || []; }
  function notifyFrontEndUpdate() {
    const payload = { type: "portfolio-content-updated", timestamp: Date.now() };
    try {
      if ("BroadcastChannel" in window) {
        const channel = new BroadcastChannel("portfolio-content-channel");
        channel.postMessage(payload);
        channel.close();
      }
      localStorage.setItem("portfolio-content-updated", String(payload.timestamp));
    } catch (error) {
      console.warn("無法通知前台更新：", error);
    }
  }
  async function mutation(request) {
    const { data, error } = await request;
    if (error) { console.error(error); throw error; }
    notifyFrontEndUpdate();
    return data;
  }
  function make(tag, className, content) { const el = document.createElement(tag); if (className) el.className = className; if (content !== undefined) el.textContent = content; return el; }

  async function checkAuth() {
    if (!supabaseClient) { setMessage("請先在 config.js 填入 Supabase URL 與 Publishable Key。", true); return; }
    const { data, error } = await supabaseClient.auth.getSession();
    if (error) { setMessage(error.message, true); return; }
    if (!data.session) { showAuth(); return; }
    try {
      const { data: profile, error: profileError } = await supabaseClient.from("profiles").select("id,email,is_admin").eq("id", data.session.user.id).maybeSingle();
      if (profileError) throw profileError;
      if (!profile) { showAuth(); setMessage("此帳號尚未建立 profiles 資料，請依 README 設定第一位管理員。", true); return; }
      if (!profile.is_admin) { showAuth(); setMessage("此帳號已登入，但沒有管理員權限。", true); return; }
      showAdmin(data.session.user.email || profile.email || "");
      await loadAllData();
    } catch (error) { console.error(error); showAuth(); setMessage(`權限查詢失敗：${error.message}`, true); }
  }
  function showAuth() { $("authView").hidden = false; $("adminView").hidden = true; }
  function showAdmin(email) { $("authView").hidden = true; $("adminView").hidden = false; if ($("adminEmail")) $("adminEmail").textContent = email; }

  async function handleLogin(event) {
    event.preventDefault(); const button = $("loginButton"); const original = button.textContent;
    try { button.disabled = true; button.textContent = "登入中…"; setMessage(""); const { error } = await supabaseClient.auth.signInWithPassword({ email: $("loginEmail").value.trim(), password: $("loginPassword").value }); if (error) throw error; await checkAuth(); }
    catch (error) { console.error(error); setMessage(`登入失敗：${error.message}`, true); }
    finally { button.disabled = false; button.textContent = original; }
  }
  async function handleRegister() {
    if (!supabaseClient) return;
    const email = $("loginEmail").value.trim(); const password = $("loginPassword").value;
    if (!email || password.length < 8) { setMessage("請輸入 Email，密碼至少 8 碼。", true); return; }
    const button = $("registerButton"); const original = button.textContent;
    try { button.disabled = true; button.textContent = "註冊中…"; const { error } = await supabaseClient.auth.signUp({ email, password }); if (error) throw error; setMessage("註冊完成。若 Supabase 開啟 Email 驗證，請先至信箱完成驗證，再依 README 設為管理員。"); }
    catch (error) { console.error(error); setMessage(`註冊失敗：${error.message}`, true); }
    finally { button.disabled = false; button.textContent = original; }
  }
  async function handleForgotPassword() {
    if (!supabaseClient) return; const email = $("loginEmail").value.trim(); if (!email) { setMessage("請先輸入 Email。", true); return; }
    const button = $("forgotButton"); const original = button.textContent;
    try { button.disabled = true; button.textContent = "寄送中…"; const redirectTo = new URL("reset-password.html", location.href).href; const { error } = await supabaseClient.auth.resetPasswordForEmail(email, { redirectTo }); if (error) throw error; setMessage("重設密碼信件已寄出，請檢查信箱。"); }
    catch (error) { console.error(error); setMessage(`寄送失敗：${error.message}`, true); }
    finally { button.disabled = false; button.textContent = original; }
  }

  async function loadAllData() {
    try {
      const [projectRows, categoryRows, toolRows, skillRows, experienceRows, educationRows, certificateRows, contactRows, messageRows, settingRows] = await Promise.all([
        query(supabaseClient.from("projects").select("*,project_category_options(id,name),project_tools(tool_id),project_links(*),project_images(*)").order("sort_order")),
        query(supabaseClient.from("project_category_options").select("*").order("sort_order")),
        query(supabaseClient.from("tool_options").select("*").order("sort_order")),
        query(supabaseClient.from("skills").select("*").order("sort_order")),
        query(supabaseClient.from("experiences").select("*").order("sort_order")),
        query(supabaseClient.from("education").select("*").order("sort_order")),
        query(supabaseClient.from("certificates").select("*").order("sort_order")),
        query(supabaseClient.from("contact_links").select("*").order("sort_order")),
        query(supabaseClient.from("contact_messages").select("*").order("created_at", { ascending: false })),
        query(supabaseClient.from("site_settings").select("key,value"))
      ]);
      projects = projectRows; projectCategories = categoryRows; toolOptions = toolRows; skills = skillRows; experiences = experienceRows; educationItems = educationRows; certificates = certificateRows; contactLinks = contactRows; contactMessages = messageRows; siteSettings = Object.fromEntries(settingRows.map(item => [item.key, item.value]));
      renderAll();
    } catch (error) { console.error(error); toast(`資料載入失敗：${error.message}`); }
  }

  function renderAll() {
    renderProjectList(); renderSimpleList("skillsList", "skills", skills, item => [item.title, item.description]); renderSimpleList("experiencesList", "experiences", experiences, item => [item.position, item.organization]); renderSimpleList("educationList", "education", educationItems, item => [item.school, [item.degree, item.department].filter(Boolean).join(" · ")]); renderSimpleList("certificatesList", "certificates", certificates, item => [item.title, item.issuer]); renderSimpleList("contactLinksList", "contact_links", contactLinks, item => [item.title, `${item.type} · ${item.value}`]); renderMessages(); renderSettingsForms(); initSortables();
  }

  function renderProjectList() {
    const list = $("projectsList"); if (!list) return;
    if (!projects.length) { list.innerHTML = '<p class="empty">目前尚無作品，請點擊「新增作品」。</p>'; return; }
    list.replaceChildren(...projects.map(project => {
      const card = make("article", "admin-card"); card.dataset.id = project.id; card.dataset.table = "projects";
      const handle = make("button", "drag-handle", "☰"); handle.type = "button"; handle.setAttribute("aria-label", "拖曳排序"); card.append(handle);
      const img = make("img", "admin-thumb"); img.alt = ""; if (safeUrl(project.cover_image_url)) img.src = safeUrl(project.cover_image_url); card.append(img);
      const info = make("div", "card-info"); info.append(make("h3", "", project.title || "未命名作品"), make("p", "", [project.project_category_options?.name, project.role, project.project_date].filter(Boolean).join(" · ")));
      const badges = make("p"); badges.append(make("span", `badge ${project.is_published ? "on" : "off"}`, project.is_published ? "已上架" : "未上架")); if (project.is_featured) badges.append(document.createTextNode(" "), make("span", "badge on", "精選")); info.append(badges); card.append(info);
      const actions = make("div", "card-actions"); actions.append(actionButton(project.is_published ? "下架" : "上架", "publish", project.id), actionButton(project.is_featured ? "取消精選" : "設為精選", "feature", project.id), actionButton("編輯", "edit", project.id)); card.append(actions); return card;
    }));
  }
  function renderSimpleList(listId, table, items, display) {
    const list = $(listId); if (!list) return;
    if (!items.length) { list.innerHTML = '<p class="empty">目前沒有資料。</p>'; return; }
    list.replaceChildren(...items.map(item => { const [title, description] = display(item); const card = make("article", "admin-card simple"); card.dataset.id = item.id; card.dataset.table = table; const handle = make("button", "drag-handle", "☰"); handle.type = "button"; const info = make("div", "card-info"); info.append(make("h3", "", title || "未命名"), make("p", "", description || "")); const actions = make("div", "card-actions"); actions.append(make("span", `badge ${item.is_visible === false ? "off" : "on"}`, item.is_visible === false ? "隱藏" : "顯示"), actionButton("編輯", "edit", item.id)); card.append(handle, info, actions); return card; }));
  }
  function actionButton(label, action, id) { const button = make("button", "button ghost small card-action", label); button.type = "button"; button.dataset.action = action; button.dataset.id = id; return button; }

  function renderMessages() {
    const list = $("messagesList"); if (!list) return;
    if (!contactMessages.length) { list.innerHTML = '<p class="empty">目前沒有聯絡訊息。</p>'; return; }
    list.replaceChildren(...contactMessages.map(item => { const card = make("article", "admin-card simple"); const info = make("div", "card-info"); info.append(make("h3", "", item.subject || "無主旨"), make("p", "", `${item.name} · ${item.email} · ${new Date(item.created_at).toLocaleString("zh-TW")}`), make("p", "", item.message)); const actions = make("div", "card-actions"); actions.append(make("span", `badge ${item.is_read ? "on" : "off"}`, item.is_read ? "已讀" : "未讀"), actionButton(item.is_read ? "標為未讀" : "標為已讀", "toggle-read", item.id), actionButton("刪除", "delete-message", item.id)); card.append(info, actions); return card; }));
  }

  function openEditor(table, item = null) {
    currentEditor = { table, item }; selectedToolIds = []; projectLinks = []; projectImages = [];
    const modal = $("editorModal"); const form = $("editorForm"); if (!modal || !form) return;
    $("editorTitle").textContent = `${item ? "編輯" : "新增"}${table === "projects" ? "作品" : schemas[table]?.title || "資料"}`;
    form.replaceChildren();
    if (table === "projects") renderProjectEditor(form, item); else renderGenericEditor(form, table, item);
    $("deleteButton").hidden = !item; modal.hidden = false; document.body.style.overflow = "hidden";
  }
  function closeEditor() { $("editorModal").hidden = true; document.body.style.overflow = ""; currentEditor = { table: "", item: null }; }

  function createInput(definition, value) {
    const wrap = make("label", `field ${definition.className || ""}`); wrap.append(make("span", "", `${definition.label}${definition.required ? " *" : ""}`)); let input;
    if (definition.type === "textarea") input = document.createElement("textarea");
    else if (definition.type === "select") { input = document.createElement("select"); definition.options.forEach(option => { const el = document.createElement("option"); el.value = option; el.textContent = option; input.append(el); }); }
    else if (definition.type === "checkbox") { wrap.className = `checkbox-field ${definition.className || ""}`; input = document.createElement("input"); input.type = "checkbox"; input.checked = value !== false; wrap.replaceChildren(input, make("span", "", definition.label)); }
    else { input = document.createElement("input"); input.type = definition.type || "text"; }
    input.name = definition.name; if (definition.required) input.required = true; if (definition.type !== "checkbox") input.value = value ?? ""; wrap.append(input); return wrap;
  }
  function renderGenericEditor(form, table, item) {
    const schema = schemas[table]; if (!schema) return;
    schema.fields.forEach(def => { let value = item?.[def.name]; if (def.name === "achievements_text") value = Array.isArray(item?.achievements) ? item.achievements.join("\n") : ""; form.append(createInput(def, value)); });
  }

  function renderProjectEditor(form, item) {
    selectedToolIds = (item?.project_tools || []).map(row => row.tool_id); projectLinks = [...(item?.project_links || [])].sort((a, b) => a.sort_order - b.sort_order); projectImages = [...(item?.project_images || [])];
    const basic = editorSection("基本資料");
    basic.append(createInput(field("title", "作品名稱", "text", true), item?.title), createInput(field("slug", "Slug（留空自動產生）"), item?.slug));
    const categoryWrap = make("label", "field"); categoryWrap.append(make("span", "", "作品分類")); const categorySelect = document.createElement("select"); categorySelect.name = "category_id"; categorySelect.append(new Option("未分類", "")); projectCategories.forEach(cat => categorySelect.append(new Option(`${cat.name}${cat.is_active ? "" : "（停用）"}`, cat.id))); categorySelect.value = item?.category_id || ""; categoryWrap.append(categorySelect); basic.append(categoryWrap);
    basic.append(createInput(field("subtitle", "一句摘要"), item?.subtitle), createInput(field("summary", "簡短介紹", "textarea", false, "wide"), item?.summary), createInput(field("project_date", "完成時間"), item?.project_date));
    const status = selectField("project_status", "專案狀態", ["規劃中", "進行中", "已完成", "持續優化", "已封存"]); basic.append(createInput(status, item?.project_status || "已完成")); form.append(basic);
    const content = editorSection("專案內容"); [["background", "專案背景"], ["problem", "問題與需求"], ["target_users", "目標使用者"], ["role", "我的角色"], ["responsibilities", "負責內容"], ["solution", "解決方案"], ["process", "執行流程"]].forEach(([name, label]) => content.append(createInput(field(name, label, "textarea", false, "wide"), item?.[name]))); form.append(content);
    const result = editorSection("成果與反思"); [["result", "專案成果"], ["metrics", "KPI／量化成效"], ["reflection", "專案反思"]].forEach(([name, label]) => result.append(createInput(field(name, label, "textarea", false, "wide"), item?.[name]))); form.append(result);
    const toolsSection = editorSection("工具與技術"); const toolWrap = make("div", "tool-options wide"); toolOptions.forEach(tool => { const button = make("button", `tool-option${selectedToolIds.includes(tool.id) ? " selected" : ""}`, tool.name); button.type = "button"; button.dataset.toolId = tool.id; toolWrap.append(button); }); toolsSection.append(toolWrap); form.append(toolsSection);
    const display = editorSection("顯示設定"); display.append(createInput(field("is_published", "上架", "checkbox"), item?.is_published ?? false), createInput(field("is_featured", "設為精選", "checkbox"), item?.is_featured ?? false), createInput(field("sort_order", "一般排序", "number"), item?.sort_order ?? projects.length + 1), createInput(field("featured_sort_order", "精選排序", "number"), item?.featured_sort_order ?? "")); form.append(display);
    const cover = editorSection("作品封面"); if (safeUrl(item?.cover_image_url)) { const img = make("img", "wide"); img.src = safeUrl(item.cover_image_url); img.alt = "目前封面"; img.style.maxHeight = "220px"; img.style.objectFit = "contain"; cover.append(img); } cover.append(createInput(field("cover_alt_text", "圖片替代文字"), item?.cover_alt_text)); const fileWrap = make("label", "field wide"); fileWrap.append(make("span", "", "選擇新封面（JPG、PNG、WebP，8MB 以下）")); const fileInput = document.createElement("input"); fileInput.type = "file"; fileInput.name = "cover_file"; fileInput.accept = "image/jpeg,image/png,image/webp"; fileWrap.append(fileInput); cover.append(fileWrap); form.append(cover);
    const links = editorSection("外部連結"); links.append(renderLinkEditor()); const addLink = make("button", "button ghost wide", "新增連結"); addLink.type = "button"; addLink.dataset.addLink = "true"; links.append(addLink); form.append(links);
    const gallery = editorSection("作品圖片"); if (!item) gallery.append(make("p", "wide", "請先儲存作品基本資料，儲存後即可上傳作品圖片。")); else { const file = document.createElement("input"); file.type = "file"; file.multiple = true; file.accept = "image/jpeg,image/png,image/webp"; file.name = "gallery_files"; const category = document.createElement("select"); category.name = "gallery_category"; ["介面設計", "流程與架構", "成果展示", "其他圖片"].forEach(value => category.append(new Option(value, value))); gallery.append(createRawField("圖片分類", category), createRawField("選擇圖片（可複選）", file), renderGalleryEditor()); } form.append(gallery);
  }
  function editorSection(title) { const section = make("section", "editor-section"); section.append(make("h3", "", title)); return section; }
  function createRawField(label, input) { const wrap = make("label", "field"); wrap.append(make("span", "", label), input); return wrap; }
  function renderLinkEditor() { const list = make("div", "repeat-list wide"); list.dataset.linkList = "true"; if (!projectLinks.length) list.append(make("p", "", "尚未新增外部連結。")); else projectLinks.forEach((link, index) => { const row = make("div", "repeat-row"); row.dataset.index = String(index); const type = document.createElement("select"); ["線上網站", "GitHub", "Figma", "Canva", "Notion", "簡報", "PDF", "影片", "Behance", "其他"].forEach(value => type.append(new Option(value, value))); type.value = link.type || "其他"; type.dataset.linkField = "type"; const title = document.createElement("input"); title.placeholder = "按鈕文字"; title.value = link.title || ""; title.dataset.linkField = "title"; const url = document.createElement("input"); url.placeholder = "https://..."; url.value = link.url || ""; url.dataset.linkField = "url"; const remove = make("button", "button danger small", "刪除"); remove.type = "button"; remove.dataset.removeLink = String(index); row.append(type, title, url, remove); list.append(row); }); return list; }
  function renderGalleryEditor() { const list = make("div", "repeat-list wide"); list.dataset.galleryList = "true"; if (!projectImages.length) list.append(make("p", "", "目前沒有作品圖片。")); else projectImages.sort((a, b) => a.category.localeCompare(b.category) || a.sort_order - b.sort_order).forEach(image => { const row = make("div", "repeat-row"); row.dataset.imageId = image.id; const img = make("img"); img.src = safeUrl(image.image_url); img.alt = image.alt_text || ""; img.style.width = "120px"; img.style.height = "80px"; img.style.objectFit = "cover"; const info = make("div"); info.append(make("strong", "", image.category), make("p", "", image.caption || "無說明")); const remove = make("button", "button danger small", "刪除圖片"); remove.type = "button"; remove.dataset.removeImage = image.id; row.append(make("span", "drag-handle", "☰"), img, info, remove); list.append(row); }); return list; }

  async function saveEditor(event) {
    event.preventDefault(); const button = $("saveButton"); const original = button.textContent;
    try { button.disabled = true; button.textContent = "儲存中…"; if (currentEditor.table === "projects") await saveProject(new FormData(event.currentTarget)); else await saveGeneric(new FormData(event.currentTarget)); await loadAllData(); closeEditor(); toast(currentEditor.item ? "資料已更新" : "資料新增完成"); }
    catch (error) { console.error(error); alert(error.message); }
    finally { button.disabled = false; button.textContent = original; }
  }
  async function saveGeneric(formData) {
    const table = currentEditor.table; const schema = schemas[table]; const row = {};
    schema.fields.forEach(def => { if (def.name === "achievements_text") { row.achievements = String(formData.get(def.name) || "").split("\n").map(v => v.trim()).filter(Boolean); return; } if (def.type === "checkbox") row[def.name] = formData.has(def.name); else if (def.type === "number") row[def.name] = Number(formData.get(def.name) || 0); else row[def.name] = String(formData.get(def.name) || "").trim() || null; });
    if (table === "contact_links") validateContactLink(row);
    if (currentEditor.item) await mutation(supabaseClient.from(table).update(row).eq("id", currentEditor.item.id)); else await mutation(supabaseClient.from(table).insert(row));
  }
  function validateContactLink(row) { if (String(row.type).toLowerCase() === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.value || "")) throw new Error("Email 格式不正確"); if (!["Email", "電話"].includes(row.type) && row.value) { const url = safeUrl(row.value); if (!url) throw new Error("網址格式不正確"); row.value = url; } }
  async function saveProject(formData) {
    const title = String(formData.get("title") || "").trim(); if (!title) throw new Error("請輸入作品名稱");
    let slug = createSlug(formData.get("slug") || title); const duplicate = projects.find(item => item.slug === slug && item.id !== currentEditor.item?.id); if (duplicate) slug = `${slug}-${Date.now().toString().slice(-5)}`;
    const row = { title, slug, category_id: formData.get("category_id") || null, subtitle: value(formData, "subtitle"), summary: value(formData, "summary"), background: value(formData, "background"), problem: value(formData, "problem"), target_users: value(formData, "target_users"), role: value(formData, "role"), responsibilities: value(formData, "responsibilities"), solution: value(formData, "solution"), process: value(formData, "process"), result: value(formData, "result"), metrics: value(formData, "metrics"), reflection: value(formData, "reflection"), project_date: value(formData, "project_date"), project_status: value(formData, "project_status"), cover_alt_text: value(formData, "cover_alt_text"), is_published: formData.has("is_published"), is_featured: formData.has("is_featured"), sort_order: Number(formData.get("sort_order") || projects.length + 1), featured_sort_order: formData.has("is_featured") ? Number(formData.get("featured_sort_order") || 0) || null : null };
    let projectId = currentEditor.item?.id;
    if (projectId) await mutation(supabaseClient.from("projects").update(row).eq("id", projectId)); else { const created = await mutation(supabaseClient.from("projects").insert(row).select().single()); projectId = created.id; currentEditor.item = created; }
    const coverFile = formData.get("cover_file"); if (coverFile instanceof File && coverFile.size) { validateFile(coverFile, ["image/jpeg", "image/png", "image/webp"], 8); const url = await uploadFile(coverFile, `projects/${slug}/covers`); await mutation(supabaseClient.from("projects").update({ cover_image_url: url }).eq("id", projectId)); }
    await mutation(supabaseClient.from("project_tools").delete().eq("project_id", projectId)); if (selectedToolIds.length) await mutation(supabaseClient.from("project_tools").insert(selectedToolIds.map(toolId => ({ project_id: projectId, tool_id: toolId }))));
    await mutation(supabaseClient.from("project_links").delete().eq("project_id", projectId)); const links = collectLinks().filter(link => link.title && link.url); links.forEach(link => { const url = safeUrl(link.url); if (!url) throw new Error(`外部連結「${link.title}」網址格式不正確`); link.url = url; }); if (links.length) await mutation(supabaseClient.from("project_links").insert(links.map((link, index) => ({ project_id: projectId, ...link, sort_order: index + 1, is_visible: true }))));
    const galleryFiles = formData.getAll("gallery_files").filter(file => file instanceof File && file.size); if (galleryFiles.length) { const category = String(formData.get("gallery_category") || "其他圖片"); const existing = projectImages.filter(image => image.category === category).length; for (let index = 0; index < galleryFiles.length; index += 1) { const file = galleryFiles[index]; validateFile(file, ["image/jpeg", "image/png", "image/webp"], 8); buttonProgress(`上傳中 ${index + 1}/${galleryFiles.length}`); const url = await uploadFile(file, `projects/${slug}/galleries/${encodeURIComponent(category)}`); await mutation(supabaseClient.from("project_images").insert({ project_id: projectId, category, image_url: url, alt_text: title, sort_order: existing + index + 1 })); } }
  }
  function value(formData, key) { return String(formData.get(key) || "").trim() || null; }
  function collectLinks() { return [...document.querySelectorAll("[data-link-list] .repeat-row")].map(row => ({ type: row.querySelector('[data-link-field="type"]')?.value || "其他", title: row.querySelector('[data-link-field="title"]')?.value.trim() || "", url: row.querySelector('[data-link-field="url"]')?.value.trim() || "" })); }
  function validateFile(file, types, maxMb) { if (!types.includes(file.type)) throw new Error(`不支援檔案格式：${file.name}`); if (file.size > maxMb * 1024 * 1024) throw new Error(`${file.name} 超過 ${maxMb} MB`); }
  async function uploadFile(file, folder) { const path = `${folder}/${sanitizeFileName(file.name)}`; const { error } = await supabaseClient.storage.from("portfolio-assets").upload(path, file, { cacheControl: "3600", upsert: false }); if (error) throw error; const { data } = supabaseClient.storage.from("portfolio-assets").getPublicUrl(path); return data.publicUrl; }
  function buttonProgress(text) { const button = $("saveButton"); if (button) button.textContent = text; }

  async function deleteCurrent() {
    const { table, item } = currentEditor; if (!item) return; if (!confirm(`確定刪除「${item.title || item.school || item.organization || item.name || "此資料"}」？此操作無法復原。`)) return;
    try { await mutation(supabaseClient.from(table).delete().eq("id", item.id)); closeEditor(); await loadAllData(); toast("資料已刪除"); } catch (error) { alert(error.message); }
  }

  function openManager(type) { currentManager = type; $("managerTitle").textContent = type === "categories" ? "作品分類管理" : "工具與技術管理"; $("managerModal").hidden = false; renderManagerList(); }
  function closeManager() { $("managerModal").hidden = true; currentManager = ""; }
  function renderManagerList() { const items = currentManager === "categories" ? projectCategories : toolOptions; const table = currentManager === "categories" ? "project_category_options" : "tool_options"; const list = $("managerList"); list.replaceChildren(...items.map(item => { const card = make("article", "admin-card simple"); card.dataset.id = item.id; card.dataset.table = table; const handle = make("button", "drag-handle", "☰"); handle.type = "button"; const info = make("div", "card-info"); info.append(make("h3", "", item.name), make("p", "", `排序 ${item.sort_order} · ${item.is_active ? "啟用" : "停用"}`)); const actions = make("div", "card-actions"); actions.append(actionButton("改名", "rename-option", item.id), actionButton(item.is_active ? "停用" : "啟用", "toggle-option", item.id), actionButton("刪除", "delete-option", item.id)); card.append(handle, info, actions); return card; })); }
  async function addManagerOption(event) { event.preventDefault(); const name = $("managerName").value.trim(); if (!name) return; const table = currentManager === "categories" ? "project_category_options" : "tool_options"; const items = currentManager === "categories" ? projectCategories : toolOptions; try { await mutation(supabaseClient.from(table).insert({ name, sort_order: items.length + 1, is_active: true })); $("managerName").value = ""; await loadAllData(); renderManagerList(); toast("選項已新增"); } catch (error) { alert(error.message); } }

  function renderSettingsForms() {
    renderKeyValueForm("profileForm", [
      ["hero_name", "姓名"], ["hero_title", "個人職稱"], ["hero_tagline", "核心標語", "textarea", "wide"], ["hero_description", "Hero 簡短說明", "textarea", "wide"], ["about_title", "關於我標題"], ["about_subtitle", "關於我副標題"], ["about_paragraph_1", "第一段介紹", "textarea", "wide"], ["about_paragraph_2", "第二段介紹", "textarea", "wide"], ["location", "所在地"], ["current_status", "目前身份"], ["professional_direction", "專業方向", "textarea"], ["collaboration_items", "可合作項目", "textarea"], ["resume_button_text", "履歷按鈕文字"], ["resume_last_updated", "履歷最後更新日期"]
    ], "儲存個人資料");
    renderKeyValueForm("settingsForm", [
      ["site_name", "網站名稱"], ["hero_primary_button_text", "主要按鈕文字"], ["hero_primary_button_url", "主要按鈕連結"], ["hero_secondary_button_text", "次要按鈕文字"], ["hero_secondary_button_url", "次要按鈕連結"], ["skills_section_title", "核心能力區標題"], ["featured_projects_title", "精選作品區標題"], ["projects_section_title", "全部作品區標題"], ["experience_section_title", "經歷區標題"], ["education_section_title", "學歷區標題"], ["certificate_section_title", "證照區標題"], ["contact_section_title", "聯絡區標題"], ["contact_section_description", "聯絡區說明", "textarea", "wide"], ["footer_text", "Footer 文字", "textarea", "wide"], ["seo_title", "SEO 標題", "text", "wide"], ["seo_description", "SEO 描述", "textarea", "wide"]
    ], "儲存網站設定");
    renderImageSettings();
  }
  function renderKeyValueForm(formId, fields, buttonText) { const form = $(formId); if (!form) return; form.replaceChildren(...fields.map(([key, label, type = "text", className = ""]) => createInput(field(key, label, type, false, className), siteSettings[key] || ""))); const button = make("button", "button primary", buttonText); button.type = "submit"; form.append(button); }
  function renderImageSettings() { const wrap = $("imageSettings"); if (!wrap) return; const items = [["site_logo_url", "網站 Logo", "site/logo", ["image/jpeg", "image/png", "image/webp"], 8], ["hero_image_url", "Hero 背景", "site/hero", ["image/jpeg", "image/png", "image/webp"], 8], ["profile_image_url", "個人照片", "profile", ["image/jpeg", "image/png", "image/webp"], 8], ["og_image_url", "Open Graph 分享圖片", "site/og", ["image/jpeg", "image/png", "image/webp"], 8], ["resume_url", "履歷 PDF", "documents/resume", ["application/pdf"], 15]]; wrap.replaceChildren(...items.map(([key, title, folder, types, max]) => { const card = make("article", "image-card"); card.append(make("h3", "", title)); if (safeUrl(siteSettings[key])) { if (key === "resume_url") { const link = make("a", "button ghost", "查看目前檔案"); link.href = safeUrl(siteSettings[key]); link.target = "_blank"; card.append(link); } else { const img = make("img"); img.src = safeUrl(siteSettings[key]); img.alt = title; card.append(img); } } else card.append(make("p", "", "尚未上傳")); const input = document.createElement("input"); input.type = "file"; input.accept = types.join(","); const button = make("button", "button primary", "選擇檔案後儲存"); button.type = "button"; button.dataset.imageKey = key; button.dataset.folder = folder; button.dataset.types = types.join(","); button.dataset.max = String(max); card.append(input, button); button.addEventListener("click", () => saveImageSetting(button, input)); return card; })); }
  async function saveSettingsForm(event) { event.preventDefault(); const rows = [...new FormData(event.currentTarget).entries()].map(([key, value]) => ({ key, value: String(value).trim() })); const button = event.currentTarget.querySelector('button[type="submit"]'); const original = button.textContent; try { button.disabled = true; button.textContent = "儲存中…"; await mutation(supabaseClient.from("site_settings").upsert(rows, { onConflict: "key" })); await loadAllData(); toast("設定已儲存"); } catch (error) { alert(error.message); } finally { button.disabled = false; button.textContent = original; } }
  async function saveImageSetting(button, input) { const file = input.files?.[0]; if (!file) { alert("請先選擇檔案"); return; } const types = button.dataset.types.split(","); const max = Number(button.dataset.max); try { validateFile(file, types, max); const original = button.textContent; button.disabled = true; button.textContent = "上傳中…"; const url = await uploadFile(file, button.dataset.folder); await mutation(supabaseClient.from("site_settings").upsert({ key: button.dataset.imageKey, value: url }, { onConflict: "key" })); await loadAllData(); toast("檔案上傳完成"); button.textContent = original; button.disabled = false; } catch (error) { console.error(error); alert(error.message); button.disabled = false; button.textContent = "選擇檔案後儲存"; } }

  function initSortables() {
    if (!window.Sortable) return;
    projectSortable?.destroy(); const list = $("projectsList"); if (list && projects.length) projectSortable = new window.Sortable(list, { handle: ".drag-handle", animation: 150, onEnd: () => saveSortOrder(list, "projects") });
    document.querySelectorAll(".admin-list").forEach(el => { if (el.id === "projectsList" || !el.querySelector("[data-id]")) return; new window.Sortable(el, { handle: ".drag-handle", animation: 150, onEnd: () => { const table = el.querySelector("[data-table]")?.dataset.table; if (table) saveSortOrder(el, table); } }); });
  }
  async function saveSortOrder(container, table) { try { const rows = [...container.querySelectorAll("[data-id]")].map((el, index) => ({ id: el.dataset.id, sort_order: index + 1 })); for (const row of rows) await mutation(supabaseClient.from(table).update({ sort_order: row.sort_order }).eq("id", row.id)); await loadAllData(); toast("排序已更新"); } catch (error) { alert(error.message); } }

  async function handleListAction(event) {
    const button = event.target.closest("[data-action]"); const card = event.target.closest("[data-id]"); if (!button && card && !event.target.closest(".drag-handle")) { const table = card.dataset.table; openEditor(table, findItem(table, card.dataset.id)); return; } if (!button) return;
    event.stopPropagation(); const id = button.dataset.id; const action = button.dataset.action;
    try {
      if (action === "edit") { const parent = button.closest("[data-table]"); openEditor(parent.dataset.table, findItem(parent.dataset.table, id)); }
      if (action === "publish") { const item = projects.find(p => p.id === id); await mutation(supabaseClient.from("projects").update({ is_published: !item.is_published }).eq("id", id)); await loadAllData(); }
      if (action === "feature") { const item = projects.find(p => p.id === id); await mutation(supabaseClient.from("projects").update({ is_featured: !item.is_featured, featured_sort_order: item.is_featured ? null : projects.filter(p => p.is_featured).length + 1 }).eq("id", id)); await loadAllData(); }
      if (action === "toggle-read") { const item = contactMessages.find(m => m.id === id); await mutation(supabaseClient.from("contact_messages").update({ is_read: !item.is_read }).eq("id", id)); await loadAllData(); }
      if (action === "delete-message" && confirm("確定刪除此訊息？")) { await mutation(supabaseClient.from("contact_messages").delete().eq("id", id)); await loadAllData(); }
      if (["rename-option", "toggle-option", "delete-option"].includes(action)) await handleManagerAction(action, id);
    } catch (error) { alert(error.message); }
  }
  function findItem(table, id) { const map = { projects, skills, experiences, education: educationItems, certificates, contact_links: contactLinks }; return (map[table] || []).find(item => item.id === id); }
  async function handleManagerAction(action, id) { const table = currentManager === "categories" ? "project_category_options" : "tool_options"; const items = currentManager === "categories" ? projectCategories : toolOptions; const item = items.find(v => v.id === id); if (!item) return; if (action === "rename-option") { const name = prompt("輸入新名稱", item.name); if (name?.trim()) await mutation(supabaseClient.from(table).update({ name: name.trim() }).eq("id", id)); } if (action === "toggle-option") await mutation(supabaseClient.from(table).update({ is_active: !item.is_active }).eq("id", id)); if (action === "delete-option") { if (currentManager === "categories") { const count = projects.filter(p => p.category_id === id).length; if (count) throw new Error(`目前有 ${count} 件作品使用此分類，請先移動作品分類。`); } if (currentManager === "tools") { const count = projects.reduce((sum, p) => sum + (p.project_tools || []).filter(t => t.tool_id === id).length, 0); if (count) throw new Error(`目前有 ${count} 件作品使用此工具，請先移除關聯。`); } if (confirm(`確定刪除「${item.name}」？`)) await mutation(supabaseClient.from(table).delete().eq("id", id)); } await loadAllData(); renderManagerList(); }

  function bindEvents() {
    $("loginForm")?.addEventListener("submit", handleLogin); $("registerButton")?.addEventListener("click", handleRegister); $("forgotButton")?.addEventListener("click", handleForgotPassword);
    $("toggleLoginPassword")?.addEventListener("click", () => { const input = $("loginPassword"); const show = input.type === "password"; input.type = show ? "text" : "password"; $("toggleLoginPassword").textContent = show ? "隱藏" : "顯示"; $("toggleLoginPassword").setAttribute("aria-label", show ? "隱藏密碼" : "顯示密碼"); });
    $("logoutButton")?.addEventListener("click", async () => { await supabaseClient.auth.signOut(); showAuth(); });
    $("adminTabs")?.addEventListener("click", event => { const button = event.target.closest("[data-tab]"); if (!button) return; document.querySelectorAll(".tab").forEach(el => el.classList.toggle("active", el === button)); document.querySelectorAll(".tab-panel").forEach(el => el.classList.toggle("active", el.dataset.panel === button.dataset.tab)); });
    document.addEventListener("click", event => { const create = event.target.closest("[data-create]"); if (create) openEditor(create.dataset.create); const manager = event.target.closest("[data-manager]"); if (manager) openManager(manager.dataset.manager); });
    document.querySelector(".admin-main")?.addEventListener("click", handleListAction); $("managerList")?.addEventListener("click", handleListAction);
    $("editorForm")?.addEventListener("submit", saveEditor); $("editorClose")?.addEventListener("click", closeEditor); $("deleteButton")?.addEventListener("click", deleteCurrent); $("editorModal")?.addEventListener("click", async event => { if (event.target.closest("[data-close-editor]")) closeEditor(); const tool = event.target.closest("[data-tool-id]"); if (tool) { const id = tool.dataset.toolId; selectedToolIds = selectedToolIds.includes(id) ? selectedToolIds.filter(v => v !== id) : [...selectedToolIds, id]; tool.classList.toggle("selected"); } if (event.target.closest("[data-add-link]")) { projectLinks.push({ type: "線上網站", title: "", url: "" }); rerenderProjectEditor(); } const removeLink = event.target.closest("[data-remove-link]"); if (removeLink) { projectLinks.splice(Number(removeLink.dataset.removeLink), 1); rerenderProjectEditor(); } const removeImage = event.target.closest("[data-remove-image]"); if (removeImage && confirm("確定刪除此圖片？")) { await mutation(supabaseClient.from("project_images").delete().eq("id", removeImage.dataset.removeImage)); currentEditor.item = await query(supabaseClient.from("projects").select("*,project_tools(tool_id),project_links(*),project_images(*)").eq("id", currentEditor.item.id).single()); rerenderProjectEditor(); } });
    $("managerClose")?.addEventListener("click", closeManager); $("managerModal")?.addEventListener("click", event => { if (event.target.closest("[data-close-manager]")) closeManager(); }); $("managerAddForm")?.addEventListener("submit", addManagerOption);
    $("profileForm")?.addEventListener("submit", saveSettingsForm); $("settingsForm")?.addEventListener("submit", saveSettingsForm); $("refreshMessages")?.addEventListener("click", loadAllData);
    document.addEventListener("keydown", event => { if (event.key === "Escape") { if (!$("editorModal")?.hidden) closeEditor(); if (!$("managerModal")?.hidden) closeManager(); } });
  }
  function rerenderProjectEditor() { const form = $("editorForm"); form.replaceChildren(); renderProjectEditor(form, currentEditor.item); }

  document.addEventListener("DOMContentLoaded", () => { bindEvents(); checkAuth(); });
})();
