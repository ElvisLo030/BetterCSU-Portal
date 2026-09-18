# AGENTS.md — 協同開發規範

這份文件是 **BetterCSU-Portal 的唯一協作契約**，開發者與 AI coding agent 都適用。AI agent 在本 repo 動任何一行程式前，請完整讀過本檔；本檔沒寫到的，以既有程式碼的既有寫法為準，不要引入外來慣例。

規範優先順序（衝突時由高到低）：

1. `LICENSE`（非商業開源授權）與 `PRIVACY.md`（隱私承諾）
2. 本檔「紅線」一節
3. 本檔其餘章節
4. 既有程式碼的實際寫法
5. 個人偏好 / 通用最佳實務

---

## 1. 這個專案是什麼

正修科技大學訊息網（`portal.csu.edu.tw`）的 Chrome / Edge 擴充功能（Manifest V3）。它在**使用者已登入的原站頁面上**就地改善介面：

- 把個人課表的逐日列表轉成週課表視圖
- 在左側選單提供功能釘選
- 在歷年學分頁提供多條件篩選

**它不是**：不是另一個課表網站、不是爬蟲、不是代理伺服器、沒有後端、沒有工具列彈出視窗、沒有帳號系統。

### 專案哲學（做決策時的判準）

| 原則 | 意思 |
|------|------|
| 唯讀寄生 | 只讀原站畫面、只加自己的 UI；絕不改寫、送出或刪除學校資料 |
| 零依賴 | 沒有 npm 套件、沒有建置步驟、沒有 CDN；原始碼即發佈產物 |
| 資料不出本機 | 沒有分析、沒有外部 API、沒有雲端同步 |
| 優雅退化 | 原站改版導致解析失敗時，保留原始表格，不讓使用者看到壞掉的頁面 |
| 小而準 | 寧可少做一個功能，也不要讓程式碼長出框架、抽象層或設定檔 |

---

## 2. 檔案地圖與執行模型

沒有 bundler。`manifest.json` 直接依頁面注入下列檔案，載入順序即 `manifest.json` 陣列順序。

| 檔案 | 注入頁面 | 層級 | 職責 |
|------|----------|------|------|
| `core.js` | 個人課表頁 | **純邏輯** | 民國日期、課表格子解析、連堂合併、視圖軸計算、課名補全比對 |
| `features.js` | 全站 + 歷年學分頁 | **純邏輯** | 釘選連結目標解析（安全過濾）、學分列解析與條件比對 |
| `content.js` | `min_stuTimeTable.aspx` | DOM | 週課表 UI、放大視窗、課程詳情、篩選對話框 |
| `pins.js` | 全站 | DOM | 左側釘選區塊、設定對話框、`chrome.storage.local` 存取 |
| `credits.js` | `min_stuCreditList.aspx` | DOM | 學分篩選列、筆數與學分加總 |

### 兩層分離是硬性規定

- **純邏輯層（`core.js`、`features.js`）**：不碰 `document`、不碰 `chrome.*`、不發網路請求。以 IIFE 包裝，結尾雙重匯出，讓 Node 測試可以 `require`：

  ```js
  const api={DAY,date,monday,cell,merge,parse,view,courseNames};
  if(typeof module!=='undefined')module.exports=api;else root.CSUWeeklyCore=api;
  ```

  全域名稱：`CSUWeeklyCore`（core.js）、`CSUFeatures`（features.js）。

- **DOM 層（`content.js`、`pins.js`、`credits.js`）**：不重複實作解析邏輯，一律呼叫純邏輯層。

**新增任何可測試的判斷、解析、比對邏輯時，放進純邏輯層並補測試**，不要寫在 DOM 層裡。

### 重複注入防護

每個 DOM 層腳本開頭都必須有 guard，原站 AJAX 重建頁面時才不會疊出第二份 UI：

```js
if(document.getElementById('csu-credit-filter'))return;
```

所有自訂元素 id 一律 `csu-` 前綴（`csu-weekly-extension`、`csu-pins`、`csu-pin-settings`、`csu-credit-filter`）。儲存鍵目前只有 `csuPinnedFunctions`。

---

## 3. 紅線（不可協商）

違反以下任一條的 PR 一律不會被合併。AI agent 若被要求做這些事，**停下來說明衝突，不要照做**。

### 3.1 隱私

