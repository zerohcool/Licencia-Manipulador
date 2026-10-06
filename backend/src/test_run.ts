import path from 'path';
import fs from 'fs';
import { fillMergeFields } from './services/docxProcessor';
import { convertToPdf } from './services/pdfConverter';

async function runTest() {
  console.log('Iniciando prueba de generación de documentos...');
  
  const testData = {
    Nombre_Completo_: 'CARLOS SEBASTIÁN PINTO SOTO',
    Rut_: '18.456.789-0',
    SEXO_: 'Masculino',
    Estado_Civil: 'SOLTERO(A)',
    Fecha_nacimiento: '12-08-1995',
    Nacido_en_: 'Concepción',
    Nacionalidad: 'Chilena',
    Nombre_del_padre_: 'Pedro Pinto Valenzuela',
    Nombre_de_la_madre_: 'Sofía Soto Riquelme',
    Nivel_Educacion: 'Profesional',
    Domicilio_Particular_: 'Av. O\'Higgins 456, Depto 12',
    Comuna: 'Concepción',
    PROVINCIA: 'Concepción',
    REGION: 'Región del Bío Bío',
    Fono_: '+56 9 1234 5678',
    Cargo: 'Supervisor de Tronadura',
    Empresa_: 'ENAEX SERVICIOS S.A.',
    Domicilio_Laboral: 'Minera Sierra Gorda SCM',
    Domicilio_Laboral_Comuna: 'SIERRA GORDA',
    Area_de_trabajo: 'Operaciones Mina Rajo Abierto',
    nombre_Prevensionista_: 'Héctor Vega Carrasco',
    Rut_prevensionista_: '12.654.321-K',
    SNS_: 'SNS-8902-A',
    Resolucion_: 'RES-7890',
    Fecha_Actual: '05-10-2026',
    CampoAutoComb: 'Observación: El solicitante cuenta con todas las certificaciones de seguridad al día.',
    TITULO_CARTOLA: 'SOLICITUD DE LICENCIA DE MANIPULADOR DE EXPLOSIVOS',
    Solicita_inscribirse_como_: 'Manipulador de Explosivos',
    AF_: 'CALAMA',
    CATEGORIA: 'A',
    INSCRITO_EN_EL_REG_NAC_COMO: 'Operador de Tronadura',
    CON_EL_N: '4567-B',
    Observacion_: 'CURSOS REALIZADOS SOBRE MANIPULACIÓN DE EXPLOSIVOS',
    Titulo1_: 'INDUCCION BASICA',
    Titulo2_: 'Curso básico',
    Titulo3_: 'SSM-CBE-02',
    Desempeñarse_como: 'MANIPULADOR DE EXPLOSIVOS'
  };

  const templatePath = path.join(__dirname, '../templates/Documentos_Plantilla.docm');
  const tempDir = path.join(__dirname, '../temp');

  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  try {
    const templateBuffer = fs.readFileSync(templatePath);
    console.log('Reemplazando marcadores...');
    const docxResult = fillMergeFields(templateBuffer, testData);
    
    const wordOutputPath = path.join(tempDir, 'test_output.docx');
    fs.writeFileSync(wordOutputPath, docxResult);
    console.log(`Word generado guardado en: ${wordOutputPath}`);
    
    console.log('Convirtiendo a PDF con LibreOffice Headless...');
    const pdfPath = await convertToPdf(wordOutputPath, tempDir);
    console.log(`¡Prueba exitosa! PDF generado en: ${pdfPath}`);
  } catch (err) {
    console.error('Error durante la prueba:', err);
  }
}

runTest();
