/**
 * app.js｜個人作品集前台
 * 1. 初始化與 Supabase 連線
 * 2. 安全輸出工具
 * 3. 動態內容載入
 * 4. 作品篩選、Modal、Lightbox
 * 5. 聯絡表單
 */
(() => {
  "use strict";

  const config = window.APP_CONFIG || {};
  const hasConfig = /^https:\/\//.test(config.SUPABASE_URL || "") && !String(config.SUPABASE_ANON_KEY || "").includes("填入");
  const supabaseClient = hasConfig && window.supabase ? window.supabase.createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY) : null;

  let settings = {};
  let projects = [];
  let categories = [];
  let tools = [];
  let selectedCategory = "all";
  let searchKeyword = "";
  let lastFocusedElement = null;
  let currentLightboxItems = [];
  let currentLightboxIndex = 0;
  let frontEndReloadTimer = null;
  const contactNotificationEmail = "bii19897720011228@gmail.com";

  const $ = id => document.getElementById(id);
  const text = (id, value) => { const el = $(id); if (el) el.textContent = value || ""; };
  const nl = value => String(value || "");
  const safeUrl = value => {
    const raw = String(value || "").trim();
    if (!raw) return "";
    if (/^(mailto:|tel:)/i.test(raw)) return raw;
    try {
      const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
      return ["http:", "https:"].includes(url.protocol) ? url.href : "";
    } catch { return ""; }
  };
  const toast = message => {
    const el = $("toast");
    if (!el) return;
    el.textContent = message;
    el.classList.add("show");
    clearTimeout(el.hideTimer);
    el.hideTimer = setTimeout(() => el.classList.remove("show"), 2400);
  };
  const query = async request => {
    const { data, error } = await request;
    if (error) { console.error(error); throw error; }
    return data || [];
  };
  const make = (tag, className, content) => {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (content !== undefined) el.textContent = content;
    return el;
  };
  const setImage = (id, url, alt = "") => {
    const img = $(id);
    if (!img) return;
    const valid = safeUrl(url);
    if (!valid) { img.hidden = true; return; }
    img.src = valid;
    img.alt = alt;
    img.hidden = false;
    img.onerror = () => { img.hidden = true; };
  };

  function showSetupNotice() {
    text("heroName", "請先完成 Supabase 設定");
    text("heroTagline", "開啟 config.js，填入 Project URL 與 Publishable Key。完成 database.sql 後即可使用。 ");
    $("heroPortraitPlaceholder")?.removeAttribute("hidden");
  }

  async function loadData() {
    if (!supabaseClient) { showSetupNotice(); return; }
    try {
      const [settingRows, categoryRows, toolRows, projectRows, skillRows, experienceRows, educationRows, certificateRows, contactRows] = await Promise.all([
        query(supabaseClient.from("site_settings").select("key,value")),
        query(supabaseClient.from("project_category_options").select("*").eq("is_active", true).order("sort_order")),
        query(supabaseClient.from("tool_options").select("*").eq("is_active", true).order("sort_order")),
        query(supabaseClient.from("projects").select("*, project_category_options(id,name), project_tools(tool_id), project_links(*), project_images(*)").eq("is_published", true).order("sort_order")),
        query(supabaseClient.from("skills").select("*").eq("is_visible", true).order("sort_order")),
        query(supabaseClient.from("experiences").select("*").eq("is_visible", true).order("sort_order")),
        query(supabaseClient.from("education").select("*").eq("is_visible", true).order("sort_order")),
        query(supabaseClient.from("certificates").select("*").eq("is_visible", true).order("sort_order")),
        query(supabaseClient.from("contact_links").select("*").eq("is_visible", true).order("sort_order"))
      ]);
      settings = Object.fromEntries(settingRows.map(item => [item.key, item.value]));
      categories = categoryRows;
      tools = toolRows;
      projects = projectRows;
      renderSettings();
      renderSkills(skillRows);
      renderFilters();
      renderProjects();
      renderExperiences(experienceRows);
      renderEducation(educationRows);
      renderCertificates(certificateRows);
      renderContacts(contactRows);
      openProjectFromHash();
    } catch (error) {
      console.error("前台資料載入失敗", error);
      toast(`資料載入失敗：${error.message}`);
      text("heroName", "網站暫時無法載入");
    }
  }

  function renderSettings() {
    const get = key => settings[key] || "";
    text("siteName", get("site_name") || "Portfolio");
    text("heroName", get("hero_name"));
    text("heroTitle", get("hero_title"));
    text("heroTagline", get("hero_tagline"));
    text("heroDescription", nl(get("hero_description")));
    text("aboutTitle", get("about_title") || "關於我");
    text("aboutSubtitle", get("about_subtitle"));
    text("aboutP1", nl(get("about_paragraph_1")));
    text("aboutP2", nl(get("about_paragraph_2")));
    text("skillsTitle", get("skills_section_title") || "核心能力");
    text("featuredTitle", get("featured_projects_title") || "精選作品");
    text("projectsTitle", get("projects_section_title") || "全部作品");
    text("experienceTitle", get("experience_section_title") || "工作／專案經歷");
    text("educationTitle", get("education_section_title") || "學歷與證照");
    text("contactTitle", get("contact_section_title") || "聯絡我");
    text("contactDescription", nl(get("contact_section_description")));
    text("footerText", get("footer_text") || "© 2026 Portfolio");

    setImage("siteLogo", get("site_logo_url"), get("site_name") || "網站 Logo");
    setImage("heroPortrait", get("profile_image_url"), get("hero_name") || "個人照片");
    setImage("aboutImage", get("profile_image_url"), get("hero_name") || "個人照片");
    if (safeUrl(get("profile_image_url"))) $("heroPortraitPlaceholder")?.setAttribute("hidden", "");
    if (safeUrl(get("hero_image_url"))) $("heroBackdrop").style.backgroundImage = `url("${safeUrl(get("hero_image_url"))}")`;

    configureButton("heroPrimary", get("hero_primary_button_text"), get("hero_primary_button_url"), get("hero_primary_button_visible") !== "false");
    configureButton("heroSecondary", get("hero_secondary_button_text"), get("hero_secondary_button_url"), get("hero_secondary_button_visible") !== "false");
    configureButton("resumeButton", get("resume_button_text") || "下載履歷", get("resume_url"), Boolean(get("resume_url")));

    const facts = [["所在地", get("location")], ["目前身份", get("current_status")], ["專業方向", get("professional_direction")], ["可合作項目", get("collaboration_items")]];
    const factGrid = $("aboutFacts");
    if (factGrid) {
      factGrid.replaceChildren(...facts.filter(([, value]) => value).map(([label, value]) => {
        const box = make("div", "fact");
        box.append(make("strong", "", label), make("span", "preserve-lines", value));
        return box;
      }));
    }

    const pageTitle = get("seo_title") || get("site_name") || "個人作品集";
    document.title = pageTitle;
    document.querySelector('meta[name="description"]')?.setAttribute("content", get("seo_description") || "個人作品集與專案成果展示。");
    document.querySelector('meta[property="og:title"]')?.setAttribute("content", pageTitle);
    document.querySelector('meta[property="og:description"]')?.setAttribute("content", get("seo_description") || "個人作品集與專案成果展示。");
    document.querySelector('meta[property="og:image"]')?.setAttribute("content", safeUrl(get("og_image_url")));
    document.querySelector('link[rel="canonical"]')?.setAttribute("href", location.href.split("#")[0]);
  }

  function configureButton(id, label, url, visible) {
    const el = $(id);
    if (!el) return;
    el.hidden = !visible || !label || !url;
    if (!el.hidden) { el.textContent = label; el.href = safeUrl(url) || url; }
  }

  function renderSkills(items) {
    const grid = $("skillsGrid");
    if (!grid) return;
    grid.replaceChildren(...items.filter(item => item.title).map(item => {
      const card = make("article", "skill-card");
      card.append(make("div", "skill-icon", item.icon || "✦"), make("h3", "", item.title), make("p", "preserve-lines", item.description || ""));
      return card;
    }));
    $("skills").hidden = items.length === 0;
  }

  function renderFilters() {
    const wrap = $("categoryFilters");
    if (!wrap) return;
    const options = [{ id: "all", name: "全部作品" }, { id: "featured", name: "精選作品" }, ...categories];
    wrap.replaceChildren(...options.map(item => {
      const button = make("button", `filter-button${selectedCategory === item.id ? " active" : ""}`, item.name);
      button.type = "button";
      button.dataset.category = item.id;
      return button;
    }));
  }

  function getProjectTools(project) {
    const ids = new Set((project.project_tools || []).map(item => item.tool_id));
    return tools.filter(item => ids.has(item.id));
  }

  function filteredProjects() {
    const keyword = searchKeyword.toLowerCase();
    return projects.filter(project => {
      const categoryMatch = selectedCategory === "all" || (selectedCategory === "featured" && project.is_featured) || project.category_id === selectedCategory;
      const haystack = [project.title, project.subtitle, project.summary, project.role, ...getProjectTools(project).map(item => item.name)].join(" ").toLowerCase();
      return categoryMatch && (!keyword || haystack.includes(keyword));
    });
  }

  function renderProjects() {
    const main = filteredProjects();
    const grid = $("projectsGrid");
    const featured = [...projects].filter(item => item.is_featured).sort((a, b) => (a.featured_sort_order ?? 9999) - (b.featured_sort_order ?? 9999));
    if (grid) grid.replaceChildren(...main.map(createProjectCard));
    $("projectEmpty").hidden = main.length > 0;
    const featuredSection = $("featured");
    if (featuredSection) featuredSection.hidden = featured.length === 0;
    const featuredGrid = $("featuredGrid");
    if (featuredGrid) featuredGrid.replaceChildren(...featured.map(createProjectCard));
  }

  function createProjectCard(project) {
    const card = make("article", "project-card");
    card.tabIndex = 0;
    card.dataset.projectId = project.id;
    card.setAttribute("role", "button");
    card.setAttribute("aria-label", `查看作品：${project.title}`);
    const coverUrl = safeUrl(project.cover_image_url);
    if (coverUrl) {
      const img = make("img", "project-cover"); img.src = coverUrl; img.alt = project.cover_alt_text || project.title || "作品封面";
      img.onerror = () => img.replaceWith(make("div", "project-cover-fallback", "圖片載入失敗")); card.append(img);
    } else card.append(make("div", "project-cover-fallback", "PROJECT"));
    const content = make("div", "project-content");
    const meta = make("div", "project-meta");
    if (project.project_category_options?.name) meta.append(make("span", "pill", project.project_category_options.name));
    if (project.is_featured) meta.append(make("span", "pill featured", "精選"));
    if (project.project_status) meta.append(make("span", "pill", project.project_status));
    content.append(meta, make("h3", "", project.title || "未命名作品"));
    if (project.subtitle) content.append(make("p", "project-summary", project.subtitle));
    if (project.summary) content.append(make("p", "project-summary", project.summary));
    const toolList = make("div", "tool-list");
    getProjectTools(project).slice(0, 6).forEach(item => toolList.append(make("span", "tool-tag", item.name)));
    content.append(toolList);
    const foot = make("p", "project-summary", [project.role, project.project_date].filter(Boolean).join(" · "));
    content.append(foot, make("span", "button secondary project-button", "查看完整作品"));
    card.append(content);
    return card;
  }

  function sectionBlock(title, value) {
    if (!value) return null;
    const section = make("section", "modal-section");
    section.append(make("h3", "", title), make("p", "preserve-lines", value));
    return section;
  }

  function openProjectModal(project) {
    if (!project) return;
    lastFocusedElement = document.activeElement;
    const modal = $("projectModal");
    const content = $("projectModalContent");
    if (!modal || !content) return;
    content.replaceChildren();
    const hero = make("div", "modal-hero");
    if (safeUrl(project.cover_image_url)) { const img = make("img"); img.src = safeUrl(project.cover_image_url); img.alt = project.cover_alt_text || project.title; hero.append(img); }
    const meta = make("div", "project-meta");
    [project.project_category_options?.name, project.project_status, project.project_date].filter(Boolean).forEach(value => meta.append(make("span", "pill", value)));
    const title = make("h2", "", project.title || "未命名作品"); title.id = "modalTitle";
    hero.append(meta, title);
    if (project.subtitle) hero.append(make("p", "lead", project.subtitle));
    content.append(hero);
    const blocks = [["專案背景", project.background], ["問題與需求", project.problem], ["目標使用者", project.target_users], ["我的角色", project.role], ["負責內容", project.responsibilities], ["解決方案", project.solution], ["執行流程", project.process], ["專案成果", project.result], ["KPI／量化成效", project.metrics], ["專案反思", project.reflection]];
    blocks.forEach(([label, value]) => { const block = sectionBlock(label, value); if (block) content.append(block); });
    const activeTools = getProjectTools(project);
    if (activeTools.length) {
      const toolSection = make("section", "modal-section"); toolSection.append(make("h3", "", "工具與技術"));
      const list = make("div", "tool-list"); activeTools.forEach(item => list.append(make("span", "tool-tag", item.name))); toolSection.append(list); content.append(toolSection);
    }
    const links = (project.project_links || []).filter(item => item.is_visible && safeUrl(item.url)).sort((a, b) => a.sort_order - b.sort_order);
    if (links.length) {
      const linkSection = make("section", "modal-section"); linkSection.append(make("h3", "", "外部連結")); const list = make("div", "external-links");
      links.forEach(item => { const a = make("a", "button ghost", item.title || item.type || "開啟連結"); a.href = safeUrl(item.url); a.target = "_blank"; a.rel = "noopener noreferrer"; list.append(a); });
      linkSection.append(list); content.append(linkSection);
    }
    const images = (project.project_images || []).filter(item => safeUrl(item.image_url)).sort((a, b) => `${a.category}-${String(a.sort_order).padStart(6, "0")}-${a.id}`.localeCompare(`${b.category}-${String(b.sort_order).padStart(6, "0")}-${b.id}`));
    if (images.length) {
      const gallerySection = make("section", "modal-section"); gallerySection.append(make("h3", "", "專案圖片")); const gallery = make("div", "gallery-grid");
      images.forEach((item, index) => { const button = make("button", "gallery-item"); button.type = "button"; button.dataset.lightboxIndex = String(index); const img = make("img"); img.src = safeUrl(item.image_url); img.alt = item.alt_text || item.caption || project.title; button.append(img); gallery.append(button); });
      gallerySection.append(gallery); content.append(gallerySection); currentLightboxItems = images;
    }
    modal.hidden = false;
    document.body.classList.add("modal-open");
    modal.querySelector(".modal-panel")?.scrollTo(0, 0);
    modal.querySelector(".modal-panel")?.focus();
    history.replaceState(null, "", `#project=${encodeURIComponent(project.slug || project.id)}`);
  }

  function closeProjectModal() {
    const modal = $("projectModal"); if (!modal || modal.hidden) return;
    modal.hidden = true; document.body.classList.remove("modal-open"); history.replaceState(null, "", location.pathname + location.search);
    if (lastFocusedElement instanceof HTMLElement) lastFocusedElement.focus();
  }

  function openProjectFromHash() {
    const match = location.hash.match(/^#project=(.+)$/); if (!match) return;
    const key = decodeURIComponent(match[1]); openProjectModal(projects.find(item => item.slug === key || item.id === key));
  }

  function openLightbox(index) {
    if (!currentLightboxItems.length) return;
    currentLightboxIndex = Math.max(0, Math.min(index, currentLightboxItems.length - 1));
    const lightbox = $("lightbox"); if (!lightbox) return;
    lightbox.hidden = false; document.body.classList.add("modal-open"); renderLightbox(); $("lightboxClose")?.focus();
  }
  function renderLightbox() {
    const item = currentLightboxItems[currentLightboxIndex]; if (!item) return;
    const img = $("lightboxImage"); if (img) { img.src = safeUrl(item.image_url); img.alt = item.alt_text || item.caption || "作品圖片"; img.onerror = () => { img.alt = "圖片載入失敗"; }; }
    text("lightboxCaption", item.caption || item.category || ""); text("lightboxCount", `${currentLightboxIndex + 1} / ${currentLightboxItems.length}`);
  }
  function closeLightbox() { const el = $("lightbox"); if (el) el.hidden = true; if ($("projectModal")?.hidden) document.body.classList.remove("modal-open"); }
  function moveLightbox(step) { currentLightboxIndex = (currentLightboxIndex + step + currentLightboxItems.length) % currentLightboxItems.length; renderLightbox(); }

  function renderExperiences(items) {
    const list = $("experienceList"); if (!list) return;
    list.replaceChildren(...items.map(item => {
      const card = make("article", "timeline-item"); const top = make("div", "timeline-top");
      const heading = make("div"); heading.append(make("h3", "", item.position || ""), make("p", "", [item.organization, item.location].filter(Boolean).join(" · ")));
      top.append(heading, make("strong", "", `${item.start_date || ""} – ${item.is_current ? "至今" : item.end_date || ""}`)); card.append(top);
      if (item.description) card.append(make("p", "preserve-lines", item.description));
      if (Array.isArray(item.achievements) && item.achievements.length) { const ul = make("ul"); item.achievements.filter(Boolean).forEach(value => ul.append(make("li", "", value))); card.append(ul); }
      return card;
    }));
    $("experience").hidden = items.length === 0;
  }

  function renderEducation(items) {
    const list = $("educationList"); if (!list) return;
    list.replaceChildren(...items.map(item => {
      const card = make("article", "stack-card"); card.append(make("h3", "", item.school || ""), make("p", "", [item.degree, item.department].filter(Boolean).join(" · ")), make("p", "", `${item.start_date || ""} – ${item.is_current ? "至今" : item.end_date || ""}`));
      if (item.description) card.append(make("p", "preserve-lines", item.description)); return card;
    }));
  }

  function renderCertificates(items) {
    const list = $("certificateList"); if (!list) return;
    list.replaceChildren(...items.map(item => {
      const card = make("article", "stack-card"); card.append(make("span", "pill", item.type || "證照"), make("h3", "", item.title || ""), make("p", "", [item.issuer, item.issue_date].filter(Boolean).join(" · ")));
      if (item.description) card.append(make("p", "preserve-lines", item.description));
      const url = safeUrl(item.credential_url); if (url) { const a = make("a", "button ghost", "查看驗證"); a.href = url; a.target = "_blank"; a.rel = "noopener noreferrer"; card.append(a); }
      return card;
    }));
  }

  function renderContacts(items) {
    const wrap = $("contactLinks"); if (!wrap) return;
    wrap.replaceChildren(...items.map(item => {
      let href = ""; const type = String(item.type || "").toLowerCase();
      if (type === "email") href = `mailto:${item.value}`; else if (["電話", "phone", "tel"].includes(type)) href = `tel:${String(item.value || "").replace(/[^\d+]/g, "")}`; else href = safeUrl(item.value);
      const a = make("a", "", item.title || item.type || item.value); a.href = href || "#";
      if (/^https?:/i.test(a.href)) { a.target = "_blank"; a.rel = "noopener noreferrer"; } return a;
    }));
  }

  async function submitContact(event) {
    event.preventDefault();
    if (!supabaseClient) { toast("請先完成 Supabase 設定"); return; }
    const form = event.currentTarget; const values = Object.fromEntries(new FormData(form).entries());
    if (values.website) return;
    const button = $("contactSubmit"); const original = button?.textContent || "送出訊息";
    try {
      if (button) { button.disabled = true; button.textContent = "送出中…"; }
      const messageRow = {
        name: String(values.name).trim(),
        email: String(values.email).trim(),
        subject: String(values.subject).trim(),
        message: String(values.message).trim()
      };

      const { error } = await supabaseClient.from("contact_messages").insert(messageRow);
      if (error) throw error;

      let emailDelivered = false;
      try {
        const emailResponse = await fetch(`https://formsubmit.co/ajax/${encodeURIComponent(contactNotificationEmail)}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json"
          },
          body: JSON.stringify({
            姓名: messageRow.name,
            Email: messageRow.email,
            聯絡主旨: messageRow.subject,
            訊息內容: messageRow.message,
            _subject: `作品集網站新訊息：${messageRow.subject}`,
            _template: "table",
            _captcha: "false"
          })
        });
        const emailResult = await emailResponse.json().catch(() => ({}));
        emailDelivered = emailResponse.ok && emailResult.success !== false;
        if (!emailDelivered) console.error("Email 通知寄送失敗", emailResult);
      } catch (emailError) {
        console.error("Email 通知寄送失敗", emailError);
      }

      form.reset();
      toast(emailDelivered ? "訊息已送出，並已寄送 Email 通知" : "訊息已儲存，可至後台聯絡訊息查看");
    } catch (error) { console.error(error); toast(`送出失敗：${error.message}`); }
    finally { if (button) { button.disabled = false; button.textContent = original; } }
  }

  function scheduleFrontEndReload() {
    window.clearTimeout(frontEndReloadTimer);
    frontEndReloadTimer = window.setTimeout(() => {
      window.location.reload();
    }, 450);
  }

  function bindContentUpdateListener() {
    if ("BroadcastChannel" in window) {
      const channel = new BroadcastChannel("portfolio-content-channel");
      channel.addEventListener("message", event => {
        if (event.data?.type === "portfolio-content-updated") scheduleFrontEndReload();
      });
    }
    window.addEventListener("storage", event => {
      if (event.key === "portfolio-content-updated" && event.newValue) scheduleFrontEndReload();
    });
  }

  function bindEvents() {
    $("menuButton")?.addEventListener("click", () => { const nav = $("mainNav"); const open = !nav?.classList.contains("open"); nav?.classList.toggle("open", open); $("menuButton")?.setAttribute("aria-expanded", String(open)); });
    $("mainNav")?.addEventListener("click", event => { if (event.target.closest("a")) { $("mainNav")?.classList.remove("open"); $("menuButton")?.setAttribute("aria-expanded", "false"); } });
    $("categoryFilters")?.addEventListener("click", event => { const button = event.target.closest("[data-category]"); if (!button) return; selectedCategory = button.dataset.category; renderFilters(); renderProjects(); });
    $("projectSearch")?.addEventListener("input", event => { searchKeyword = event.target.value.trim(); renderProjects(); });
    [$("projectsGrid"), $("featuredGrid")].forEach(grid => grid?.addEventListener("click", event => { const card = event.target.closest(".project-card"); if (card) openProjectModal(projects.find(item => item.id === card.dataset.projectId)); }));
    [$("projectsGrid"), $("featuredGrid")].forEach(grid => grid?.addEventListener("keydown", event => { if (!["Enter", " "].includes(event.key)) return; const card = event.target.closest(".project-card"); if (card) { event.preventDefault(); openProjectModal(projects.find(item => item.id === card.dataset.projectId)); } }));
    $("projectModalClose")?.addEventListener("click", closeProjectModal);
    $("projectModal")?.addEventListener("click", event => { if (event.target.closest("[data-close-modal]")) closeProjectModal(); const gallery = event.target.closest("[data-lightbox-index]"); if (gallery) openLightbox(Number(gallery.dataset.lightboxIndex)); });
    $("lightboxClose")?.addEventListener("click", closeLightbox); $("lightboxPrev")?.addEventListener("click", () => moveLightbox(-1)); $("lightboxNext")?.addEventListener("click", () => moveLightbox(1));
    $("lightbox")?.addEventListener("click", event => { if (event.target.closest("[data-close-lightbox]")) closeLightbox(); });
    document.addEventListener("keydown", event => { if (event.key === "Escape") { if (!$("lightbox")?.hidden) closeLightbox(); else closeProjectModal(); } if (!$("lightbox")?.hidden && event.key === "ArrowLeft") moveLightbox(-1); if (!$("lightbox")?.hidden && event.key === "ArrowRight") moveLightbox(1); });
    $("contactForm")?.addEventListener("submit", submitContact);
  }

  document.addEventListener("DOMContentLoaded", () => { bindEvents(); bindContentUpdateListener(); loadData(); });
})();
