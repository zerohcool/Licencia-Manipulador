import fs from 'fs';
import path from 'path';
import PizZip from 'pizzip';
import { DOMParser } from 'xmldom';

export interface ComunaInfo {
  comuna: string;
  provincia: string;
  region: string;
  numeroRegion: string;
}

class ComunasService {
  private comunas: ComunaInfo[] = [];
  private isLoaded = false;

  /**
   * Carga e indexa en memoria las comunas de Chile desde Tabla Ciudades.xlsx
   */
  public init(): void {
    if (this.isLoaded) return;

    // Ruta de Tabla Ciudades.xlsx con búsqueda en backend/data y raíz del proyecto
    const possiblePaths = [
      path.resolve(__dirname, '../../data/Tabla Ciudades.xlsx'),
      path.resolve(__dirname, '../../../Tabla Ciudades.xlsx'),
      path.resolve(process.cwd(), 'backend/data/Tabla Ciudades.xlsx'),
      path.resolve(process.cwd(), 'Tabla Ciudades.xlsx'),
    ];
    const xlsxPath = possiblePaths.find(p => fs.existsSync(p)) || possiblePaths[0];
    console.log('[ComunasService] Cargando comunas desde:', xlsxPath);

    if (!fs.existsSync(xlsxPath)) {
      console.warn('[ComunasService] Advertencia: No se encontró Tabla Ciudades.xlsx.');
      return;
    }

    try {
      const buffer = fs.readFileSync(xlsxPath);
      const zip = new PizZip(buffer);

      // 1. Cargar shared strings
      const sharedStringsXml = zip.file('xl/sharedStrings.xml')?.asText();
      if (!sharedStringsXml) {
        throw new Error('sharedStrings.xml no encontrado en el archivo XLSX.');
      }

      const parser = new DOMParser();
      const ssDoc = parser.parseFromString(sharedStringsXml, 'application/xml');
      const tElements = ssDoc.getElementsByTagName('t');
      const sharedStrings: string[] = [];
      for (let i = 0; i < tElements.length; i++) {
        // Remover espacios rígidos y limpiar texto
        sharedStrings.push((tElements[i].textContent || '').replace(/\u00A0/g, ' ').trim());
      }

      // 2. Cargar hoja de datos
      const sheetXml = zip.file('xl/worksheets/sheet1.xml')?.asText();
      if (!sheetXml) {
        throw new Error('sheet1.xml no encontrado en el archivo XLSX.');
      }

      const sheetDoc = parser.parseFromString(sheetXml, 'application/xml');
      const rows = sheetDoc.getElementsByTagName('row');
      const list: ComunaInfo[] = [];

      // Empezamos en la fila 1 (la fila 0 son las cabeceras: Comuna, Provincia, Región, Número Región)
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const cells = row.getElementsByTagName('c');
        const rowData: string[] = [];

        for (let j = 0; j < cells.length; j++) {
          const cell = cells[j];
          const type = cell.getAttribute('t');
          const valElement = cell.getElementsByTagName('v')[0];
          const val = valElement ? valElement.textContent || '' : '';

          if (type === 's' && val !== '') {
            const strIdx = parseInt(val, 10);
            rowData.push(sharedStrings[strIdx] || '');
          } else {
            rowData.push(val);
          }
        }

        // Mapear columnas: 0=Comuna, 1=Provincia, 2=Región, 3=Número Región
        if (rowData.length >= 4) {
          list.push({
            comuna: rowData[0].toUpperCase(),
            provincia: rowData[1].toUpperCase(),
            region: rowData[2].toUpperCase(),
            numeroRegion: rowData[3].toUpperCase(),
          });
        }
      }

      // Ordenar alfabéticamente por comuna
      this.comunas = list.sort((a, b) => a.comuna.localeCompare(b.comuna));
      this.isLoaded = true;
      console.log(`[ComunasService] Éxito: ${this.comunas.length} comunas cargadas desde Excel.`);
    } catch (err: any) {
      console.error('[ComunasService] Error al inicializar comunas desde Excel:', err);
    }
  }

  public getComunas(): ComunaInfo[] {
    if (!this.isLoaded) this.init();
    return this.comunas;
  }

  public getComunaInfo(name: string): ComunaInfo | undefined {
    if (!this.isLoaded) this.init();
    const upperName = name.toUpperCase();
    return this.comunas.find(c => c.comuna === upperName);
  }
}

export const comunasService = new ComunasService();
