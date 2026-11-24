/* =========================================================
   Estilo Livre - Barbearia | JavaScript
   ========================================================= */

const CHAVE_TEMA = 'tema-estilo-livre';
const html = document.documentElement;
const btnTema = document.getElementById('btnTema');
const iconeTema = document.getElementById('iconeTema');
const textoTema = document.getElementById('textoTema');

/* ---------- Tema: branco <-> roxo ---------- */
function aplicarTema(tema) {
  html.setAttribute('data-theme', tema);
  // Faz os componentes do Bootstrap acompanharem o tema
  html.setAttribute('data-bs-theme', tema === 'purple' ? 'dark' : 'light');

  if (tema === 'purple') {
    iconeTema.className = 'bi bi-sun-fill';
    textoTema.textContent = 'Tema branco';
  } else {
    iconeTema.className = 'bi bi-moon-stars-fill';
    textoTema.textContent = 'Tema roxo';
  }

  try { localStorage.setItem(CHAVE_TEMA, tema); } catch (e) {}
}

// Tema inicial (já aplicado no <head>; aqui só sincroniza o botão)
aplicarTema(html.getAttribute('data-theme') || 'light');

btnTema.addEventListener('click', () => {
  const atual = html.getAttribute('data-theme');
  aplicarTema(atual === 'purple' ? 'light' : 'purple');
});

/* ---------- Navbar: sombra ao rolar + botão topo ---------- */
const navbar = document.querySelector('.navbar-glass');
const btnTopo = document.getElementById('btnTopo');

window.addEventListener('scroll', () => {
  navbar.classList.toggle('scrolled', window.scrollY > 20);
  btnTopo.classList.toggle('show', window.scrollY > 400);
});

btnTopo.addEventListener('click', () => {
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

/* ---------- Fecha o menu mobile ao clicar em um link ---------- */
document.querySelectorAll('.navbar-nav .nav-link').forEach((link) => {
  link.addEventListener('click', () => {
    const menu = document.getElementById('menuPrincipal');
    if (menu.classList.contains('show')) {
      bootstrap.Collapse.getOrCreateInstance(menu).hide();
    }
  });
});

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
  '.service-card, .about-visual, .testimonial, .contact-info, .contact-form, .section-title'
);
elementosReveal.forEach((el) => el.classList.add('reveal'));

const observadorReveal = new IntersectionObserver((entradas) => {
  entradas.forEach((entrada) => {
    if (entrada.isIntersecting) {
      entrada.target.classList.add('visible');
      observadorReveal.unobserve(entrada.target);
    }
  });
}, { threshold: 0.15 });

elementosReveal.forEach((el) => observadorReveal.observe(el));

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
