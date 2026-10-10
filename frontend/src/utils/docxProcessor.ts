import PizZip from 'pizzip';

/**
 * Procesa el contenido XML de un archivo de Word para reemplazar los MERGEFIELDs
 * con los valores proporcionados directamente en el navegador.
 */
function processXmlContent(xmlStr: string, data: Record<string, any>): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlStr, 'application/xml');

  // 1. Procesar Campos Simples (<w:fldSimple w:instr="MERGEFIELD nombre">)
  const fldSimples = doc.getElementsByTagName('w:fldSimple');
  for (let i = fldSimples.length - 1; i >= 0; i--) {
    const fldSimple = fldSimples[i];
    const instr = fldSimple.getAttribute('w:instr') || '';
    const match = instr.match(/MERGEFIELD\s+"?([^"\s\\><]+)"?/i);

    if (match) {
      const varName = match[1];
      const val = data[varName] !== undefined ? String(data[varName]) : '';

      const tElements = fldSimple.getElementsByTagName('w:t');
      if (tElements.length > 0) {
        tElements[0].textContent = val;
        for (let j = 1; j < tElements.length; j++) {
          tElements[j].textContent = '';
        }
      }

      const parent = fldSimple.parentNode;
      if (parent) {
        while (fldSimple.firstChild) {
          parent.insertBefore(fldSimple.firstChild, fldSimple);
        }
        parent.removeChild(fldSimple);
      }
    }
  }

  // 2. Procesar Campos Complejos
  const paragraphs = doc.getElementsByTagName('w:p');
  for (let pIdx = 0; pIdx < paragraphs.length; pIdx++) {
    const p = paragraphs[pIdx];
    const childNodes = Array.from(p.childNodes) as any[];

    let inField = false;
    let fieldNodes: any[] = [];
    let fieldName: string | null = null;

    for (let nodeIdx = 0; nodeIdx < childNodes.length; nodeIdx++) {
      const node = childNodes[nodeIdx];

      if (node.nodeName === 'w:r') {
        const fldChars = node.getElementsByTagName('w:fldChar');
        if (fldChars.length > 0) {
          const fldCharType = fldChars[0].getAttribute('w:fldCharType');
          if (fldCharType === 'begin') {
            inField = true;
            fieldNodes = [node];
            fieldName = null;
            continue;
          }
        }
      }

      if (inField) {
        fieldNodes.push(node);

        if (node.nodeName === 'w:r') {
          const instrTexts = node.getElementsByTagName('w:instrText');
          if (instrTexts.length > 0) {
            const instr = instrTexts[0].textContent || '';
            const match = instr.match(/MERGEFIELD\s+"?([^"\s\\><]+)"?/i);
            if (match) {
              fieldName = match[1];
            }
          }
        }

        const fldChars = node.nodeName === 'w:r' ? node.getElementsByTagName('w:fldChar') : [];
        if (fldChars.length > 0 && fldChars[0].getAttribute('w:fldCharType') === 'end') {
          if (fieldName) {
            const val = data[fieldName] !== undefined ? String(data[fieldName]) : '';

            let targetRun: any = null;
            for (const fn of fieldNodes) {
              if (fn.nodeName === 'w:r') {
                const ts = fn.getElementsByTagName('w:t');
                if (ts.length > 0) {
                  targetRun = fn;
                  break;
                }
              }
            }

            if (targetRun) {
              const ts = targetRun.getElementsByTagName('w:t');
              ts[0].textContent = val;
              for (let k = 1; k < ts.length; k++) {
                ts[k].textContent = '';
              }

              fieldNodes.forEach((fn) => {
                if (fn !== targetRun && fn.parentNode === p) {
                  p.removeChild(fn);
                }
              });
            } else {
              const firstRun = fieldNodes[0];
              const rPr = firstRun.getElementsByTagName('w:rPr')[0];

              const newRun = doc.createElement('w:r');
              if (rPr) {
                newRun.appendChild(rPr.cloneNode(true));
              }
              const newT = doc.createElement('w:t');
              newT.textContent = val;
              newRun.appendChild(newT);

              p.insertBefore(newRun, firstRun);
              fieldNodes.forEach((fn) => {
                if (fn.parentNode === p) {
                  p.removeChild(fn);
                }
              });
            }
          }

          inField = false;
          fieldNodes = [];
          fieldName = null;
        }
      }
    }
  }

  const serializer = new XMLSerializer();
  return serializer.serializeToString(doc);
}

/**
 * Lee una plantilla de Word (.docm / .docx) en base a un ArrayBuffer o Uint8Array,
 * reemplaza los MERGEFIELDs y retorna un Blob listo para ser descargado o visualizado.
 */
export function fillMergeFieldsInBrowser(templateBinary: ArrayBuffer | Uint8Array, data: Record<string, any>): Blob {
  const zip = new PizZip(templateBinary);
  const files = zip.files;

  for (const fileName in files) {
    if (fileName.endsWith('.xml') && (
      fileName.startsWith('word/document') ||
      fileName.startsWith('word/header') ||
      fileName.startsWith('word/footer')
    )) {
      const file = zip.file(fileName);
      if (file) {
        const originalXml = file.asText();
        const updatedXml = processXmlContent(originalXml, data);
        zip.file(fileName, updatedXml);
      }
    }
  }

  // 2. Eliminar la vinculación de combinación de correspondencia (mailMerge) en word/settings.xml
  // Esto evita la alerta de Word: "Al abrir este documento, se ejecutará el siguiente comando SQL..."
  const settingsFile = zip.file('word/settings.xml');
  if (settingsFile) {
    let settingsXml = settingsFile.asText();
    settingsXml = settingsXml.replace(/<w:mailMerge[\s\S]*?<\/w:mailMerge>/gi, '');
    zip.file('word/settings.xml', settingsXml);
  }

  // 3. Eliminar la relación de origen externo en word/_rels/settings.xml.rels si existe
  const relsFile = zip.file('word/_rels/settings.xml.rels');
  if (relsFile) {
    let relsXml = relsFile.asText();
    relsXml = relsXml.replace(/<Relationship[^>]*?mailMergeSource[^>]*?\/>/gi, '');
    zip.file('word/_rels/settings.xml.rels', relsXml);
  }

  return zip.generate({
    type: 'blob',
    mimeType: 'application/vnd.ms-word.document.macroEnabled.12'
  });
}

