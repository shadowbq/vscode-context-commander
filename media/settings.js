// @ts-check
'use strict';

// eslint-disable-next-line no-undef
const vscode = acquireVsCodeApi();

/** @typedef {{ label: string, commands: Array<{command:string,args?:unknown[]}>, when?: object, group?: string, enabled?: boolean }} Binding */

/** @type {{ bindings: Binding[], editingIndex: number, mode: 'list'|'edit' }} */
let state = vscode.getState() ?? { bindings: [], editingIndex: -1, mode: 'list' };

// ── Message handling from extension host ──────────────────────────────────────
window.addEventListener('message', (event) => {
  // Only accept messages from the VS Code extension host (same-origin in webview context).
  if (event.origin !== window.location.origin) {
    return;
  }
  const { data } = event;
  if (data.type === 'update') {
    state.bindings = data.bindings ?? [];
    state.mode = 'list';
    render();
    vscode.setState(state);
  }
});

// Tell extension host we are ready to receive data
vscode.postMessage({ type: 'ready' });

// ── Rendering ─────────────────────────────────────────────────────────────────
function render() {
  const listView = /** @type {HTMLElement} */ (document.getElementById('list-view'));
  const editView = /** @type {HTMLElement} */ (document.getElementById('edit-view'));

  if (state.mode === 'list') {
    listView.style.display = '';
    editView.style.display = 'none';
    renderList();
  } else {
    listView.style.display = 'none';
    editView.style.display = '';
    renderForm();
  }
}

function renderList() {
  const container = /** @type {HTMLElement} */ (document.getElementById('bindings-list'));

  if (state.bindings.length === 0) {
    container.innerHTML =
      '<div class="empty-state"><p>No bindings configured yet.<br>Click <strong>+ Add Binding</strong> to get started.</p></div>';
    return;
  }

  container.innerHTML = state.bindings
    .map((b, i) => {
      const badges = buildWhenBadges(b.when);
      const isDisabled = b.enabled === false;
      return `
        <div class="binding-card ${isDisabled ? 'is-disabled' : ''}">
          <div class="binding-header">
            <span class="binding-label">${esc(b.label)}</span>
            <span class="binding-cmds">${b.commands.map(c => esc(c.command)).join(' → ')}</span>
          </div>
          ${badges ? `<div class="when-row">${badges}</div>` : ''}
          <div class="card-actions">
            <button class="btn" data-act="toggle" data-i="${i}">${isDisabled ? 'Enable' : 'Disable'}</button>
            <button class="btn" data-act="up"     data-i="${i}" ${i === 0 ? 'disabled' : ''}>↑</button>
            <button class="btn" data-act="down"   data-i="${i}" ${i === state.bindings.length - 1 ? 'disabled' : ''}>↓</button>
            <button class="btn" data-act="edit"   data-i="${i}">Edit</button>
            <button class="btn" data-act="delete" data-i="${i}">Delete</button>
          </div>
        </div>`;
    })
    .join('');

  container.querySelectorAll('[data-act]').forEach(el => {
    el.addEventListener('click', handleCardAction);
  });
}

/** @param {object|undefined} when */
function buildWhenBadges(when) {
  if (!when) { return ''; }
  const b = /** @type {any} */ (when);
  const parts = [];
  if (b.fileExtensions?.length)  { parts.push(`<span class="badge">ext: ${b.fileExtensions.join(', ')}</span>`); }
  if (b.languageIds?.length)     { parts.push(`<span class="badge">lang: ${b.languageIds.join(', ')}</span>`); }
  if (b.glob)                    { parts.push(`<span class="badge">glob: ${esc(b.glob)}</span>`); }
  if (b.isDirectory === true)    { parts.push('<span class="badge">directories only</span>'); }
  if (b.isDirectory === false)   { parts.push('<span class="badge">files only</span>'); }
  return parts.join('');
}

/** @param {Event} e */
function handleCardAction(e) {
  const btn = /** @type {HTMLElement} */ (e.currentTarget);
  const act = btn.dataset['act'];
  const i = parseInt(btn.dataset['i'] ?? '0', 10);

  switch (act) {
    case 'edit':
      state.editingIndex = i;
      state.mode = 'edit';
      render();
      break;
    case 'delete':
      state.bindings.splice(i, 1);
      render();
      break;
    case 'toggle':
      state.bindings[i] = { ...state.bindings[i], enabled: state.bindings[i].enabled === false };
      render();
      break;
    case 'up':
      if (i > 0) {
        [state.bindings[i - 1], state.bindings[i]] = [state.bindings[i], state.bindings[i - 1]];
        render();
      }
      break;
    case 'down':
      if (i < state.bindings.length - 1) {
        [state.bindings[i], state.bindings[i + 1]] = [state.bindings[i + 1], state.bindings[i]];
        render();
      }
      break;
  }
  vscode.setState(state);
}

