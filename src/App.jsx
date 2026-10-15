import { useEffect, useMemo, useRef, useState } from 'react';
import html2canvas from 'html2canvas';
import sheetCss from './style.css?inline';

const emptyTemplate = `# CHARACTER NAME
-# [Japanese name] — Epithet or title

### ⚔ GENERAL INFORMATION

- **Name:** [Fill in]
- **Age:** [Fill in]
- **Gender:** [Fill in]
- **Occupation:** [Fill in]

### ⚔ ORIGINS & PERSONALITY

[Describe where your character comes from, the people who shaped their early life, and the traits that define them.]

### ⚔ THE PLACE YOU RETURN TO

[Describe a meaningful place, what your character does there, and what it means to them.]

---
-# A short sentence that captures your character.`;

const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[char]));

function inline(raw) {
  let content = escapeHtml(raw);
  content = content.replace(/`([^`]+)`/g, '<code>$1</code>');
  content = content.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
  content = content.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/__(.+?)__/g, '<strong>$1</strong>');
  content = content.replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, '<em>$1</em>').replace(/(?<!_)_([^_\n]+)_(?!_)/g, '<em>$1</em>');
  return content;
}

function parseMarkdown(source, symbol) {
  const lines = source.replace(/\r/g, '').split('\n');
  let title = 'Untitled character';
  let subtitle = '';
  let takenTitle = false;
  let takenSubtitle = false;
  const output = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i].trim();
    if (!line) { i += 1; continue; }
    if (!takenTitle && /^#\s+/.test(line)) {
      title = line.replace(/^#\s+/, '');
      takenTitle = true;
      i += 1;
      continue;
    }
    if (takenTitle && !takenSubtitle && (/^\*[^*]+\*$/.test(line) || /^-#\s+/.test(line))) {
      subtitle = /^-#\s+/.test(line) ? line.replace(/^-#\s+/, '') : line.slice(1, -1);
      takenSubtitle = true;
      i += 1;
      continue;
    }
    if (/^```/.test(line)) {
      const code = [];
      i += 1;
      while (i < lines.length && !/^```/.test(lines[i])) code.push(lines[i++]);
      i += 1;
      output.push(`<pre><code>${escapeHtml(code.join('\n'))}</code></pre>`);
      continue;
    }
    if (/^\s*(?:---+|___+|━━━+|━━━━━━━━.+)\s*$/.test(line)) {
      output.push('<hr>');
      i += 1;
      continue;
    }
    if (/^#{2,6}\s/.test(line)) {
      const depth = line.match(/^#+/)[0].length;
      const heading = line.replace(/^#{2,6}\s+/, '').replace(/^(?:[\p{Extended_Pictographic}\p{So}]\uFE0F?\s*)+/u, '').trim();
      const rendered = `<span class="section-icon" aria-hidden="true">${escapeHtml(symbol)}</span>${inline(heading)}`;
      const tag = depth === 2 ? 'h2' : 'h3';
      output.push(`<${tag}>${rendered}</${tag}>`);
      i += 1;
      continue;
    }
    if (/^>\s?/.test(line)) {
      const quote = [];
      while (i < lines.length && /^>\s?/.test(lines[i].trim())) quote.push(lines[i++].trim().replace(/^>\s?/, ''));
      output.push(`<blockquote><p>${inline(quote.join(' '))}</p></blockquote>`);
      continue;
    }
    if (/^([-*+]\s|\d+\.\s)/.test(line)) {
      const ordered = /^\d+\.\s/.test(line);
      const items = [];
      while (i < lines.length && /^\s*([-*+]\s|\d+\.\s)/.test(lines[i])) {
        items.push(`<li>${inline(lines[i].trim().replace(/^([-*+]\s|\d+\.\s)/, ''))}</li>`);
        i += 1;
      }
      const tag = ordered ? 'ol' : 'ul';
      output.push(`<${tag}>${items.join('')}</${tag}>`);
      continue;
    }
    if (/^[-#] /.test(line)) { i += 1; continue; }

    const paragraph = [];
    while (i < lines.length && lines[i].trim() && !/^(#{1,6}\s|>\s?|```|[-*+]\s|\d+\.\s|---+\s*$|___+\s*$)/.test(lines[i].trim())) {
      paragraph.push(lines[i++]);
    }
    if (paragraph.length) {
      const text = paragraph.map((part) => part.replace(/ {2,}$/, '@@BR@@').trim()).join(' ');
      if (/^-#\s+/.test(text)) {
        output.push(`<p class="closing">${inline(text.replace(/^-#\s+/, ''))}</p>`);
      } else {
        output.push(`<p>${text.split('@@BR@@').map(inline).join('<br>')}</p>`);
      }
    } else {
      i += 1;
    }
  }

  return { title, subtitle, body: output.join('\n') };
}

