import fs from 'fs';
import path from 'path';
import PizZip from 'pizzip';
import { DOMParser } from 'xmldom';

function inspectXlsx() {
  const xlsxPath = path.resolve(__dirname, '../../Tabla Ciudades.xlsx');
  console.log('Ruta del Excel:', xlsxPath);
  if (!fs.existsSync(xlsxPath)) {
    console.error('El archivo no existe.');
    return;
  }

  const buffer = fs.readFileSync(xlsxPath);
  const zip = new PizZip(buffer);
  
  // 1. Cargar Shared Strings
  const sharedStringsXml = zip.file('xl/sharedStrings.xml')?.asText();
  if (!sharedStringsXml) {
    console.error('No se encontró xl/sharedStrings.xml');
    return;
  }
  
  const parser = new DOMParser();
  const ssDoc = parser.parseFromString(sharedStringsXml, 'application/xml');
  const tElements = ssDoc.getElementsByTagName('t');
  const sharedStrings: string[] = [];
  for (let i = 0; i < tElements.length; i++) {
    sharedStrings.push(tElements[i].textContent || '');
  }
  
  console.log(`Cargados ${sharedStrings.length} shared strings.`);

  // 2. Cargar Sheet 1
  const sheetXml = zip.file('xl/worksheets/sheet1.xml')?.asText();
  if (!sheetXml) {
    console.error('No se encontró xl/worksheets/sheet1.xml');
    return;
  }

  const sheetDoc = parser.parseFromString(sheetXml, 'application/xml');
  const rows = sheetDoc.getElementsByTagName('row');
  
  console.log(`Total de filas encontradas: ${rows.length}`);
  
  // Mostrar las primeras 10 filas
  for (let rIdx = 0; rIdx < Math.min(rows.length, 15); rIdx++) {
    const row = rows[rIdx];
    const cells = row.getElementsByTagName('c');
    const rowData: string[] = [];
    
    for (let cIdx = 0; cIdx < cells.length; cIdx++) {
      const cell = cells[cIdx];
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
    console.log(`Fila ${rIdx + 1}:`, rowData);
  }
}

inspectXlsx();
