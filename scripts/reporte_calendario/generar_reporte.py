"""Genera el reporte para RRHH: calendario de marcación por persona, con estadísticas por departamento.

Uso (desde la carpeta del proyecto):
    python scripts/reporte_calendario/generar_reporte.py --ini 2026-09-10 --fin 2026-10-10
Opcional:
    --horario-anterior archivos/BACKUP/Horario_....xlsx   marca los turnos cargados después de ese export
    --carpeta archivos      carpeta con las exportaciones de BioTime (toma el archivo más reciente de cada tipo)
    --salida informes/...   ruta del Excel

Necesita Python con openpyxl y Node.js. Usa el motor real de reporte-horas.html.
Antes de guardar, verifica cada celda contra los archivos originales; si algo no cuadra,
guarda el archivo con el sufijo _REVISAR y explica qué falló.
"""
import argparse, collections, datetime as dt, glob, json, os, re, shutil, subprocess, sys, tempfile

try:
    import openpyxl
    from openpyxl.comments import Comment
    from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
    from openpyxl.utils import get_column_letter as L
except ImportError:
    sys.exit("Falta la librería openpyxl. Instálela con:  python -m pip install openpyxl")

sys.stdout.reconfigure(encoding="utf-8")
sys.stderr.reconfigure(encoding="utf-8")
AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.abspath(os.path.join(AQUI, "..", ".."))

TIPOS = {  # clave del motor -> (patrón del nombre, obligatorio)
    "emp": ("Empleado_*.xlsx", True), "tur": ("Turno_*.xlsx", True), "hor": ("Horario_*.xlsx", True),
    "mar": ("Reporte de Marcaciones_*.xlsx", True), "ren": ("Renuncia_*.xlsx", False),
    "vis": ("Vista de horarios programados_*.xlsx", False),
}
CAT = [("A", "Marcó bien con turno", "C6EFCE", "006100"), ("M", "Marcó mal con turno", "FFEB9C", "9C5700"),
       ("F", "Con turno, no marcó", "FFC7CE", "9C0006"), ("S", "Marcó bien sin turno", "BDD7EE", "1F4E78"),
       ("X", "Marcó mal sin turno", "D9C3E9", "5B2C83"), ("D", "Marcó en su día de descanso", "E7E6E6", "404040")]
RESP = {"A": "—", "M": "Empleado", "F": "Empleado (o novedad sin registrar: incapacidad, permiso)",
        "S": "Quien programa el turno", "X": "Compartido: programación y empleado", "D": "Revisar: trabajo en día de descanso"}
MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"]
DSEM = ["lun", "mar", "mié", "jue", "vie", "sáb", "dom"]


def norm_id(v):
    s = str("" if v is None else v).strip()
    return re.sub(r"^0+(?=\d)", "", s) or s


def celda(v):
    if v is None:
        return ""
    if isinstance(v, dt.datetime):
        return v.date().isoformat() if v.time() == dt.time(0) else v.strftime("%Y-%m-%d %H:%M:%S")
    if isinstance(v, dt.date):
        return v.isoformat()
    if isinstance(v, dt.time):
        return v.strftime("%H:%M:%S")
    return str(v)


def a_iso(v):
    s = celda(v).strip()[:10]
    m = re.match(r"^(\d{2})[-/](\d{2})[-/](\d{4})$", s)
    return f"{m[3]}-{m[2]}-{m[1]}" if m else s


def leer(ruta):
    ws = openpyxl.load_workbook(ruta, read_only=True).worksheets[0]
    return [[celda(v) for v in fila] for fila in ws.iter_rows(values_only=True)]


def encabezado(aoa, patron_llave):
    for i, fila in enumerate(aoa[:10]):
        if any(re.match(patron_llave, c.strip().lower()) for c in fila if c):
            return i, [c.strip().lower() for c in fila]
    sys.exit(f"No encontré el encabezado ({patron_llave}) en uno de los archivos.")


def col(cab, patron, archivo):
    for j, c in enumerate(cab):
        if re.match(patron, c):
            return j
    sys.exit(f"El archivo {archivo} no tiene la columna esperada ({patron}). ¿Cambió el formato del export?")


def buscar_archivos(carpeta):
    hallados, faltan = {}, []
    for k, (patron, oblig) in TIPOS.items():
        candidatos = [f for f in glob.glob(os.path.join(carpeta, patron)) if not os.path.basename(f).startswith("~$")]
        if candidatos:
            hallados[k] = max(candidatos, key=os.path.getmtime)
        elif oblig:
            faltan.append(patron)
    if faltan:
        sys.exit("Faltan archivos en " + carpeta + ": " + ", ".join(faltan))
    return hallados


