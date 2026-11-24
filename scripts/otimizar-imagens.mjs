/**
 * Otimiza as imagens originais (antes/img) e gera versões
 * redimensionadas em AVIF e WebP dentro de src/img.
 *
 * Cada imagem é gerada no tamanho em que realmente aparece na tela
 * (com 2x para telas de alta densidade), em vez de usar o arquivo cheio.
 *
 * Uso: npm run imagens
 */
import sharp from 'sharp';
import { mkdir, readdir, rm, stat } from 'node:fs/promises';
import path from 'node:path';

const ORIGEM = 'antes/img';
const DESTINO = 'src/img';

// largura/altura = recorte final (fit: cover). larguras = variações para srcset.
const IMAGENS = {
  // Hero (só aparece no desktop): exibida ~530x460, origem 600x338 -> mantém 600 de largura
  home:       { larguras: [600] },
  // Sobre: até ~636x400 no desktop, ~100vw no mobile
  sobre:      { larguras: [400, 612] },
  // Cards de serviço: faixa de 180px de altura, recorte central em 16:10
  corte:      { larguras: [320, 640], proporcao: 16 / 10 },
  barba:      { larguras: [320, 640], proporcao: 16 / 10 },
  combo:      { larguras: [320, 525], proporcao: 16 / 10 },
  hidratacao: { larguras: [320, 612], proporcao: 16 / 10 },
  // Avatares: exibidos em 70x70 -> 140x140 (2x)
  cliente1:   { larguras: [140], proporcao: 1 },
  cliente2:   { larguras: [140], proporcao: 1 },
  cliente3:   { larguras: [140], proporcao: 1 },
};

const kb = (b) => (b / 1024).toFixed(1) + ' KB';

await rm(DESTINO, { recursive: true, force: true });
await mkdir(DESTINO, { recursive: true });

const arquivos = await readdir(ORIGEM);
let totalAntes = 0;
let totalAvif = 0;
let totalWebp = 0;

for (const [nome, cfg] of Object.entries(IMAGENS)) {
  const arquivo = arquivos.find((a) => path.parse(a).name === nome);
  const entrada = path.join(ORIGEM, arquivo);
  const original = await stat(entrada);
  totalAntes += original.size;

  for (const largura of cfg.larguras) {
    let pipeline = sharp(entrada);
    if (cfg.proporcao) {
      const altura = Math.round(largura / cfg.proporcao);
      pipeline = pipeline.resize(largura, altura, { fit: 'cover', position: 'centre' });
    } else {
      pipeline = pipeline.resize({ width: largura, withoutEnlargement: true });
    }

    const base = path.join(DESTINO, `${nome}-${largura}`);
    const avif = await pipeline.clone().avif({ quality: 50, effort: 6 }).toFile(`${base}.avif`);
    const webp = await pipeline.clone().webp({ quality: 72, effort: 6 }).toFile(`${base}.webp`);

    // só a maior variação entra no total "exibido" (a que o navegador mobile baixa)
    if (largura === Math.max(...cfg.larguras)) {
      totalAvif += avif.size;
      totalWebp += webp.size;
    }
    console.log(
      `${nome.padEnd(11)} ${String(largura).padStart(4)}px  ${avif.width}x${avif.height}  ` +
        `avif ${kb(avif.size).padStart(8)}  webp ${kb(webp.size).padStart(8)}`
    );
  }
}

console.log('\nOriginais (webp sem redimensionar): ' + kb(totalAntes));
console.log('Otimizadas (maior variação, AVIF): ' + kb(totalAvif));
console.log('Otimizadas (maior variação, WebP): ' + kb(totalWebp));
