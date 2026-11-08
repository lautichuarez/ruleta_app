const canvas = document.getElementById('ruleta');
const ctx = canvas.getContext('2d');
const inputNueva = document.getElementById('nuevaOpcion');
const btnAgregar = document.getElementById('btnAgregar');
const btnGirar = document.getElementById('btnGirar');
const lista = document.getElementById('lista');
const resultado = document.getElementById('resultado');
const btnInstalar = document.getElementById('btnInstalar');
const contenedorFondo = document.querySelector('.fondo-emojis');
const selectorLista = document.getElementById('selectorLista');
const btnNuevaLista = document.getElementById('btnNuevaLista');
const btnBorrarLista = document.getElementById('btnBorrarLista');

const COLORES = ['#ff6b6b', '#feca57', '#48dbfb', '#1dd1a1',
                 '#ff9ff3', '#54a0ff', '#5f27cd', '#ff9f43'];

// ---------- LISTAS ----------
// Cada lista tiene un nombre y sus opciones. Si ya tenías opciones guardadas
// de la versión anterior, se pasan a una lista llamada "General".
let listas = JSON.parse(localStorage.getItem('listas'));
if (!listas) {
  const antiguas = JSON.parse(localStorage.getItem('opciones'));
  listas = antiguas
    ? { 'General': antiguas }
    : {
        'Comida': ['Pizza', 'Sushi', 'Tacos', 'Hamburguesa'],
        'Películas': ['Acción', 'Comedia', 'Terror', 'Animada'],
        'Planes': ['Cine', 'Parque', 'Café', 'Caminata']
      };
}

let listaActual = localStorage.getItem('listaActual');
if (!listas[listaActual]) listaActual = Object.keys(listas)[0];

// "opciones" apunta a la lista que se está usando
let opciones = listas[listaActual];
let angulo = 0;   // rotación actual de la ruleta (en radianes)
let girando = false;
let eventoInstalar = null;

function guardar() {
  localStorage.setItem('listas', JSON.stringify(listas));
  localStorage.setItem('listaActual', listaActual);
}

function renderizarSelector() {
  selectorLista.innerHTML = '';
  Object.keys(listas).forEach(nombre => {
    const op = document.createElement('option');
    op.value = nombre;
    op.textContent = nombre;
    selectorLista.appendChild(op);
  });
  selectorLista.value = listaActual;
}

function cambiarLista(nombre) {
  if (girando) return;
  listaActual = nombre;
  opciones = listas[nombre];
  guardar();
  resultado.textContent = '';
  renderizarSelector();
  renderizarLista();
  dibujar();
}

function nuevaLista() {
  if (girando) return;
  const nombre = (prompt('Nombre de la nueva lista:') || '').trim();
  if (nombre === '') return;
  if (listas[nombre]) {
    alert('Ya existe una lista con ese nombre.');
    return;
  }
  listas[nombre] = [];
  cambiarLista(nombre);
}

function borrarLista() {
  if (girando) return;
  if (Object.keys(listas).length <= 1) {
    alert('Debe quedar al menos una lista.');
    return;
  }
  if (!confirm(`¿Borrar la lista "${listaActual}"?`)) return;
  delete listas[listaActual];
  cambiarLista(Object.keys(listas)[0]);
}

// ---------- SONIDOS ----------
let audioCtx = null;

// El navegador exige que el audio se active con un toque del usuario
function obtenerAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

// Tic corto que suena al pasar por cada opción
function tic() {
  try {
    const c = obtenerAudio();
    const osc = c.createOscillator();
    const vol = c.createGain();
    osc.type = 'square';
    osc.frequency.value = 900;
    vol.gain.setValueAtTime(0.15, c.currentTime);
    vol.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.05);
    osc.connect(vol);
    vol.connect(c.destination);
    osc.start();
    osc.stop(c.currentTime + 0.06);
  } catch (e) {
    // Si el audio no está disponible, la app sigue funcionando
  }
}

// Sonido de celebración al mostrar el ganador (archivo task_complete.wav)
const sonidoGanador = new Audio('task_complete.wav');
sonidoGanador.preload = 'auto';

function celebrar() {
  sonidoGanador.currentTime = 0;
  sonidoGanador.play().catch(() => {
    // Si el navegador bloquea el audio, la app sigue funcionando sin sonido
  });
}

// ---------- DIBUJAR LA RULETA ----------
function dibujar() {
  const tamaño = canvas.width;
  const centro = tamaño / 2;
  const radio = centro - 4;

  ctx.clearRect(0, 0, tamaño, tamaño);

  if (opciones.length === 0) {
    ctx.fillStyle = '#ddd';
    ctx.beginPath();
    ctx.arc(centro, centro, radio, 0, 2 * Math.PI);
    ctx.fill();
    return;
  }

  const porcion = (2 * Math.PI) / opciones.length;

  opciones.forEach((opcion, i) => {
    const inicio = angulo + i * porcion;
    const fin = inicio + porcion;

    // Sector de color
    ctx.beginPath();
    ctx.moveTo(centro, centro);
    ctx.arc(centro, centro, radio, inicio, fin);
    ctx.fillStyle = COLORES[i % COLORES.length];
    ctx.fill();

    // Texto dentro del sector
    ctx.save();
    ctx.translate(centro, centro);
    ctx.rotate(inicio + porcion / 2);
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'right';

    // Tamaño de letra que se ajusta solo para que quepa en el sector
    let tamano = 46;
    ctx.font = `bold ${tamano}px system-ui, sans-serif`;
    while (ctx.measureText(opcion).width > radio * 0.6 && tamano > 20) {
      tamano -= 2;
      ctx.font = `bold ${tamano}px system-ui, sans-serif`;
    }

    ctx.fillText(opcion, radio - 24, 16);
    ctx.restore();
  });
}

