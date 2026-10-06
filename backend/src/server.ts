import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import multer from 'multer';
import { fillMergeFields } from './services/docxProcessor';
import { convertToPdf } from './services/pdfConverter';
import { configService } from './services/configService';
import { comunasService } from './services/comunasService';
import { solicitudesService } from './services/solicitudesService';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Enaex.2026';

// Middleware de autenticación para administradores
function requireAdmin(req: express.Request, res: express.Response, next: express.NextFunction) {
  const authHeader = req.headers['x-admin-password'];
  if (!authHeader || authHeader !== ADMIN_PASSWORD) {
    return res.status(403).json({
      success: false,
      error: 'Acceso no autorizado. Se requiere la contraseña de administrador.'
    });
  }
  next();
}

// Configuración de directorios
const TEMPLATES_DIR = path.join(__dirname, '../templates');
const TEMP_DIR = path.join(__dirname, '../temp');

// Asegurar que los directorios existan
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}
if (!fs.existsSync(TEMPLATES_DIR)) {
  fs.mkdirSync(TEMPLATES_DIR, { recursive: true });
}

// Inicializar catálogo de comunas de Chile desde Excel
comunasService.init();

app.use(cors());
app.use(express.json());

// Servir la carpeta temporal estáticamente para la previsualización del PDF
app.use('/temp', express.static(TEMP_DIR));

// Configuración de Multer para recibir plantillas en memoria
const upload = multer({ storage: multer.memoryStorage() });

/**
 * Convierte cualquier fecha válida o string (YYYY-MM-DD, ISO, Date) a formato estricto dd-mm-yyyy
 */
function formatDateToDDMMYYYY(dateInput: any): string {
  if (!dateInput) return '';

  if (typeof dateInput === 'string') {
    const trimmed = dateInput.trim();
    // Formato YYYY-MM-DD o YYYY/MM/DD
    const isoMatch = trimmed.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
    if (isoMatch) {
      const year = isoMatch[1];
      const month = isoMatch[2].padStart(2, '0');
      const day = isoMatch[3].padStart(2, '0');
      return `${day}-${month}-${year}`;
    }
    // Formato DD-MM-YYYY o DD/MM/YYYY
    const dmyMatch = trimmed.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
    if (dmyMatch) {
      const day = dmyMatch[1].padStart(2, '0');
      const month = dmyMatch[2].padStart(2, '0');
      const year = dmyMatch[3];
      return `${day}-${month}-${year}`;
    }
  }

  const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (isNaN(d.getTime())) return String(dateInput);

  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
}


/**
 * 1. Endpoint para obtener el listado de comunas de Chile (cargado desde Excel)
 */
