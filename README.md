# Tennis CV Lab

Lab web para testear un tracker de práctica de tenis contra la pared.

No es el pipeline original de [collidingScopes/tennis-cv](https://github.com/collidingScopes/tennis-cv) (Python + Roboflow + RF-DETR + Kalman). Ese código no existe en el repo original y no corre en Vercel.

Este lab sí corre en Vercel:

- **Demo** sintética (rally + overlays + stats) para probar ya
- **Cámara** del browser
- **Upload** de un video
- Pose con MediaPipe en el cliente
- Pelota por color amarillo/lima
- Conteo de golpes, forehand/backhand, velocidad estimada, mapa de impactos

## Cómo probar

1. Abrí el deploy de Vercel
2. Tocá **Probar demo** — tiene que contar golpes solo
3. O subí un clip filmado con trípode contra la pared, pelota visible
4. Cargá la distancia jugador–pared en metros para la escala de velocidad

## Local

```bash
npm install
npm run dev
```

## Límites honestos

- Sin modelo RF-DETR entrenado, la pelota real depende del color y la luz
- Velocidad es estimación 2D, no Hawk-Eye
- El procesamiento es 100% en el browser: no hay GPU serverless
