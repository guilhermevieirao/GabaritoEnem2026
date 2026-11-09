#!/usr/bin/env python3
"""Agrega as notas oficiais do ENEM por número de acertos, direto dos microdados do INEP.

Lê o CSV de participantes de dentro do .zip remoto do INEP via requisições HTTP com Range
e descompressão incremental: nada grande é salvo em disco.

Uso:
  python3 tools/tri/agregar_microdados.py <ca.pem> <url-do-zip> <nome-do-csv> <saida.json>
Exemplo:
  python3 tools/tri/agregar_microdados.py ca.pem \
    https://download.inep.gov.br/microdados/microdados_enem_2024.zip RESULTADOS_2024.csv tools/tri/agregado_2024.json

Sobre <ca.pem>: o servidor download.inep.gov.br não envia o certificado intermediário
"RNP ICPEdu GR46 OV TLS CA 2025". Baixe-o do endereço indicado no próprio certificado
(http://secure.globalsign.com/cacert/rnpicpedugr46ovtlsca2025.crt), confira que ele
valida contra a raiz GlobalSign R46 do sistema e junte-o ao bundle de CAs do sistema.
A verificação TLS continua ligada.

Saída: { area: { questoes_validas: { acertos: {n, min, p10, p25, med, p75, p90, max, mean} } } }
import http.client, time, ssl, struct, sys, urllib.request, zlib, json, io, csv, array
from collections import defaultdict
CA, URL, MEMBER, OUT = sys.argv[1:5]
ctx = ssl.create_default_context(cafile=CA)
op = urllib.request.build_opener(urllib.request.HTTPSHandler(context=ctx), urllib.request.ProxyHandler())
def get(a, b):
    r = op.open(urllib.request.Request(URL, headers={'Range': f'bytes={a}-{b}'}), timeout=300); return r
r = get(0, 0); size = int(r.headers['Content-Range'].split('/')[1]); r.read()
tail = get(size - 65536, size - 1).read(); i = tail.rfind(b'PK\x05\x06')
_, _, _, _, n, cdsize, cdoff, _ = struct.unpack('<IHHHHIIH', tail[i:i+22])
cd = get(cdoff, cdoff + cdsize - 1).read(); p = 0; target = None
while cd[p:p+4] == b'PK\x01\x02':
    f = struct.unpack('<IHHHHHHIIIHHHHHII', cd[p:p+46]); name = cd[p+46:p+46+f[10]].decode('cp437')
    if name.endswith(MEMBER): target = (f[8], f[16])
    p += 46 + f[10] + f[11] + f[12]
csize, lho = target
h = get(lho, lho + 29).read(); fnl, exl = struct.unpack('<HH', h[26:30]); start = lho + 30 + fnl + exl
resp = get(start, start + csize - 1)
d = zlib.decompressobj(-15)
scores = defaultdict(lambda: array.array('f'))
header = None; buf = b''; rows = 0; read = 0
AREAS = ('CN', 'CH', 'LC', 'MT')
tentativas = 0
while True:
    try:
        chunk = resp.read(4 << 20)
    except (ConnectionError, OSError, http.client.HTTPException) as e:
        tentativas += 1
        if tentativas > 20: raise
        print('reconectando em', read, repr(e), flush=True); time.sleep(3)
        resp = get(start + read, start + csize - 1)
        continue
    if not chunk:
        if read < csize:
            resp = get(start + read, start + csize - 1); continue
        break
    read += len(chunk)
    buf += d.decompress(chunk)
    lines = buf.split(b'\n'); buf = lines.pop()
    for ln in lines:
        cols = ln.decode('latin-1').rstrip('\r').split(';')
        if header is None: header = {c.strip('"'): k for k, c in enumerate(cols)}; continue
        rows += 1
        for a in AREAS:
            try:
                if cols[header[f'TP_PRESENCA_{a}']] != '1': continue
                nota = cols[header[f'NU_NOTA_{a}']]
                if not nota: continue
                rs = cols[header[f'TX_RESPOSTAS_{a}']].strip('"'); gb = cols[header[f'TX_GABARITO_{a}']].strip('"')
                if a == 'LC':
                    lang = cols[header['TP_LINGUA']]
                    if len(gb) != 50 or lang not in ('0', '1'): continue
                    gb = (gb[:5] if lang == '0' else gb[5:10]) + gb[10:]
                if len(rs) != len(gb) or len(gb) != 45: continue
                valid = sum(1 for g in gb if g != 'X')
                k = sum(1 for x, g in zip(rs, gb) if g != 'X' and x == g)
                # normalise to 45 valid items when an item was annulled (rare)
                scores[(a, valid, k)].append(float(nota.replace(',', '.')))
            except (KeyError, IndexError, ValueError):
                pass
    if rows and rows % 500000 < 20000: print(f'{read/1e6:.0f}MB comprimidos, {rows} linhas', flush=True)
print('linhas', rows)
import numpy as np
out = {}
for (a, valid, k), v in scores.items():
    v = np.frombuffer(v, dtype=np.float32)
    out.setdefault(a, {}).setdefault(str(valid), {})[str(k)] = {
        'n': int(v.size), 'min': round(float(v.min()), 1), 'p10': round(float(np.percentile(v, 10)), 1),
        'p25': round(float(np.percentile(v, 25)), 1), 'med': round(float(np.median(v)), 1),
        'p75': round(float(np.percentile(v, 75)), 1), 'p90': round(float(np.percentile(v, 90)), 1),
        'max': round(float(v.max()), 1), 'mean': round(float(v.mean()), 1)}
json.dump(out, open(OUT, 'w'), indent=0)
