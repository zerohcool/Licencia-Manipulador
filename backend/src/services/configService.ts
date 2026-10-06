import fs from 'fs';
import path from 'path';
import PizZip from 'pizzip';

export interface DocumentConfig {
  tituloCartola: string;
  solicitaInscribirseComo: string;
  af: string;
  categoria: string;
  inscritoRegNacComo: string;
  conElN: string;
  observacion: string;
  titulo1: string;
  titulo2: string;
  titulo3: string;
  desempenarseComo: string;
}

export interface DocumentType {
  id: string;
  name: string;
  templateFilename: string;
  config: DocumentConfig;
}

export interface CompanyWorkplace {
  id: string;
  companyName: string;
  companyRut: string;
  workplaceName: string;
  comuna: string;
  workArea: string;
}

export interface HsecProfessional {
  id: string;
  name: string;
  rut: string;
  sns: string;
  resolution: string;
}

export interface VariableMapping {
  id: string;
  description: string;
  formField: string;
  wordPlaceholder: string;
}

export interface AppConfig {
  documentTypes: DocumentType[];
  companyWorkplaces: CompanyWorkplace[];
  hsecProfessionals: HsecProfessional[];
  variableMappings: VariableMapping[];
}

const CONFIG_PATH = path.join(__dirname, '../../data/config.json');
const TEMPLATES_DIR = path.join(__dirname, '../../templates');

class ConfigService {
  private config: AppConfig | null = null;

  /**
   * Carga la configuración del archivo config.json
   */
  public getConfig(): AppConfig {
    if (this.config) return this.config;

    try {
      if (fs.existsSync(CONFIG_PATH)) {
        const data = fs.readFileSync(CONFIG_PATH, 'utf8');
        this.config = JSON.parse(data);
      } else {
        throw new Error('Archivo config.json no existe.');
      }
    } catch (err) {
      console.error('[ConfigService] Error cargando config.json, inicializando por defecto:', err);
      this.config = {
        documentTypes: [],
        companyWorkplaces: [],
        hsecProfessionals: [],
        variableMappings: []
      };
      this.saveConfig();
    }

    return this.config!;
  }

  /**
   * Guarda la configuración en config.json
   */
  public saveConfig(): void {
    if (!this.config) return;
    try {
      fs.writeFileSync(CONFIG_PATH, JSON.stringify(this.config, null, 2), 'utf8');
      console.log('[ConfigService] Configuración guardada en disco.');
    } catch (err) {
      console.error('[ConfigService] Error al guardar config.json:', err);
    }
  }

  /**
   * Actualiza el objeto de configuración y lo persiste
   */
  public updateConfig(newConfig: AppConfig): void {
    this.config = newConfig;
    this.saveConfig();
  }

  /**
   * Extrae todas las variables MERGEFIELD únicas de una plantilla de Word (.docx / .docm)
   */
  public analyzeTemplateVariables(templateBuffer: Buffer): {
    variables: string[];
    missing: string[];
    extra: string[];
  } {
    const zip = new PizZip(templateBuffer);
    const files = zip.files;
    const foundVariables = new Set<string>();

    // Buscar en todos los XML de texto del zip
    for (const fileName in files) {
      if (fileName.endsWith('.xml') && (
        fileName.startsWith('word/document') ||
        fileName.startsWith('word/header') ||
        fileName.startsWith('word/footer')
      )) {
        const file = zip.file(fileName);
        if (file) {
          const xmlText = file.asText();
          
          // Regex para encontrar "MERGEFIELD nombre_variable" (soporta eñes, acentos y comillas)
          const regex = /MERGEFIELD\s+"?([^"\s\\><]+)"?/gi;
          let match;
          while ((match = regex.exec(xmlText)) !== null) {
            foundVariables.add(match[1]);
          }
        }
      }
    }

    const variables = Array.from(foundVariables);
    
    // Obtener variables dinámicas requeridas
    const required = this.getConfig().variableMappings.map(v => v.wordPlaceholder);

    // Comparar contra variables esperadas
    const missing = required.filter(v => !foundVariables.has(v));
    const extra = variables.filter(v => !required.includes(v));

    return {
      variables,
      missing,
      extra
    };
  }

  /**
   * Reemplaza la plantilla Word física
   */
  public saveTemplateFile(documentTypeId: string, fileBuffer: Buffer, originalName: string): string {
    if (!fs.existsSync(TEMPLATES_DIR)) {
      fs.mkdirSync(TEMPLATES_DIR, { recursive: true });
    }

    const ext = path.extname(originalName) || '.docx';
    const filename = `Documentos_Plantilla.docm`; // Forzar nombre de plantilla única predeterminada
    const destPath = path.join(TEMPLATES_DIR, filename);

    // Guardar el archivo
    fs.writeFileSync(destPath, fileBuffer);
    console.log(`[ConfigService] Plantilla guardada como plantilla global única en: ${destPath}`);

    // Actualizar nombre de archivo en config para todos los tipos de documento
    const conf = this.getConfig();
    conf.documentTypes.forEach(d => {
      d.templateFilename = filename;
    });
    this.saveConfig();

    return filename;
  }
}

export const configService = new ConfigService();
export const REQUIRED_VARIABLES = configService.getConfig().variableMappings.map(v => v.wordPlaceholder);
