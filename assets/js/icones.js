// Ícones desenhados em SVG com o mesmo traço (1.8) para toda a interface.
const svg = (corpo, extra = '') =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${corpo}</svg>`;

export const icone = {
  certo: svg('<path d="M5 12.5l4.2 4.2L19 7"/>'),
  errado: svg('<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>'),
  branco: svg('<path d="M6 12h12"/>'),
  anterior: svg('<path d="M15 5l-7 7 7 7"/>'),
  proxima: svg('<path d="M9 5l7 7-7 7"/>'),
  colar: svg('<rect x="6" y="4" width="12" height="17" rx="2"/><path d="M9 4.5V3.8A1.8 1.8 0 0 1 10.8 2h2.4A1.8 1.8 0 0 1 15 3.8v.7M9 10h6M9 14h6M9 18h3"/>'),
  cartao: svg('<rect x="4" y="3" width="16" height="18" rx="2"/><circle cx="9" cy="8" r="1.4"/><circle cx="15" cy="8" r="1.4"/><circle cx="9" cy="12.5" r="1.4"/><circle cx="15" cy="12.5" r="1.4"/><circle cx="9" cy="17" r="1.4"/><circle cx="15" cy="17" r="1.4"/>'),
  baixar: svg('<path d="M12 4v11M7 10.5l5 5 5-5M5 20h14"/>'),
  compartilhar: svg('<circle cx="18" cy="5.5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="18.5" r="2.5"/><path d="M8.2 10.8l7.6-4M8.2 13.2l7.6 4"/>'),
  editar: svg('<path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4z"/><path d="M13.5 6.5l4 4"/>'),
  refazer: svg('<path d="M4 12a8 8 0 1 0 2.4-5.7"/><path d="M4 4v4.5h4.5"/>'),
  inicio: svg('<path d="M4 11l8-7 8 7"/><path d="M6 9.5V20h12V9.5"/>'),
  relogio: svg('<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>'),
  info: svg('<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5M12 7.8v.2"/>'),
  alerta: svg('<path d="M12 4l9 16H3l9-16z"/><path d="M12 10v4.5M12 17.4v.2"/>'),
  resultado: svg('<path d="M5 20V10M12 20V4M19 20v-7"/>'),
};

/** Traço de correção desenhado sobre a bolha (como caneta do professor). */
export function marcaCorrecao(tipo) {
  const d = tipo === 'acerto' ? 'M16 34 L28 46 L50 18' : 'M18 18 L46 46 M46 18 L18 46';
  return `<svg class="marca-correcao ${tipo}" viewBox="0 0 64 64" aria-hidden="true"><path d="${d}"/></svg>`;
}