- 不得新增任何對**外部網域**的請求（分析、錯誤回報、CDN、字型、圖床、AI API，一律不行）。
- 不得讀取 `document.cookie`、`localStorage` 中的學校資料、或任何帳密欄位。
- 不得把成績、學號、姓名、課表內容寫入 `chrome.storage`、剪貼簿或 console log。
- 目前唯一允許的網路行為：`content.js` 以使用者既有工作階段向**同站** `min_stuScoreList.aspx` 發出**一次** `fetch`，只取學期／課號／課名，不保存回應。要加第二個請求，必須先在 issue 討論並同步更新 `PRIVACY.md` 與 `README.md`。
- 任何改動只要碰到資料流，`PRIVACY.md` 與 README「資料與權限」段落必須在同一個 PR 內一起更新。

### 3.2 安全

- **學校頁面來的文字一律用 `textContent` 插入，禁止 `innerHTML` / `insertAdjacentHTML` / `outerHTML`。** 課名、備註、教室都是不可信輸入。
- 禁止 `eval`、`new Function`、`setTimeout('字串')`。
- 禁止產生或觸發 `javascript:` URL。釘選功能只接受 `features.js` 中 `pinTarget()` 白名單比對後、協定為 `http:`/`https:` 的結果；解析不出來就退回「請從原站選單開啟」，不要放寬正規表達式來「多支援幾個功能」。
- 自訂 UI 一律放在 Shadow DOM（`attachShadow({mode:'open'})`）或獨立 `<style>`，不得污染原站樣式、不得覆蓋原站 CSS 規則。
- 原站帶有 CSP，**不得依賴 inline event handler 或動態插入的 script**（1.0.4 的釘選就是為了這點改走一般連結）。

### 3.3 權限

- `manifest.json` 目前只要 `storage`。三個 `content_scripts` 區塊的 `matches` 全部限定在 `portal.csu.edu.tw` 網域下（全站一組、課表頁一組、歷年學分頁一組），新增注入目標時必須同樣限定在該網域，且只注入該頁真正需要的檔案。
- 新增任何 permission、`host_permissions`、background service worker、`declarativeNetRequest`，都必須在 PR 描述寫明理由與 Chrome Web Store 的權限說明文字，並更新 `PRIVACY.md`。沒有理由就不要加。

### 3.4 對原站的非破壞性

- 不得送出表單、不得點擊原站按鈕、不得改寫學校計算出的數字（實得學分、平均成績一律原樣保留）。
- 隱藏列只用 `style.display`，並保存原值以便還原。
- 解析失敗時走「保留原始表格 + 狀態列提示」路徑，不要 throw 到頁面上。

### 3.5 依賴與建置

- 不得加入 `package.json` 相依套件、`node_modules`、TypeScript、bundler、CSS 前處理器、framework。
- 不得為了「現代化」把既有程式碼改寫成 ES module、class 或 React。
- 測試只用 Node 內建 `node:test` 與 `node:assert/strict`。

---

## 4. 程式風格

本專案採用**高密度單行風格**，這是刻意的（原始碼即發佈產物，檔案要小、diff 要集中）。請比照既有檔案，**不要整檔重排、不要跑 Prettier / ESLint --fix**，那會製造無法審閱的 diff。

具體慣例：

- 一個小函式寫成一行；運算子、逗號後不加空白；`if`/`for` 單行不加大括號時緊接敘述。
- 每個檔案開頭 `'use strict';`，整體包在 IIFE 裡。
- 變數命名短而具體（`rows`、`cells`、`blocks`、`pins`、`filtered`），不用匈牙利命名或 `_private`。
- 現代語法可用且鼓勵：optional chaining、`?.[]`、`??`、`at(-1)`、`Object.fromEntries`、`replaceChildren()`、`AbortSignal.timeout()`。
- DOM 建立走 `document.createElement` 或該檔自己的 `el()` 小工具（`content.js` 為 `el(tag,text,cls)`、`credits.js` 為 `el(tag,text)`），不要用 template literal 組 HTML 字串。
- **註解寫「為什麼」，不寫「做什麼」**，用繁體中文，且只寫在反直覺處。既有範例：

  ```js
  // 原站依帳號回傳兩種軸向；先辨識星期表頭，不以資料筆數推測。
  // 原站桌面與手機選單共用 ID，優先使用桌面 accordion，不能取第一個 ID。
  // 所有學校資料都用 textContent 插入，避免把課程文字當成 HTML 執行。
  ```

  這些註解記錄的是原站的行為約束，**刪除註解前要先確認該約束已不存在**。

