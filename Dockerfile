# Imagen base oficial de Node.js en Debian
FROM node:20-slim

# Instalar LibreOffice y fuentes esenciales de alta calidad para renderizado perfecto de documentos
RUN apt-get update && apt-get install -y --no-install-recommends \
    libreoffice \
    libreoffice-writer \
    fonts-liberation \
    fonts-dejavu \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copiar archivos raíz de configuración y plantillas requeridas
COPY "Tabla Ciudades.xlsx" ./
COPY "Documentos Plantilla.docm" ./
COPY package.json ./

# 1. Instalar y compilar Backend
COPY backend/package*.json ./backend/
RUN cd backend && npm install
COPY backend/ ./backend/
RUN cd backend && npm run build

# 2. Instalar y compilar Frontend
COPY frontend/package*.json ./frontend/
RUN cd frontend && npm install
COPY frontend/ ./frontend/
RUN cd frontend && npm run build

# Configuración de variables de entorno de producción
ENV PORT=3001
ENV NODE_ENV=production

EXPOSE 3001

# Ejecutar el servidor Express (el cual sirve la API y el Frontend compilado)
CMD ["node", "backend/dist/server.js"]