// ── Edit form ─────────────────────────────────────────────────────────────────
function renderForm() {
  const isNew = state.editingIndex === -1;
  const heading = /** @type {HTMLElement} */ (document.getElementById('edit-heading'));
  heading.textContent = isNew ? 'Add Binding' : 'Edit Binding';

  /** @type {Binding} */
  const b = isNew
    ? { label: '', commands: [{ command: '' }], when: {}, enabled: true }
    : state.bindings[state.editingIndex];

  setVal('f-label', b.label ?? '');
  setChecked('f-enabled', b.enabled !== false);

  const w = /** @type {any} */ (b.when ?? {});
  setVal('f-ext',  (w.fileExtensions ?? []).join(' '));
  setVal('f-lang', (w.languageIds ?? []).join(' '));
  setVal('f-glob', w.glob ?? '');
  setChecked('f-isdir', !!w.isDirectory);

  rebuildCmdRows(b.commands ?? [{ command: '' }]);
}

/** @param {Array<{command:string,args?:unknown[]}>} commands */
function rebuildCmdRows(commands) {
  const list = /** @type {HTMLElement} */ (document.getElementById('cmd-list'));
  list.innerHTML = '';
  commands.forEach(cmd => addCmdRow(cmd.command, cmd.args ? JSON.stringify(cmd.args) : ''));
}

/**
 * @param {string} [command]
 * @param {string} [argsJson]
 */
function addCmdRow(command = '', argsJson = '') {
  const row = document.createElement('div');
  row.className = 'cmd-row';
  row.innerHTML = `
    <input type="text" class="input cmd-id"   placeholder="extension.some.command"   value="${esc(command)}">
    <input type="text" class="input cmd-args" placeholder='["$\{file}"]'            value="${esc(argsJson)}" style="flex:0 0 220px" title="JSON array of args (optional)">
    <button class="btn cmd-remove" title="Remove command">✕</button>`;

  row.querySelector('.cmd-remove')?.addEventListener('click', () => {
    if (document.querySelectorAll('.cmd-row').length > 1) {
      row.remove();
    }
  });

  document.getElementById('cmd-list')?.appendChild(row);
}

function saveForm() {
  const label = getVal('f-label').trim();
  if (!label) {
    const el = document.getElementById('f-label');
    el?.setAttribute('invalid-message', 'Label is required');
    el?.focus();
    return;
  }

  // Collect commands
  const commands = /** @type {Array<{command:string,args?:unknown[]}>} */ ([]);
  document.querySelectorAll('.cmd-row').forEach(row => {
    const id   = /** @type {HTMLInputElement} */ (row.querySelector('.cmd-id')).value.trim();
    if (!id) { return; }
    const raw  = /** @type {HTMLInputElement} */ (row.querySelector('.cmd-args')).value.trim();
    if (raw) {
      let parsed;
      try { parsed = JSON.parse(raw); } catch { parsed = [raw]; }
      commands.push({ command: id, args: parsed });
    } else {
      commands.push({ command: id });
    }
  });

  if (commands.length === 0) {
    alert('At least one command ID is required.');
    return;
  }

  // Collect when filters
  const extRaw  = getVal('f-ext').trim();
  const langRaw = getVal('f-lang').trim();
  const glob    = getVal('f-glob').trim();
  const isDir   = getChecked('f-isdir');

  /** @type {any} */
  const when = {};
  if (extRaw)  { when.fileExtensions = extRaw.split(/\s+/).map(e => (e.startsWith('.') ? e : `.${e}`)); }
  if (langRaw) { when.languageIds    = langRaw.split(/\s+/); }
  if (glob)    { when.glob           = glob; }
  if (isDir)   { when.isDirectory    = true; }

  /** @type {Binding} */
  const binding = {
    label,
    commands,
    ...(Object.keys(when).length ? { when } : {}),
    enabled: getChecked('f-enabled'),
  };

  if (state.editingIndex === -1) {
    state.bindings.push(binding);
  } else {
    state.bindings[state.editingIndex] = binding;
  }

  state.mode = 'list';
  render();
  vscode.setState(state);
}

// ── DOM helpers ───────────────────────────────────────────────────────────────
/** @param {string} id @returns {string} */
function getVal(id) {
  return /** @type {HTMLInputElement} */ (document.getElementById(id)).value ?? '';
}
/** @param {string} id @param {string} val */
function setVal(id, val) {
  const el = /** @type {HTMLInputElement} */ (document.getElementById(id));
  if (el) { el.value = val; }
}
/** @param {string} id @returns {boolean} */
function getChecked(id) {
  return /** @type {HTMLInputElement} */ (document.getElementById(id)).checked ?? false;
}
/** @param {string} id @param {boolean} val */
function setChecked(id, val) {
  const el = /** @type {HTMLInputElement} */ (document.getElementById(id));
  if (el) { el.checked = val; }
}
/** @param {unknown} str @returns {string} */
function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Wire up static buttons on DOMContentLoaded ────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('btn-add')?.addEventListener('click', () => {
    state.editingIndex = -1;
    state.mode = 'edit';
    render();
  });

  document.getElementById('btn-save')?.addEventListener('click', () => {
    vscode.postMessage({ type: 'save', bindings: state.bindings });
  });

  document.getElementById('btn-add-cmd')?.addEventListener('click', () => addCmdRow());

  document.getElementById('btn-form-save')?.addEventListener('click', saveForm);

  document.getElementById('btn-form-cancel')?.addEventListener('click', () => {
    state.mode = 'list';
    render();
  });

  render();
});