- 使用者可見文字一律繁體中文，語氣與現有 UI 一致（簡短、陳述、不用驚嘆號）。狀態列要說明「資料僅在本頁處理」這類保證時，用字比照既有句子。
- 無障礙不可回退：對話框要有 `aria-label`，狀態列用 `role="status"`，可點卡片要有 `tabIndex`、`role="button"` 與 Enter/Space 處理，`:focus-visible` 樣式要保留。
- RWD 不可回退：既有 `@media(max-width:650px)` / `(max-width:550px)` / `(max-width:480px)` 區塊、觸控目標 44px 最小高度都要維持。

---

## 5. 改動流程

### 5.1 動手前

1. 確認要改的是**純邏輯層**還是 **DOM 層**（見第 2 節表格）。
2. 讀完該檔案——檔案都不長，不要只讀片段就改。
3. 若行為與原站 HTML 結構有關，先用 `tests/` 裡的合成頁確認目前行為，再改。
4. 不確定原站實際結構時，**問專案維護者，不要臆測後寫死選擇器**。

### 5.2 改動範圍

- 一個 PR 只做一件事。功能、重構、格式調整不要混在同一個 commit。
- 不要動與任務無關的檔案。特別是 `LICENSE`、`PRIVACY.md`、`.github/workflows/` 非必要不要碰。
- 不要新增檔案來「整理架構」。目前 5 個執行檔的切分是穩定的；要新增第 6 個檔案前先開 issue。

### 5.3 AI agent 專屬要求

- **禁止提交任何真實帳號、學號、成績、課表截圖或 HTML dump。** 測試資料一律用 `tests/` 裡的合成資料，課號用 `AAAAAAA` 這類明顯假值。
- 宣告完成前必須實際執行測試並貼出輸出；「應該可以動」不算完成。
- 動到 DOM 層時，必須說明你用哪個合成頁驗證過、驗了哪些情境；無法驗證的部分要明講，不要含糊帶過。
- 不要順手「修正」你覺得奇怪的既有寫法（壓縮風格、重複的 `el()` 工具、看似冗長的正規表達式）——那些多半有原因，要改先在 PR 描述說明理由。
- 產生的中文不得出現簡體字或中國用語。

---

## 6. 測試與驗收

### 6.1 自動化測試（必跑）

在含 `manifest.json` 的目錄執行（需要 Node.js 20 以上）：

```sh
node --test tests/core.test.cjs tests/features.test.cjs
```

覆蓋率：

```sh
node --test --experimental-test-coverage tests/core.test.cjs tests/features.test.cjs
```

規則：

- 純邏輯層的每個行為分支都要有測試；**改 `core.js` 或 `features.js` 卻沒動測試的 PR 會被退回**。
- 測試風格比照既有檔案：一個 `test()` 涵蓋一組相關斷言，測試名稱用繁體中文描述行為（`features.test.cjs` 沿用英文亦可，跟著該檔既有寫法）。
- 測試名稱描述**行為與邊界**，不是函式名稱。例：`只合併相鄰同科同教室同備註`、`長休息不合併，括號格式可辨識`。
- 修 bug 時先加一個會失敗的測試，再修。

### 6.2 手動驗收（DOM 層改動必做）

用 `tests/` 底下的合成頁，全部是假資料，可直接用瀏覽器開啟或起本機靜態伺服器：

| 頁面 | 驗什麼 |
|------|--------|
| `tests/browser.html` | 週課表轉換、長課名、少量星期、十三節、學期切換、空課表 |
| `tests/integration.html` | 釘選區塊 + 課表同時存在時的互動、`chrome.storage` 以 `localStorage` 模擬 |
| `tests/strict.html` | **帶 CSP 的情境**，學分篩選與釘選開窗；改釘選或注入方式後一定要跑這頁 |
| `tests/destination.html` | 釘選一般連結開窗的落點 |
| `tests/min_stuScoreList.aspx` | 課名補全的合成成績頁 |

真機驗收（改動影響原站相容性時）：在瀏覽器開發人員模式載入本資料夾，登入訊息網後測試。