def sello(ruta):
    b = os.path.basename(ruta)
    m = re.search(r"(\d{4})-(\d{2})-(\d{2})-(\d{2})-(\d{2})", b) or re.search(r"(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})\d{2}", b)
    return f"{int(m[3])}-{MESES[int(m[2]) - 1]}-{m[1]} {m[4]}:{m[5]}" if m else b


def leer_vista(aoa):
    i, cab = encabezado(aoa, r"^empleado id$")
    fechas = {j: f"{c[:4]}-{c[4:6]}-{c[6:8]}" for j, c in enumerate(cab) if re.fullmatch(r"\d{8}", c)}
    vista = {}
    for fila in aoa[i + 1:]:
        if fila and fila[0]:
            vista[norm_id(fila[0])] = {iso: fila[j] for j, iso in fechas.items() if j < len(fila) and fila[j]}
    return vista, sorted(fechas.values())


def asignaciones(aoa, nombre):
    i, cab = encabezado(aoa, r"^empleado id$")
    ci, cc, cf0, cf1 = col(cab, r"^empleado id$", nombre), col(cab, r"^c.digo$", nombre), col(cab, r"^fecha inicial", nombre), col(cab, r"^fecha final", nombre)
    out = collections.defaultdict(list)
    for f in aoa[i + 1:]:
        if len(f) > cf1 and f[ci]:
            out[norm_id(f[ci])].append((a_iso(f[cf0]), a_iso(f[cf1]) or "2999-12-31", f[cc].strip()))
    return out


def dias_turno(aoa):
    i, cab = encabezado(aoa, r"^c.digo$")
    cc = col(cab, r"^c.digo$", "Turno")
    dias = {wd: col(cab, p, "Turno") for wd, p in enumerate([r"^lun", r"^mar$", r"^mi", r"^jue", r"^vie", r"^s.b", r"^dom"])}
    out = collections.defaultdict(set)
    for f in aoa[i + 1:]:
        if f and f[cc]:
            for wd, j in dias.items():
                if j < len(f) and f[j].strip().lower() == "true":
                    out[f[cc].strip()].add(wd)
    return out


def marcaciones(aoa):
    i, cab = encabezado(aoa, r"^employee id$")
    ci, cf, ch = col(cab, r"^employee id$", "Marcaciones"), col(cab, r"^fecha$", "Marcaciones"), col(cab, r"^hora$", "Marcaciones")
    out = collections.defaultdict(list)
    for f in aoa[i + 1:]:
        if len(f) > ch and f[ci] and f[cf]:
            out[(norm_id(f[ci]), a_iso(f[cf]))].append(f[ch].strip()[:5])
    return out


def verificar(res, crudo, vista):
    """Comprueba cada celda contra los archivos originales, sin usar el motor."""
    mar, hor, tur = marcaciones(crudo["mar"]), asignaciones(crudo["hor"], "Horario"), dias_turno(crudo["tur"])
    mover = lambda iso, n: (dt.date.fromisoformat(iso) + dt.timedelta(n)).isoformat()
    trabaja = lambda i, iso: any(a <= iso <= b and dt.date.fromisoformat(iso).weekday() in tur[c] for a, b, c in hor.get(i, []))
    fallas, ok = collections.Counter(), 0
    ejemplos = []

    def falla(msg, o, iso):
        fallas[msg] += 1
        if len(ejemplos) < 15:
            ejemplos.append(f"  {msg}: empleado {o['id']}, {iso}, {o['cal'][iso]}")

    for o in res["todas"]:
        for iso in res["dias"]:
            v, c = o["cal"][iso], o["cal"][iso]["c"]
            turno = trabaja(o["id"], iso) or bool(vista.get(o["id"], {}).get(iso))
            crudo_dia = mar.get((o["id"], iso), [])
            despues10 = [h for h in crudo_dia if h >= "10:00"]
            m = (v.get("m") or "")
            if c in ("S", "X"):
                if turno: falla(c + " con turno en Horario o Vista", o, iso)
                elif not crudo_dia: falla(c + " sin marcaciones en el archivo original", o, iso)
                else: ok += 1
            elif c in ("A", "M"):
                if not turno: falla(c + " sin turno en Horario ni Vista", o, iso)
                elif not crudo_dia and not mar.get((o["id"], mover(iso, 1))): falla(c + " sin marcaciones ese día ni el siguiente", o, iso)
                elif c == "A" and (not m or len(m.split()) % 2): falla("A con marcaciones impares o vacías", o, iso)
                else: ok += 1
            elif c == "F":
                if not turno: falla("F sin turno en Horario ni Vista", o, iso)
                elif despues10: falla("F con marcaciones después de las 10:00", o, iso)
                else: ok += 1
            elif c == "D":
                if not crudo_dia: falla("D sin marcaciones", o, iso)
                else: ok += 1
            elif c == "":
                previo = o["cal"].get(mover(iso, -1), {}).get("m") or ""
                if turno: falla("Día libre con turno", o, iso)
                elif despues10 and not all(h in previo for h in crudo_dia): falla("Día libre con marcaciones después de las 10:00", o, iso)
                else: ok += 1
    return ok, fallas, ejemplos


