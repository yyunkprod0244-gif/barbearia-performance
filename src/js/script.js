/* =========================================================
   Estilo Livre - Barbearia | JavaScript
   ---------------------------------------------------------
   Antes: bootstrap.bundle.min.js (~80 KB, com Popper) só para
   o menu colapsável e o carrossel. Agora esses dois componentes
   são implementados aqui, reaproveitando as classes CSS do
   Bootstrap (collapse/collapsing/show e carousel-item-*).
   ========================================================= */

const CHAVE_TEMA = 'tema-estilo-livre';
const html = document.documentElement;
const btnTema = document.getElementById('btnTema');
const iconeTema = document.getElementById('iconeTema');
const textoTema = document.getElementById('textoTema');

/* Lê a duração da transição CSS de um elemento (em ms). */
function duracaoTransicao(el) {
  const { transitionDuration, transitionDelay } = getComputedStyle(el);
  const ms = (v) => (parseFloat(v) || 0) * (v.includes('ms') ? 1 : 1000);
  return ms(transitionDuration.split(',')[0]) + ms(transitionDelay.split(',')[0]);
}

/* Executa a função ao fim da transição (com fallback se ela não disparar). */
function aoTerminarTransicao(el, fn) {
  let feito = false;
  const concluir = () => {
    if (feito) return;
    feito = true;
    el.removeEventListener('transitionend', concluir);
    fn();
  };
  el.addEventListener('transitionend', concluir);
  setTimeout(concluir, duracaoTransicao(el) + 50);
}

/* ---------- Tema: branco <-> roxo ---------- */
function aplicarTema(tema) {
  html.setAttribute('data-theme', tema);
  // Faz os componentes do Bootstrap acompanharem o tema
  html.setAttribute('data-bs-theme', tema === 'purple' ? 'dark' : 'light');

  const roxo = tema === 'purple';
  iconeTema.querySelector('use').setAttribute('href', roxo ? '#bi-sun-fill' : '#bi-moon-stars-fill');
  textoTema.textContent = roxo ? 'Tema branco' : 'Tema roxo';

  try { localStorage.setItem(CHAVE_TEMA, tema); } catch (e) {}
}

// Tema inicial (já aplicado no <head>; aqui só sincroniza o botão)
aplicarTema(html.getAttribute('data-theme') || 'light');

btnTema.addEventListener('click', () => {
  const atual = html.getAttribute('data-theme');
  aplicarTema(atual === 'purple' ? 'light' : 'purple');
});

/* ---------- Menu mobile (substitui o Collapse do Bootstrap) ---------- */
const menu = document.getElementById('menuPrincipal');
const btnMenu = document.querySelector('[data-bs-target="#menuPrincipal"]');
let menuAnimando = false;

function abrirMenu() {
  if (menuAnimando || menu.classList.contains('show')) return;
  menuAnimando = true;
  menu.classList.remove('collapse');
  menu.classList.add('collapsing');
  menu.style.height = '0px';
  btnMenu.setAttribute('aria-expanded', 'true');
  void menu.offsetHeight; // força reflow com altura 0 antes de animar
  menu.style.height = menu.scrollHeight + 'px';
  aoTerminarTransicao(menu, () => {
    menu.classList.remove('collapsing');
    menu.classList.add('collapse', 'show');
    menu.style.height = '';
    menuAnimando = false;
  });
}

function fecharMenu() {
  if (menuAnimando || !menu.classList.contains('show')) return;
  menuAnimando = true;
  menu.style.height = menu.getBoundingClientRect().height + 'px';
  void menu.offsetHeight; // força reflow antes de animar
  menu.classList.add('collapsing');
  menu.classList.remove('collapse', 'show');
  btnMenu.setAttribute('aria-expanded', 'false');
  menu.style.height = '';
  aoTerminarTransicao(menu, () => {
    menu.classList.remove('collapsing');
    menu.classList.add('collapse');
    menuAnimando = false;
  });
}

btnMenu.addEventListener('click', () => {
  menu.classList.contains('show') ? fecharMenu() : abrirMenu();
});

// Fecha o menu mobile ao clicar em um link
document.querySelectorAll('.navbar-nav .nav-link').forEach((link) => {
  link.addEventListener('click', fecharMenu);
});

/* ---------- Navbar: sombra ao rolar + botão topo ---------- */
const navbar = document.querySelector('.navbar-glass');
const btnTopo = document.getElementById('btnTopo');
let rolagemAgendada = false;

// Listener passivo + requestAnimationFrame: no máximo 1 atualização por quadro
window.addEventListener('scroll', () => {
  if (rolagemAgendada) return;
  rolagemAgendada = true;
  requestAnimationFrame(() => {
    const y = window.scrollY;
    navbar.classList.toggle('scrolled', y > 20);
    btnTopo.classList.toggle('show', y > 400);
    rolagemAgendada = false;
  });
}, { passive: true });

