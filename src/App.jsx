import React, { useEffect, useMemo, useRef, useState } from "react";
import { Download, FileText, Save, Trash2, Copy, Eye, Type, Sigma, Printer, Maximize2, Minimize2, Infinity as InfinityIcon } from "lucide-react";
import { saveAs } from "file-saver";
import katex from "katex";
import "katex/dist/katex.min.css";

const STORAGE_KEY = "kessarismath-editor";

const STARTER = String.raw`\documentclass[12pt]{article}
\usepackage[utf8]{inputenc}
\usepackage[greek,english]{babel}
\usepackage{alphabeta}
\usepackage{amsmath}
\usepackage{amssymb}
\usepackage{geometry}
\geometry{a4paper, margin=1in}

\begin{document}

\section*{ΘΕΜΑ Γ (Αναθεωρημένο)}

Δίνονται οι ανισώσεις:

\begin{equation}
|x - 2| < 3 \quad (1)
\end{equation}

\begin{equation}
x^2 - 5x + 4 \le 0 \quad (2)
\end{equation}

\begin{itemize}
  \item[\textbf{Γ1.}] Να λύσετε τις ανισώσεις (1) και (2). \hfill \textbf{Μονάδες 8}
  \item[\textbf{Γ2.}] Να βρείτε το σύνολο των κοινών λύσεων των ανισώσεων (1) και (2). \hfill \textbf{Μονάδες 7}
  \item[\textbf{Γ3.}] Έστω $x_1, x_2$ οι ρίζες της εξίσωσης $x^2 - 5x + 4 = 0$.
  \begin{itemize}
    \item[i.] Χωρίς να λύσετε την εξίσωση, να υπολογίσετε το άθροισμα $S=x_1+x_2$ και το γινόμενο $P=x_1\cdot x_2$ των ριζών της.
    \item[ii.] Να εξετάσετε αν οι ρίζες $x_1$ και $x_2$ της παραπάνω εξίσωσης αποτελούν κοινές λύσεις των ανισώσεων (1) και (2). \hfill \textbf{Μονάδες 10}
  \end{itemize}
\end{itemize}

\end{document}`;

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function normalizeLatex(input) {
  let text = input;

  text = text.replace(/\\documentclass(?:\[[^\]]*\])?\{[^}]*\}/g, "");
  text = text.replace(/\\usepackage(?:\[[^\]]*\])?\{[^}]*\}/g, "");
  text = text.replace(/\\geometry\{[^}]*\}/g, "");
  text = text.replace(/\\title\{([^}]*)\}/g, "# $1");
  text = text.replace(/\\author\{([^}]*)\}/g, "");
  text = text.replace(/\\date\{([^}]*)\}/g, "");
  text = text.replace(/\\maketitle/g, "");

  text = text.replace(/\\begin\{document\}/g, "");
  text = text.replace(/\\end\{document\}/g, "");

  text = text.replace(/\\section\*?\{([^}]*)\}/g, "# $1");
  text = text.replace(/\\subsection\*?\{([^}]*)\}/g, "## $1");
  text = text.replace(/\\subsubsection\*?\{([^}]*)\}/g, "### $1");

  text = text.replace(/\\begin\{equation\*?\}([\s\S]*?)\\end\{equation\*?\}/g, (_, math) => `\n$$\n${math.trim()}\n$$\n`);
  text = text.replace(/\\begin\{align\*?\}([\s\S]*?)\\end\{align\*?\}/g, (_, math) => `\n$$\n${math.trim()}\n$$\n`);
  text = text.replace(/\\begin\{gather\*?\}([\s\S]*?)\\end\{gather\*?\}/g, (_, math) => `\n$$\n${math.trim()}\n$$\n`);
  text = text.replace(/\\begin\{multline\*?\}([\s\S]*?)\\end\{multline\*?\}/g, (_, math) => `\n$$\n${math.trim()}\n$$\n`);
  text = text.replace(/\\\[([\s\S]*?)\\\]/g, (_, math) => `\n$$\n${math.trim()}\n$$\n`);
  text = text.replace(/\\\(([\s\S]*?)\\\)/g, (_, math) => `$${math.trim()}$`);

  text = text.replace(/\\begin\{itemize\}/g, "");
  text = text.replace(/\\end\{itemize\}/g, "");
  text = text.replace(/\\begin\{enumerate\}/g, "");
  text = text.replace(/\\end\{enumerate\}/g, "");

  text = text.replace(/\\item\[([^\]]*)\]/g, "• $1 ");
  text = text.replace(/\\item\s+/g, "• ");

  text = text.replace(/\\textbf\{([^{}]*)\}/g, "**$1**");
  text = text.replace(/\\textit\{([^{}]*)\}/g, "*$1*");
  text = text.replace(/\\emph\{([^{}]*)\}/g, "*$1*");
  text = text.replace(/\\underline\{([^{}]*)\}/g, "$1");

  text = text.replace(/\\hfill/g, "     ");
  text = text.replace(/\\noindent/g, "");
  text = text.replace(/\\newpage/g, "\n---PAGE---\n");
  text = text.replace(/\\vspace\*?\{[^}]*\}/g, "");
  text = text.replace(/\\begin\{center\}/g, "");
  text = text.replace(/\\end\{center\}/g, "");
  text = text.replace(/\\leq/g, "\\le");
  text = text.replace(/\\geq/g, "\\ge");

  text = text.replace(/\n{3,}/g, "\n\n");
  return text.trim();
}