// ---------- CALCULAR EL GANADOR ----------
function obtenerGanador() {
  const porcion = (2 * Math.PI) / opciones.length;
  // El puntero está arriba (-90°). Calculamos qué sector queda debajo.
  let a = (-Math.PI / 2 - angulo) % (2 * Math.PI);
  if (a < 0) a += 2 * Math.PI;
  return opciones[Math.floor(a / porcion)];
}

// ---------- GIRAR CON ANIMACIÓN ----------
function girar() {
  if (girando) return;
  if (opciones.length < 2) {
    resultado.textContent = 'Agrega al menos 2 opciones';
    return;
  }

  girando = true;
  btnGirar.disabled = true;
  resultado.classList.remove('mostrar');
  resultado.textContent = '';

  const inicio = angulo;
  const vueltas = 5 + Math.random() * 3;             // entre 5 y 8 vueltas completas
  const destino = inicio + vueltas * 2 * Math.PI + Math.random() * 2 * Math.PI;
  const duracion = 4000;                              // milisegundos
  const t0 = performance.now();

  const porcion = (2 * Math.PI) / opciones.length;
  let ultimoSector = Math.floor(angulo / porcion);

  function frame(ahora) {
    const progreso = Math.min((ahora - t0) / duracion, 1);
    const suavizado = 1 - Math.pow(1 - progreso, 3);  // desacelera al final
    angulo = inicio + (destino - inicio) * suavizado;
    dibujar();

    // Tic cada vez que el puntero cruza una opción
    const sectorActual = Math.floor(angulo / porcion);
    if (sectorActual !== ultimoSector) {
      tic();
      ultimoSector = sectorActual;
    }

    if (progreso < 1) {
      requestAnimationFrame(frame);
    } else {
      angulo = destino % (2 * Math.PI);
      dibujar();
      mostrarGanador();
      girando = false;
      btnGirar.disabled = false;
    }
  }
  requestAnimationFrame(frame);
}

function mostrarGanador() {
  resultado.textContent = '🎉 ' + obtenerGanador() + ' 🎉';
  resultado.classList.add('mostrar');
  celebrar();
  // Vibración: funciona en Android; en iPhone el navegador la ignora
  if ('vibrate' in navigator) {
    navigator.vibrate([200, 100, 200]);
  }
}

// ---------- GESTIONAR LA LISTA ----------
function renderizarLista() {
  lista.innerHTML = '';
  opciones.forEach((opcion, i) => {
    const li = document.createElement('li');

    const texto = document.createElement('span');
    texto.textContent = opcion;

    const btnBorrar = document.createElement('button');
    btnBorrar.textContent = 'Borrar';
    btnBorrar.onclick = () => {
      opciones.splice(i, 1);
      guardar();
      renderizarLista();
      dibujar();
    };

    li.appendChild(texto);
    li.appendChild(btnBorrar);
    lista.appendChild(li);
  });
}

function agregarOpcion() {
  const texto = inputNueva.value.trim();
  if (texto === '') return;
  if (opciones.length >= 8) {
    resultado.textContent = 'Máximo 8 opciones';
    return;
  }
  opciones.push(texto);
  inputNueva.value = '';
  guardar();
  renderizarLista();
  dibujar();
}

// ---------- EVENTOS ----------
btnGirar.addEventListener('click', girar);
btnAgregar.addEventListener('click', agregarOpcion);
inputNueva.addEventListener('keydown', e => {
  if (e.key === 'Enter') agregarOpcion();
});
selectorLista.addEventListener('change', () => cambiarLista(selectorLista.value));
btnNuevaLista.addEventListener('click', nuevaLista);
btnBorrarLista.addEventListener('click', borrarLista);

// Registrar el service worker (necesario para instalar la app)
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js');
}

// ---------- BOTÓN DESCARGAR / INSTALAR ----------
// Android y computadoras (Chrome y Edge): el navegador avisa cuando la app se puede instalar
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  eventoInstalar = e;
  btnInstalar.hidden = false;
});

btnInstalar.addEventListener('click', async () => {
  if (eventoInstalar) {
    eventoInstalar.prompt();
    await eventoInstalar.userChoice;
    eventoInstalar = null;
    btnInstalar.hidden = true;
  } else {
    // iPhone no permite instalación automática: mostramos instrucciones
    alert('En iPhone: toca el botón Compartir (cuadrado con flecha) y elige "Agregar a pantalla de inicio".');
  }
});

window.addEventListener('appinstalled', () => {
  btnInstalar.hidden = true;
});

// En iPhone mostramos el botón con instrucciones (si la app no está ya instalada)
const esIphone = /iPhone|iPad/.test(navigator.userAgent);
const yaInstalada = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
if (esIphone && !yaInstalada) {
  btnInstalar.hidden = false;
}

// ---------- EMOJIS ANIMADOS DE FONDO ----------
const EMOJIS_FONDO = ['😂', '😍', '🥳', '😢', '😜', '😅', '🤩', '🎉', '😎', '🤪', '😋', '👍', '❤️'];

for (let i = 0; i < 22; i++) {
  const s = document.createElement('span');
  s.textContent = EMOJIS_FONDO[Math.floor(Math.random() * EMOJIS_FONDO.length)];
  s.style.left = (Math.random() * 100) + '%';
  s.style.fontSize = (28 + Math.random() * 36) + 'px';
  s.style.animationDuration = (8 + Math.random() * 8) + 's';
  s.style.animationDelay = (-Math.random() * 16) + 's'; // negativo: ya empiezan en movimiento
  contenedorFondo.appendChild(s);
}

// Arranque
renderizarSelector();
renderizarLista();
dibujar();
