/** reset-password.js｜Supabase 密碼重設頁 */
(() => {
  "use strict";
  const config = window.APP_CONFIG || {};
  const client = window.supabase && /^https:\/\//.test(config.SUPABASE_URL || "") ? window.supabase.createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY) : null;
  const $ = id => document.getElementById(id);
  function message(value, error = false) { const el = $("resetMessage"); if (el) { el.textContent = value; el.style.color = error ? "#994a3e" : "#627b63"; } }
  document.addEventListener("DOMContentLoaded", () => {
    $("toggleNewPassword")?.addEventListener("click", () => { const input = $("newPassword"); const show = input.type === "password"; input.type = show ? "text" : "password"; $("toggleNewPassword").textContent = show ? "隱藏" : "顯示"; });
    $("resetForm")?.addEventListener("submit", async event => {
      event.preventDefault(); if (!client) { message("請先完成 config.js 設定。", true); return; }
      const password = $("newPassword").value; const confirm = $("confirmPassword").value; if (password.length < 8) { message("密碼至少 8 碼。", true); return; } if (password !== confirm) { message("兩次密碼輸入不一致。", true); return; }
      const button = $("resetButton"); const original = button.textContent;
      try { button.disabled = true; button.textContent = "更新中…"; const { error } = await client.auth.updateUser({ password }); if (error) throw error; await client.auth.signOut(); message("密碼已更新，請返回登入頁重新登入。"); }
      catch (error) { console.error(error); message(`更新失敗：${error.message}`, true); }
      finally { button.disabled = false; button.textContent = original; }
    });
  });
})();
