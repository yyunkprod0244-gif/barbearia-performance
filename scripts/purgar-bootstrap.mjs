/**
 * Gera src/css/bootstrap-enxuto.css: o Bootstrap 5.3.3 apenas com as regras
 * que a página realmente usa (mesma ideia do PurgeCSS, sem dependências).
 *
 * 1. Lê as classes e tags usadas em src/index.html (+ classes que o JS adiciona).
 * 2. Mantém só os seletores cujas classes e tags existem na página.
 * 3. Remove variáveis CSS (--bs-*) e @keyframes que ninguém referencia.
 *
 * Uso: npm run bootstrap
 */
import { readFile, writeFile } from 'node:fs/promises';

const ENTRADA = 'node_modules/bootstrap/dist/css/bootstrap.min.css';
const SAIDA = 'src/css/bootstrap-enxuto.css';
const HTML = 'src/index.html';
const CSS_PROJETO = 'src/css/style.css';

// Classes adicionadas/removidas pelo JavaScript (não aparecem no HTML estático)
const CLASSES_DO_JS = [
  'show', 'collapse', 'collapsing', 'active', 'scrolled', 'visible', 'reveal',
  'was-validated', 'd-none',
  'carousel-item-next', 'carousel-item-prev', 'carousel-item-start', 'carousel-item-end',
];

/* ------------------------------------------------------------------ */
/* Classes e tags usadas                                               */
/* ------------------------------------------------------------------ */
const html = await readFile(HTML, 'utf8');
const cssProjeto = await readFile(CSS_PROJETO, 'utf8');

const classesUsadas = new Set(CLASSES_DO_JS);
for (const m of html.matchAll(/class="([^"]*)"/g)) {
  m[1].split(/\s+/).filter(Boolean).forEach((c) => classesUsadas.add(c));
}
const tagsUsadas = new Set(['html', 'body']);
for (const m of html.matchAll(/<([a-zA-Z][a-zA-Z0-9]*)[\s>/]/g)) tagsUsadas.add(m[1].toLowerCase());

/* ------------------------------------------------------------------ */
/* Parser mínimo de CSS (suficiente para o bootstrap.min.css)          */
/* ------------------------------------------------------------------ */
const AT_COM_FILHOS = new Set(['media', 'supports', 'container', 'layer']);

function lerAte(css, i, paradas) {
  // avança até um caractere de parada fora de strings/comentários/parênteses
  let prof = 0;
  while (i < css.length) {
    const c = css[i];
    if (c === '"' || c === "'") {
      i = css.indexOf(c, i + 1) + 1;
      continue;
    }
    if (c === '/' && css[i + 1] === '*') {
      i = css.indexOf('*/', i + 2) + 2;
      continue;
    }
    if (c === '(') prof++;
    else if (c === ')') prof--;
    else if (prof === 0 && paradas.includes(c)) return i;
    i++;
  }
  return i;
}

function parse(css, i = 0) {
  const nos = [];
  while (i < css.length) {
    while (i < css.length && /\s/.test(css[i])) i++;
    if (i >= css.length || css[i] === '}') return [nos, i + 1];
    if (css.startsWith('/*', i)) {
      i = css.indexOf('*/', i + 2) + 2;
      continue;
    }
    const fim = lerAte(css, i, '{;}');
    const prelude = css.slice(i, fim).trim();
    if (css[fim] === ';') {
      nos.push({ tipo: 'instrucao', texto: prelude + ';' });
      i = fim + 1;
      continue;
    }
    if (prelude.startsWith('@')) {
      const nome = prelude.slice(1).split(/[\s(]/)[0];
      if (AT_COM_FILHOS.has(nome)) {
        const [filhos, prox] = parse(css, fim + 1);
        nos.push({ tipo: 'at', prelude, filhos });
        i = prox;
        continue;
      }
      // @keyframes, @font-face...: guarda o bloco inteiro como texto
      let prof = 0;
      let j = fim;
      do {
        j = lerAte(css, j, '{}');
        prof += css[j] === '{' ? 1 : -1;
        j++;
      } while (prof > 0 && j < css.length);
      nos.push({ tipo: 'bloco', nome, prelude, corpo: css.slice(fim + 1, j - 1) });
      i = j;
      continue;
    }
    const fecha = lerAte(css, fim + 1, '}');
    nos.push({ tipo: 'regra', seletor: prelude, decls: css.slice(fim + 1, fecha) });
    i = fecha + 1;
  }
  return [nos, i];
}

function dividirTopo(texto, sep) {
  const partes = [];
  let ini = 0;
  let i = 0;
  while (i <= texto.length) {
    const j = lerAte(texto, i, sep + '[');
    if (texto[j] === '[') {
      i = texto.indexOf(']', j) + 1;
      continue;
    }
    partes.push(texto.slice(ini, j));
    ini = i = j + 1;
  }
  return partes.map((p) => p.trim()).filter(Boolean);
}

/* ------------------------------------------------------------------ */
/* Seletor é usado?                                                     */
/* ------------------------------------------------------------------ */
function seletorUsado(sel) {
  let s = sel
    .replace(/"[^"]*"|'[^']*'/g, '""')
    .replace(/\[[^\]]*\]/g, '') // atributos: mantém
    .replace(/:(not|is|where|has)\((?:[^()]|\([^()]*\))*\)/g, ''); // conteúdo opcional
  s = s.replace(/::?[a-zA-Z-]+(\((?:[^()]|\([^()]*\))*\))?/g, ''); // pseudo-classes/elementos

  for (const m of s.matchAll(/\.((?:\\.|[\w-])+)/g)) {
    const classe = m[1].replace(/\\/g, '');
    if (!classesUsadas.has(classe)) return false;
  }
  for (const composto of s.split(/[\s>+~]+/)) {
    const tag = composto.match(/^([a-zA-Z][a-zA-Z0-9]*)/);
    if (tag && !tagsUsadas.has(tag[1].toLowerCase())) return false;
  }
  return true;
}

