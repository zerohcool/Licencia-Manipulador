# Solicitud de Licencia de Manipulador - WebApp

Esta es una aplicación web moderna (React + TypeScript + Vite + Node.js + Express) diseñada para rellenar automáticamente plantillas de Word (`.docx` o `.docm` con campos de correspondencia nativos `MERGEFIELD`) con los datos ingresados en un formulario interactivo paso a paso, guardando cada solicitud en Supabase y convirtiéndolos instantáneamente a PDF mediante LibreOffice en modo Headless para su visualización y descarga.

---

## Características Principales

- **Formulario Premium Multi-pasos**: Formulario interactivo dividido en 5 pasos lógicos (Datos Personales, Contacto, Solicitud, Prevención de Riesgos y Confirmación) para hacer la carga de más de 30 campos una experiencia cómoda y fluida.
- **Selectores de Fecha con Calendario (@daypicker/react)**: DatePickers estilizados en español con formato estandarizado obligatorio `dd-mm-yyyy`.
- **Procesador XML de Word Nativo**: Lógica a nivel de ZIP/XML en Node.js que analiza el archivo `.docm` y reemplaza los marcadores `MERGEFIELD` de correspondencia complejos y simples, garantizando que el diseño, tipografías, alineaciones y estilos originales del documento Word se conserven al 100%.
- **Conversor a PDF Headless**: Integración con LibreOffice Headless con aislamiento de perfiles de usuario y codificación URL para evitar bloqueos del sistema o conflictos de archivos.
- **Visualizador de PDF**: Visor integrado en tiempo real directamente en la aplicación web para validar el documento antes de realizar la descarga.
- **Seguridad Administrativa**: Panel de Configuración General y Panel de Registros protegidos con contraseña de administrador (`Enaex.2026`).
- **Historial de Registros en Base de Datos (Supabase)**: Cada generación de documento se almacena en la tabla `solicitudes_licencia` (integrada en la base de datos de Dashboard KPI) y cuenta con respaldo local JSON failover. El administrador puede consultar registros históricos y cargarlos en el formulario ("⚡ Cargar en Formulario") para generar nuevos documentos rápidamente.
- **Gestión de Plantillas y Descargas**: Permite al administrador descargar la plantilla `.docm` actualmente en uso y actualizar mapeos de campos dinámicamente.

---

## Requisitos de Entorno

### 1. Node.js
Es necesario tener instalado Node.js (versión 18 o superior).

### 2. LibreOffice (macOS / Linux / Windows)
La conversión headless a PDF requiere que LibreOffice esté instalado.
En macOS se encuentra en:
`/Applications/LibreOffice.app`

*(En caso de reinstalación en macOS: `brew install --cask libreoffice`)*

### 3. Configuración de Base de Datos (Supabase)
La aplicación guarda cada solicitud en la base de datos Supabase en la tabla `solicitudes_licencia`.

Para crear la tabla en Supabase, ejecuta el script SQL incluido en el proyecto:
[`supabase_solicitudes_licencia.sql`](supabase_solicitudes_licencia.sql)

```sql
CREATE TABLE IF NOT EXISTS public.solicitudes_licencia (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  rut TEXT NOT NULL,
  nombre_completo TEXT NOT NULL,
  empresa TEXT,
  faena TEXT,
  comuna TEXT,
  cargo_desempeno TEXT,
  motivo_solicitud TEXT,
  datos_formulario JSONB NOT NULL
);
```

---

## Variables de Entorno (Backend)

Crea el archivo `backend/.env` basándote en `backend/.env.example`:

```env
PORT=3001
ADMIN_PASSWORD=Enaex.2026
SUPABASE_URL=https://<tu-proyecto>.supabase.co
SUPABASE_ANON_KEY=<tu-supabase-anon-key>
```

---

## Estructura del Proyecto

```
├── backend/                              # Servidor API Express (TypeScript)
│   ├── .env.example                      # Plantilla de variables de entorno
│   ├── data/
│   │   └── config.json                   # Mapeo de campos, empresas y plantillas
│   ├── src/
│   │   ├── server.ts                     # Servidor Express, endpoints y auth
│   │   └── services/
│   │       ├── docxProcessor.ts          # Motor de reemplazo de MERGEFIELDs
│   │       ├── pdfConverter.ts           # Conversión a PDF vía LibreOffice
│   │       ├── comunasService.ts         # Provincias, regiones y comunas
│   │       ├── configService.ts          # Gestión de configuración de campos
│   │       └── solicitudesService.ts     # Integración Supabase + respaldo local
│   └── templates/                        # Plantillas Word oficiales (.docm)
├── frontend/                             # Aplicación Web React (TypeScript + Vite)
│   ├── src/
│   │   ├── App.tsx                       # Vista principal y navegación
│   │   ├── components/
│   │   │   ├── AdminAuthModal.tsx        # Modal de autenticación admin
│   │   │   ├── ConfigPanel.tsx           # Panel de configuración general
│   │   │   ├── DatePicker.tsx            # Selector de fechas dd-mm-yyyy
│   │   │   └── RegistrosPanel.tsx        # Panel de historial y recarga de datos
│   │   └── index.css                     # Sistema de diseño y estilos UI
└── supabase_solicitudes_licencia.sql     # Script DDL para la tabla en Supabase
```

---

## Instrucciones para Ejecución Local

Para levantar la aplicación, necesitas iniciar tanto el servidor backend como el cliente frontend. Abre dos pestañas de terminal en el directorio raíz del proyecto:

### Paso 1: Iniciar el Backend (Servidor Express)
1. Ve al directorio del backend e instala dependencias:
   ```bash
   cd backend
   npm install
   ```
2. Ejecuta el servidor en modo de desarrollo:
   ```bash
   npm run dev
   ```
   *El servidor se iniciará en `http://localhost:3001`.*

### Paso 2: Iniciar el Frontend (React + Vite)
1. Ve al directorio del frontend e instala dependencias:
   ```bash
   cd ../frontend
   npm install
   ```
2. Ejecuta el servidor de desarrollo de Vite:
   ```bash
   npm run dev
   ```
   *La WebApp estará disponible en `http://localhost:5173`.*

---

## Acceso Administrador

- **Contraseña de Administrador**: `Enaex.2026`
- Da acceso al panel de **Configuración General** (gestión de plantillas, descarga de muestras y campos) y a la vista **Historial Registros** (consulta de solicitudes y carga en el formulario).
