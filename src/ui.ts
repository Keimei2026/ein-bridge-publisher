import type { Env, PublicationMode } from "./types";
import { escapeHtml } from "./utils";

export function adminPage(env: Env, publicOrigin: string): string {
  return `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
  <title>Ein Bridge Publisher</title>
  <link rel="stylesheet" href="/styles.css">
  <script src="https://accounts.google.com/gsi/client" async defer></script>
  <script src="/admin.js" defer></script>
</head>
<body data-google-client-id="${escapeHtml(env.GOOGLE_CLIENT_ID)}" data-public-origin="${escapeHtml(publicOrigin)}">
  <header class="topbar">
    <div>
      <p class="eyebrow">EIN BRIDGE</p>
      <h1>Publisher</h1>
    </div>
    <button id="logoutButton" class="button ghost hidden" type="button">ログアウト</button>
  </header>

  <main class="shell">
    <section id="loginPanel" class="card login-card">
      <h2>管理者ログイン</h2>
      <p><strong>${escapeHtml(env.ADMIN_EMAIL)}</strong> のGoogleアカウントだけが利用できます。</p>
      <div id="googleButton"></div>
      <p id="loginMessage" class="message"></p>
    </section>

    <div id="appPanel" class="hidden">
      <section class="card">
        <div class="section-heading">
          <div>
            <p class="eyebrow">NEW / UPDATE</p>
            <h2>資料を公開する</h2>
          </div>
          <span class="badge">最大5MB</span>
        </div>
        <div class="form-grid">
          <label>表示名
            <input id="titleInput" maxlength="160" placeholder="SHIKI企画書">
          </label>
          <label>URL名
            <input id="slugInput" maxlength="64" inputmode="url" placeholder="shiki">
          </label>
        </div>
        <fieldset>
          <legend>公開モード</legend>
          <label class="choice"><input type="radio" name="mode" value="static" checked> 静的資料モード（JavaScript禁止）</label>
          <label class="choice"><input type="radio" name="mode" value="interactive"> インタラクティブモード（日英切替など）</label>
        </fieldset>
        <div id="dropZone" class="drop-zone" role="button" tabindex="0" aria-label="HTMLファイルを選択またはドロップ">
          <input id="fileInput" class="file-input" type="file" accept=".html,text/html">
          <div class="drop-icon" aria-hidden="true">＋</div>
          <div>
            <strong>HTMLをここへドラッグ＆ドロップ</strong>
            <span class="drop-sub">またはクリックしてファイルを選択</span>
            <span id="fileSummary" class="file-summary">まだ選択されていません</span>
          </div>
        </div>
        <div class="actions">
          <button id="previewButton" class="button secondary" type="button">プレビュー</button>
          <button id="publishButton" class="button primary" type="button">公開する</button>
        </div>
        <div class="progress-wrap hidden" id="progressWrap">
          <progress id="uploadProgress" max="100" value="0"></progress>
          <span id="progressText">0%</span>
        </div>
        <p id="statusMessage" class="message" aria-live="polite"></p>
      </section>

      <section class="card">
        <div class="section-heading">
          <div><p class="eyebrow">PUBLISHED</p><h2>公開資料</h2></div>
          <button id="reloadButton" class="button ghost" type="button">更新</button>
        </div>
        <div id="siteList" class="site-list"></div>
      </section>
    </div>
  </main>

  <dialog id="previewDialog" class="dialog wide">
    <div class="dialog-head"><h2>公開前プレビュー</h2><button class="icon-button" data-close="previewDialog" aria-label="閉じる">×</button></div>
    <iframe id="previewFrame" title="プレビュー"></iframe>
  </dialog>

  <dialog id="historyDialog" class="dialog">
    <div class="dialog-head"><h2>更新履歴</h2><button class="icon-button" data-close="historyDialog" aria-label="閉じる">×</button></div>
    <div id="historyList"></div>
  </dialog>
</body>
</html>`;
}