> **踩坑提醒**：更新未封裝擴充功能時，要把新檔案覆蓋回**當初載入的那個資料夾**再按「重新載入」，`chrome.storage.local` 才會保留。載入另一個資料夾、或先移除再載入會換 extension ID，釘選設定會被清空。

### 6.3 驗收清單（PR 自查）

- [ ] `node --test` 全綠，輸出已貼在 PR
- [ ] 沒有新增外部依賴、外部請求、新權限
- [ ] 學校資料仍只走 `textContent`
- [ ] 解析失敗時仍會退回原始表格
- [ ] 手機寬度（≤650px）版面正常
- [ ] 鍵盤可操作、對話框可用 Esc 關閉
- [ ] 沒有夾帶真實個資
- [ ] 若行為改變，README 對應段落已更新

---

## 7. 版號與發佈

**`manifest.json` 的 `version` 是唯一版號權威。**

發佈流程（自動）：

1. 在同一個 PR 裡調高 `manifest.json` 的 `version`，並在 `README.md`「版本紀錄」加一行說明（使用者看得懂的白話，不是 commit 訊息）。
2. 合併進 `main` 後，`.github/workflows/release.yml` 偵測到版號變動，會執行 `scripts/release-on-version-bump.sh`：打包 ZIP、建立 tag `v<版號>` 與 GitHub Release（`gh release create --generate-notes`）。
3. 版號沒變則跳過；同名 Release 已存在也會跳過。手動觸發 `workflow_dispatch` 會強制發佈。

本機打包（需要 `python3` 與 `zip`）：

```sh
./scripts/package.sh
```

產出 `BetterCSU-Portal-v<版號>.zip`，只含 `manifest.json` 與 5 個執行檔，不含測試與文件。

規則：

- **ZIP 不進版控**（`.gitignore` 已排除 `*.zip`），一律由 CI 或 `package.sh` 產生。
- 版號規則：修 bug `PATCH`、加功能 `MINOR`、破壞既有設定或權限 `MAJOR`。目前處於 `1.0.x`。
- 不要手動建立 tag 或 Release，交給 CI。
- 不要在 commit 裡只改 README 版號而忘記 `manifest.json`，兩者必須一致。

---

## 8. Commit 與 PR 規範

Commit 訊息格式（沿用既有歷史）：

```
feat: 1.0.5 修課狀況篩選並更名為 BetterCSU-Portal

- 歷年學分可依修課狀況篩選。
- 擴充功能名稱改為 BetterCSU-Portal，README 改為使用者說明。
```

- 前綴：`feat:` / `fix:` / `refactor:` / `docs:` / `test:` / `chore:`。
- 發版 commit 在前綴後帶版號；一般 commit 不帶。
- 標題用繁體中文，一行講完；細節寫在條列內文，每行句號結尾。
- 不要在訊息裡放測試輸出、檔案清單或 AI 產生的冗長說明。

PR 描述至少包含：改了什麼、為什麼、怎麼驗證的（含測試輸出）、有沒有碰到權限或資料流。

---

## 9. 原站改版時的修復指引

學校網站改版是本專案最常見的故障來源。修復順序：

1. 先判斷是**選擇器失效**（`#stuTimetable`、`#l_semester`、`#dirMine`、7 欄學分表頭）還是**資料格式改變**（課表格子字串、民國日期格式）。
2. 選擇器失效 → 改 DOM 層，並在該行補一則「為什麼要這樣選」的註解。
3. 格式改變 → 改純邏輯層，**先在測試加入新格式的案例**，且舊格式的測試不能刪（學校可能只改部分頁面）。
4. 無法解析的內容一律保留原文（`{raw:s}` 路徑），不要猜。

---

## 10. 授權與聯絡

本專案採 **Non-Commercial Open Source License**（見 `LICENSE`）：個人、教育、非營利可自由使用與修改，**禁止商業使用**。

- 提交 PR 即表示你同意你的貢獻以相同授權釋出。
- 散布修改版時必須保留原始著作權聲明與授權全文，並標示修改內容與修改者。
- 不得移除或變更 `LICENSE`、README 授權段落與 `PRIVACY.md` 的聯絡資訊。
- 商業授權洽詢：<hi@elvislo.tw>

本擴充功能與正修科技大學無隸屬關係，非官方產品。
