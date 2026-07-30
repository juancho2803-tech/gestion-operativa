# Tablero Taller — Resumen

Tablero BI para unificar el seguimiento de órdenes de taller VW (chapa/pintura,
garantía, interna, externa) con carga diaria de la base y persistencia
compartida vía Google Sheets + Apps Script.

## Estructura del repo

```
index.html      → el tablero (frontend, se hostea con GitHub Pages)
gas/Code.gs      → backend Apps Script (se pega en el editor de Google Sheets)
```

## 1. Backend (Apps Script + Google Sheets)

1. Creá una Google Sheet nueva (o usá una existente) — va a ser la base de datos.
2. Extensiones → Apps Script.
3. Borrá el contenido de `Code.gs` que viene por defecto y pegá el contenido
   de `gas/Code.gs` de este repo.
4. Guardá el proyecto.
5. Implementar → Nueva implementación → tipo **Aplicación web**.
   - Ejecutar como: **Yo**
   - Quién tiene acceso: **Cualquier usuario**
6. Autorizá los permisos que pida Google (es tu propia cuenta/Sheet).
7. Copiá la **URL de la aplicación web** que te da al finalizar
   (termina en `/exec`).

Cada vez que vuelvas a implementar una versión nueva del script (por cambios
futuros), la URL se mantiene si elegís "Editar implementación existente" en
vez de crear una nueva.

## 2. Conectar el frontend

1. Abrí `index.html` (local o ya publicado en GitHub Pages).
2. Click en el ícono de engranaje (⚙) junto al selector de tema.
3. Pegá la URL `.../exec` que copiaste del paso anterior → **Guardar**.
4. A partir de ahí, cada carga de base (.xlsx/.csv) se guarda automáticamente
   en la Google Sheet, y al abrir el tablero desde cualquier compu se trae
   la última base cargada.

Sin esa URL configurada, el tablero sigue funcionando igual pero guarda los
datos solo en el navegador (localStorage) — útil para probar antes de
conectar el backend.

## 3. Publicar en GitHub Pages

```
git init
git add .
git commit -m "Bloque 1: tablero resumen + backend Apps Script"
git branch -M main
git remote add origin https://github.com/TU-USUARIO/tablero-taller-vw.git
git push -u origin main
```

Repo → Settings → Pages → Source: "Deploy from a branch" → `main` / `/ (root)`.
Queda accesible en `https://TU-USUARIO.github.io/tablero-taller-vw/`.
