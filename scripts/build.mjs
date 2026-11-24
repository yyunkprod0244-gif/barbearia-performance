/**
 * Build de produção: src/ -> dist/
 *
 * - CSS: junta bootstrap-enxuto.css + style.css, minifica com esbuild e
 *   embute no <head> (elimina a requisição de CSS que bloqueava a renderização).
 * - JS: minifica js/script.js (carregado com defer) e o script inline de tema.
 * - HTML: remove comentários e espaços desnecessários.
 * - Copia imagens e fontes já otimizadas.
 *
 * Uso: npm run build
 */
import { transform } from 'esbuild';
import { cp, mkdir, readFile, rm, writeFile, readdir, stat } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import path from 'node:path';

const SRC = 'src';
const DIST = 'dist';

const kb = (n) => (n / 1024).toFixed(1).padStart(6) + ' KB';
const relatorio = [];

await rm(DIST, { recursive: true, force: true });
await mkdir(path.join(DIST, 'js'), { recursive: true });

let html = await readFile(path.join(SRC, 'index.html'), 'utf8');

/* ---------- CSS: concatena, minifica e embute ---------- */
const links = [...html.matchAll(/<link href="([^"]+\.css)" rel="stylesheet" data-inline>\s*/g)];
let cssBruto = '';
for (const [, href] of links) {
  const conteudo = await readFile(path.join(SRC, href), 'utf8');
  // caminhos relativos a css/ passam a ser relativos à raiz (o CSS vai para o HTML)
  cssBruto += conteudo.replace(/url\((["']?)\.\.\//g, 'url($1') + '\n';
}
const { code: cssMin } = await transform(cssBruto, {
  loader: 'css',
  minify: true,
  legalComments: 'none',
  target: ['chrome100', 'firefox100', 'safari15', 'edge100'],
});
relatorio.push(['CSS (bootstrap-enxuto + style)', cssBruto.length, cssMin.length]);

links.forEach(([tag], i) => {
  html = html.replace(tag, i === 0 ? `<style>${cssMin.trim()}</style>\n` : '');
});

/* ---------- JS ---------- */
const jsBruto = await readFile(path.join(SRC, 'js/script.js'), 'utf8');
const { code: jsMin } = await transform(jsBruto, { loader: 'js', minify: true, target: 'es2019' });
await writeFile(path.join(DIST, 'js/script.js'), jsMin);
relatorio.push(['js/script.js', jsBruto.length, jsMin.length]);

// scripts inline (aplicação do tema antes da renderização)
const inlines = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
for (const [tag, codigo] of inlines) {
  const { code } = await transform(codigo, { loader: 'js', minify: true, target: 'es2019' });
  html = html.replace(tag, `<script>${code.trim()}</script>`);
}

/* ---------- HTML ---------- */
const htmlBruto = html;
const reservados = [];
html = html.replace(/<(script|style)\b[\s\S]*?<\/\1>/g, (m) => {
  reservados.push(m);
  return `\u0000${reservados.length - 1}\u0000`;
});

const BLOCOS =
  'html|head|body|meta|link|title|nav|div|section|main|footer|header|ul|ol|li|form|' +
  'h[1-6]|p|source|symbol|path|circle|picture';

html = html
  .replace(/<!--[\s\S]*?-->/g, '') // comentários
  .replace(/\s+/g, ' ') // colapsa espaços
  .replace(new RegExp(`\\s*(</?(?:${BLOCOS})\\b[^>]*>)\\s*`, 'g'), '$1') // espaços junto a blocos
  .replace(/\s*(\u0000\d+\u0000)\s*/g, '$1')
  .replace(/^\s+|\s+$/g, '');

html = html.replace(/\u0000(\d+)\u0000/g, (_, i) => reservados[i]);
await writeFile(path.join(DIST, 'index.html'), html);
// o tamanho "bruto" do HTML não inclui o CSS embutido, para comparar só a marcação
relatorio.unshift(['index.html (com CSS embutido)', htmlBruto.length, html.length]);

/* ---------- Imagens e fontes ---------- */
await cp(path.join(SRC, 'img'), path.join(DIST, 'img'), { recursive: true });
await cp(path.join(SRC, 'fonts'), path.join(DIST, 'fonts'), { recursive: true });

/* ---------- Resumo ---------- */
console.log('Arquivo                              original   minificado   gzip');
for (const [nome, antes, depois] of relatorio) {
  const final = nome.startsWith('js') ? jsMin : nome.startsWith('index') ? html : cssMin;
  console.log(`${nome.padEnd(34)} ${kb(antes)}   ${kb(depois)}   ${kb(gzipSync(final).length)}`);
}

let total = 0;
async function somar(dir) {
  for (const nome of await readdir(dir)) {
    const p = path.join(dir, nome);
    const s = await stat(p);
    if (s.isDirectory()) await somar(p);
    else total += s.size;
  }
}
await somar(DIST);
console.log(`\nTamanho total de dist/: ${kb(total)} (inclui todas as variações de imagem)`);