def armar_excel(res, salida, fuentes, anterior):
    DIAS, P = res["dias"], sorted(res["todas"], key=lambda o: (o["depto"], o["nombre"]))
    EST = {c: (PatternFill("solid", fgColor=bg), Font(bold=True, color=fg)) for c, _, bg, fg in CAT}
    AZ, BL, B = PatternFill("solid", fgColor="1F3A5F"), Font(bold=True, color="FFFFFF"), Font(bold=True)
    fino = Side(style="thin", color="D0D5DD"); BOX = Border(left=fino, right=fino, top=fino, bottom=fino)
    viejo = asignaciones(leer(anterior), "Horario anterior") if anterior else None
    tarde = (lambda o, d: o["cal"][d]["c"] in ("A", "M", "F") and not any(a <= d <= b for a, b, _ in viejo.get(o["id"], []))) if viejo else (lambda o, d: False)

    def stats(n):
        base = sum(n.get(c, 0) for c, *_ in CAT)
        return base, [n.get(c, 0) for c, *_ in CAT], [(n.get(c, 0) / base if base else None) for c, *_ in CAT]

    def cab(iso):
        d = dt.date.fromisoformat(iso)
        return f"{d.day:02d}-{MESES[d.month - 1]}\n{DSEM[d.weekday()]}"

    def encabezar(ws, alto=58):
        for c in ws[1]:
            c.font, c.fill, c.alignment = BL, AZ, Alignment(wrap_text=True, horizontal="center", vertical="center")
        ws.row_dimensions[1].height = alto

    wb = openpyxl.Workbook()
    ws = wb.active; ws.title = "Calendario"
    IDC = ["Código", "Nombres", "Apellidos", "Compañía", "Departamento", "Cargo", "Vínculo", "Fecha de ingreso"]
    ws.append(IDC + [cab(d) for d in DIAS] + [f"{t} (días)" for _, t, _, _ in CAT] + ["Días evaluados"] + [f"{t} (%)" for _, t, _, _ in CAT])
    encabezar(ws)
    nI, nD = len(IDC), len(DIAS)
    for o in P:
        base, cnt, pct = stats(o["n"])
        ws.append([int(o["id"]) if o["id"].isdigit() else o["id"], o["nombres"], o["apellidos"], o["cia"], o["depto"], o["cargo"], o["vinc"], o["ingreso"]]
                  + [o["cal"][d]["c"] for d in DIAS] + cnt + [base] + pct)
        r = ws.max_row
        for j, d in enumerate(DIAS):
            cel, v = ws.cell(r, nI + 1 + j), o["cal"][d]
            cel.alignment, cel.border = Alignment(horizontal="center"), BOX
            if v["c"] in EST: cel.fill, cel.font = EST[v["c"]]
            elif v["c"] == "·": cel.font = Font(color="98A2B3")
            partes = [("Turno: " + v["t"]) if v.get("t") else ("Sin turno" if v["c"] in ("S", "X", "D") else ""),
                      ("Marcaciones: " + v["m"]) if v.get("m") else ""]
            if tarde(o, d): partes.append("Turno cargado después de trabajado este día")
            txt = " · ".join(x for x in partes if x)
            if txt:
                cel.comment = Comment(txt, "Reporte"); cel.comment.width, cel.comment.height = 260, 60
        for k in range(len(CAT) * 2 + 1):
            cel = ws.cell(r, nI + nD + 1 + k); cel.border, cel.alignment = BOX, Alignment(horizontal="center")
            if k > len(CAT): cel.number_format = "0.0%"
    tot = collections.Counter()
    for o in P: tot.update(o["n"])
    base, cnt, pct = stats(tot)
    ws.append(["TOTAL"] + [""] * (nI - 1 + nD) + cnt + [base] + pct)
    for c in ws[ws.max_row]: c.font, c.border = B, BOX
    for k in range(len(CAT) + 1, len(CAT) * 2 + 1): ws.cell(ws.max_row, nI + nD + 1 + k).number_format = "0.0%"
    for i, w in enumerate([8, 18, 20, 15, 28, 28, 9, 11]): ws.column_dimensions[L(i + 1)].width = w
    for j in range(nD): ws.column_dimensions[L(nI + 1 + j)].width = 5.2
    for k in range(len(CAT) * 2 + 1): ws.column_dimensions[L(nI + nD + 1 + k)].width = 11
    ws.freeze_panes = ws.cell(2, 4)
    ws.auto_filter.ref = f"A1:{L(ws.max_column)}{ws.max_row - 1}"

    es = wb.create_sheet("Por departamento", 0)
    es.append(["Departamento", "Personas"] + [f"{t} (días)" for _, t, _, _ in CAT] + ["Días evaluados"] + [f"{t} (%)" for _, t, _, _ in CAT])
    encabezar(es)
    dep = collections.defaultdict(lambda: {"p": 0, "n": collections.Counter()})
    for o in P: dep[o["depto"]]["p"] += 1; dep[o["depto"]]["n"].update(o["n"])
    for k, d in sorted(dep.items(), key=lambda kv: -(kv[1]["n"]["S"] + kv[1]["n"]["X"])):
        base, cnt, pct = stats(d["n"]); es.append([k, d["p"]] + cnt + [base] + pct)
    base, cnt, pct = stats(tot); es.append(["TOTAL", len(P)] + cnt + [base] + pct)
    for c in es[es.max_row]: c.font = B
    for fila in es.iter_rows(min_row=2):
        for c in fila[2 + len(CAT) + 1:]: c.number_format = "0.0%"
    es.column_dimensions["A"].width = 40
    for j in range(2, 3 + len(CAT) * 2 + 1): es.column_dimensions[L(j)].width = 12

    total_tarde = 0
    if viejo:
        ct = wb.create_sheet("Turnos cargados después")
        ct.append(["Código", "Nombre", "Departamento", "Días con turno cargado después", "Fechas"]); encabezar(ct, 30)
        cdep = collections.Counter()
        for o in P:
            F = [d for d in DIAS if tarde(o, d)]
            if F:
                ct.append([int(o["id"]) if o["id"].isdigit() else o["id"], o["nombre"], o["depto"], len(F), ", ".join(F)]); cdep[o["depto"]] += len(F)
        total_tarde = sum(cdep.values())
        ct.append([]); ct.append(["", "", "Departamento", "Días"])
        for k, v in cdep.most_common(): ct.append(["", "", k, v])
        ct.append(["", "", "TOTAL", total_tarde])
        for col_, w in zip("ABCDE", [9, 34, 40, 14, 90]): ct.column_dimensions[col_].width = w
        ct.freeze_panes = "A2"

    lg = wb.create_sheet("Leyenda")
    lg.append(["Código", "Significado", "Responsable"]); encabezar(lg, 20)
    for c, t, _, _ in CAT:
        lg.append([c, t, RESP[c]]); cel = lg.cell(lg.max_row, 1); cel.fill, cel.font = EST[c]; cel.alignment = Alignment(horizontal="center")
    lg.append(["(vacío)", "Día libre: sin turno y sin marcaciones", "—"])
    lg.append(["·", "Fuera de vigencia: antes del ingreso o después del retiro", "—"])
    notas = ["",
             f"Periodo: {DIAS[0]} a {DIAS[-1]}.",
             "Archivos de BioTime usados: " + "; ".join(f"{os.path.basename(v)} ({sello(v)})" for v in fuentes.values()) + ".",
             "Días evaluados = suma de los seis códigos. Los días libres y fuera de vigencia no cuentan. Los porcentajes se calculan sobre los días evaluados.",
             "Al pasar el mouse sobre cada día se ven el turno y las marcaciones.",
             "Un turno nocturno trabajado sin programación se cuenta en el día en que empezó; la salida del día siguiente aparece con (+1).",
             "Un día cuenta con turno si lo tiene el Horario o la Vista de horarios programados de BioTime."]
    if viejo:
        notas.append(f"Turnos cargados después: no estaban en el Horario exportado el {sello(anterior)}. Ver la hoja Turnos cargados después.")
    for t in notas: lg.append([t])
    lg.column_dimensions["A"].width, lg.column_dimensions["B"].width, lg.column_dimensions["C"].width = 10, 60, 55
    try:
        wb.save(salida)
    except PermissionError:
        sys.exit(f"No pude guardar {salida}: el archivo está abierto en Excel. Ciérrelo y vuelva a ejecutar.")
    return tot, total_tarde