function renderMath(expression, displayMode = false) {
  try {
    return katex.renderToString(expression, {
      throwOnError: false,
      displayMode,
      strict: false,
    });
  } catch {
    return `<span class="math-error">${escapeHtml(expression)}</span>`;
  }
}

function renderTextWithInlineMathAndBold(line) {
  let source = line;
  const mathParts = [];

  source = source.replace(/\$([^$]+)\$/g, (_, math) => {
    const key = `@@MATH_${mathParts.length}@@`;
    mathParts.push(renderMath(math.trim(), false));
    return key;
  });

  let html = escapeHtml(source);

  html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*([^*]+)\*/g, "<em>$1</em>");

  mathParts.forEach((mathHtml, index) => {
    html = html.replace(`@@MATH_${index}@@`, mathHtml);
  });

  return html;
}

function simplePreview(rawLatex) {
  let normalized = normalizeLatex(rawLatex);
  const blockMathParts = [];

  normalized = normalized.replace(/\$\$([\s\S]*?)\$\$/g, (_, math) => {
    const key = `@@BLOCKMATH_${blockMathParts.length}@@`;
    blockMathParts.push(`<div class="math-block">${renderMath(math.trim(), true)}</div>`);
    return `\n${key}\n`;
  });

  const lines = normalized.split("\n");

  return lines
    .map((line) => {
      if (line === "---PAGE---") return `<div class="page-break"></div>`;

      const blockMatch = line.match(/^@@BLOCKMATH_(\d+)@@$/);
      if (blockMatch) return blockMathParts[Number(blockMatch[1])];

      if (line.startsWith("### ")) return `<h3>${renderTextWithInlineMathAndBold(line.slice(4))}</h3>`;
      if (line.startsWith("## ")) return `<h2>${renderTextWithInlineMathAndBold(line.slice(3))}</h2>`;
      if (line.startsWith("# ")) return `<h1>${renderTextWithInlineMathAndBold(line.slice(2))}</h1>`;

      if (line.trim().startsWith("•")) return `<p class="bullet">${renderTextWithInlineMathAndBold(line)}</p>`;
      if (!line.trim()) return "<br />";

      return `<p>${renderTextWithInlineMathAndBold(line)}</p>`;
    })
    .join("");
}

