-- ==============================================================================
-- Tabla: solicitudes_licencia
-- Base de datos: Webapp Dashboard KPI (Supabase eaahnurknumayzvubwep)
-- Descripción: Almacena los registros de solicitudes de licencia manipulador
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.solicitudes_licencia (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    rut TEXT NOT NULL,
    nombre_completo TEXT NOT NULL,
    empresa TEXT,
    faena TEXT,
    comuna TEXT,
    cargo_desempeno TEXT,
    motivo_solicitud TEXT,
    datos_formulario JSONB NOT NULL
);

-- Desactivar Row Level Security (RLS) para permitir lectura e inserción directa
ALTER TABLE public.solicitudes_licencia DISABLE ROW LEVEL SECURITY;

-- Índices para búsqueda y ordenamiento eficiente
CREATE INDEX IF NOT EXISTS idx_solicitudes_rut ON public.solicitudes_licencia(rut);
CREATE INDEX IF NOT EXISTS idx_solicitudes_created_at ON public.solicitudes_licencia(created_at DESC);

COMMENT ON TABLE public.solicitudes_licencia IS 'Registro histórico de solicitudes de licencia manipulador de explosivos';
