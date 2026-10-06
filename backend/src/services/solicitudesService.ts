import { createClient, SupabaseClient } from '@supabase/supabase-js';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config({ path: path.join(__dirname, '../../.env') });

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

class SolicitudesService {
  private supabase: SupabaseClient | null = null;
  private localFilePath: string;

  constructor() {
    this.localFilePath = path.join(__dirname, '../../data/solicitudes_registros.json');
    this.ensureLocalDir();
    this.initSupabase();
  }

  private ensureLocalDir() {
    const dir = path.dirname(this.localFilePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    if (!fs.existsSync(this.localFilePath)) {
      fs.writeFileSync(this.localFilePath, JSON.stringify([], null, 2), 'utf-8');
    }
  }

  private initSupabase() {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_ANON_KEY;

    if (url && key) {
      try {
        this.supabase = createClient(url, key);
        console.log('[SolicitudesService] Cliente de Supabase inicializado con:', url);
      } catch (err) {
        console.error('[SolicitudesService] Error al inicializar cliente Supabase:', err);
      }
    } else {
      console.warn('[SolicitudesService] SUPABASE_URL o SUPABASE_ANON_KEY no configurados en .env');
    }
  }

  private getLocalRecords(): SolicitudRecord[] {
    try {
      if (fs.existsSync(this.localFilePath)) {
        const raw = fs.readFileSync(this.localFilePath, 'utf-8');
        return JSON.parse(raw);
      }
    } catch (err) {
      console.error('[SolicitudesService] Error al leer archivo local de solicitudes:', err);
    }
    return [];
  }

  private saveLocalRecord(record: SolicitudRecord) {
    try {
      const records = this.getLocalRecords();
      // Si ya existe (mismo id), actualizar; si no, agregar al inicio
      const existingIdx = records.findIndex(r => r.id === record.id);
      if (existingIdx >= 0) {
        records[existingIdx] = record;
      } else {
        records.unshift(record);
      }
      fs.writeFileSync(this.localFilePath, JSON.stringify(records, null, 2), 'utf-8');
    } catch (err) {
      console.error('[SolicitudesService] Error al guardar en archivo local:', err);
    }
  }

  /**
   * Guarda un nuevo registro de solicitud en Supabase y en la copia local
   */
  async saveSolicitud(record: SolicitudRecord): Promise<{ success: boolean; id: string; source: 'supabase' | 'local'; error?: string }> {
    const fallbackId = record.id || `local-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const fullRecord: SolicitudRecord = {
      ...record,
      id: record.id || fallbackId,
      created_at: record.created_at || new Date().toISOString()
    };

    // Siempre guardar en copia local de respaldo
    this.saveLocalRecord(fullRecord);

    if (this.supabase) {
      try {
        const { data, error } = await this.supabase
          .from('solicitudes_licencia')
          .insert([{
            rut: record.rut,
            nombre_completo: record.nombre_completo,
            empresa: record.empresa,
            faena: record.faena,
            comuna: record.comuna,
            cargo_desempeno: record.cargo_desempeno,
            motivo_solicitud: record.motivo_solicitud,
            datos_formulario: record.datos_formulario
          }])
          .select('id, created_at')
          .single();

        if (error) {
          console.warn('[SolicitudesService] Advertencia Supabase al insertar (guardado local preservado):', error.message);
          return {
            success: true,
            id: fullRecord.id || fallbackId,
            source: 'local',
            error: error.message
          };
        }

        if (data) {
          fullRecord.id = data.id;
          fullRecord.created_at = data.created_at;
          this.saveLocalRecord(fullRecord); // Actualizar ID generado por Supabase
          return {
            success: true,
            id: data.id,
            source: 'supabase'
          };
        }
      } catch (err: any) {
        console.error('[SolicitudesService] Error de conexión con Supabase:', err);
      }
    }

    return {
      success: true,
      id: fullRecord.id || fallbackId,
      source: 'local'
    };
  }

  /**
   * Obtiene la lista completa de solicitudes (desde Supabase o respaldo local)
   */
  async getSolicitudes(): Promise<{ success: boolean; data: SolicitudRecord[]; source: 'supabase' | 'local' }> {
    if (this.supabase) {
      try {
        const { data, error } = await this.supabase
          .from('solicitudes_licencia')
          .select('*')
          .order('created_at', { ascending: false });

        if (!error && Array.isArray(data)) {
          // Actualizar caché local
          fs.writeFileSync(this.localFilePath, JSON.stringify(data, null, 2), 'utf-8');
          return { success: true, data, source: 'supabase' };
        } else if (error) {
          console.warn('[SolicitudesService] Error consultando Supabase, usando respaldo local:', error.message);
        }
      } catch (err: any) {
        console.error('[SolicitudesService] Error al conectar con Supabase en getSolicitudes:', err);
      }
    }

    const localData = this.getLocalRecords();
    return { success: true, data: localData, source: 'local' };
  }

  /**
   * Obtiene una solicitud específica por su ID
   */
  async getSolicitudById(id: string): Promise<SolicitudRecord | null> {
    if (this.supabase) {
      try {
        const { data, error } = await this.supabase
          .from('solicitudes_licencia')
          .select('*')
          .eq('id', id)
          .maybeSingle();

        if (!error && data) {
          return data;
        }
      } catch (err) {
        console.error('[SolicitudesService] Error buscando por ID en Supabase:', err);
      }
    }

    const localRecords = this.getLocalRecords();
    return localRecords.find(r => r.id === id) || null;
  }
}

export const solicitudesService = new SolicitudesService();