function filtrar(nos) {
  const saida = [];
  for (const no of nos) {
    if (no.tipo === 'regra') {
      const seletores = dividirTopo(no.seletor, ',').filter(seletorUsado);
      if (seletores.length) saida.push({ ...no, seletor: seletores.join(',') });
    } else if (no.tipo === 'at') {
      const filhos = filtrar(no.filhos);
      if (filhos.length) saida.push({ ...no, filhos });
    } else {
      saida.push(no);
    }
  }
  return saida;
}

/* ------------------------------------------------------------------ */
/* Remove variáveis --bs-* e @keyframes sem uso                         */
/* ------------------------------------------------------------------ */
function cadaRegra(nos, fn) {
  for (const no of nos) {
    if (no.tipo === 'regra') fn(no);
    else if (no.tipo === 'at') cadaRegra(no.filhos, fn);
  }
}

function limparVariaveis(nos) {
  for (let rodada = 0; rodada < 10; rodada++) {
    const referenciadas = new Set();
    const coletar = (t) => { for (const m of t.matchAll(/var\(\s*(--[\w-]+)/g)) referenciadas.add(m[1]); };
    coletar(cssProjeto);
    cadaRegra(nos, (r) => coletar(r.decls));
    nos.forEach((n) => n.tipo === 'bloco' && coletar(n.corpo));

    let removeu = false;
    cadaRegra(nos, (r) => {
      const decls = dividirTopo(r.decls, ';');
      const mantidas = decls.filter((d) => {
        const nome = d.match(/^(--[\w-]+)\s*:/);
        return !nome || referenciadas.has(nome[1]);
      });
      if (mantidas.length !== decls.length) removeu = true;
      r.decls = mantidas.join(';');
    });
    if (!removeu) break;
  }
}

function semRegrasVazias(nos) {
  return nos
    .map((n) => (n.tipo === 'at' ? { ...n, filhos: semRegrasVazias(n.filhos) } : n))
    .filter((n) => (n.tipo === 'regra' ? n.decls.trim() : n.tipo === 'at' ? n.filhos.length : true));
}

function limparKeyframes(nos) {
  const animacoes = new Set();
  const coletar = (t) => {
    for (const m of t.matchAll(/animation(?:-name)?\s*:\s*([^;]+)/g)) {
      m[1].split(/[\s,]+/).forEach((p) => animacoes.add(p));
    }
  };
  cadaRegra(nos, (r) => coletar(r.decls));
  coletar(cssProjeto);
  const filtrarNos = (lista) =>
    lista
      .filter((n) => !(n.tipo === 'bloco' && n.nome === 'keyframes' && !animacoes.has(n.prelude.split(/\s+/)[1])))
      .map((n) => (n.tipo === 'at' ? { ...n, filhos: filtrarNos(n.filhos) } : n));
  return filtrarNos(nos);
}

/* ------------------------------------------------------------------ */
/* Serialização                                                         */
/* ------------------------------------------------------------------ */
function serializar(nos, nivel = 0) {
  const pad = '  '.repeat(nivel);
  return nos
    .map((n) => {
      if (n.tipo === 'instrucao') return pad + n.texto;
      if (n.tipo === 'bloco') return `${pad}${n.prelude}{${n.corpo}}`;
      if (n.tipo === 'at') return `${pad}${n.prelude} {\n${serializar(n.filhos, nivel + 1)}\n${pad}}`;
      return `${pad}${n.seletor} { ${n.decls} }`;
    })
    .join('\n');
}

const original = await readFile(ENTRADA, 'utf8');
const [arvore] = parse(original.replace(/\/\*# sourceMappingURL=.*?\*\//, ''));
let resultado = filtrar(arvore);
limparVariaveis(resultado);
resultado = semRegrasVazias(resultado);
resultado = limparKeyframes(resultado);

const cabecalho =
  '/*!\n * Bootstrap v5.3.3 (https://getbootstrap.com/) - versão enxuta\n' +
  ' * Copyright 2011-2024 The Bootstrap Authors - Licensed under MIT\n' +
  ' * Gerado por scripts/purgar-bootstrap.mjs: apenas as regras usadas por src/index.html\n */\n';
const css = cabecalho + serializar(resultado) + '\n';
await writeFile(SAIDA, css);

const kb = (n) => (n / 1024).toFixed(1) + ' KB';
console.log(`Bootstrap original: ${kb(original.length)}  ->  enxuto: ${kb(css.length)}`);
