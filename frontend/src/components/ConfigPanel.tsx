import React, { useState, useEffect } from 'react';
import { formatRut, validateRut } from '../utils/validation';
import { apiFetch, apiUrl } from '../utils/api';
import comunasChileData from '../data/comunasChile.json';
import defaultConfig from '../data/defaultConfig.json';

interface DocumentConfig {
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

interface DocumentType {
  id: string;
  name: string;
  templateFilename: string;
  config: DocumentConfig;
}

interface CompanyWorkplace {
  id: string;
  companyName: string;
  companyRut: string;
  workplaceName: string;
  comuna: string;
  workArea: string;
}

interface HsecProfessional {
  id: string;
  name: string;
  rut: string;
  sns: string;
  resolution: string;
}

interface VariableMapping {
  id: string;
  description: string;
  formField: string;
  wordPlaceholder: string;
}

interface AppConfig {
  documentTypes: DocumentType[];
  companyWorkplaces: CompanyWorkplace[];
  hsecProfessionals: HsecProfessional[];
  variableMappings: VariableMapping[];
}

interface ComunaInfo {
  comuna: string;
  provincia: string;
  region: string;
  numeroRegion: string;
}

const FORM_FIELDS_OPTIONS = [
  { value: 'Nombre_Completo', label: 'Datos Personales: Nombre Completo' },
  { value: 'Rut_', label: 'Datos Personales: RUT' },
  { value: 'SEXO', label: 'Datos Personales: Sexo' },
  { value: 'Estado_Civil', label: 'Datos Personales: Estado Civil' },
  { value: 'Fecha_nacimiento', label: 'Datos Personales: Fecha Nacimiento' },
  { value: 'Nacido_en_', label: 'Datos Personales: Lugar Nacimiento' },
  { value: 'Nacionalidad', label: 'Datos Personales: Nacionalidad' },
  { value: 'Nombre_del_padre_', label: 'Datos Personales: Nombre Padre' },
  { value: 'Nombre_de_la_madre_', label: 'Datos Personales: Nombre Madre' },
  { value: 'Nivel_Educacion', label: 'Datos Personales: Nivel Educación' },
  { value: 'Domicilio_Particular_', label: 'Dirección y Contacto: Domicilio Particular' },
  { value: 'Comuna', label: 'Dirección y Contacto: Comuna' },
  { value: 'PROVINCIA', label: 'Dirección y Contacto: Provincia' },
  { value: 'REGION', label: 'Dirección y Contacto: Región (número romano)' },
  { value: 'Fono_', label: 'Dirección y Contacto: Teléfono Contacto' },
  { value: 'Cargo', label: 'Solicitud y Trabajo: Cargo' },
  { value: 'Fecha_Actual', label: 'Automático: Fecha Actual del Sistema' },
  { value: 'CampoAutoComb', label: 'Automático: Observaciones Adicionales' },
  { value: 'companyName', label: 'Empresa y Faena: Nombre de la Empresa' },
  { value: 'companyRut', label: 'Empresa y Faena: RUT de la Empresa' },
  { value: 'workplaceName', label: 'Empresa y Faena: Faena / Domicilio Laboral' },
  { value: 'Domicilio_Laboral', label: 'Empresa y Faena: Faena / Domicilio Laboral' },
  { value: 'workplaceComuna', label: 'Empresa y Faena: Comuna de Faena' },
  { value: 'workArea', label: 'Empresa y Faena: Área de Trabajo' },
  { value: 'domicilioLaboralCompleto', label: 'Empresa y Faena: Texto Completo Unificado' },
  { value: 'nombre_Prevensionista_', label: 'HSEC: Nombre Prevencionista' },
  { value: 'Rut_prevensionista_', label: 'HSEC: RUT Prevencionista' },
  { value: 'SNS_', label: 'HSEC: Registro SNS' },
  { value: 'Resolucion_', label: 'HSEC: Resolución HSEC' },
  { value: 'tituloCartola', label: 'Licencia: Título Cartola' },
  { value: 'solicitaInscribirseComo', label: 'Licencia: Solicita Inscribirse Como' },
  { value: 'af', label: 'Licencia: AF' },
  { value: 'categoria', label: 'Licencia: Categoría' },
  { value: 'inscritoRegNacComo', label: 'Licencia: Inscrito en Registro Nacional Como' },
  { value: 'conElN', label: 'Licencia: Con el N°' },
  { value: 'observacion', label: 'Licencia: Observaciones de la Licencia' },
  { value: 'titulo1', label: 'Licencia: Título Inducción 1' },
  { value: 'titulo2', label: 'Licencia: Título Inducción 2' },
  { value: 'titulo3', label: 'Licencia: Título Inducción 3' },
  { value: 'desempenarseComo', label: 'Licencia: Desempeñarse Como' }
];

interface ConfigPanelProps {
  onConfigChange: () => void;
  adminPassword?: string;
  onLogoutAdmin?: () => void;
}

export default function ConfigPanel({ onConfigChange, adminPassword, onLogoutAdmin }: ConfigPanelProps) {
  const [config, setConfig] = useState<AppConfig | null>(defaultConfig as unknown as AppConfig);
  const [comunas, setComunas] = useState<ComunaInfo[]>(comunasChileData as ComunaInfo[]);
  const [activeTab, setActiveTab] = useState<'docs' | 'companyWorkplaces' | 'hsec' | 'variables'>('docs');
  
  // Estados de edición
  const [editingDoc, setEditingDoc] = useState<DocumentType | null>(null);
  
  const [newCW, setNewCW] = useState({ companyName: '', companyRut: '', workplaceName: '', comuna: '', workArea: 'MINA' });
  const [editingCW, setEditingCW] = useState<CompanyWorkplace | null>(null);
  
  const [newHsec, setNewHsec] = useState({ name: '', rut: '', sns: '', resolution: '' });
  const [editingHsec, setEditingHsec] = useState<HsecProfessional | null>(null);

  const [newVM, setNewVM] = useState({ description: '', formField: 'Nombre_Completo', wordPlaceholder: '' });
  const [editingVM, setEditingVM] = useState<VariableMapping | null>(null);
  
  // Estado para subida de plantilla y análisis
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadingDocId, setUploadingDocId] = useState<string | null>(null);
  const [uploadResult, setUploadResult] = useState<{
    success: boolean;
    analysis?: {
      variables: string[];
      missing: string[];
      extra: string[];
    };
    error?: string;
  } | null>(null);
  
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    loadConfig();
    loadComunas();
  }, []);

  const loadConfig = async () => {
    try {
      const response = await apiFetch('/api/config');
      const data = await response.json();
      if (data.success) {
        setConfig(data.config);
      }
    } catch {
      // Mantiene la configuración por defecto
    }
  };

  const loadComunas = async () => {
    try {
      const response = await apiFetch('/api/comunas');
      const data = await response.json();
      if (data.success && Array.isArray(data.comunas) && data.comunas.length > 0) {
        setComunas(data.comunas);
      }
    } catch {
      // Mantiene las 346 comunas de respaldo
    }
  };

  const showMsg = (text: string, type: 'success' | 'error') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 5000);
  };

  const saveConfig = async (updatedConfig: AppConfig) => {
    try {
      const response = await apiFetch('/api/config', {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          ...(adminPassword ? { 'x-admin-password': adminPassword } : {})
        },
        body: JSON.stringify(updatedConfig)
      });
      const data = await response.json();
      if (data.success) {
        setConfig(updatedConfig);
        showMsg('Configuración guardada exitosamente.', 'success');
        onConfigChange();
      } else {
        showMsg(data.error || 'Error al guardar configuración.', 'error');
      }
    } catch {
      showMsg('Error de conexión al guardar configuración.', 'error');
    }
  };

  // 1. Manejo de Plantillas y Carga
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFile(e.target.files[0]);
      setUploadResult(null);
    }
  };

  const handleUploadTemplate = async (docId: string) => {
    if (!selectedFile) {
      alert('Por favor seleccione un archivo primero.');
      return;
    }
    
    setUploadingDocId(docId);
    setUploadResult(null);
    
    const formData = new FormData();
    formData.append('template', selectedFile);

    try {
      const response = await apiFetch(`/api/config/templates/${docId}`, {
        method: 'POST',
        headers: {
          ...(adminPassword ? { 'x-admin-password': adminPassword } : {})
        },
        body: formData
      });
      const data = await response.json();
      if (data.success) {
        setUploadResult({
          success: true,
          analysis: data.analysis
        });
        showMsg('Plantilla subida y analizada correctamente.', 'success');
        loadConfig(); // Recargar datos
        setSelectedFile(null);
      } else {
        setUploadResult({
          success: false,
          error: data.error
        });
      }
    } catch (err: any) {
      setUploadResult({
        success: false,
        error: 'Error de conexión al subir la plantilla.'
      });
    } finally {
      setUploadingDocId(null);
    }
  };

  // 2. Métodos CRUD para Empresas y Faenas Unificadas
  const handleAddCW = () => {
    const { companyName, companyRut, workplaceName, comuna, workArea } = newCW;
    if (!companyName.trim() || !companyRut.trim() || !workplaceName.trim() || !comuna || !config) {
      alert('Todos los campos son obligatorios.');
      return;
    }

    if (!validateRut(companyRut)) {
      alert('RUT de Empresa inválido.');
      return;
    }

    const updated = {
      ...config,
      companyWorkplaces: [
        ...config.companyWorkplaces,
        {
          id: `cw-${Date.now()}`,
          companyName: companyName.trim().toUpperCase(),
          companyRut: formatRut(companyRut),
          workplaceName: workplaceName.trim().toUpperCase(),
          comuna: comuna,
          workArea: workArea.trim().toUpperCase()
        }
      ]
    };
    saveConfig(updated);
    setNewCW({ companyName: '', companyRut: '', workplaceName: '', comuna: '', workArea: 'MINA' });
  };

  const handleUpdateCW = () => {
    if (!editingCW || !config) return;
    const { companyName, companyRut, workplaceName, comuna, workArea } = editingCW;
    if (!companyName.trim() || !companyRut.trim() || !workplaceName.trim() || !comuna) {
      alert('Todos los campos son obligatorios.');
      return;
    }

    if (!validateRut(companyRut)) {
      alert('RUT de Empresa inválido.');
      return;
    }

    const updated = {
      ...config,
      companyWorkplaces: config.companyWorkplaces.map(cw => 
        cw.id === editingCW.id ? {
          ...cw,
          companyName: companyName.trim().toUpperCase(),
          companyRut: formatRut(companyRut),
          workplaceName: workplaceName.trim().toUpperCase(),
          comuna,
          workArea: workArea.trim().toUpperCase()
        } : cw
      )
    };
    saveConfig(updated);
    setEditingCW(null);
  };

  const handleDeleteCW = (id: string) => {
    if (!config || !confirm('¿Está seguro de eliminar este registro de Empresa y Faena?')) return;
    const updated = {
      ...config,
      companyWorkplaces: config.companyWorkplaces.filter(cw => cw.id !== id)
    };
    saveConfig(updated);
  };

  // 4. Métodos CRUD para HSEC
  const handleAddHsec = () => {
    const { name, rut, sns, resolution } = newHsec;
    if (!name.trim() || !rut.trim() || !sns.trim() || !resolution.trim() || !config) {
      alert('Todos los campos de HSEC son obligatorios.');
      return;
    }

    if (!validateRut(rut)) {
      alert('RUT de Profesional HSEC inválido.');
      return;
    }

    const updated = {
      ...config,
      hsecProfessionals: [
        ...config.hsecProfessionals,
        {
          id: `hsec-${Date.now()}`,
          name: name.trim().toUpperCase(),
          rut: formatRut(rut),
          sns: sns.trim().toUpperCase(),
          resolution: resolution.trim().toUpperCase()
        }
      ]
    };
    saveConfig(updated);
    setNewHsec({ name: '', rut: '', sns: '', resolution: '' });
  };

  const handleUpdateHsec = () => {
    if (!editingHsec || !config) return;
    const { name, rut, sns, resolution } = editingHsec;
    if (!name.trim() || !rut.trim() || !sns.trim() || !resolution.trim()) {
      alert('Todos los campos son obligatorios.');
      return;
    }

    if (!validateRut(rut)) {
      alert('RUT de Profesional HSEC inválido.');
      return;
    }

    const updated = {
      ...config,
      hsecProfessionals: config.hsecProfessionals.map(h => 
        h.id === editingHsec.id ? {
          ...h,
          name: name.trim().toUpperCase(),
          rut: formatRut(rut),
          sns: sns.trim().toUpperCase(),
          resolution: resolution.trim().toUpperCase()
        } : h
      )
    };
    saveConfig(updated);
    setEditingHsec(null);
  };

  const handleDeleteHsec = (id: string) => {
    if (!config || !confirm('¿Está seguro de eliminar este Profesional HSEC?')) return;
    const updated = {
      ...config,
      hsecProfessionals: config.hsecProfessionals.filter(h => h.id !== id)
    };
    saveConfig(updated);
  };

  // 5. Métodos CRUD para Mapeos de Variables
  const handleAddVM = () => {
    const { description, formField, wordPlaceholder } = newVM;
    if (!description.trim() || !formField || !wordPlaceholder.trim() || !config) {
      alert('Todos los campos son obligatorios.');
      return;
    }

    const normalizedPlaceholder = wordPlaceholder.trim();

    if (config.variableMappings.some(vm => vm.wordPlaceholder === normalizedPlaceholder)) {
      alert('La variable de Word ya está registrada.');
      return;
    }

    const updated = {
      ...config,
      variableMappings: [
        ...config.variableMappings,
        {
          id: `vm-${Date.now()}`,
          description: description.trim(),
          formField: formField,
          wordPlaceholder: normalizedPlaceholder
        }
      ]
    };
    saveConfig(updated);
    setNewVM({ description: '', formField: 'Nombre_Completo', wordPlaceholder: '' });
  };

  const handleUpdateVM = () => {
    if (!editingVM || !config) return;
    const { description, formField, wordPlaceholder } = editingVM;
    if (!description.trim() || !formField || !wordPlaceholder.trim()) {
      alert('Todos los campos son obligatorios.');
      return;
    }

    const updated = {
      ...config,
      variableMappings: config.variableMappings.map(vm => 
        vm.id === editingVM.id ? {
          ...vm,
          description: description.trim(),
          formField,
          wordPlaceholder: wordPlaceholder.trim()
        } : vm
      )
    };
    saveConfig(updated);
    setEditingVM(null);
  };

  const handleDeleteVM = (id: string) => {
    if (!config || !confirm('¿Está seguro de eliminar este mapeo de variable? (Esto causará advertencias en la validación si la plantilla aún contiene el marcador)')) return;
    const updated = {
      ...config,
      variableMappings: config.variableMappings.filter(vm => vm.id !== id)
    };
    saveConfig(updated);
  };

  // 5. Edición de Parámetros de Documento
  const handleSaveDocConfig = () => {
    if (!editingDoc || !config) return;
    const updated = {
      ...config,
      documentTypes: config.documentTypes.map(d => d.id === editingDoc.id ? editingDoc : d)
    };
    saveConfig(updated);
    setEditingDoc(null);
  };

  if (!config) return <div className="loading-overlay"><div className="spinner"></div><p>Cargando Configuración...</p></div>;

  return (
    <div style={{ background: 'white', borderRadius: 'var(--radius-lg)', padding: '2rem', boxShadow: 'var(--shadow-lg)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <h2 style={{ fontSize: '1.75rem', fontWeight: 700, margin: 0 }}>Panel de Configuración</h2>
            <span style={{ fontSize: '0.8rem', padding: '0.2rem 0.65rem', borderRadius: '12px', backgroundColor: 'hsl(142, 70%, 93%)', color: 'hsl(142, 70%, 25%)', fontWeight: 600 }}>
              🛡️ Modo Administrador
            </span>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', margin: '0.3rem 0 0' }}>Administración de parámetros, plantillas y catálogos de la aplicación.</p>
        </div>
        {onLogoutAdmin && (
          <button 
            type="button" 
            className="btn btn-secondary" 
            onClick={onLogoutAdmin}
            style={{ padding: '0.45rem 0.9rem', fontSize: '0.85rem' }}
          >
            🔒 Bloquear Configuración
          </button>
        )}
      </div>

      {message && (
        <div style={{ 
          padding: '1rem', 
          borderRadius: 'var(--radius-md)', 
          marginBottom: '1.5rem',
          backgroundColor: message.type === 'success' ? 'var(--success-light)' : 'hsl(0, 100%, 96%)',
          color: message.type === 'success' ? 'var(--success)' : 'var(--danger)',
          borderLeft: `4px solid ${message.type === 'success' ? 'var(--success)' : 'var(--danger)'}`,
          fontWeight: 600
        }}>
          {message.text}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--border)', marginBottom: '2rem' }}>
        <button 
          className="btn" 
          style={{ 
            background: activeTab === 'docs' ? 'var(--primary-light)' : 'none', 
            color: activeTab === 'docs' ? 'var(--primary)' : 'var(--text-secondary)',
            borderBottom: activeTab === 'docs' ? '2px solid var(--primary)' : 'none',
            borderRadius: 'var(--radius-sm) var(--radius-sm) 0 0',
            padding: '0.75rem 1.25rem'
          }}
          onClick={() => setActiveTab('docs')}
        >
          Documentos y Plantillas
        </button>
        <button 
          className="btn" 
          style={{ 
            background: activeTab === 'companyWorkplaces' ? 'var(--primary-light)' : 'none', 
            color: activeTab === 'companyWorkplaces' ? 'var(--primary)' : 'var(--text-secondary)',
            borderBottom: activeTab === 'companyWorkplaces' ? '2px solid var(--primary)' : 'none',
            borderRadius: 'var(--radius-sm) var(--radius-sm) 0 0',
            padding: '0.75rem 1.25rem'
          }}
          onClick={() => setActiveTab('companyWorkplaces')}
        >
          Empresas y Faenas
        </button>
        <button 
          className="btn" 
          style={{ 
            background: activeTab === 'hsec' ? 'var(--primary-light)' : 'none', 
            color: activeTab === 'hsec' ? 'var(--primary)' : 'var(--text-secondary)',
            borderBottom: activeTab === 'hsec' ? '2px solid var(--primary)' : 'none',
            borderRadius: 'var(--radius-sm) var(--radius-sm) 0 0',
            padding: '0.75rem 1.25rem'
          }}
          onClick={() => setActiveTab('hsec')}
        >
          Profesionales HSEC
        </button>
        <button 
          className="btn" 
          style={{ 
            background: activeTab === 'variables' ? 'var(--primary-light)' : 'none', 
            color: activeTab === 'variables' ? 'var(--primary)' : 'var(--text-secondary)',
            borderBottom: activeTab === 'variables' ? '2px solid var(--primary)' : 'none',
            borderRadius: 'var(--radius-sm) var(--radius-sm) 0 0',
            padding: '0.75rem 1.25rem'
          }}
          onClick={() => setActiveTab('variables')}
        >
          Mapeo de Variables
        </button>
      </div>

      {/* CONTENIDO TAB: DOCUMENTOS Y PLANTILLAS */}
      {activeTab === 'docs' && (
        <div>
          {editingDoc ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontWeight: 700 }}>Editar Configuración: {editingDoc.name}</h3>
                <button className="btn btn-secondary" onClick={() => setEditingDoc(null)}>Cancelar</button>
              </div>

              <div className="form-grid">
                {Object.keys(editingDoc.config).map((key) => (
                  <div className="form-group" key={key}>
                    <label style={{ textTransform: 'capitalize' }}>
                      {key.replace(/([A-Z])/g, ' $1')}
                    </label>
                    <input 
                      type="text" 
                      value={(editingDoc.config as any)[key]} 
                      onChange={(e) => {
                        const val = e.target.value.toUpperCase(); // Forzar mayúsculas
                        setEditingDoc({
                          ...editingDoc,
                          config: {
                            ...editingDoc.config,
                            [key]: val
                          }
                        });
                      }}
                    />
                  </div>
                ))}
              </div>

              <button className="btn btn-primary" onClick={handleSaveDocConfig} style={{ alignSelf: 'flex-end', marginTop: '1rem' }}>
                Guardar Parámetros
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
              {/* Sección Global de Plantilla Única Predeterminada */}
              <div style={{ border: '2px dashed var(--primary)', padding: '1.5rem', borderRadius: 'var(--radius-md)', background: 'var(--primary-light)' }}>
                <h4 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--primary)', marginBottom: '0.5rem' }}>Plantilla Word Predeterminada Única</h4>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1rem', lineHeight: '1.6' }}>
                  El sistema utiliza una plantilla de Word maestra (
                  <a 
                    href={apiUrl('/api/config/template/download')} 
                    download="Documentos_Plantilla.docm"
                    title="Descargar plantilla maestra actual con sus MERGEFIELD"
                    style={{ 
                      display: 'inline-flex', 
                      alignItems: 'center', 
                      gap: '0.35rem', 
                      fontWeight: 700, 
                      color: 'var(--primary)', 
                      textDecoration: 'none',
                      background: 'white',
                      padding: '0.2rem 0.6rem',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--primary)',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                      cursor: 'pointer',
                      margin: '0 0.25rem'
                    }}
                  >
                    📥 <code>Documentos_Plantilla.docm</code> (Descargar muestra)
                  </a>
                  ). Los parámetros específicos se mapean dinámicamente según el tipo de documento seleccionado.
                </p>
                
                <div style={{ background: 'white', padding: '1.25rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                  <h5 style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.75rem' }}>Actualizar Plantilla Maestra (.docx / .docm)</h5>
                  <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <input 
                      type="file" 
                      accept=".docx,.docm" 
                      onChange={handleFileChange} 
                      style={{ padding: '0.35rem 0.75rem', fontSize: '0.85rem', width: 'auto' }}
                    />
                    <button 
                      className="btn btn-primary" 
                      style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
                      disabled={uploadingDocId !== null || !selectedFile}
                      onClick={() => handleUploadTemplate('manipulador-explosivos')}
                    >
                      {uploadingDocId !== null ? 'Subiendo...' : 'Subir y Validar Plantilla'}
                    </button>
                  </div>

                  {uploadResult && (
                    <div style={{ marginTop: '1rem', padding: '1rem', background: 'var(--bg-app)', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem' }}>
                      {uploadResult.success && uploadResult.analysis ? (
                        <div>
                          <div style={{ color: 'var(--success)', fontWeight: 700, marginBottom: '0.5rem' }}>✓ Plantilla maestra analizada exitosamente.</div>
                          
                          {uploadResult.analysis.missing.length > 0 ? (
                            <div style={{ color: 'var(--danger)', marginBottom: '0.5rem' }}>
                              <strong>⚠️ Variables Faltantes detectadas (Requeridas por el formulario):</strong>
                              <ul style={{ marginLeft: '1.5rem', marginTop: '0.25rem' }}>
                                {uploadResult.analysis.missing.map(v => <li key={v}><code>{v}</code></li>)}
                              </ul>
                            </div>
                          ) : (
                            <div style={{ color: 'var(--success)', marginBottom: '0.5rem' }}>
                              <strong>✓ La plantilla contiene todas las variables requeridas por el formulario.</strong>
                            </div>
                          )}

                          {uploadResult.analysis.extra.length > 0 && (
                            <div style={{ color: 'var(--warning)' }}>
                              <strong>ℹ Variables adicionales encontradas (No rellenadas por el formulario):</strong>
                              <ul style={{ marginLeft: '1.5rem', marginTop: '0.25rem' }}>
                                {uploadResult.analysis.extra.map(v => <li key={v}><code>{v}</code></li>)}
                              </ul>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div style={{ color: 'var(--danger)', fontWeight: 600 }}>
                          Error al cargar plantilla: {uploadResult.error}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Lista de Configuración de Parámetros de Documentos */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <h4 style={{ fontWeight: 700, fontSize: '1.2rem', marginBottom: '0.5rem' }}>Configuración de Parámetros por Licencia</h4>
                {config.documentTypes.map((doc) => (
                  <div key={doc.id} style={{ border: '1px solid var(--border)', padding: '1.25rem', borderRadius: 'var(--radius-md)', background: 'var(--bg-card)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <h5 style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-primary)' }}>{doc.name}</h5>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Mapeo: Título Cartola = <code>{doc.config.tituloCartola}</code></span>
                    </div>
                    <button className="btn btn-secondary" onClick={() => setEditingDoc(doc)}>
                      Editar Parámetros
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}


      {/* CONTENIDO TAB: EMPRESAS Y FAENAS */}
      {activeTab === 'companyWorkplaces' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          {/* Agregar */}
          <div style={{ background: 'var(--bg-app)', padding: '1.5rem', borderRadius: 'var(--radius-md)' }}>
            <h4 style={{ fontWeight: 600, marginBottom: '1rem', color: 'var(--primary)' }}>Registrar Nueva Empresa y Faena Laboral</h4>
            <div className="form-grid">
              <div className="form-group">
                <label>Nombre de la Empresa</label>
                <input 
                  type="text" 
                  placeholder="Ej. ENAEX SERVICIOS S.A."
                  value={newCW.companyName}
                  onChange={(e) => setNewCW({ ...newCW, companyName: e.target.value.toUpperCase() })}
                />
              </div>
              <div className="form-group">
                <label>RUT de la Empresa</label>
                <input 
                  type="text" 
                  placeholder="Ej. 76.041.871-4"
                  value={newCW.companyRut}
                  onChange={(e) => setNewCW({ ...newCW, companyRut: e.target.value.toUpperCase() })}
                />
              </div>
              <div className="form-group">
                <label>Faena / Domicilio Laboral</label>
                <input 
                  type="text" 
                  placeholder="Ej. MINERA SIERRA GORDA SCM"
                  value={newCW.workplaceName}
                  onChange={(e) => setNewCW({ ...newCW, workplaceName: e.target.value.toUpperCase() })}
                />
              </div>
              <div className="form-group">
                <label>Comuna Faena</label>
                <select 
                  value={newCW.comuna}
                  onChange={(e) => setNewCW({ ...newCW, comuna: e.target.value })}
                >
                  <option value="">Seleccione Comuna...</option>
                  {comunas.map((co) => (
                    <option key={co.comuna} value={co.comuna}>{co.comuna}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Área de Trabajo</label>
                <input 
                  type="text" 
                  placeholder="Ej. MINA"
                  value={newCW.workArea}
                  onChange={(e) => setNewCW({ ...newCW, workArea: e.target.value.toUpperCase() })}
                />
              </div>
              <div className="form-group" style={{ display: 'flex', alignItems: 'flex-end' }}>
                <button className="btn btn-primary" onClick={handleAddCW} style={{ width: '100%', height: '42px' }}>Agregar Registro</button>
              </div>
            </div>
          </div>

          {/* Listado */}
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.95rem' }}>
            <thead>
              <tr style={{ background: 'var(--bg-app)', borderBottom: '2px solid var(--border)', textAlign: 'left' }}>
                <th style={{ padding: '0.75rem' }}>Empresa (RUT)</th>
                <th style={{ padding: '0.75rem' }}>Faena Laboral</th>
                <th style={{ padding: '0.75rem' }}>Comuna</th>
                <th style={{ padding: '0.75rem' }}>Área</th>
                <th style={{ padding: '0.75rem', textAlign: 'right' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {config.companyWorkplaces.map((cw) => (
                <tr key={cw.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '0.75rem' }}>
                    {editingCW?.id === cw.id ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                        <input 
                          type="text"
                          value={editingCW.companyName}
                          onChange={(e) => setEditingCW({ ...editingCW, companyName: e.target.value })}
                          placeholder="Nombre Empresa"
                          style={{ padding: '0.4rem 0.7rem' }}
                        />
                        <input 
                          type="text"
                          value={editingCW.companyRut}
                          onChange={(e) => setEditingCW({ ...editingCW, companyRut: e.target.value })}
                          placeholder="RUT Empresa"
                          style={{ padding: '0.4rem 0.7rem' }}
                        />
                      </div>
                    ) : (
                      <div>
                        <div style={{ fontWeight: 600 }}>{cw.companyName}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>RUT: {cw.companyRut}</div>
                      </div>
                    )}
                  </td>
                  <td style={{ padding: '0.75rem' }}>
                    {editingCW?.id === cw.id ? (
                      <input 
                        type="text"
                        value={editingCW.workplaceName}
                        onChange={(e) => setEditingCW({ ...editingCW, workplaceName: e.target.value })}
                        placeholder="Faena"
                        style={{ padding: '0.4rem 0.7rem' }}
                      />
                    ) : cw.workplaceName}
                  </td>
                  <td style={{ padding: '0.75rem' }}>
                    {editingCW?.id === cw.id ? (
                      <select 
                        value={editingCW.comuna}
                        onChange={(e) => setEditingCW({ ...editingCW, comuna: e.target.value })}
                        style={{ padding: '0.4rem 0.7rem' }}
                      >
                        {comunas.map((co) => (
                          <option key={co.comuna} value={co.comuna}>{co.comuna}</option>
                        ))}
                      </select>
                    ) : cw.comuna}
                  </td>
                  <td style={{ padding: '0.75rem' }}>
                    {editingCW?.id === cw.id ? (
                      <input 
                        type="text"
                        value={editingCW.workArea}
                        onChange={(e) => setEditingCW({ ...editingCW, workArea: e.target.value })}
                        placeholder="Área"
                        style={{ padding: '0.4rem 0.7rem' }}
                      />
                    ) : cw.workArea}
                  </td>
                  <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                    {editingCW?.id === cw.id ? (
                      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                        <button className="btn btn-primary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }} onClick={handleUpdateCW}>Guardar</button>
                        <button className="btn btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }} onClick={() => setEditingCW(null)}>Cancelar</button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                        <button className="btn btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }} onClick={() => setEditingCW(cw)}>Editar</button>
                        <button className="btn btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', color: 'var(--danger)' }} onClick={() => handleDeleteCW(cw.id)}>Eliminar</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* CONTENIDO TAB: PROFESIONALES HSEC */}
      {activeTab === 'hsec' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          {/* Agregar */}
          <div style={{ background: 'var(--bg-app)', padding: '1.5rem', borderRadius: 'var(--radius-md)' }}>
            <h4 style={{ fontWeight: 600, marginBottom: '1rem' }}>Registrar Nuevo Profesional HSEC</h4>
            <div className="form-grid">
              <div className="form-group">
                <label>Nombre Completo</label>
                <input 
                  type="text" 
                  placeholder="Ej. Héctor Iván Vargas Galindo"
                  value={newHsec.name}
                  onChange={(e) => setNewHsec({ ...newHsec, name: e.target.value.toUpperCase() })}
                />
              </div>
              <div className="form-group">
                <label>RUT</label>
                <input 
                  type="text" 
                  placeholder="Ej. 10.095.773-6"
                  value={newHsec.rut}
                  onChange={(e) => setNewHsec({ ...newHsec, rut: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Registro SNS</label>
                <input 
                  type="text" 
                  placeholder="Ej. AN/P-2945"
                  value={newHsec.sns}
                  onChange={(e) => setNewHsec({ ...newHsec, sns: e.target.value.toUpperCase() })}
                />
              </div>
              <div className="form-group">
                <label>Resolución</label>
                <input 
                  type="text" 
                  placeholder="Ej. 8878"
                  value={newHsec.resolution}
                  onChange={(e) => setNewHsec({ ...newHsec, resolution: e.target.value.toUpperCase() })}
                />
              </div>
            </div>
            <button className="btn btn-primary" onClick={handleAddHsec} style={{ marginTop: '1rem', display: 'block', marginLeft: 'auto' }}>
              Agregar Profesional
            </button>
          </div>

          {/* Listado */}
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.95rem' }}>
            <thead>
              <tr style={{ background: 'var(--bg-app)', borderBottom: '2px solid var(--border)', textAlign: 'left' }}>
                <th style={{ padding: '0.75rem' }}>Nombre Completo</th>
                <th style={{ padding: '0.75rem' }}>RUT</th>
                <th style={{ padding: '0.75rem' }}>SNS</th>
                <th style={{ padding: '0.75rem' }}>Resolución</th>
                <th style={{ padding: '0.75rem', textAlign: 'right' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {config.hsecProfessionals.map((h) => (
                <tr key={h.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  {editingHsec?.id === h.id ? (
                    <>
                      <td style={{ padding: '0.75rem' }}>
                        <input 
                          type="text"
                          value={editingHsec.name}
                          onChange={(e) => setEditingHsec({ ...editingHsec, name: e.target.value })}
                          style={{ padding: '0.4rem 0.7rem' }}
                        />
                      </td>
                      <td style={{ padding: '0.75rem' }}>
                        <input 
                          type="text"
                          value={editingHsec.rut}
                          onChange={(e) => setEditingHsec({ ...editingHsec, rut: e.target.value })}
                          style={{ padding: '0.4rem 0.7rem' }}
                        />
                      </td>
                      <td style={{ padding: '0.75rem' }}>
                        <input 
                          type="text"
                          value={editingHsec.sns}
                          onChange={(e) => setEditingHsec({ ...editingHsec, sns: e.target.value })}
                          style={{ padding: '0.4rem 0.7rem' }}
                        />
                      </td>
                      <td style={{ padding: '0.75rem' }}>
                        <input 
                          type="text"
                          value={editingHsec.resolution}
                          onChange={(e) => setEditingHsec({ ...editingHsec, resolution: e.target.value })}
                          style={{ padding: '0.4rem 0.7rem' }}
                        />
                      </td>
                      <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                          <button className="btn btn-primary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }} onClick={handleUpdateHsec}>Guardar</button>
                          <button className="btn btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }} onClick={() => setEditingHsec(null)}>Cancelar</button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td style={{ padding: '0.75rem', fontWeight: 500 }}>{h.name}</td>
                      <td style={{ padding: '0.75rem' }}>{h.rut}</td>
                      <td style={{ padding: '0.75rem' }}>{h.sns}</td>
                      <td style={{ padding: '0.75rem' }}>{h.resolution}</td>
                      <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                          <button className="btn btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }} onClick={() => setEditingHsec(h)}>Editar</button>
                          <button className="btn btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', color: 'var(--danger)' }} onClick={() => handleDeleteHsec(h.id)}>Eliminar</button>
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* CONTENIDO TAB: MAPEO DE VARIABLES */}
      {activeTab === 'variables' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          {/* Agregar */}
          <div style={{ background: 'var(--bg-app)', padding: '1.5rem', borderRadius: 'var(--radius-md)' }}>
            <h4 style={{ fontWeight: 600, marginBottom: '1rem', color: 'var(--primary)' }}>Registrar Nuevo Mapeo de Variable</h4>
            <div className="form-grid">
              <div className="form-group">
                <label>Descripción Legible</label>
                <input 
                  type="text" 
                  placeholder="Ej. RUT del Prevencionista"
                  value={newVM.description}
                  onChange={(e) => setNewVM({ ...newVM, description: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Origen en el Formulario</label>
                <select 
                  value={newVM.formField}
                  onChange={(e) => setNewVM({ ...newVM, formField: e.target.value })}
                >
                  {FORM_FIELDS_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Nombre de la Variable en el Word (MERGEFIELD)</label>
                <input 
                  type="text" 
                  placeholder="Ej. Rut_prevensionista_"
                  value={newVM.wordPlaceholder}
                  onChange={(e) => setNewVM({ ...newVM, wordPlaceholder: e.target.value })}
                />
              </div>
              <div className="form-group" style={{ display: 'flex', alignItems: 'flex-end' }}>
                <button className="btn btn-primary" onClick={handleAddVM} style={{ width: '100%', height: '42px' }}>Agregar Variable</button>
              </div>
            </div>
          </div>

          {/* Listado */}
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.95rem' }}>
            <thead>
              <tr style={{ background: 'var(--bg-app)', borderBottom: '2px solid var(--border)', textAlign: 'left' }}>
                <th style={{ padding: '0.75rem' }}>Descripción</th>
                <th style={{ padding: '0.75rem' }}>Origen (Formulario)</th>
                <th style={{ padding: '0.75rem' }}>Marcador Word (MERGEFIELD)</th>
                <th style={{ padding: '0.75rem', textAlign: 'right' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {config.variableMappings.map((vm) => (
                <tr key={vm.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  {editingVM?.id === vm.id ? (
                    <>
                      <td style={{ padding: '0.75rem' }}>
                        <input 
                          type="text"
                          value={editingVM.description}
                          onChange={(e) => setEditingVM({ ...editingVM, description: e.target.value })}
                          style={{ padding: '0.4rem 0.7rem' }}
                        />
                      </td>
                      <td style={{ padding: '0.75rem' }}>
                        <select 
                          value={editingVM.formField}
                          onChange={(e) => setEditingVM({ ...editingVM, formField: e.target.value })}
                          style={{ padding: '0.4rem 0.7rem' }}
                        >
                          {FORM_FIELDS_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                      </td>
                      <td style={{ padding: '0.75rem' }}>
                        <input 
                          type="text"
                          value={editingVM.wordPlaceholder}
                          onChange={(e) => setEditingVM({ ...editingVM, wordPlaceholder: e.target.value })}
                          style={{ padding: '0.4rem 0.7rem' }}
                        />
                      </td>
                      <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                          <button className="btn btn-primary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }} onClick={handleUpdateVM}>Guardar</button>
                          <button className="btn btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }} onClick={() => setEditingVM(null)}>Cancelar</button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td style={{ padding: '0.75rem' }}>{vm.description}</td>
                      <td style={{ padding: '0.75rem' }}>
                        <code style={{ background: 'var(--primary-light)', color: 'var(--primary)', padding: '0.15rem 0.35rem', borderRadius: '4px', fontSize: '0.8rem' }}>
                          {FORM_FIELDS_OPTIONS.find(opt => opt.value === vm.formField)?.label || vm.formField}
                        </code>
                      </td>
                      <td style={{ padding: '0.75rem' }}>
                        <code>«{vm.wordPlaceholder}»</code>
                      </td>
                      <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                          <button className="btn btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }} onClick={() => setEditingVM(vm)}>Editar</button>
                          <button className="btn btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', color: 'var(--danger)' }} onClick={() => handleDeleteVM(vm.id)}>Eliminar</button>
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