btnTopo.addEventListener('click', () => {
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

/* ---------- Carrossel de depoimentos (substitui o Carousel do Bootstrap) ---------- */
function criarCarrossel(raiz) {
  const itens = [...raiz.querySelectorAll('.carousel-item')];
  const indicadores = [...raiz.querySelectorAll('.carousel-indicators [data-bs-slide-to]')];
  const intervalo = Number(raiz.dataset.bsInterval) || 5000;
  let atual = itens.findIndex((i) => i.classList.contains('active'));
  let deslizando = false;
  let timer = null;

  function irPara(destino, direcao) {
    if (deslizando || destino === atual) return;
    const ativo = itens[atual];
    const proximo = itens[destino];
    const paraFrente = direcao ? direcao === 'next' : destino > atual;
    const classeOrdem = paraFrente ? 'carousel-item-next' : 'carousel-item-prev';
    const classeDirecao = paraFrente ? 'carousel-item-start' : 'carousel-item-end';

    deslizando = true;
    proximo.classList.add(classeOrdem);
    void proximo.offsetHeight; // reflow para a transição começar do lugar certo
    ativo.classList.add(classeDirecao);
    proximo.classList.add(classeDirecao);

    indicadores.forEach((ind, i) => {
      ind.classList.toggle('active', i === destino);
      if (i === destino) ind.setAttribute('aria-current', 'true');
      else ind.removeAttribute('aria-current');
    });

    aoTerminarTransicao(ativo, () => {
      proximo.classList.remove(classeOrdem, classeDirecao);
      proximo.classList.add('active');
      ativo.classList.remove('active', classeDirecao);
      atual = destino;
      deslizando = false;
    });
  }

  const proximo = () => irPara((atual + 1) % itens.length, 'next');
  const anterior = () => irPara((atual - 1 + itens.length) % itens.length, 'prev');

  const pausar = () => { clearInterval(timer); timer = null; };
  const iniciar = () => {
    pausar();
    if (!document.hidden) timer = setInterval(proximo, intervalo);
  };

  raiz.querySelector('[data-bs-slide="next"]').addEventListener('click', () => { proximo(); iniciar(); });
  raiz.querySelector('[data-bs-slide="prev"]').addEventListener('click', () => { anterior(); iniciar(); });
  indicadores.forEach((ind, i) => ind.addEventListener('click', () => { irPara(i); iniciar(); }));

  // Pausa com o mouse em cima e quando a aba não está visível
  raiz.addEventListener('mouseenter', pausar);
  raiz.addEventListener('mouseleave', iniciar);
  document.addEventListener('visibilitychange', () => (document.hidden ? pausar() : iniciar()));

  // Teclado e gesto de deslizar no celular
  raiz.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') { proximo(); iniciar(); }
    if (e.key === 'ArrowLeft') { anterior(); iniciar(); }
  });
  let toqueX = null;
  raiz.addEventListener('touchstart', (e) => { toqueX = e.touches[0].clientX; }, { passive: true });
  raiz.addEventListener('touchend', (e) => {
    if (toqueX === null) return;
    const dx = e.changedTouches[0].clientX - toqueX;
    if (Math.abs(dx) > 40) { (dx < 0 ? proximo : anterior)(); iniciar(); }
    toqueX = null;
  }, { passive: true });

  // Só começa a girar quando o carrossel aparece na tela
  new IntersectionObserver(([entrada], obs) => {
    if (entrada.isIntersecting) { iniciar(); obs.disconnect(); }
  }).observe(raiz);
}

const carrossel = document.getElementById('carrosselDepoimentos');
if (carrossel) criarCarrossel(carrossel);

/* ---------- Link ativo conforme a seção visível ---------- */
const secoes = document.querySelectorAll('main section[id]');
const linksMenu = document.querySelectorAll('.navbar-nav .nav-link');

const observadorSecoes = new IntersectionObserver((entradas) => {
  entradas.forEach((entrada) => {
    if (entrada.isIntersecting) {
      linksMenu.forEach((l) =>
        l.classList.toggle('active', l.getAttribute('href') === '#' + entrada.target.id)
      );
    }
  });
}, { rootMargin: '-45% 0px -50% 0px' });

secoes.forEach((s) => observadorSecoes.observe(s));

/* ---------- Animação de entrada (scroll reveal) ---------- */
const elementosReveal = document.querySelectorAll(
  '.service-card, .testimonial, .contact-info, .contact-form, .section-title'
);

const observadorReveal = new IntersectionObserver((entradas) => {
  entradas.forEach((entrada) => {
    if (entrada.isIntersecting) {
      entrada.target.classList.add('visible');
      observadorReveal.unobserve(entrada.target);
    }
  });
}, { threshold: 0.15 });

elementosReveal.forEach((el) => {
  el.classList.add('reveal');
  observadorReveal.observe(el);
});

/* ---------- Formulário de contato (sem backend) ---------- */
const form = document.getElementById('formContato');
const alertaSucesso = document.getElementById('alertaSucesso');

form.addEventListener('submit', (evento) => {
  evento.preventDefault();
  evento.stopPropagation();

  if (!form.checkValidity()) {
    form.classList.add('was-validated');
    alertaSucesso.classList.add('d-none');
    return;
  }

  // Simulação de envio: não há integração real
  alertaSucesso.classList.remove('d-none');
  form.reset();
  form.classList.remove('was-validated');

  setTimeout(() => alertaSucesso.classList.add('d-none'), 6000);
});
