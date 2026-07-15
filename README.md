# 黃婷懌 Portfolio CMS

Vanilla HTML、CSS、JavaScript + Supabase 的個人作品集內容管理系統。前台內容由 Supabase 動態載入，管理者可透過後台管理作品、圖片、能力、經歷、學歷、證照、聯絡方式與網站設定。

## 1. 專案結構

```text
/
├── index.html              # 公開前台
├── styles.css              # 前台樣式
├── app.js                  # 前台資料載入與互動
├── admin.html              # 管理後台
├── admin.css               # 後台樣式
├── admin.js                # Auth、CRUD、上傳與排序
├── reset-password.html     # 重設密碼頁
├── reset-password.js
├── config.js               # Supabase 公開連線設定
├── database.sql            # 資料表、RLS、Storage Policies
├── vercel.json             # Vercel 靜態設定與安全標頭
├── README.md
└── assets/
    └── portfolio-source-photos.zip  # 原始作品照片素材備份
```

## 2. 建立 Supabase 專案

1. 登入 Supabase，建立新 Project。
2. 進入 **Project Settings → API**。
3. 複製：
   - Project URL
   - Publishable Key（或舊介面的 anon public key）
4. 編輯 `config.js`：

```js
window.APP_CONFIG = {
  SUPABASE_URL: "https://你的專案.supabase.co",
  SUPABASE_ANON_KEY: "你的 Publishable Key"
};
```

不可放入 `service_role` key。前端寫入安全性由 RLS 控制。

## 3. 建立資料庫

1. Supabase Dashboard → **SQL Editor**。
2. 新增 Query。
3. 複製 `database.sql` 全部內容並執行。
4. SQL 會建立資料表、外鍵、索引、Trigger、RLS、預設分類、預設工具與初始網站文字。

## 4. 建立 Storage Bucket

1. Supabase Dashboard → **Storage**。
2. 建立 Bucket：`portfolio-assets`。
3. 設定為 **Public bucket**。
4. `database.sql` 已建立 Storage Policy：
   - 公開訪客可讀取。
   - 僅 `profiles.is_admin = true` 的登入者可新增、修改、刪除。

建議路徑由後台自動建立：

- `site/logo/`
- `site/hero/`
- `profile/`
- `projects/{slug}/covers/`
- `projects/{slug}/galleries/{category}/`
- `documents/resume/`
- `site/og/`

## 5. 建立第一位管理員

### 方法 A：後台註冊

1. 本機啟動網站。
2. 開啟 `http://localhost:8000/admin.html`。
3. 輸入 Email 與至少 8 碼密碼，點擊「註冊帳號」。
4. 若 Supabase 開啟 Email confirmation，先完成信箱驗證。
5. 回到 SQL Editor 執行：

```sql
update public.profiles
set is_admin = true
where email = '你的管理員信箱@example.com';
```

### 方法 B：Supabase 建立帳號

1. Authentication → Users → Add user。
2. 建立後執行上方 `update profiles` SQL。

## 6. Authentication URL 設定

Supabase → Authentication → URL Configuration。

Site URL（本機測試時）：

```text
http://localhost:8000
```

Redirect URLs 加入：

```text
http://localhost:8000/reset-password.html
https://你的正式網域/reset-password.html
```

有 Vercel Preview 時，也可加入對應 Preview URL。

## 7. 本機測試

不可直接使用 `file://` 開啟。

macOS：

```bash
cd 專案資料夾
python3 -m http.server 8000
```

Windows：

```bash
python -m http.server 8000
```

開啟：

- 前台：`http://localhost:8000`
- 後台：`http://localhost:8000/admin.html`
- 重設密碼：`http://localhost:8000/reset-password.html`

## 8. 後台使用流程

1. 登入管理員帳號。
2. 至「個人資料」設定姓名、職稱、介紹與履歷文字。
3. 至「網站設定」設定區塊標題、Hero 按鈕、SEO 與 Footer。
4. 使用下方圖片卡片上傳 Logo、Hero、個人照、OG 圖與履歷 PDF。
5. 先管理分類與工具，再新增作品。
6. 新增作品第一次儲存後，再次編輯即可上傳多張作品圖片。
7. 上架作品後，重新整理前台即可顯示。

## 9. GitHub 上傳

```bash
git init
git add .
git commit -m "Initial portfolio CMS"
git branch -M main
git remote add origin https://github.com/你的帳號/你的Repository.git
git push -u origin main
```

注意：`config.js` 內的 Publishable Key 本來就可放前端，但不可放 service_role key。

## 10. Vercel 部署

1. 將專案 Push 至 GitHub。
2. 登入 Vercel → Add New Project。
3. 匯入 Repository。
4. Framework Preset 選 **Other**。
5. Root Directory 使用專案根目錄。
6. Build Command 留空。
7. Output Directory 留空。
8. Deploy。
9. 將正式網址加入 Supabase Auth Redirect URLs。

## 11. 資料與權限

公開訪客：

