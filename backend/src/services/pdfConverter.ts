import { exec } from 'child_process';
import path from 'path';
import fs from 'fs';

// Ruta por defecto para el binario de LibreOffice en macOS
const LIBREOFFICE_PATH = '/Applications/LibreOffice.app/Contents/MacOS/soffice';

/**
 * Convierte un archivo de Word (.docx / .docm) a PDF usando LibreOffice Headless.
 * @param inputPath Ruta absoluta al archivo Word.
 * @param outputDir Directorio donde se guardará el PDF.
 * @returns Promesa que se resuelve con la ruta absoluta del PDF generado.
 */
export function convertToPdf(inputPath: string, outputDir: string): Promise<string> {
  return new Promise((resolve, reject) => {
    // Verificar si LibreOffice está instalado
    if (!fs.existsSync(LIBREOFFICE_PATH)) {
      return reject(
        new Error(
          `LibreOffice no fue encontrado en la ruta: ${LIBREOFFICE_PATH}. Por favor, asegúrese de que esté instalado.`
        )
      );
    }

    const fileBasename = path.basename(inputPath, path.extname(inputPath));
    
    // Crear un perfil de usuario de LibreOffice temporal y exclusivo para esta conversión.
    // Esto evita colisiones de bloqueo de perfiles y fallos de permisos en modo Headless.
    const profileDir = path.join(outputDir, `lo_profile_${fileBasename}`);
    try {
      if (!fs.existsSync(profileDir)) {
        fs.mkdirSync(profileDir, { recursive: true });
      }
    } catch (err: any) {
      return reject(new Error(`No se pudo crear el directorio de perfil temporal: ${err.message}`));
    }

    // Convertir la ruta absoluta del perfil en una URL de archivo de LibreOffice (file://...)
    // Codificamos la URI para escapar espacios y caracteres especiales, ya que LibreOffice requiere formato URL válido
    const profileUrl = `file://${encodeURI(profileDir.replace(/\\/g, '/'))}`;

    // Escapar rutas de archivo para evitar inyecciones de comandos
    const escapedInputPath = `"${inputPath.replace(/"/g, '\\"')}"`;
    const escapedOutputDir = `"${outputDir.replace(/"/g, '\\"')}"`;

    // Comando incluyendo el perfil de usuario temporal aislado
    const cmd = `${LIBREOFFICE_PATH} "-env:UserInstallation=${profileUrl}" --headless --convert-to pdf --outdir ${escapedOutputDir} ${escapedInputPath}`;

    // Ejecutar el proceso con un timeout de 20 segundos
    exec(cmd, { timeout: 20000 }, (error, stdout, stderr) => {
      // Función de limpieza del perfil temporal de LibreOffice
      const cleanProfile = () => {
        try {
          if (fs.existsSync(profileDir)) {
            fs.rmSync(profileDir, { recursive: true, force: true });
            console.log(`Perfil de LibreOffice temporal eliminado: ${profileDir}`);
          }
        } catch (rmErr) {
          console.error('Error al eliminar perfil de LibreOffice temporal:', rmErr);
        }
      };

      if (error) {
        console.error('Error ejecutando LibreOffice:', error);
        console.error('Stderr:', stderr);
        cleanProfile();
        return reject(new Error(`Error de LibreOffice: ${error.message}`));
      }

      const pdfPath = path.join(outputDir, `${fileBasename}.pdf`);

      // Verificar que el PDF realmente fue creado
      if (fs.existsSync(pdfPath)) {
        cleanProfile();
        resolve(pdfPath);
      } else {
        cleanProfile();
        reject(new Error('LibreOffice terminó exitosamente pero no se encontró el PDF generado.'));
      }
    });
  });
}
