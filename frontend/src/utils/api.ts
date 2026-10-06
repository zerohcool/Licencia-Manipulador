/**
 * Utilidad unificada para resolver las URLs del backend.
 * Soporta:
 * - VITE_API_URL configurada (ej: en Vercel apuntando al backend en la nube)
 * - Proxy local (/api) en desarrollo con Vite
 * - Mismo host en Docker / Producción unificada
 * - Fallback automático a http://localhost:3001 si está en desarrollo local
 */
const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

export function apiUrl(path: string): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  if (API_BASE) {
    return `${API_BASE}${cleanPath}`;
  }
  return cleanPath;
}

export async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const primaryUrl = apiUrl(path);
  try {
    const res = await fetch(primaryUrl, options);
    // Si la respuesta es 404 o no OK y estamos usando ruta relativa en localhost sin proxy activo
    if ((res.status === 404 || res.status === 502) && !API_BASE && window.location.hostname === 'localhost') {
      const fallbackUrl = `http://localhost:3001${path.startsWith('/') ? path : `/${path}`}`;
      return await fetch(fallbackUrl, options);
    }
    return res;
  } catch (err) {
    // Si hubo error de conexión de red y estamos en localhost
    if (!API_BASE && window.location.hostname === 'localhost') {
      const fallbackUrl = `http://localhost:3001${path.startsWith('/') ? path : `/${path}`}`;
      return await fetch(fallbackUrl, options);
    }
    throw err;
  }
}