export default function App() {
  const [text, setText] = useState(() => localStorage.getItem(STORAGE_KEY) || STARTER);
  const [lastSaved, setLastSaved] = useState("Δεν έχει αποθηκευτεί ακόμη");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const textareaRef = useRef(null);

  const preview = useMemo(() => simplePreview(text), [text]);

  useEffect(() => {
    const timer = setTimeout(() => {
      localStorage.setItem(STORAGE_KEY, text);
      setLastSaved(`Αποθηκεύτηκε αυτόματα: ${new Date().toLocaleTimeString("el-GR")}`);
    }, 2000);

    return () => clearTimeout(timer);
  }, [text]);

  function insertSnippet(snippet, cursorOffset = null) {
  const textarea = textareaRef.current;

  if (!textarea) {
    setText((prev) => `${prev}${snippet}`);
    return;
  }

  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;

  // κρατάμε το scroll position
  const scrollTop = textarea.scrollTop;
  const scrollLeft = textarea.scrollLeft;

  const selectedText = text.slice(start, end);
  const before = text.slice(0, start);
  const after = text.slice(end);

  let finalSnippet = snippet;

  if (selectedText && snippet.includes("{}")) {
    finalSnippet = snippet.replace("{}", `{${selectedText}}`);
  }

  const nextText = `${before}${finalSnippet}${after}`;

  setText(nextText);

  requestAnimationFrame(() => {
    textarea.focus();

    let nextCursor;

    if (selectedText) {
      nextCursor = start + finalSnippet.length;
    } else if (cursorOffset !== null) {
      nextCursor = start + cursorOffset;
    } else {
      nextCursor = start + finalSnippet.length;
    }

    textarea.setSelectionRange(nextCursor, nextCursor);

    // επαναφορά scroll
    textarea.scrollTop = scrollTop;
    textarea.scrollLeft = scrollLeft;
  });
}

  function saveLocal() {
    localStorage.setItem(STORAGE_KEY, text);
    setLastSaved(`Αποθηκεύτηκε χειροκίνητα: ${new Date().toLocaleTimeString("el-GR")}`);
  }

  async function exportDocx() {
    try {
      const response = await fetch("http://localhost:3001/convert-docx", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ latex: text }),
      });

      if (!response.ok) throw new Error("Pandoc conversion failed");

      const blob = await response.blob();
      saveAs(blob, "KessarisMath-pandoc-export.docx");
    } catch (error) {
      alert("Δεν μπόρεσε να γίνει Word export με Pandoc. Έλεγξε ότι τρέχει ο server και ότι έχει εγκατασταθεί το Pandoc.");
      console.error(error);
    }
  }

  function exportTex() {
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    saveAs(blob, "KessarisMath-document.tex");
  }

  function exportPdf() {
    const printWindow = window.open("", "_blank", "width=900,height=700");
    if (!printWindow) return;

    printWindow.document.write(`
      <!doctype html>
      <html>
        <head>
          <title>KessarisMath PDF</title>
          <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css">
          <style>
            body { font-family: Arial, sans-serif; padding: 36px; color: #111827; line-height: 1.6; }
            h1 { font-size: 28px; margin-bottom: 20px; }
            h2 { font-size: 22px; margin-top: 24px; }
            h3 { font-size: 18px; margin-top: 20px; }
            .math-block { margin: 16px 0; text-align: center; }
            p { margin: 8px 0; }
            .page-break { page-break-before: always; }
            @page { margin: 18mm; }
          </style>
        </head>
        <body>${preview}</body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 300);
  }

  async function copyText() {
    await navigator.clipboard.writeText(text);
  }
function loadExamTemplate() {
  setText(`\\documentclass[12pt]{article}

\\usepackage[utf8]{inputenc}
\\usepackage[greek,english]{babel}
\\usepackage{alphabeta}
\\usepackage{amsmath,amssymb}
\\usepackage{geometry}
\\geometry{a4paper, margin=1in}

\\begin{document}

\\begin{center}
{\\Large \\textbf{Γραπτές προαγωγικές εξετάσεις περιόδου Μαΐου – Ιουνίου 2026}}

\\vspace{0.5cm}

στο μάθημα της \\underline{\\hspace{5cm}}

\\end{center}

\\vspace{1cm}

\\textbf{ΗΜΕΡΟΜΗΝΙΑ:} \\underline{\\hspace{3cm}}

\\vspace{0.3cm}

\\textbf{ΟΝΟΜΑΤΕΠΩΝΥΜΟ:} \\underline{\\hspace{8cm}}

\\vspace{0.3cm}

\\textbf{ΤΑΞΗ:} \\underline{\\hspace{2cm}} Λυκείου

\\vspace{0.3cm}

\\textbf{ΕΙΣΗΓΗΤΕΣ:}

\\vspace{0.3cm}

\\textbf{ΕΠΙΤΗΡΗΤΗΣ:} \\underline{\\hspace{6cm}}

\\vspace{1cm}

\\section*{ΘΕΜΑ Α}

\\textbf{Α1.} Να γράψετε το τετράδιό σας το νούμερο της πρότασης και δίπλα τη λέξη «Σωστό» αν η πρόταση είναι σωστή ή τη λέξη «Λάθος» αν η πρόταση είναι λανθασμένη.

\\hfill \\textbf{(Μονάδες __)}

\\vspace{0.5cm}

\\textbf{Α2.} Να αποδείξετε ότι:

\\hfill \\textbf{(Μονάδες __)}

\\vspace{1cm}

\\section*{ΘΕΜΑ Β}

\\textbf{Β1.}

\\vspace{1cm}

\\textbf{Β2.}

\\vspace{1cm}

\\textbf{Β3.}

\\newpage

\\section*{ΘΕΜΑ Γ}

\\textbf{Γ1.}

\\vspace{1cm}

\\textbf{Γ2.}

\\vspace{1cm}

\\textbf{Γ3.}

\\vspace{1cm}

\\section*{ΘΕΜΑ Δ}

\\textbf{Δ1.}

\\vspace{1cm}

\\textbf{Δ2.}

\\vspace{1cm}

\\textbf{Δ3.}

\\end{document}`);
}
  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <h1>KessarisMath</h1>
          <p>Πέτα κανονικό LaTeX αριστερά. Το preview εμφανίζεται αυτόματα και το Word export γίνεται με Pandoc.</p>
          <span className="save-status">{lastSaved}</span>
        </div>

        <div className="actions">
          <button onClick={saveLocal}><Save size={16} /> Αποθήκευση</button>
          <button onClick={copyText}><Copy size={16} /> Αντιγραφή</button>
          <button onClick={exportTex}><FileText size={16} /> .tex</button>
          <button onClick={exportPdf}><Printer size={16} /> PDF</button>
          <button className="primary" onClick={exportDocx}><Download size={16} /> Word</button>
        </div>
      </header>

      <section className="toolbar">
        <button onClick={() => insertSnippet('$\\frac{}{}$', 6)}><Sigma size={16} /> 𝑎⁄𝑏</button>
        <button onClick={() => insertSnippet('$\\sqrt{}$', 6)}>√x</button>
        <button onClick={() => insertSnippet('$^{2}$')}>x²</button>
        <button onClick={() => insertSnippet('$_{1}$')}>x₁</button>
        <button onClick={() => insertSnippet('$\\lim_{x\\to 0} $')}>lim</button>
        <button onClick={() => insertSnippet('$\\int_a^b f(x)\\,dx$')}>∫</button>
        <button onClick={() => insertSnippet('$f(x)=$')}>f(x)</button>
        <button onClick={() => insertSnippet('$\\le$')}>≤</button>
        <button onClick={() => insertSnippet('$\\ge$')}>≥</button>
        <button onClick={() => insertSnippet('$\\ne$')}>≠</button>
        <button onClick={() => insertSnippet('$\\Leftrightarrow$')}>⇔</button>
        <button onClick={() => insertSnippet('$\\infty$')}><InfinityIcon size={16} />∞</button>
        <button onClick={() => insertSnippet('$\\mathbb{R}$')}>ℝ</button>
        <button onClick={() => insertSnippet('$\\in$')}>∈</button>
        <button onClick={() => insertSnippet('$\\forall$')}>∀</button>
        <button onClick={() => insertSnippet('$\\Longrightarrow$')}>⟹</button>
        <button onClick={() => insertSnippet('$\\section*{Νέα ενότητα}$')}><Type size={16} /> Ενότητα</button>
        <button onClick={() => setIsFullscreen((value) => !value)}>
          {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          {isFullscreen ? " Κανονική προβολή" : " Fullscreen editor"}
        </button>
        <button className="danger" onClick={() => setText("")}><Trash2 size={16} /> Καθαρισμός</button>
      </section>

      <main className={isFullscreen ? "workspace fullscreen" : "workspace"}>
        <section className="panel">
          <div className="panel-title"><Type size={16} /> Κανονικό LaTeX</div>
          <textarea ref={textareaRef} value={text} onChange={(e) => setText(e.target.value)} spellCheck="false" />
        </section>

        {!isFullscreen && (
          <section className="panel">
            <div className="panel-title"><Eye size={16} /> Preview</div>
            <div className="preview" dangerouslySetInnerHTML={{ __html: preview }} />
          </section>
        )}
      </main>

      <div className="note">
        Το preview καθαρίζει αυτόματα το LaTeX για εμφάνιση. Το Word export γίνεται μέσω Pandoc server στο localhost:3001.
      </div>

      <style>{`
        * { box-sizing: border-box; }

        html, body, #root {
          height: 100%;
          margin: 0;
          width: 100%;
          max-width: none !important;
          padding: 0 !important;
          text-align: left !important;
        }

        body {
          font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, Helvetica, sans-serif;
          color: #111827;
          overflow: hidden;
          background:
            radial-gradient(circle at top left, rgba(33, 45, 205, 0.16), transparent 32%),
            radial-gradient(circle at top right, rgba(246, 236, 54, 0.25), transparent 28%),
            linear-gradient(135deg, #ffffff 0%, #f8fafc 44%, #eef2ff 100%);
        }

        .app-shell {
          height: 100vh;
          width: 100vw;
          padding: 18px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .topbar {
          flex: 0 0 auto;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 14px;
          padding: 10px 16px;
          border-radius: 22px;
          background: rgba(255, 255, 255, 0.68);
          border: 1px solid rgba(255, 255, 255, 0.7);
          box-shadow: 0 10px 28px rgba(15, 23, 42, 0.06);
          backdrop-filter: blur(18px);
        }

        .topbar h1 {
          margin: 0;
          font-size: 26px;
          line-height: 1;
          font-weight: 900;
          letter-spacing: -1px;
          color: #111827;
        }

        .topbar h1::after {
          content: "";
          display: inline-block;
          width: 8px;
          height: 8px;
          margin-left: 6px;
          border-radius: 999px;
          background: #cd0019;
          box-shadow: 12px 0 0 #f6ec36, 24px 0 0 #212dcd;
          transform: translateY(-2px);
        }

        .topbar p {
          margin: 3px 0 0;
          color: #475569;
          font-size: 12px;
          max-width: 520px;
        }

        .save-status {
          display: inline-block;
          margin-top: 4px;
          color: #64748b;
          font-size: 11px;
          padding: 3px 8px;
          border-radius: 999px;
          background: rgba(248, 250, 252, 0.9);
          border: 1px solid #e2e8f0;
        }

        .actions, .toolbar {
          display: flex;
          flex-wrap: wrap;
          gap: 9px;
        }

        button {
          border: 1px solid rgba(226, 232, 240, 0.9);
          background: rgba(255, 255, 255, 0.78);
          color: #0f172a;
          border-radius: 999px;
          padding: 9px 14px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 650;
          display: inline-flex;
          align-items: center;
          gap: 7px;
          transition: transform 0.15s ease, box-shadow 0.15s ease, background 0.15s ease, border-color 0.15s ease;
          box-shadow: 0 8px 22px rgba(15, 23, 42, 0.06);
          backdrop-filter: blur(14px);
        }

        button:hover {
          transform: translateY(-1px);
          background: rgba(255, 255, 255, 0.96);
          border-color: rgba(33, 45, 205, 0.25);
          box-shadow: 0 14px 30px rgba(15, 23, 42, 0.10);
        }

        button:active {
          transform: translateY(0);
          box-shadow: 0 6px 16px rgba(15, 23, 42, 0.08);
        }

        button.primary {
          background: linear-gradient(135deg, #212dcd 0%, #0f172a 100%);
          color: white;
          border-color: rgba(33, 45, 205, 0.65);
          box-shadow: 0 14px 32px rgba(33, 45, 205, 0.28);
        }

        button.primary:hover {
          background: linear-gradient(135deg, #1b25aa 0%, #111827 100%);
          box-shadow: 0 18px 38px rgba(33, 45, 205, 0.34);
        }

        button.danger {
          background: rgba(255, 255, 255, 0.84);
          border-color: rgba(205, 0, 25, 0.28);
          color: #cd0019;
        }

        button.danger:hover {
          background: rgba(205, 0, 25, 0.08);
          border-color: rgba(205, 0, 25, 0.42);
        }

        .toolbar {
          flex: 0 0 auto;
          padding: 13px;
          border-radius: 24px;
          background: rgba(255, 255, 255, 0.70);
          border: 1px solid rgba(255, 255, 255, 0.78);
          box-shadow: 0 18px 45px rgba(15, 23, 42, 0.08);
          backdrop-filter: blur(18px);
        }

        .workspace {
          flex: 1 1 auto;
          min-height: 0;
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
          gap: 14px;
        }

        .workspace.fullscreen {
          grid-template-columns: 1fr;
        }

        .panel {
          min-height: 0;
          background: rgba(255, 255, 255, 0.78);
          border: 1px solid rgba(255, 255, 255, 0.82);
          border-radius: 28px;
          overflow: hidden;
          box-shadow: 0 22px 55px rgba(15, 23, 42, 0.10);
          display: flex;
          flex-direction: column;
          backdrop-filter: blur(20px);
        }

        .panel-title {
          flex: 0 0 auto;
          padding: 14px 18px;
          border-bottom: 1px solid rgba(226, 232, 240, 0.85);
          font-weight: 800;
          display: flex;
          align-items: center;
          gap: 8px;
          background: rgba(255, 255, 255, 0.72);
          color: #111827;
        }

        textarea {
          flex: 1 1 auto;
          width: 100%;
          min-height: 0;
          border: none;
          outline: none;
          resize: none;
          padding: 20px;
          font-family: Consolas, "SFMono-Regular", "Courier New", monospace;
          font-size: 14px;
          line-height: 1.65;
          overflow: auto;
          background: rgba(255, 255, 255, 0.60);
          color: #0f172a;
        }

        textarea::selection {
          background: rgba(33, 45, 205, 0.18);
        }

        .preview {
          flex: 1 1 auto;
          min-height: 0;
          padding: 28px;
          line-height: 1.75;
          font-size: 16px;
          overflow: auto;
          background: rgba(255, 255, 255, 0.62);
        }

        .preview h1 {
          font-size: 31px;
          margin: 0 0 24px;
          text-align: center;
          letter-spacing: -0.5px;
          color: #111827;
        }

        .preview h2 {
          font-size: 23px;
          margin: 22px 0 10px;
          color: #212dcd;
        }

        .preview h3 {
          font-size: 19px;
          margin: 18px 0 8px;
          color: #111827;
        }

        .preview p {
          margin: 9px 0;
        }

        .preview .bullet {
          padding-left: 16px;
        }

        .math-block {
          margin: 18px 0;
          padding: 18px;
          text-align: center;
          background: rgba(248, 250, 252, 0.88);
          border: 1px solid rgba(226, 232, 240, 0.95);
          border-radius: 22px;
          overflow-x: auto;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.85), 0 12px 26px rgba(15, 23, 42, 0.04);
        }

        .math-inline {
          background: rgba(248, 250, 252, 0.85);
          padding: 2px 6px;
          border-radius: 8px;
        }

        .math-error {
          color: #cd0019;
          font-family: Consolas, monospace;
        }

        .page-break {
          height: 1px;
          border-top: 2px dashed #cbd5e1;
          margin: 20px 0;
        }

        .note {
          flex: 0 0 auto;
          background: rgba(255, 251, 235, 0.82);
          border: 1px solid rgba(246, 236, 54, 0.65);
          color: #92400e;
          padding: 11px 15px;
          border-radius: 20px;
          font-size: 13px;
          line-height: 1.4;
          box-shadow: 0 12px 28px rgba(15, 23, 42, 0.05);
          backdrop-filter: blur(14px);
        }

        ::-webkit-scrollbar {
          width: 10px;
          height: 10px;
        }

        ::-webkit-scrollbar-track {
          background: transparent;
        }

        ::-webkit-scrollbar-thumb {
          background: rgba(148, 163, 184, 0.65);
          border-radius: 999px;
          border: 2px solid rgba(255, 255, 255, 0.75);
        }

        ::-webkit-scrollbar-thumb:hover {
          background: rgba(100, 116, 139, 0.75);
        }

        @media (max-width: 900px) {
          body { overflow: auto; }
          .app-shell { height: auto; min-height: 100vh; }
          .topbar { flex-direction: column; }
          .workspace { grid-template-columns: 1fr; height: 1100px; }
          .topbar h1 { font-size: 30px; }
        }
      `}</style>
    </div>
  );
}