export function setupPage(env: Env, currentHost: string): string {
  return `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Ein Bridge Publisher Setup</title><style>${minimalCss()}</style></head><body><main class="setup"><h1>Ein Bridge Publisher</h1><p>Workerは起動していますが、このホストは管理画面または公開画面として登録されていません。</p><p>現在アクセス中のホスト：<code>${escapeHtml(currentHost)}</code></p><p>設定済み候補：<code>${escapeHtml(env.ADMIN_HOST)}</code> / <code>${escapeHtml(env.PUBLIC_HOST)}</code></p><p><a href="/health">稼働確認</a></p></main></body></html>`;
}

export function publicWrapper(title: string, contentPath: string, mode: PublicationMode): string {
  const sandbox = mode === "interactive" ? "allow-scripts" : "";
  return `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title><style>html,body,iframe{width:100%;height:100%;margin:0;border:0;background:#fff}iframe{display:block}</style></head><body><iframe sandbox="${sandbox}" referrerpolicy="no-referrer" src="${escapeHtml(contentPath)}" title="${escapeHtml(title)}"></iframe></body></html>`;
}

export function adminCss(): string {
  return `
:root{font-family:Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;color:#182335;background:#f3f6f8;line-height:1.5}
*{box-sizing:border-box}body{margin:0;min-height:100vh;background:linear-gradient(160deg,#f7fafb,#edf3f5)}
button,input{font:inherit}.hidden{display:none!important}.topbar{display:flex;justify-content:space-between;align-items:center;padding:22px clamp(18px,4vw,48px);background:#17324d;color:#fff;box-shadow:0 8px 25px #17324d2b}.topbar h1{margin:0;font-size:clamp(26px,4vw,40px)}.eyebrow{margin:0 0 2px;font-size:12px;letter-spacing:.18em;font-weight:800;color:#6a889d}.topbar .eyebrow{color:#bcd0dc}
.shell{max-width:980px;margin:0 auto;padding:24px 16px 60px}.card{background:#fff;border:1px solid #dbe4e9;border-radius:20px;padding:clamp(18px,4vw,30px);margin-bottom:20px;box-shadow:0 12px 35px #17324d0d}.login-card{max-width:540px;margin:60px auto}.card h2{margin:0;font-size:clamp(22px,3vw,30px)}.section-heading{display:flex;justify-content:space-between;align-items:center;gap:16px;margin-bottom:20px}.badge{background:#eaf2f5;border-radius:999px;padding:5px 10px;font-size:12px;font-weight:800;color:#355a70}
.form-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}label,legend{font-weight:750}input[type=text],input:not([type]){width:100%;margin-top:6px;border:1px solid #b8c8d2;border-radius:11px;padding:12px;background:#fff}input:focus{outline:3px solid #9cc9df66;border-color:#4e91b4}fieldset{border:1px solid #d4e0e6;border-radius:12px;margin:18px 0;padding:14px}.choice{display:block;font-weight:600;margin:7px 0}.drop-zone{display:flex;align-items:center;gap:14px;border:2px dashed #8ba7b7;background:#f7fafb;border-radius:15px;padding:20px;cursor:pointer;transition:.18s ease}.drop-zone:hover,.drop-zone:focus-visible,.drop-zone.dragover{border-color:#176a8d;background:#edf7fa;outline:none;box-shadow:0 0 0 4px #76b5d326}.drop-icon{display:grid;place-items:center;flex:0 0 44px;width:44px;height:44px;border-radius:50%;background:#e4f0f4;color:#176a8d;font-size:28px;font-weight:500}.drop-zone strong{display:block}.drop-sub,.file-summary{display:block;font-size:13px;color:#637585;margin-top:2px}.file-summary.selected{color:#176b4b;font-weight:750}.file-input{position:absolute;width:1px;height:1px;opacity:0;pointer-events:none}
.actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:18px}.button{border:0;border-radius:10px;padding:11px 16px;font-weight:800;cursor:pointer}.button:disabled{opacity:.55;cursor:wait}.primary{background:#176a8d;color:#fff}.secondary{background:#e8f1f4;color:#17324d}.ghost{background:transparent;border:1px solid currentColor;color:inherit}.danger{background:#fff0f0;color:#a32b2b}.message{min-height:1.4em;margin:14px 0 0;white-space:pre-wrap}.message.error{color:#a32b2b}.message.success{color:#176b4b}
.progress-wrap{display:grid;grid-template-columns:1fr auto;gap:10px;align-items:center;margin-top:14px}progress{width:100%;height:14px}.site-list{display:grid;gap:14px}.site-card{border:1px solid #dbe4e9;border-radius:16px;padding:14px}.site-card.deleted{background:#faf7f7;opacity:.8}.site-card-grid{display:grid;grid-template-columns:220px minmax(0,1fr);gap:16px;align-items:start}.site-thumb{position:relative;display:block;width:100%;aspect-ratio:16/10;overflow:hidden;border:1px solid #cfdce3;border-radius:11px;background:linear-gradient(135deg,#edf3f6,#fff);box-shadow:0 6px 18px #17324d12}.site-thumb-frame{position:absolute;inset:0;width:400%;height:400%;border:0;transform:scale(.25);transform-origin:top left;pointer-events:none;background:#fff}.site-thumb::after{content:"開く";position:absolute;right:8px;bottom:8px;padding:4px 8px;border-radius:999px;background:#17324dcc;color:#fff;font-size:11px;font-weight:800;opacity:0;transition:.15s}.site-thumb:hover::after,.site-thumb:focus-visible::after{opacity:1}.site-thumb-placeholder{display:grid;place-items:center;width:100%;aspect-ratio:16/10;border:1px dashed #c8d2d8;border-radius:11px;color:#7c8d98;background:#f5f6f7;font-weight:750}.site-row{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.site-card h3{margin:0 0 4px}.meta{font-size:13px;color:#637585}.url{font-size:13px;word-break:break-all;color:#176a8d}.site-actions{display:flex;gap:7px;flex-wrap:wrap;margin-top:12px}.small-button{border:0;border-radius:8px;padding:8px 10px;font-weight:750;cursor:pointer;background:#edf3f5;color:#1e4056}.small-button.danger{background:#fff0f0;color:#a32b2b}
.dialog{border:0;border-radius:18px;padding:0;box-shadow:0 22px 70px #13283b55;max-width:min(720px,94vw);width:100%}.dialog::backdrop{background:#15283b99}.dialog.wide{max-width:96vw;width:1100px;height:92vh}.dialog-head{display:flex;justify-content:space-between;align-items:center;padding:15px 18px;border-bottom:1px solid #dbe4e9}.dialog-head h2{margin:0}.icon-button{border:0;background:transparent;font-size:28px;cursor:pointer}.dialog iframe{width:100%;height:calc(92vh - 64px);border:0}.history-item{padding:14px 18px;border-bottom:1px solid #e2e8ec}.history-item.current{background:#eef7f2}
@media(max-width:700px){.form-grid{grid-template-columns:1fr}.site-card-grid{grid-template-columns:1fr}.site-thumb{max-width:none}.site-row{display:block}.topbar{padding:18px}.shell{padding:16px 12px 40px}.card{border-radius:15px}.button{flex:1}.site-actions .small-button{flex:1}.drop-zone{align-items:flex-start}}
`;
}

