const canvas = document.getElementById('ruleta');
const ctx = canvas.getContext('2d');
const inputNueva = document.getElementById('nuevaOpcion');
const btnAgregar = document.getElementById('btnAgregar');
const btnGirar = document.getElementById('btnGirar');
const lista = document.getElementById('lista');
const resultado = document.getElementById('resultado');

const COLORES = ['#ff6b6b', '#feca57', '#48dbfb', '#1dd1a1',
                 '#ff9ff3', '#54a0ff', '#5f27cd', '#ff9f43'];

// Cargar opciones guardadas o usar ejemplos
let opciones = JSON.parse(localStorage.getItem('opciones')) || ['Pizza', 'Cine', 'Parque', 'Sushi'];
let angulo = 0;   // rotación actual de la ruleta (en radianes)
let girando = false;

function guardar() {
  localStorage.setItem('opciones', JSON.stringify(opciones));
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

// Registrar el service worker (necesario para instalar la app)
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js');
}

// ---------- BOTÓN DESCARGAR / INSTALAR ----------
const btnInstalar = document.getElementById('btnInstalar');
let eventoInstalar = null;

// Android y computadoras (Chrome y Edge): el navegador avisa cuando la app se puede instalar
window
