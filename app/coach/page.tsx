"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type Drill = "globo-dejada" | "peloteo";
type Zone = "corta" | "media" | "profunda";

const BOUNCES: Array<{ x: number; y: number; zone: Zone; kind: string }> = [
  { x: 28, y: 22, zone: "profunda", kind: "globo" },
  { x: 62, y: 68, zone: "corta", kind: "dejada" },
  { x: 34, y: 40, zone: "media", kind: "FH" },
  { x: 70, y: 36, zone: "media", kind: "BH" },
  { x: 24, y: 18, zone: "profunda", kind: "globo" },
  { x: 58, y: 72, zone: "corta", kind: "dejada" },
  { x: 40, y: 48, zone: "media", kind: "FH" },
  { x: 76, y: 30, zone: "profunda", kind: "BH" }
];

const BIO = [
  { label: "Altura de contacto", value: 72, hint: "Globo: ir a 85%+" },
  { label: "Rotacion hombros", value: 54, hint: "Separar cadera/hombro" },
  { label: "Flexion rodilla", value: 61, hint: "Estable al pegar" },
  { label: "Base / stance", value: 48, hint: "Un poco estrecha" }
];

export default function CoachPage() {
  const [drill, setDrill] = useState<Drill>("globo-dejada");
  const [mode, setMode] = useState<"uno" | "dos">("uno");

  const stats = useMemo(() => {
    const deep = BOUNCES.filter((b) => b.zone === "profunda").length;
    const short = BOUNCES.filter((b) => b.zone === "corta").length;
    const mid = BOUNCES.filter((b) => b.zone === "media").length;
    return { deep, short, mid, total: BOUNCES.length, rally: 6 };
  }, []);

  return (
    <div className="coach">
      <header className="coach-top">
        <div>
          <p className="eyebrow">CLASE · POLVO</p>
          <h1>Ficha de cancha</h1>
        </div>
        <Link className="ghost" href="/">Lab live</Link>
      </header>

      <section className="coach-hero">
        <article className="student">
          <div className="avatar">AM</div>
          <div>
            <h2>Alumno demo</h2>
            <p>Martes 11:30 · 45 min · derecha</p>
          </div>
          <div className="pills">
            <button className={drill === "globo-dejada" ? "on" : ""} onClick={() => setDrill("globo-dejada")}>Globo–dejada</button>
            <button className={drill === "peloteo" ? "on" : ""} onClick={() => setDrill("peloteo")}>Peloteo</button>
            <button className={mode === "uno" ? "on" : ""} onClick={() => setMode("uno")}>1 alumno</button>
            <button className={mode === "dos" ? "on" : ""} onClick={() => setMode("dos")}>De a dos</button>
          </div>
        </article>
        <div className="hero-kpis">
          <div><span>Golpes</span><b>{stats.total}</b></div>
          <div><span>Profundas</span><b>{stats.deep}</b></div>
          <div><span>Cortas</span><b>{stats.short}</b></div>
          <div><span>Rally max</span><b>{stats.rally}</b></div>
        </div>
      </section>

      <section className="coach-grid">
        <div className="panel court-panel">
          <div className="panel-h">
            <h3>Mini cancha · piques</h3>
            <small>amarillo globo · lima dejada · blanco resto</small>
          </div>
          <MiniCourt />
          <ul className="legend">
            <li><i className="z deep" /> profunda {stats.deep}</li>
            <li><i className="z mid" /> media {stats.mid}</li>
            <li><i className="z short" /> corta {stats.short}</li>
          </ul>
        </div>

        <div className="panel">
          <div className="panel-h"><h3>Biomecanica del golpe</h3><small>MediaPipe · coordenadas mundo</small></div>
          {BIO.map((row) => (
            <div className="meter" key={row.label}>
              <div className="meter-l">
                <span>{row.label}</span>
                <b>{row.value}</b>
              </div>
              <div className="bar"><span style={{ width: `${row.value}%` }} /></div>
              <em>{row.hint}</em>
            </div>
          ))}
          <p className="tip">
            En globo–dejada mira el contraste: el globo tiene que nacer alto; la dejada, swing corto y pique en {mode === "dos" ? "el cuadro de saque del rival" : "la zona corta"}.
          </p>
        </div>

        <div className="panel wide">
          <div className="panel-h"><h3>Notas de la serie</h3></div>
          <ol className="notes">
            <li>3 globos se quedaron a altura de pecho — pedir contacto por encima del hombro.</li>
            <li>Las dejadas salen, pero 2 pican media: frenar antes el swing.</li>
            <li>En peloteo de a dos, el alumno pierde profundidad despues del tercer tiro.</li>
          </ol>
        </div>
      </section>
    </div>
  );
}

function MiniCourt() {
  return (
    <svg className="mini" viewBox="0 0 200 360" role="img" aria-label="Mini cancha de polvo">
      <rect width="200" height="360" fill="#b3542a" />
      <rect x="18" y="16" width="164" height="328" fill="none" stroke="#f4efe6" strokeWidth="2" />
      <line x1="18" y1="180" x2="182" y2="180" stroke="#f4efe6" strokeWidth="3" />
      <rect x="46" y="16" width="108" height="328" fill="none" stroke="#f4efe6" strokeWidth="1.4" />
      <line x1="46" y1="86" x2="154" y2="86" stroke="#f4efe6" strokeWidth="1.4" />
      <line x1="46" y1="274" x2="154" y2="274" stroke="#f4efe6" strokeWidth="1.4" />
      <line x1="100" y1="86" x2="100" y2="274" stroke="#f4efe6" strokeWidth="1.2" />
      <text x="24" y="34" fill="#f4efe6" fontSize="8" opacity="0.7">profunda</text>
      <text x="24" y="352" fill="#f4efe6" fontSize="8" opacity="0.7">corta</text>
      {BOUNCES.map((b, i) => (
        <circle
          key={i}
          cx={18 + (b.x / 100) * 164}
          cy={16 + (b.y / 100) * 328}
          r="5"
          fill={b.kind === "globo" ? "#f5c542" : b.kind === "dejada" ? "#c8f542" : "#f4efe6"}
        />
      ))}
    </svg>
  );
}