function filenameFor(title) {
  return (title.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\w\-]+/g, '_').replace(/^_+|_+$/g, '') || 'personnage').toLowerCase();
}

function download(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function App() {
  const [markdown, setMarkdown] = useState(emptyTemplate);
  const [theme, setTheme] = useState('blue');
  const [symbol, setSymbol] = useState('⚔');
  const [eyebrow, setEyebrow] = useState('');
  const [pngBusy, setPngBusy] = useState(false);
  const paperRef = useRef(null);
  const parsed = useMemo(() => parseMarkdown(markdown, symbol), [markdown, symbol]);
  const filename = filenameFor(parsed.title);

  useEffect(() => {
    document.title = `${parsed.title} ? Atelier de fiches`;
  }, [parsed.title]);

  function loadBlank() {
    setMarkdown(emptyTemplate);
    setTheme('blue');
    setSymbol('⚔');
    setEyebrow('');
  }

  function clearMarkdown() {
    if (window.confirm('Effacer le Markdown actuel ?')) setMarkdown('');
  }

  function exportHtml() {
    const css = sheetCss;
    const html = `<!doctype html>\n<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(parsed.title)} — Atelier de fiches</title><style>${css}</style></head><body><article class="paper theme-${theme}"><div class="mini-label"${eyebrow.trim() ? '' : ' style="display:none"'}>${escapeHtml(eyebrow.trim())}</div><h1 class="document-title">${escapeHtml(parsed.title)}</h1><div class="subtitle"${parsed.subtitle ? '' : ' style="display:none"'}>${escapeHtml(parsed.subtitle)}</div><div class="ornament"><span>${escapeHtml(symbol === '⚔' ? '×' : symbol)}</span></div><div class="document-body">${parsed.body}</div></article></body></html>`;
    download(`${filename}.html`, html, 'text/html;charset=utf-8');
  }

  async function exportPng() {
    setPngBusy(true);
    try {
      if (document.fonts?.ready) await document.fonts.ready;
      const paper = paperRef.current;
      const canvas = await html2canvas(paper, {
        scale: 2,
        backgroundColor: getComputedStyle(paper).backgroundColor,
        useCORS: true,
        logging: false,
      });
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
      if (!blob) throw new Error('Création du fichier PNG impossible');
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${filename}.png`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      console.error('Export PNG échoué', error);
      window.alert(typeof window.html2canvas === 'function'
        ? 'La fiche n’a pas pu être exportée en PNG. Réessaie après avoir rechargé la page.'
        : 'La fonction PNG n’a pas pu être chargée. Vérifie ta connexion Internet puis recharge la page.');
    } finally {
      setPngBusy(false);
    }
  }

  function exportPdf() {
    window.print();
  }

  return (
    <>
      <header className="top">
        <div className="logo">✦ Atelier de fiches <small>Markdown → fiche élégante → PDF</small></div>
        <div className="note">100 % local · aucun compte nécessaire</div>
      </header>
      <main className="workspace">
        <aside className="editor">
          <div>
            <div className="sect-title">01 / Personnaliser</div>
            <div className="field-row">
              <div className="field">
                <label htmlFor="theme">Thème visuel</label>
                <select id="theme" value={theme} onChange={(event) => setTheme(event.target.value)}>
                  <option value="rose">❀ Rose poudré</option>
                  <option value="blue">⚔ Bleu acier</option>
                  <option value="sage">✿ Vert sauge</option>
                  <option value="ink">◆ Minimaliste</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="symbol">Icône des sections</label>
                <select id="symbol" value={symbol} onChange={(event) => setSymbol(event.target.value)}>
                  <option value="❀">❀ Fleur</option>
                  <option value="⚔">⚔ Épées</option>
                  <option value="✦">✦ Étoile</option>
                  <option value="◆">◆ Diamant</option>
                  <option value="✿">✿ Fleur simple</option>
                </select>
              </div>
            </div>
            <p className="subtext">Le symbole choisi marque les titres de section.</p>
          </div>
          <div className="field">
            <label htmlFor="eyebrow">Mention au-dessus du titre</label>
            <input id="eyebrow" type="text" value={eyebrow} maxLength={80} onChange={(event) => setEyebrow(event.target.value)} />
          </div>
          <div className="editor-fill">
            <div className="sect-title">02 / Markdown</div>
            <textarea id="markdown" spellCheck="false" aria-label="Texte Markdown" value={markdown} onChange={(event) => setMarkdown(event.target.value)} />
            <p className="subtext">Utilise <b>#</b> pour le titre, <b>*italique*</b> pour le sous-titre, <b>##</b> ou <b>###</b> pour les sections, <b>&gt;</b> pour les citations et <b>---</b> pour les séparateurs. Les listes et le gras fonctionnent aussi. La ligne en italique ou préfixée par <b>-#</b> après le titre devient le sous-titre. Le modèle complet est personnalisable : remplace les champs entre crochets et supprime les rubriques inutiles.</p>
          </div>
          <div>
            <div className="sect-title">03 / Modèles et export</div>
            <div className="btn-row" style={{ marginBottom: 9 }}>
              <button type="button" onClick={loadBlank}>Modèle vierge</button>
              <button type="button" onClick={clearMarkdown}>Effacer</button>
            </div>
            <div className="btn-row">
              <button type="button" onClick={() => download(`${filename}.md`, markdown, 'text/markdown;charset=utf-8')}>↓ Markdown</button>
              <button type="button" onClick={exportHtml}>↓ HTML</button>
              <button type="button" onClick={exportPng} disabled={pngBusy}>{pngBusy ? 'Création…' : '↓ PNG'}</button>
              <button type="button" className="primary" onClick={exportPdf}><span className="button-icon">↗</span>Exporter en PDF</button>
            </div>
            <p className="subtext">Le brouillon n’est pas enregistré automatiquement. Exporte-le pour le garder. Pour le PDF, choisis « Enregistrer au format PDF » et active « Graphiques d’arrière-plan » dans la boîte d’impression de ton navigateur. Les pages A4 se répartissent automatiquement.</p>
          </div>
        </aside>
        <section className="preview-area">
          <div className="preview-bar"><strong>Aperçu du document</strong><span>Format A4 · Mise à jour en direct</span></div>
          <article ref={paperRef} id="paper" className={`paper theme-${theme}`}>
            <div className="mini-label" style={{ display: eyebrow.trim() ? '' : 'none' }}>{eyebrow.trim()}</div>
            <h1 className="document-title">{parsed.title}</h1>
            <div className="subtitle" style={{ display: parsed.subtitle ? '' : 'none' }}>{parsed.subtitle}</div>
            <div className="ornament"><span>{symbol === '⚔' ? '×' : symbol}</span></div>
            <div className="document-body" dangerouslySetInnerHTML={{ __html: parsed.body }} />
          </article>
        </section>
      </main>
    </>
  );
}