def main():
    ap = argparse.ArgumentParser(description="Reporte RRHH: calendario de marcación por persona.")
    ap.add_argument("--ini", required=True, help="fecha inicial, AAAA-MM-DD")
    ap.add_argument("--fin", required=True, help="fecha final, AAAA-MM-DD")
    ap.add_argument("--carpeta", default=os.path.join(RAIZ, "archivos"))
    ap.add_argument("--html", default=os.path.join(RAIZ, "reporte-horas.html"))
    ap.add_argument("--horario-anterior", default=None)
    ap.add_argument("--salida", default=None)
    a = ap.parse_args()
    for f in (a.ini, a.fin):
        try: dt.date.fromisoformat(f)
        except ValueError: sys.exit(f"Fecha inválida: {f}. Use el formato AAAA-MM-DD, por ejemplo 2026-09-10.")
    if a.ini > a.fin: sys.exit("La fecha inicial es posterior a la final.")
    if not shutil.which("node"): sys.exit("No encontré Node.js. Instálelo desde nodejs.org y vuelva a intentar.")
    if not os.path.exists(a.html): sys.exit(f"No encontré la herramienta en {a.html}.")
    generado = dt.datetime.now().strftime("%Y%m%d-%H%M")
    salida = a.salida or os.path.join(RAIZ, "informes", f"Reporte_RRHH_Calendario_marcacion_{a.ini}_a_{a.fin}_generado-{generado}.xlsx")
    os.makedirs(os.path.dirname(salida), exist_ok=True)

    fuentes = buscar_archivos(a.carpeta)
    print("Archivos encontrados (el más reciente de cada tipo):")
    for k, v in fuentes.items(): print(f"  {os.path.basename(v)}")
    if "vis" not in fuentes:
        print("  AVISO: no está la Vista de horarios programados. Los turnos se tomarán solo del Horario.")
    if "ren" not in fuentes:
        print("  AVISO: no está el archivo de Renuncias. Los retirados no se reconocerán.")

    crudo = {k: leer(v) for k, v in fuentes.items()}
    vista, fechas_vista = leer_vista(crudo.pop("vis")) if "vis" in crudo else ({}, [])
    if fechas_vista and (fechas_vista[0] > a.ini or fechas_vista[-1] < a.fin):
        print(f"  AVISO: la Vista cubre {fechas_vista[0]} a {fechas_vista[-1]}; fuera de ese rango solo cuenta el Horario.")
    ult = max((iso for (_, iso) in marcaciones(crudo["mar"])), default="")
    if ult and ult < a.fin:
        print(f"  AVISO: las marcaciones llegan hasta {ult}; los días posteriores aparecerán sin marcar.")

    with tempfile.TemporaryDirectory() as tmp:
        ent, sal = os.path.join(tmp, "entrada.json"), os.path.join(tmp, "salida.json")
        with open(ent, "w", encoding="utf-8") as f:
            json.dump({"ini": a.ini, "fin": a.fin, "archivos": crudo, "vista": vista}, f, ensure_ascii=False)
        p = subprocess.run(["node", os.path.join(AQUI, "motor_calendario.js"), a.html, ent, sal], capture_output=True, text=True, encoding="utf-8")
        if p.returncode != 0:
            sys.exit("El motor falló:\n" + (p.stderr or p.stdout)[-3000:])
        print(p.stdout.strip())
        with open(sal, encoding="utf-8") as f: res = json.load(f)

    print("Verificando cada celda contra los archivos originales...")
    ok, fallas, ejemplos = verificar(res, crudo, vista)
    if fallas:
        salida = salida.replace(".xlsx", "_REVISAR.xlsx")
    tot, tarde = armar_excel(res, salida, fuentes, a.horario_anterior)

    print(f"\nPersonas: {len(res['todas'])}  ·  Días evaluados: {sum(tot.get(c, 0) for c, *_ in CAT)}")
    for c, t, _, _ in CAT: print(f"  {c}  {t:<30} {tot.get(c, 0):>7}")
    if a.horario_anterior: print(f"  Turnos cargados después del Horario anterior: {tarde} días")
    if fallas:
        print(f"\nVERIFICACIÓN CON FALLAS ({sum(fallas.values())} celdas). No envíe este archivo sin revisarlo:")
        for k, v in fallas.items(): print(f"  {v:>6}  {k}")
        print("\n".join(ejemplos))
        print(f"\nArchivo: {salida}")
        sys.exit(1)
    print(f"\nVerificación: {ok} celdas confirmadas contra los archivos originales, sin fallas.")
    print(f"Archivo: {salida}")


if __name__ == "__main__":
    main()
