// Sons gerados no próprio navegador (sem arquivos externos que podem sumir do ar).
let contexto = null;

function ctx() {
  if (!contexto) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    contexto = new AC();
  }
  if (contexto.state === 'suspended') contexto.resume().catch(() => {});
  return contexto;
}

function nota(ac, freq, inicio, duracao, tipo = 'sine', volume = 0.16) {
  const osc = ac.createOscillator();
  const ganho = ac.createGain();
  osc.type = tipo;
  osc.frequency.setValueAtTime(freq, inicio);
  ganho.gain.setValueAtTime(0.0001, inicio);
  ganho.gain.exponentialRampToValueAtTime(volume, inicio + 0.012);
  ganho.gain.exponentialRampToValueAtTime(0.0001, inicio + duracao);
  osc.connect(ganho).connect(ac.destination);
  osc.start(inicio);
  osc.stop(inicio + duracao + 0.02);
}

export function tocar(tipo) {
  try {
    const ac = ctx();
    if (!ac) return;
    const t = ac.currentTime;
    if (tipo === 'acerto') {
      nota(ac, 659.25, t, 0.14);
      nota(ac, 987.77, t + 0.09, 0.22);
    } else if (tipo === 'erro') {
      nota(ac, 196, t, 0.22, 'triangle', 0.2);
      nota(ac, 174.61, t + 0.1, 0.24, 'triangle', 0.16);
    } else {
      nota(ac, 523.25, t, 0.08, 'sine', 0.08);
    }
  } catch {
    // Sem áudio disponível: segue sem som.
  }
}
