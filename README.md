# hikagen

Landing page para startup con React + Vite (preparada para Firebase).

## Requisitos

- Node.js 20+
- npm 10+

## Cómo levantar el proyecto

1. Instalar dependencias:

```bash
npm install
```

2. Crear variables de entorno locales:

```bash
copy .env.example .env.local
```

3. Iniciar en desarrollo:

```bash
npm run dev
```

4. Build de producción:

```bash
npm run build
```

5. Previsualizar build:

```bash
npm run preview
```

## Estructura de carpetas (best practices)

```text
src/
	app/          # App principal y estilos de shell
	assets/       # Imágenes, íconos, fuentes
	components/   # Componentes UI reutilizables
	sections/     # Secciones de la landing (Hero, Features, CTA...)
	hooks/        # Hooks personalizados
	services/     # Lógica de integración externa (APIs)
	lib/          # Inicialización de librerías (Firebase, etc.)
	constants/    # Constantes globales
	data/         # Contenido estático de la landing
	styles/       # Estilos globales y utilidades
	main.jsx      # Punto de entrada
```

## Firebase

- Configuración en `src/lib/firebase.js`
- Variables en `.env.local`


