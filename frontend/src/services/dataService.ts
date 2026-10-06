import { supabase } from './supabaseClient';
import defaultConfig from '../data/defaultConfig.json';
import { DEFAULT_TEMPLATE_BASE64 } from '../data/defaultTemplateBase64';

export interface AppConfig {
  documentTypes: any[];
  companyWorkplaces: any[];
  hsecProfessionals: any[];
  variableMappings?: any[];
}

export interface SolicitudRecord {
  id?: string;
  created_at?: string;
  rut: string;
  nombre_completo: string;
  empresa: string;
  faena: string;
  comuna: string;
  cargo_desempeno: string;
  motivo_solicitud: string;
  datos_formulario: Record<string, any>;
}

/**
 * 1. Cargar Configuración Global directamente desde Supabase
 */
export async function getRemoteConfig(): Promise<{ config: AppConfig; source: 'supabase' | 'local' }> {
  try {
    const { data, error } = await supabase
      .from('licencia_configuracion')
      .select('config')
      .eq('id', 'global')
      .maybeSingle();

    if (!error && data && data.config) {
      return { config: data.config as AppConfig, source: 'supabase' };
    }
  } catch (err) {
    console.warn('[DataService] Error consultando config en Supabase:', err);
  }

  return { config: defaultConfig as unknown as AppConfig, source: 'local' };
}

/**
 * 2. Guardar Configuración Global directamente en Supabase
 */
export async function saveRemoteConfig(newConfig: AppConfig): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('licencia_configuracion')
      .upsert({
        id: 'global',
        config: newConfig,
        updated_at: new Date().toISOString()
      });

    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Error de conexión con Supabase.' };
  }
}

/**
 * 3. Obtener Plantilla Activa (.docm / .docx) desde Supabase
 */
export async function getActiveTemplate(): Promise<{ filename: string; binary: Uint8Array }> {
  try {
    const { data, error } = await supabase
      .from('licencia_plantillas')
      .select('filename, archivo_base64')
      .eq('id', 'default')
      .maybeSingle();

    if (!error && data && data.archivo_base64) {
      const byteCharacters = atob(data.archivo_base64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      return {
        filename: data.filename || 'Documentos_Plantilla.docm',
        binary: new Uint8Array(byteNumbers)
      };
    }
  } catch (err) {
    console.warn('[DataService] Error obteniendo plantilla desde Supabase, usando respaldo local:', err);
  }

  // Respaldo local integrado
  const byteCharacters = atob(DEFAULT_TEMPLATE_BASE64);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  return {
    filename: 'Documentos_Plantilla.docm',
    binary: new Uint8Array(byteNumbers)
  };
}

/**
 * 4. Subir Nueva Plantilla (.docm / .docx) directamente a Supabase
 */
export async function uploadActiveTemplate(file: File): Promise<{ success: boolean; filename: string; error?: string }> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    let binaryStr = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binaryStr += String.fromCharCode(bytes[i]);
    }
    const base64 = btoa(binaryStr);

    const { error } = await supabase
      .from('licencia_plantillas')
      .upsert({
        id: 'default',
        filename: 'Documentos_Plantilla.docm',
        archivo_base64: base64,
        updated_at: new Date().toISOString()
      });

    if (error) {
      return { success: false, filename: file.name, error: error.message };
    }
    return { success: true, filename: 'Documentos_Plantilla.docm' };
  } catch (err: any) {
    return { success: false, filename: file.name, error: err.message || 'Error al guardar plantilla en Supabase.' };
  }
}

/**
 * 5. Guardar Registro de Solicitud en Supabase
 */
export async function saveSolicitudRecord(record: {
  rut: string;
  nombre_completo: string;
  empresa: string;
  faena: string;
  comuna: string;
  cargo_desempeno: string;
  motivo_solicitud: string;
  datos_formulario: Record<string, any>;
}): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('solicitudes_licencia')
      .insert([{
        rut: record.rut,
        nombre_completo: record.nombre_completo,
        empresa: record.empresa,
        faena: record.faena,
        comuna: record.comuna,
        cargo_desempeno: record.cargo_desempeno,
        motivo_solicitud: record.motivo_solicitud,
        datos_formulario: record.datos_formulario,
        created_at: new Date().toISOString()
      }])
      .select('id')
      .single();

    if (error) {
      console.error('[DataService] Error al guardar en solicitudes_licencia:', error);
      return { success: false, error: error.message };
    }

    return { success: true, id: data?.id };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * 6. Consultar Todos los Registros de Solicitudes desde Supabase
 */
export async function getSolicitudesRecords(): Promise<{ success: boolean; data: SolicitudRecord[]; source: 'supabase' | 'local' }> {
  try {
    const { data, error } = await supabase
      .from('solicitudes_licencia')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      return { success: true, data: data as SolicitudRecord[], source: 'supabase' };
    }
    console.warn('[DataService] Error listando solicitudes de Supabase:', error);
  } catch (err) {
    console.error('[DataService] Error de conexión:', err);
  }

  return { success: true, data: [], source: 'local' };
}