function minimalCss(): string {
  return `body{font-family:system-ui,sans-serif;background:#f4f7f8;color:#183044;margin:0}.setup{max-width:700px;margin:50px auto;background:#fff;padding:30px;border-radius:18px;box-shadow:0 15px 45px #18304418}code{background:#edf3f5;padding:2px 6px;border-radius:5px;word-break:break-all}li{margin:12px 0}`;
}

export function adminJs(): string {
  return String.raw`
(() => {
  const $ = (id) => document.getElementById(id);
  const body = document.body;
  const clientId = body.dataset.googleClientId;
  const publicOrigin = body.dataset.publicOrigin;
  let currentUser = null;
  let selectedFile = null;

  function cookie(name) {
    const found = document.cookie.split(';').map(v => v.trim()).find(v => v.startsWith(name + '='));
    return found ? decodeURIComponent(found.slice(name.length + 1)) : '';
  }

  async function api(path, options = {}) {
    const headers = new Headers(options.headers || {});
    const method = (options.method || 'GET').toUpperCase();
    if (!['GET', 'HEAD'].includes(method)) headers.set('x-csrf-token', cookie('__Host-ebp_csrf'));
    const response = await fetch(path, { ...options, headers, credentials: 'same-origin' });
    const type = response.headers.get('content-type') || '';
    const data = type.includes('application/json') ? await response.json() : await response.text();
    if (!response.ok) {
      const code = data && typeof data === 'object' ? data.error : String(data);
      throw new Error(code || 'REQUEST_FAILED');
    }
    return data;
  }

  function setMessage(text, kind = '') {
    const el = $('statusMessage');
    el.textContent = text;
    el.className = 'message' + (kind ? ' ' + kind : '');
  }

  function humanBytes(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1024 / 1024).toFixed(2) + ' MB';
  }

  function slugFromFilename(filename) {
    const base = filename.replace(/\.html?$/i, '').normalize('NFKC').toLowerCase();
    const slug = base.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').replace(/-+/g, '-').slice(0, 64);
    if (slug) return slug;
    const now = new Date();
    const pad = value => String(value).padStart(2, '0');
    return 'document-' + String(now.getFullYear()).slice(-2) + pad(now.getMonth() + 1) + pad(now.getDate()) + '-' + pad(now.getHours()) + pad(now.getMinutes());
  }

  async function selectFile(file) {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.html')) return setMessage('.htmlファイルを選択してください。', 'error');
    if (file.size <= 0 || file.size > 5 * 1024 * 1024) return setMessage('HTMLは5MB以内にしてください。', 'error');
    try {
      const source = new TextDecoder('utf-8', {fatal:true}).decode(await file.arrayBuffer());
      selectedFile = file;
      const parsed = new DOMParser().parseFromString(source, 'text/html');
      const detectedTitle = (parsed.querySelector('title')?.textContent || '').trim();
      if (!$('titleInput').value.trim()) $('titleInput').value = detectedTitle || file.name.replace(/\.html?$/i, '');
      if (!$('slugInput').value.trim()) $('slugInput').value = slugFromFilename(file.name);
      $('fileSummary').textContent = file.name + '（' + humanBytes(file.size) + '）';
      $('fileSummary').classList.add('selected');
      setMessage('HTMLを選択しました。内容を確認して「公開する」を押してください。', 'success');
    } catch {
      selectedFile = null;
      setMessage('UTF-8のHTMLファイルではありません。UTF-8で保存し直してください。', 'error');
    }
  }

  function clearSelectedFile() {
    selectedFile = null;
    $('fileInput').value = '';
    $('fileSummary').textContent = 'まだ選択されていません';
    $('fileSummary').classList.remove('selected');
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  async function sha256Hex(bytes) {
    const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
    return [...digest].map(v => v.toString(16).padStart(2, '0')).join('');
  }

  async function session() {
    try {
      const result = await api('/api/session');
      currentUser = result.user;
      $('loginPanel').classList.add('hidden');
      $('appPanel').classList.remove('hidden');
      $('logoutButton').classList.remove('hidden');
      await loadSites();
    } catch {
      currentUser = null;
      $('loginPanel').classList.remove('hidden');
      $('appPanel').classList.add('hidden');
      $('logoutButton').classList.add('hidden');
      renderGoogleButton();
    }
  }

  function renderGoogleButton() {
    if (!window.google?.accounts?.id) return setTimeout(renderGoogleButton, 150);
    if (!clientId || clientId === 'REPLACE_DURING_DEPLOY') {
      $('loginMessage').textContent = 'Google Client IDが未設定です。Cloudflareの環境変数を確認してください。';
      return;
    }
    window.google.accounts.id.initialize({ client_id: clientId, callback: onGoogleCredential, ux_mode: 'popup' });
    $('googleButton').innerHTML = '';
    window.google.accounts.id.renderButton($('googleButton'), { theme: 'outline', size: 'large', text: 'signin_with', shape: 'rectangular' });
  }

  async function onGoogleCredential(response) {
    try {
      $('loginMessage').textContent = '確認中…';
      await api('/auth/google', {
        method: 'POST',
        headers: {'content-type': 'application/json'},
        body: JSON.stringify({ credential: response.credential })
      });
      $('loginMessage').textContent = '';
      await session();
    } catch (error) {
      $('loginMessage').textContent = error.message === 'ACCOUNT_NOT_ALLOWED' ? 'このGoogleアカウントは許可されていません。' : 'ログインに失敗しました: ' + error.message;
    }
  }

  async function loadSites() {
    const result = await api('/api/sites');
    const list = $('siteList');
    if (!result.sites.length) {
      list.innerHTML = '<p>まだ公開資料はありません。</p>';
      return;
    }
    list.innerHTML = result.sites.map(site => {
      const url = publicOrigin + '/p/' + encodeURIComponent(site.slug);
      const deleted = Boolean(site.deletedAt);
      const thumb = deleted
        ? '<div class="site-thumb-placeholder">削除済み</div>'
        : '<a class="site-thumb" href="' + url + '" target="_blank" rel="noopener" aria-label="' + escapeHtml(site.title) + 'を開く"><iframe class="site-thumb-frame" loading="lazy" sandbox="" tabindex="-1" title="" src="' + url + '"></iframe></a>';
      return '<article class="site-card' + (deleted ? ' deleted' : '') + '"><div class="site-card-grid">' + thumb + '<div>' +
        '<div class="site-row"><div><h3>' + escapeHtml(site.title) + '</h3>' +
        '<div class="meta">' + escapeHtml(site.slug) + '・' + (site.mode === 'interactive' ? 'インタラクティブ' : '静的') + '・' + humanBytes(site.byteSize) + '</div>' +
        '<div class="meta">更新 ' + new Date(site.updatedAt).toLocaleString() + (deleted ? '・削除済み' : '') + '</div>' +
        (!deleted ? '<a class="url" href="' + url + '" target="_blank" rel="noopener">' + escapeHtml(url) + '</a>' : '') + '</div></div>' +
        '<div class="site-actions">' +
        (!deleted ? '<button class="small-button" data-action="copy" data-slug="' + escapeHtml(site.slug) + '">URLコピー</button><button class="small-button" data-action="share" data-slug="' + escapeHtml(site.slug) + '" data-title="' + escapeHtml(site.title) + '">共有</button><button class="small-button" data-action="history" data-slug="' + escapeHtml(site.slug) + '">履歴</button><button class="small-button danger" data-action="delete" data-slug="' + escapeHtml(site.slug) + '">削除</button>' :
        '<button class="small-button" data-action="restore" data-slug="' + escapeHtml(site.slug) + '">復元</button>') +
        '</div></div></div></article>';
    }).join('');
  }

  async function publish() {
    const file = selectedFile || $('fileInput').files[0];
    const title = $('titleInput').value.trim();
    const slug = $('slugInput').value.trim().toLowerCase();
    const mode = document.querySelector('input[name="mode"]:checked').value;
    if (!file || !title || !slug) return setMessage('表示名、URL名、HTMLファイルを指定してください。', 'error');
    if (!/^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/.test(slug)) return setMessage('URL名は半角英数字とハイフンだけで入力してください。', 'error');
    if (file.size <= 0 || file.size > 5 * 1024 * 1024) return setMessage('HTMLは5MB以内にしてください。', 'error');
    if (!file.name.toLowerCase().endsWith('.html')) return setMessage('.htmlファイルを選択してください。', 'error');

    let fileBuffer;
    try {
      fileBuffer = await file.arrayBuffer();
      const source = new TextDecoder('utf-8', {fatal:true}).decode(fileBuffer);
      const warnings = [];
      if (!/<meta\s+[^>]*charset=/i.test(source)) warnings.push('文字コード指定（meta charset）がありません。');
      if (!/<meta\s+[^>]*name=["\']viewport["\']/i.test(source)) warnings.push('スマホ表示用のviewport指定がありません。');
      if (/(?:src|href)\s*=\s*["\']https?:\/\//i.test(source)) warnings.push('外部画像・CSS・JavaScriptは公開時に遮断されます。');
      if (mode === 'static' && /<script\b/i.test(source)) warnings.push('静的資料モードではJavaScriptは実行されません。');
      if (warnings.length && !confirm('公開前の確認:\n\n' + warnings.join('\n') + '\n\nこのまま公開しますか？')) return;
    } catch {
      return setMessage('UTF-8のHTMLファイルではありません。UTF-8で保存し直してください。', 'error');
    }

    $('publishButton').disabled = true;
    $('progressWrap').classList.remove('hidden');
    $('uploadProgress').value = 0;
    setMessage('アップロードを開始します…');
    try {
      const chunkBytes = 128 * 1024;
      const chunkCount = Math.ceil(file.size / chunkBytes);
      const started = await api('/api/uploads/start', {
        method: 'POST', headers: {'content-type':'application/json'},
        body: JSON.stringify({ title, slug, mode, byteSize: file.size, chunkCount })
      });
      for (let index = 0; index < chunkCount; index += 1) {
        const start = index * chunkBytes;
        const bytes = fileBuffer.slice(start, Math.min(file.size, start + chunkBytes));
        const hash = await sha256Hex(bytes);
        await api('/api/uploads/' + encodeURIComponent(started.uploadId) + '/chunks/' + index + '?slug=' + encodeURIComponent(slug), {
          method: 'PUT', headers: {'content-type':'application/octet-stream','x-chunk-sha256':hash}, body: bytes
        });
        const percent = Math.round(((index + 1) / chunkCount) * 90);
        $('uploadProgress').value = percent;
        $('progressText').textContent = percent + '%';
      }
      const result = await api('/api/uploads/' + encodeURIComponent(started.uploadId) + '/finish?slug=' + encodeURIComponent(slug), {
        method: 'POST', headers: {'content-type':'application/json'}, body: '{}'
      });
      $('uploadProgress').value = 100;
      $('progressText').textContent = '100%';
      const url = publicOrigin + '/p/' + slug;
      setMessage('公開しました。\n' + url + (result.warning ? '\n※一覧同期を再試行しています。' : ''), 'success');
      await navigator.clipboard.writeText(url).catch(() => {});
      clearSelectedFile();
      $('titleInput').value = '';
      $('slugInput').value = '';
      await loadSites();
    } catch (error) {
      setMessage('公開できませんでした: ' + error.message, 'error');
    } finally {
      $('publishButton').disabled = false;
    }
  }

  async function preview() {
    const file = selectedFile || $('fileInput').files[0];
    if (!file) return setMessage('先にHTMLファイルを選択してください。', 'error');
    if (file.size <= 0 || file.size > 5 * 1024 * 1024) return setMessage('HTMLは5MB以内にしてください。', 'error');
    if (!file.name.toLowerCase().endsWith('.html')) return setMessage('.htmlファイルを選択してください。', 'error');
    try {
      const source = new TextDecoder('utf-8', {fatal:true}).decode(await file.arrayBuffer());
      const mode = document.querySelector('input[name="mode"]:checked').value;
      const frame = $('previewFrame');
      frame.setAttribute('sandbox', mode === 'interactive' ? 'allow-scripts' : '');
      frame.srcdoc = source;
      $('previewDialog').showModal();
    } catch {
      setMessage('UTF-8のHTMLファイルではありません。UTF-8で保存し直してください。', 'error');
    }
  }

  async function showHistory(slug) {
    const result = await api('/api/sites/' + encodeURIComponent(slug) + '/history');
    $('historyList').innerHTML = result.revisions.map(revision =>
      '<div class="history-item' + (revision.id === result.site.currentRevision ? ' current' : '') + '">' +
      '<strong>' + escapeHtml(revision.title) + '</strong><div class="meta">' + new Date(revision.createdAt).toLocaleString() + '・' + humanBytes(revision.byteSize) + '・' + escapeHtml(revision.mode) + '</div>' +
      '<div class="site-actions"><a class="small-button" href="/api/sites/' + encodeURIComponent(slug) + '/revisions/' + encodeURIComponent(revision.id) + '/download">HTML保存</a>' +
      (revision.id !== result.site.currentRevision ? '<button class="small-button" data-rollback="' + escapeHtml(slug) + '" data-revision="' + escapeHtml(revision.id) + '">この版に戻す</button>' : '<span class="badge">公開中</span>') + '</div></div>'
    ).join('');
    $('historyDialog').showModal();
  }

  const dropZone = $('dropZone');
  dropZone.addEventListener('click', event => { if (event.target !== $('fileInput')) $('fileInput').click(); });
  dropZone.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); $('fileInput').click(); }
  });
  $('fileInput').addEventListener('change', event => selectFile(event.target.files?.[0]));
  ['dragenter','dragover'].forEach(type => dropZone.addEventListener(type, event => {
    event.preventDefault(); event.stopPropagation(); dropZone.classList.add('dragover');
  }));
  ['dragleave','drop'].forEach(type => dropZone.addEventListener(type, event => {
    event.preventDefault(); event.stopPropagation(); dropZone.classList.remove('dragover');
  }));
  dropZone.addEventListener('drop', event => selectFile(event.dataTransfer?.files?.[0]));
  window.addEventListener('dragover', event => event.preventDefault());
  window.addEventListener('drop', event => event.preventDefault());

  $('publishButton').addEventListener('click', publish);
  $('previewButton').addEventListener('click', preview);
  $('reloadButton').addEventListener('click', loadSites);
  $('logoutButton').addEventListener('click', async () => { await api('/auth/logout', {method:'POST', headers:{'content-type':'application/json'}, body:'{}'}); location.reload(); });
  document.addEventListener('click', async (event) => {
    const target = event.target.closest('button');
    if (!target) return;
    if (target.dataset.close) document.getElementById(target.dataset.close).close();
    const action = target.dataset.action;
    const slug = target.dataset.slug;
    if (action === 'copy') {
      const url = publicOrigin + '/p/' + slug; await navigator.clipboard.writeText(url); setMessage('URLをコピーしました。', 'success');
    }
    if (action === 'share') {
      const url = publicOrigin + '/p/' + slug;
      if (navigator.share) await navigator.share({title: target.dataset.title, url}).catch(() => {});
      else location.href = 'https://line.me/R/msg/text/?' + encodeURIComponent((target.dataset.title || '') + '\n' + url);
    }
    if (action === 'history') await showHistory(slug);
    if (action === 'delete' && confirm('「' + slug + '」を削除しますか？30日以内は復元できます。')) {
      await api('/api/sites/' + encodeURIComponent(slug) + '/delete', {method:'POST',headers:{'content-type':'application/json'},body:'{}'}); await loadSites();
    }
    if (action === 'restore') { await api('/api/sites/' + encodeURIComponent(slug) + '/restore', {method:'POST',headers:{'content-type':'application/json'},body:'{}'}); await loadSites(); }
    if (target.dataset.rollback && confirm('この版に戻しますか？')) {
      await api('/api/sites/' + encodeURIComponent(target.dataset.rollback) + '/rollback', {method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({revisionId:target.dataset.revision})});
      $('historyDialog').close(); await loadSites();
    }
  });

  session();
})();
`;
}