- 只能讀取已上架作品、啟用分類／工具、可見能力／經歷／學歷／證照／聯絡方式及網站設定。
- 可以新增聯絡訊息。
- 不可讀取其他聯絡訊息。
- 不可寫入管理內容或上傳檔案。

管理員：

- 必須登入。
- `profiles.is_admin` 必須為 `true`。
- 所有資料寫入和 Storage 操作仍受 Supabase RLS／Storage Policy 控制。

## 12. 圖片與檔案限制

圖片：JPG、JPEG、PNG、WebP，8MB 以下。  
履歷：PDF，15MB 以下。

前端檢查只是操作體驗；真正權限由 Storage Policy 控制。若需要更嚴格的容量或 MIME 驗證，可在 Supabase Storage Bucket 設定中加入限制。

## 13. 常見錯誤

### 顯示「請先完成 Supabase 設定」

確認 `config.js` 已填入正確 Project URL 與 Publishable Key，且不是 service_role key。

### 登入後顯示沒有 profile

確認已執行完整 `database.sql`。舊帳號若在 Trigger 建立前存在，可執行：

```sql
insert into public.profiles (id, email, is_admin)
select id, email, false from auth.users
on conflict (id) do update set email = excluded.email;
```

再將管理員設為 `true`。

### 登入後顯示沒有管理員權限

```sql
update public.profiles
set is_admin = true
where email = '你的 Email';
```

### 圖片上傳失敗

檢查：

1. Bucket 名稱必須為 `portfolio-assets`。
2. Bucket 已設為 Public。
3. 已執行 Storage Policies。
4. 登入帳號 `profiles.is_admin = true`。
5. 檔案格式與大小符合限制。

### 忘記密碼信件回到錯誤頁面

確認 Authentication → URL Configuration 已加入完整 `reset-password.html` URL。

### 前台查不到資料

確認：

- 作品 `is_published = true`。
- 其他內容 `is_visible = true`。
- 分類、工具 `is_active = true`。
- 瀏覽器 Console 沒有 RLS 或網路錯誤。

### Vercel 部署後仍讀取舊資料

重新整理頁面並清除瀏覽器 Cache。Supabase 查詢本身不需要重新部署；只有修改前端程式碼或 `config.js` 才需要重新部署。

## 14. 語法與結構檢查

專案交付前已執行：

```bash
node --check app.js
node --check admin.js
node --check reset-password.js
```

另檢查同一 HTML 檔案內無重複 `id`。

## 15. 驗收重點

- 前台全部內容由 Supabase 載入。
- 未上架作品不公開。
- 精選作品無資料時自動隱藏。
- 分類與關鍵字搜尋可用。
- 作品卡支援滑鼠、Enter、Space。
- Modal 可用按鈕、背景與 Esc 關閉。
- Lightbox 支援上一張、下一張、左右鍵與 Esc。
- 聯絡表單公開可新增，但公開不可讀取。
- 非管理員不可寫入資料或 Storage。
- 後台可 CRUD 作品、能力、經歷、學歷、證照與聯絡方式。
- 分類使用中不可直接刪除。
- 圖片選擇後僅在儲存時正式上傳。
- 作品排序使用 SortableJS 並同步 `sort_order`。
- 手機、平板、桌機版皆為響應式版型。

## 16. 原始作品照片

`assets/portfolio-source-photos.zip` 是你上傳的原始作品素材備份。為避免把固定圖片寫死在網站，請從後台依作品分類上傳至 Supabase Storage。這樣未來可自行增刪、排序與替換。

## 聯絡表單 Email 通知

前台聯絡表單會同時：

1. 寫入 Supabase 的 `contact_messages`，可在管理後台查看。
2. 透過 FormSubmit 將通知寄到 `bii19897720011228@gmail.com`。

第一次有人送出表單後，FormSubmit 會寄一封啟用確認信到上述 Gmail。請先點擊信中的啟用連結；完成後，之後的網站留言才會正常寄送 Email 通知。即使 Email 通知暫時失敗，訊息仍會保存在 Supabase 後台。

預設聯絡方式已加入：

- Email：`bii19897720011228@gmail.com`
- LINE：`https://line.me/ti/p/iPlHgOQfLv`
- Instagram：`https://www.instagram.com/xav.yi_/`

若資料庫已經建立過，請重新執行最新版 `database.sql`，它會補上這三筆資料且不會重複新增。


## 前台自動更新與後台登入安全

- 後台任何新增、修改、刪除、上下架、排序或檔案上傳成功後，會透過 `BroadcastChannel` 通知同一瀏覽器、同一網域中已開啟的前台頁面自動重新整理。
- 另提供 `localStorage storage` 事件作為相容性備援。
- 後台登入憑證改存於 `sessionStorage`：同一個管理頁籤重新整理時仍保持登入；關閉該頁籤後憑證會被瀏覽器清除，再次開啟 `admin.html` 必須重新登入。
- 若同時開啟多個管理頁籤，每個頁籤有各自的登入狀態。


### 履歷更新時間
履歷最後更新時間會在 PDF 上傳成功後自動記錄（以 Asia/Taipei 顯示），不需要手動輸入。
