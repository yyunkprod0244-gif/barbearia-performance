/**
 * Substitui a fonte de ícones do Bootstrap Icons (CSS de ~98 KB + fonte de ~130 KB
 * com ~2.000 ícones) por um sprite SVG embutido no HTML só com os ícones usados.
 *
 * Lê os ícones referenciados como <use href="#bi-NOME"> em src/index.html e
 * src/js/script.js, monta os <symbol> a partir de node_modules/bootstrap-icons
 * e grava o sprite entre os marcadores <!-- ICONES:INICIO --> e <!-- ICONES:FIM -->.
 *
 * Uso: npm run icones
 */
import { readFile, writeFile } from 'node:fs/promises';

const HTML = 'src/index.html';
const JS = 'src/js/script.js';
const PASTA_ICONES = 'node_modules/bootstrap-icons/icons';

const html = await readFile(HTML, 'utf8');
const js = await readFile(JS, 'utf8');

const usados = new Set();
for (const texto of [html, js]) {
  for (const m of texto.matchAll(/#bi-([a-z0-9-]+)/g)) usados.add(m[1]);
}

const simbolos = [];
for (const nome of [...usados].sort()) {
  const svg = await readFile(`${PASTA_ICONES}/${nome}.svg`, 'utf8');
  const viewBox = svg.match(/viewBox="([^"]+)"/)[1];
  const conteudo = svg
    .replace(/^[\s\S]*?<svg[^>]*>/, '')
    .replace(/<\/svg>\s*$/, '')
    .replace(/\s+/g, ' ')
    .trim();
  simbolos.push(`<symbol id="bi-${nome}" viewBox="${viewBox}">${conteudo}</symbol>`);
}

const sprite =
  '<!-- ICONES:INICIO (gerado por scripts/gerar-icones.mjs) -->\n' +
  '  <svg xmlns="http://www.w3.org/2000/svg" style="display:none">\n    ' +
  simbolos.join('\n    ') +
  '\n  </svg>\n  <!-- ICONES:FIM -->';

const novo = html.replace(/<!-- ICONES:INICIO[\s\S]*?ICONES:FIM -->/, sprite);
if (novo === html && !html.includes('ICONES:INICIO')) {
  throw new Error('Marcadores <!-- ICONES:INICIO --> / <!-- ICONES:FIM --> não encontrados em ' + HTML);
}
await writeFile(HTML, novo);
console.log(`${usados.size} ícones embutidos: ${[...usados].sort().join(', ')}`);