app.get('/api/comunas', (req, res) => {
  try {
    const list = comunasService.getComunas();
    return res.json({ success: true, comunas: list });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * 2. Endpoint para obtener la configuración completa
 */
app.get('/api/config', (req, res) => {
  try {
    const config = configService.getConfig();
    return res.json({ success: true, config });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * 2.1 Endpoint para verificar la contraseña del Administrador
 */
app.post('/api/admin/verify', (req, res) => {
  const { password } = req.body;
  if (password === ADMIN_PASSWORD) {
    return res.json({ success: true, message: 'Acceso autorizado como Administrador.' });
  }
  return res.status(401).json({ success: false, error: 'Contraseña incorrecta. Acceso denegado.' });
});

/**
 * 2.2 Endpoint para consultar el historial de solicitudes registradas (desde Supabase o local)
 */
app.get('/api/registros', async (req, res) => {
  try {
    const result = await solicitudesService.getSolicitudes();
    return res.json({ success: true, registros: result.data, source: result.source });
  } catch (err: any) {
    console.error('Error al obtener registros:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * 2.3 Endpoint para obtener el detalle de una solicitud específica
 */
app.get('/api/registros/:id', async (req, res) => {
  try {
    const registro = await solicitudesService.getSolicitudById(req.params.id);
    if (!registro) {
      return res.status(404).json({ success: false, error: 'Registro de solicitud no encontrado.' });
    }
    return res.json({ success: true, registro });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * 3. Endpoint para actualizar la configuración (Protegido para Administrador)
 */
app.put('/api/config', requireAdmin, (req, res) => {
  try {
    const newConfig = req.body;
    configService.updateConfig(newConfig);
    return res.json({ success: true, message: 'Configuración actualizada exitosamente.' });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * 4. Endpoint para subir y validar una plantilla Word para un tipo de documento (Protegido para Administrador)
 */
app.post('/api/config/templates/:id', requireAdmin, upload.single('template'), (req, res) => {
  const documentTypeId = req.params.id;
  const file = req.file;

  if (!file) {
    return res.status(400).json({ success: false, error: 'No se subió ningún archivo de plantilla.' });
  }

  try {
    // Validar que el archivo sea Word
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext !== '.docx' && ext !== '.docm') {
      return res.status(400).json({ success: false, error: 'El archivo debe ser de formato Word (.docx o .docm).' });
    }

    // Analizar las variables MERGEFIELD dentro del documento
    const analysis = configService.analyzeTemplateVariables(file.buffer);

    // Guardar el archivo en el disco y actualizar la configuración
    const filename = configService.saveTemplateFile(documentTypeId, file.buffer, file.originalname);

    return res.json({
      success: true,
      filename,
      analysis,
      message: 'Plantilla de Word cargada y analizada con éxito.'
    });
  } catch (err: any) {
    console.error(`Error al procesar plantilla para ${documentTypeId}:`, err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * 4.1 Endpoint para descargar la plantilla maestra actual con sus MERGEFIELD
 */
app.get('/api/config/template/download', (req, res) => {
  try {
    let actualTemplatePath = path.join(TEMPLATES_DIR, 'Documentos_Plantilla.docm');
    if (!fs.existsSync(actualTemplatePath)) {
      const fallbackPath = path.join(__dirname, '../templates/Documentos_Plantilla.docm');
      if (fs.existsSync(fallbackPath)) {
        actualTemplatePath = fallbackPath;
      } else {
        const rootPath = path.join(__dirname, '../../../Documentos Plantilla.docm');
        if (fs.existsSync(rootPath)) {
          actualTemplatePath = rootPath;
        } else {
          return res.status(404).json({ success: false, error: 'No se encontró la plantilla maestra en el servidor.' });
        }
      }
    }

    return res.download(actualTemplatePath, 'Documentos_Plantilla.docm');
  } catch (err: any) {
    console.error('Error al descargar plantilla maestra:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * 5. Endpoint para generar el documento combinando datos del usuario, configuración del tipo de documento, HSEC y comunas
 */
app.post('/api/generate', async (req, res) => {
  try {
    const formData = req.body;
    console.log('Solicitud de generación recibida para tipo de documento:', formData.documentTypeId);

    // Obtener la configuración actual
    const config = configService.getConfig();

    // 1. Buscar la configuración específica del tipo de documento
    const docType = config.documentTypes.find(d => d.id === formData.documentTypeId);
    if (!docType) {
      return res.status(404).json({
        success: false,
        error: `No se encontró la configuración del tipo de documento '${formData.documentTypeId}'`,
      });
    }

    // 2. Resolver la ruta de la plantilla de Word predeterminada
    let actualTemplatePath = path.join(TEMPLATES_DIR, 'Documentos_Plantilla.docm');
    if (!fs.existsSync(actualTemplatePath)) {
      const fallbackPath = path.join(__dirname, '../templates/Documentos_Plantilla.docm');
      if (fs.existsSync(fallbackPath)) {
        actualTemplatePath = fallbackPath;
      } else {
        const rootPath = path.join(__dirname, '../../../Documentos Plantilla.docm');
        if (fs.existsSync(rootPath)) {
          // Copiar y normalizar
          if (!fs.existsSync(TEMPLATES_DIR)) {
            fs.mkdirSync(TEMPLATES_DIR, { recursive: true });
          }
          fs.copyFileSync(rootPath, actualTemplatePath);
          console.log(`[Server] Plantilla copiada y normalizada desde la raíz a: ${actualTemplatePath}`);
        } else {
          return res.status(404).json({
            success: false,
            error: 'No se encontró la plantilla de Word predeterminada (Documentos_Plantilla.docm). Por favor, suba la plantilla desde Configuración.',
          });
        }
      }
    }

    // 3. Mezclar los datos para el Mail Merge dinámico
    // Resolver empresa y faena laboral
    const selectedCW = config.companyWorkplaces?.find(cw => cw.id === formData.companyWorkplaceId);
    const resolvedCompanyName = formData.companyName || selectedCW?.companyName || '';
    const resolvedCompanyRut = formData.companyRut || selectedCW?.companyRut || '';
    const resolvedWorkplaceName = formData.workplaceName || selectedCW?.workplaceName || '';
    const resolvedWorkplaceComuna = formData.workplaceComuna || selectedCW?.comuna || '';
    const resolvedWorkArea = formData.workArea || selectedCW?.workArea || 'MINA';

    // Mapear todos los posibles campos origen de datos del payload del frontend y configuración de licencia
    const dataSources: Record<string, any> = {
      // Datos ingresados por el usuario
      Nombre_Completo: formData.Nombre_Completo,
      Rut_: formData.Rut_,
      SEXO: formData.SEXO,
      Estado_Civil: formData.Estado_Civil,
      Fecha_nacimiento: formatDateToDDMMYYYY(formData.Fecha_nacimiento),
      Nacido_en_: formData.Nacido_en_,
      Nacionalidad: formData.Nacionalidad,
      Nombre_del_padre_: formData.Nombre_del_padre_,
      Nombre_de_la_madre_: formData.Nombre_de_la_madre_,
      Nivel_Educacion: formData.Nivel_Educacion,
      Domicilio_Particular_: formData.Domicilio_Particular_,
      Comuna: formData.Comuna,
      PROVINCIA: formData.PROVINCIA,
      REGION: formData.REGION,
      Fono_: formData.Fono_,
      Cargo: formData.Cargo,
      
      // Datos automáticos
      Fecha_Actual: formatDateToDDMMYYYY(formData.Fecha_Actual || new Date()),

      // Variables dinámicas del Tipo de Documento desde Configuración
      tituloCartola: docType.config.tituloCartola,
      solicitaInscribirseComo: docType.config.solicitaInscribirseComo,
      af: docType.config.af,
      categoria: docType.config.categoria,
      inscritoRegNacComo: docType.config.inscritoRegNacComo,
      conElN: docType.config.conElN,
      observacion: docType.config.observacion,
      titulo1: docType.config.titulo1,
      titulo2: docType.config.titulo2,
      titulo3: docType.config.titulo3,
      desempenarseComo: docType.config.desempenarseComo,

      // Datos dinámicos de la Empresa y Faena
      companyName: resolvedCompanyName, // Nombre Empresa (ej: ENAEX SERVICIOS S.A.)
      companyRut: resolvedCompanyRut, // RUT Empresa (ej: 76.041.871-4)
      workplaceName: resolvedWorkplaceName, // Faena (ej: Minera Sierra Gorda SCM)
      Empresa_: resolvedCompanyName, // Soporte directo si formField o placeholder es Empresa_
      Domicilio_Laboral: resolvedWorkplaceName, // Faena laboral -> Minera Sierra Gorda SCM
      workplaceComuna: resolvedWorkplaceComuna, // Comuna de la faena
      workArea: resolvedWorkArea, // Área (ej: MINA)
      domicilioLaboralCompleto: formData.domicilioLaboralCompleto || formData.Domicilio_Laboral,
      
      // Datos dinámicos del Profesional HSEC
      nombre_Prevensionista_: formData.nombre_Prevensionista_,
      Rut_prevensionista_: formData.Rut_prevensionista_,
      SNS_: formData.SNS_,
      Resolucion_: formData.Resolucion_,
      
      // Notas adicionales
      CampoAutoComb: formData.CampoAutoComb,
    };

    // Armar el mergeData final dinámicamente según la configuración
    const mergeData: Record<string, any> = {};
    if (config.variableMappings && Array.isArray(config.variableMappings)) {
      config.variableMappings.forEach(mapping => {
        let val = dataSources[mapping.formField] !== undefined ? dataSources[mapping.formField] : '';
        
        // Garantizar formato de fechas dd-mm-yyyy en cualquier campo con fecha
        if (typeof val === 'string' && /^\d{4}[-/]\d{1,2}[-/]\d{1,2}$/.test(val.trim())) {
          val = formatDateToDDMMYYYY(val);
        } else if (val instanceof Date) {
          val = formatDateToDDMMYYYY(val);
        }

        // Si la plantilla pide Empresa_ y vino vacía o mapeada a Faena por configs antiguas, forzar companyName
        if (mapping.wordPlaceholder === 'Empresa_' && (!val || val === resolvedWorkplaceName)) {
          val = resolvedCompanyName;
        }
        // Si la plantilla pide Domicilio_Laboral y vino el texto concatenado largo, forzar nombre de faena
        if (mapping.wordPlaceholder === 'Domicilio_Laboral' && typeof val === 'string' && val.includes('EMPRESA ')) {
          val = resolvedWorkplaceName;
        }

        mergeData[mapping.wordPlaceholder] = val;
      });
    }

    // 4. Procesar la plantilla de Word
    const templateBuffer = fs.readFileSync(actualTemplatePath);
    const processedDocxBuffer = fillMergeFields(templateBuffer, mergeData);

    // Generar archivo de salida temporal
    const fileId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    // Mantenemos la extensión original de la plantilla para el Word de descarga (.docx o .docm)
    const ext = path.extname(actualTemplatePath) || '.docx';
    const wordTempPath = path.join(TEMP_DIR, `solicitud-${fileId}${ext}`);
    
    fs.writeFileSync(wordTempPath, processedDocxBuffer);

    // 5. Convertir a PDF usando LibreOffice Headless
    let pdfTempPath = '';
    try {
      pdfTempPath = await convertToPdf(wordTempPath, TEMP_DIR);
    } catch (pdfError: any) {
      console.error('Error en conversión de PDF:', pdfError);
      
      // Limpiar Word temporal si falla
      try {
        if (fs.existsSync(wordTempPath)) fs.unlinkSync(wordTempPath);
      } catch (e) {}

      return res.status(500).json({
        success: false,
        error: `Error de conversión PDF: ${pdfError.message}`,
      });
    }

    // Programar la eliminación automática en 15 minutos
    setTimeout(() => {
      try {
        if (fs.existsSync(wordTempPath)) fs.unlinkSync(wordTempPath);
        if (fs.existsSync(pdfTempPath)) fs.unlinkSync(pdfTempPath);
        console.log(`Archivos temporales limpiados para transacción: ${fileId}`);
      } catch (err) {
        console.error('Error al limpiar archivos temporales:', err);
      }
    }, 15 * 60 * 1000);

    // 6. Guardar automáticamente el registro en la base de datos (Supabase y local)
    let registroResult = null;
    try {
      registroResult = await solicitudesService.saveSolicitud({
        rut: formData.Rut_ || '',
        nombre_completo: formData.Nombre_Completo || '',
        empresa: resolvedCompanyName,
        faena: resolvedWorkplaceName,
        comuna: formData.Comuna || '',
        cargo_desempeno: formData.Desempeñarse_como || formData.desempenarseComo || '',
        motivo_solicitud: formData.Motivo_Solicitud || '',
        datos_formulario: formData
      });
      console.log(`[Server] Solicitud registrada exitosamente (${registroResult.source}): ID ${registroResult.id}`);
    } catch (dbErr: any) {
      console.error('[Server] Advertencia al registrar solicitud en base de datos:', dbErr);
    }

    return res.json({
      success: true,
      fileId,
      registroId: registroResult?.id,
      registroSource: registroResult?.source,
      extension: ext.replace('.', ''),
      message: 'Documentos generados y registrados con éxito.',
    });
  } catch (error: any) {
    console.error('Error en /api/generate:', error);
    return res.status(500).json({
      success: false,
      error: `Error interno: ${error.message}`,
    });
  }
});

/**
 * 6. Descarga del archivo final
 */
app.get('/api/download/:id/:format', (req, res) => {
  const { id, format } = req.params;
  const config = configService.getConfig();
  
  // Buscar en los archivos temporales de temp
  const tempFiles = fs.readdirSync(TEMP_DIR);
  const matchFile = tempFiles.find(f => f.startsWith(`solicitud-${id}.`) && f.endsWith(format === 'pdf' ? 'pdf' : ''));
  
  if (!matchFile) {
    return res.status(404).send('El archivo solicitado ya no existe o el enlace ha expirado.');
  }

  const filePath = path.join(TEMP_DIR, matchFile);
  const filename = format === 'pdf' ? 'Solicitud_Licencia.pdf' : `Solicitud_Licencia${path.extname(matchFile)}`;

  res.download(filePath, filename, (err) => {
    if (err) {
      console.error('Error al descargar archivo:', err);
      if (!res.headersSent) res.status(500).send('Error en descarga.');
    } else {
      // Limpieza segura en 10 segundos
      setTimeout(() => {
        try {
          if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        } catch (e) {}
      }, 10000);
    }
  });
});

// Endpoint de salud
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    libreofficeInstalled: fs.existsSync('/Applications/LibreOffice.app/Contents/MacOS/soffice'),
    comunasLoaded: comunasService.getComunas().length > 0
  });
});

app.listen(PORT, () => {
  console.log(`Servidor Express corriendo en http://localhost:${PORT}`);
});
