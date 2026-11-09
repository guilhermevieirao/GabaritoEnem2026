// Relatório em PDF. O jsPDF (≈420 KB) só é carregado quando a pessoa pede o arquivo.
// Só usamos caracteres que as fontes padrão do PDF conseguem desenhar; marcas de
// acerto e erro são traços desenhados, não símbolos de texto.

let carregando = null;

function carregarJsPdf() {
  if (window.jspdf?.jsPDF) return Promise.resolve(window.jspdf.jsPDF);
  if (!carregando) {
    carregando = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = new URL('../vendor/jspdf.umd.min.js', import.meta.url).href;
      s.onload = () => (window.jspdf?.jsPDF ? resolve(window.jspdf.jsPDF) : reject(new Error('jsPDF indisponível')));
      s.onerror = () => { carregando = null; reject(new Error('falha ao carregar jsPDF')); };
      document.head.append(s);
    });
  }
  return carregando;
}

const CORES_RGB = {
  azul: [47, 111, 214], amarelo: [242, 194, 48], branco: [214, 216, 210], cinza: [139, 145, 154], verde: [23, 131, 74],
};

export async function gerarPdf({ edicao, dia, sessao, dadosDia, resultado, estimativas, disputas, nomeCor, nomeLingua, tabelaTri }) {
  const JsPDF = await carregarJsPdf();
  const doc = new JsPDF({ unit: 'mm', format: 'a4' });
  const L = doc.internal.pageSize.getWidth();
  const A = doc.internal.pageSize.getHeight();
  const M = 16;
  const agora = new Date();
  const gerado = `${agora.toLocaleDateString('pt-BR')} ${agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
  const tinta = [20, 23, 28];
  const cinza = [95, 103, 114];
  const verde = [20, 119, 58];
  const vermelho = [191, 38, 38];

  // Faixa do caderno
  doc.setFillColor(...(CORES_RGB[sessao.cor] || tinta));
  doc.rect(0, 0, L, 6, 'F');
  if (sessao.cor === 'branco') { doc.setDrawColor(180); doc.line(0, 6, L, 6); }

  let y = 20;
  doc.setTextColor(...tinta);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(19);
  doc.text(`Gabarito ENEM ${edicao} - resultado do ${dia}º dia`, M, y);
  y += 7;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...cinza);
  const situacao = dadosDia.situacao === 'oficial' ? 'gabarito oficial do INEP' : `gabarito extraoficial (consenso de ${dadosDia.fontes.length} correções de cursinhos)`;
  doc.text(`Caderno ${nomeCor}${nomeLingua ? ` · ${nomeLingua}` : ''} · ${situacao} · gerado em ${gerado}`, M, y);
  y += 12;

  // Boletim
  doc.setTextColor(...tinta);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('Boletim estimado', M, y);
  y += 6;
  const colunas = [M, M + 82, M + 108, M + 136, M + 160];
  doc.setFontSize(8.5);
  doc.setTextColor(...cinza);
  ['Área', 'Acertos', 'Nota provável', 'Metade entre', '80% entre'].forEach((t, k) => doc.text(t, colunas[k], y));
  y += 2;
  doc.setDrawColor(210);
  doc.line(M, y, L - M, y);
  y += 6;
  doc.setTextColor(...tinta);
  dadosDia.areas.forEach((area, k) => {
    const c = resultado.porArea[area.id];
    const e = estimativas[k];
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.text(area.nome, M, y, { maxWidth: 78 });
    doc.setFont('helvetica', 'normal');
    doc.text(`${c.acertos} de ${c.validas}`, colunas[1], y);
    doc.setFont('helvetica', 'bold');
    doc.text(e ? String(Math.round(e.mediana)) : '-', colunas[2], y);
    doc.setFont('helvetica', 'normal');
    doc.text(e ? `${Math.round(e.p25)} a ${Math.round(e.p75)}` : '-', colunas[3], y);
    doc.text(e ? `${Math.round(e.p10)} a ${Math.round(e.p90)}` : '-', colunas[4], y);
    y += area.nome.length > 40 ? 10 : 7;
    for (const sub of area.sub || []) {
      const cs = resultado.porArea[sub.id];
      doc.setFontSize(9.5);
      doc.setTextColor(...cinza);
      doc.text(`   ${sub.nome}`, M, y);
      doc.text(`${cs.acertos} de ${cs.validas}`, colunas[1], y);
      doc.setTextColor(...tinta);
      y += 6;
    }
    doc.setDrawColor(230);
    doc.line(M, y - 3, L - M, y - 3);
    y += 2;
  });
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  const t = resultado.total;
  doc.text(`Total: ${t.acertos} acertos de ${t.validas} (${t.percentual.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%) · ${t.erros} erros · ${t.brancos + t.pendentes} em branco${t.anuladas ? ` · ${t.anuladas} anuladas` : ''}`, M, y);
  y += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...cinza);
  const explica = `Nota provável: mediana das notas oficiais de quem teve o mesmo número de acertos no ENEM ${tabelaTri.anos.join(' e ')} (microdados do INEP). A nota real depende de quais questões você acertou e pode cair em qualquer ponto da faixa.`;
  doc.text(doc.splitTextToSize(explica, L - 2 * M), M, y);
  y += 12;

  // Cartão corrigido
  doc.setTextColor(...tinta);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('Cartão corrigido', M, y);
  y += 4;
  const porLinha = 10;
  const larg = (L - 2 * M) / porLinha;
  const alt = 13;
  const disputadas = new Set(disputas.map((d) => d.indice));
  resultado.porQuestao.forEach((q, i) => {
    const col = i % porLinha;
    const lin = Math.floor(i / porLinha);
    const x = M + col * larg;
    const yy = y + lin * (alt + 1.5);
    const fundo = { acerto: [226, 243, 232], erro: [251, 228, 228], anulada: [251, 237, 212] }[q.situacao] || [240, 241, 243];
    doc.setFillColor(...fundo);
    doc.roundedRect(x + 0.6, yy, larg - 1.2, alt, 1.5, 1.5, 'F');
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...cinza);
    doc.text(String(q.numero), x + 2.2, yy + 3.6);
    if (disputadas.has(q.indice)) { doc.setFillColor(91, 69, 196); doc.circle(x + larg - 3, yy + 2.6, 0.9, 'F'); }
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    if (q.situacao === 'anulada') {
      doc.setFontSize(7);
      doc.setTextColor(138, 83, 0);
      doc.text('anulada', x + 2.2, yy + 9);
      return;
    }
    const cx = x + 3.6;
    const cy = yy + 8.4;
    if (q.situacao === 'acerto') {
      doc.setDrawColor(...verde); doc.setLineWidth(0.6);
      doc.line(cx - 1.4, cy, cx - 0.2, cy + 1.2); doc.line(cx - 0.2, cy + 1.2, cx + 1.8, cy - 1.4);
      doc.setTextColor(...verde);
      doc.text(q.marcada, x + 6.4, yy + 9.6);
    } else if (q.situacao === 'erro') {
      doc.setDrawColor(...vermelho); doc.setLineWidth(0.6);
      doc.line(cx - 1.3, cy - 1.3, cx + 1.3, cy + 1.3); doc.line(cx + 1.3, cy - 1.3, cx - 1.3, cy + 1.3);
      doc.setTextColor(...vermelho);
      doc.text(q.marcada, x + 6.4, yy + 9.6);
      doc.setFontSize(7); doc.setFont('helvetica', 'normal'); doc.setTextColor(...cinza);
      doc.text(`era ${q.correta}`, x + 10.2, yy + 9.4);
    } else {
      doc.setTextColor(...cinza);
      doc.text('-', x + 2.6, yy + 9.6);
      doc.setFontSize(7); doc.setFont('helvetica', 'normal');
      doc.text(`era ${q.correta}`, x + 6.4, yy + 9.4);
    }
    doc.setLineWidth(0.2);
  });
  y += Math.ceil(resultado.porQuestao.length / porLinha) * (alt + 1.5) + 4;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...cinza);
  doc.text(`Verde: acerto · vermelho: erro (com o gabarito) · cinza: em branco${disputas.length ? ' · ponto roxo: questão em disputa entre as correções' : ''}`, M, y);
  y += 10;

  // Disputas
  if (disputas.length) {
    const nomes = Object.fromEntries((dadosDia.fontes || []).map((f) => [f.id, f.nome]));
    if (y > A - 50) { doc.addPage(); y = 20; }
    doc.setTextColor(...tinta);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('Questões em disputa', M, y);
    y += 6;
    doc.setFontSize(9);
    for (const d of disputas) {
      const marcada = sessao.respostas[d.indice];
      const linha = `Questão ${(dia === 2 ? 90 : 0) + d.indice + 1} (você: ${marcada && marcada !== '-' ? marcada : 'em branco'}) - ${Object.entries(d.votos).map(([l, fs]) => `${l}: ${fs.map((f) => nomes[f] || f).join(', ')}`).join(' | ')}`;
      const partes = doc.splitTextToSize(linha, L - 2 * M);
      if (y + partes.length * 4.5 > A - 20) { doc.addPage(); y = 20; }
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...tinta);
      doc.text(partes, M, y);
      y += partes.length * 4.5 + 1.5;
    }
  }

  const paginas = doc.getNumberOfPages();
  for (let p = 1; p <= paginas; p += 1) {
    doc.setPage(p);
    doc.setFontSize(8);
    doc.setTextColor(...cinza);
    doc.text(`Estimativa não oficial. O resultado oficial é divulgado pelo INEP. · guilhermevieirao.github.io/GabaritoEnem2026 · página ${p} de ${paginas}`, L / 2, A - 8, { align: 'center' });
  }
  doc.save(`gabarito-enem-${edicao}-dia${dia}-${sessao.cor}.pdf`);
}
