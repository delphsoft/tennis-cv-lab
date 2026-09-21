# Ordenes de trabajo — Tennis CV Lab (polvo, clase)

Cancha: polvo. Drill inicial: globo–dejada. Modo: alumno solo y peloteo de a dos.

## OT-01 — Filmacion de campo
**Duenio:** profe en cancha  
**Salida:** 20 clips en una carpeta `clips/`

Checklist del tripode:
- [ ] Celular fijo, 3–4 m de alto, esquina o fondo de alambrado
- [ ] Encaje las dos mitades de cancha o al menos de red a baseline del alumno
- [ ] 8 clips globo–dejada (1 alumno)
- [ ] 8 clips peloteo de a dos
- [ ] 4 clips con contraluz / sombra de red
- [ ] 30–90 s cada uno, 1080p, 30 o 60 fps
- [ ] Anotar distancia aproximada camara–red

## OT-02 — Frames para Roboflow
**Duenio:** notebook / PC  
**Script:** `python scripts/extract_frames.py clips/ --out dataset/frames --fps 2`

- [ ] ~200–250 jpg
- [ ] Fork en Roboflow: Tennis Ball & Players Detector (Clay + Hard)
- [ ] Clases: `ball`, `player`, `racket`, `net`
- [ ] Auto-label + revision manual (pelota inventada y blur)

## OT-03 — Lineas de cancha (OpenCV)
**Duenio:** mismo PC  
**Script:** `python scripts/detect_court_lines.py clips/primer_clip.mp4 --every 15 --out out_court`

- [ ] Verificar overlay: lineas H cyan, V verde, quad amarillo
- [ ] Si no hay quad: subir contraste / cambiar angulo / limpiar linea de fondo
- [ ] Guardar un JSON bueno como referencia de homografia

## OT-04 — Fine-tune detector
**Duenio:** Roboflow  
- [ ] Entrenar RF-DETR medium, input 1024
- [ ] Augment solo brillo/exposicion (luz de polvo)
- [ ] Endpoint hosted para inferencia (no Vercel)
- [ ] TrackNet pretrained como plan B de trayectoria

## OT-05 — Ficha de clase + biomecanica
**Duenio:** lab web `/coach`  
Por golpe mostrar:
- tipo (FH / BH / globo / dejada)
- zona de pique (corta / media / profunda)
- altura de contacto
- rotacion hombros
- flexión de rodilla
- clip overlay para el alumno

Historial por alumno en Vercel. Procesado de video afuera.