/**
 * Analiza las variables MERGEFIELD presentes en una plantilla de Word (.docx / .docm)
 */
export function analyzeDocxVariablesInBrowser(binary: ArrayBuffer | Uint8Array, requiredVars: string[] = []): {
  variables: string[];
  missing: string[];
  extra: string[];
} {
  const zip = new PizZip(binary);
  const found = new Set<string>();

  for (const fileName in zip.files) {
    if (fileName.endsWith('.xml') && (
      fileName.startsWith('word/document') ||
      fileName.startsWith('word/header') ||
      fileName.startsWith('word/footer')
    )) {
      const file = zip.file(fileName);
      if (file) {
        const xml = file.asText();
        const regex = /MERGEFIELD\s+"?([^"\s\\><]+)"?/gi;
        let match;
        while ((match = regex.exec(xml)) !== null) {
          found.add(match[1]);
        }
      }
    }
  }

  const variables = Array.from(found);
  const missing = requiredVars.filter(v => !found.has(v));
  const extra = variables.filter(v => !requiredVars.includes(v));

  return { variables, missing, extra };
}

/**
 * Prepara el mapeo completo de variables MERGEFIELD a partir del formData y la configuración
 */
export function buildMergeData(formData: Record<string, any>, config: any): Record<string, any> {
  const docType = config?.documentTypes?.find((d: any) => d.id === formData.documentTypeId);
  const selectedCW = config?.companyWorkplaces?.find((cw: any) => cw.id === formData.companyWorkplaceId);
  const selectedHsec = config?.hsecProfessionals?.find((h: any) => h.id === formData.hsecAId);

  const resolvedCompanyName = formData.companyName || selectedCW?.companyName || '';
  const resolvedCompanyRut = formData.companyRut || selectedCW?.companyRut || '';
  const resolvedWorkplaceName = formData.workplaceName || selectedCW?.workplaceName || '';
  const resolvedWorkplaceComuna = formData.workplaceComuna || selectedCW?.comuna || '';
  const resolvedWorkArea = formData.workArea || selectedCW?.workArea || 'MINA';

  const dataSources: Record<string, any> = {
    Nombre_Completo: formData.Nombre_Completo || '',
    Rut_: formData.Rut_ || '',
    SEXO: formData.SEXO || '',
    Estado_Civil: formData.Estado_Civil || '',
    Fecha_nacimiento: formData.Fecha_nacimiento || '',
    Nacido_en_: formData.Nacido_en_ || '',
    Nacionalidad: formData.Nacionalidad || '',
    Nombre_del_padre_: formData.Nombre_del_padre_ || '',
    Nombre_de_la_madre_: formData.Nombre_de_la_madre_ || '',
    Nivel_Educacion: formData.Nivel_Educacion || '',
    Domicilio_Particular_: formData.Domicilio_Particular_ || '',
    Comuna: formData.Comuna || '',
    PROVINCIA: formData.PROVINCIA || '',
    REGION: formData.REGION || '',
    Fono_: formData.Fono_ || '',
    Cargo: formData.Cargo || '',
    
    Fecha_Actual: formData.Fecha_Actual || '',

    tituloCartola: docType?.config?.tituloCartola || '',
    solicitaInscribirseComo: docType?.config?.solicitaInscribirseComo || '',
    af: docType?.config?.af || '',
    categoria: docType?.config?.categoria || '',
    inscritoRegNacComo: docType?.config?.inscritoRegNacComo || '',
    conElN: docType?.config?.conElN || '',
    observacion: docType?.config?.observacion || '',
    titulo1: docType?.config?.titulo1 || '',
    titulo2: docType?.config?.titulo2 || '',
    titulo3: docType?.config?.titulo3 || '',
    desempenarseComo: docType?.config?.desempenarseComo || '',

    companyName: resolvedCompanyName,
    companyRut: resolvedCompanyRut,
    workplaceName: resolvedWorkplaceName,
    Empresa_: resolvedCompanyName,
    Domicilio_Laboral: resolvedWorkplaceName,
    workplaceComuna: resolvedWorkplaceComuna,
    workArea: resolvedWorkArea,
    domicilioLaboralCompleto: formData.domicilioLaboralCompleto || formData.Domicilio_Laboral || '',

    nombre_Prevensionista_: formData.nombre_Prevensionista_ || selectedHsec?.name || '',
    Rut_prevensionista_: formData.Rut_prevensionista_ || selectedHsec?.rut || '',
    SNS_: formData.SNS_ || selectedHsec?.sns || '',
    Resolucion_: formData.Resolucion_ || selectedHsec?.resolution || '',

    CampoAutoComb: formData.CampoAutoComb || '',
  };

  const mergeData: Record<string, any> = {};
  const mappings = config?.variableMappings || [];

  for (const m of mappings) {
    if (m.wordPlaceholder && m.formField) {
      mergeData[m.wordPlaceholder] = dataSources[m.formField] !== undefined ? dataSources[m.formField] : '';
    }
  }

  for (const [key, val] of Object.entries(dataSources)) {
    if (mergeData[key] === undefined) {
      mergeData[key] = val;
    }
  }

  return mergeData;
}
