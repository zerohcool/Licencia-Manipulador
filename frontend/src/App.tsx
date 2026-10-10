import React, { useState, useEffect } from 'react';
import { formatRut, validateRut, calculateAge, isAdult, formatDateToDDMMYYYY } from './utils/validation';
import ConfigPanel from './components/ConfigPanel';
import { DatePicker } from './components/DatePicker';
import { AdminAuthModal } from './components/AdminAuthModal';
import { RegistrosPanel } from './components/RegistrosPanel';
import { getRemoteConfig, saveSolicitudRecord, getActiveTemplate } from './services/dataService';
import { fillMergeFieldsInBrowser, buildMergeData } from './utils/docxProcessor';
import comunasChileData from './data/comunasChile.json';
import defaultConfig from './data/defaultConfig.json';

interface ComunaInfo {
  comuna: string;
  provincia: string;
  region: string;
  numeroRegion: string;
}

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

interface AppConfig {
  documentTypes: DocumentType[];
  companyWorkplaces: CompanyWorkplace[];
  hsecProfessionals: HsecProfessional[];
  variableMappings?: any[];
}

interface FormData {
  // Config
  documentTypeId: string;
  
  // Paso 1: Personales
  Nombre_Completo: string;
  Rut_: string;
  SEXO: string;
  Estado_Civil: string;
  Fecha_nacimiento: string;
  Nacido_en_: string;
  Nacionalidad: string;
  Nombre_del_padre_: string;
  Nombre_de_la_madre_: string;
  Nivel_Educacion: string;
  
  // Paso 2: Dirección y Contacto
  Domicilio_Particular_: string;
  Comuna: string;
  PROVINCIA: string;
  REGION: string;
  Fono_: string; // Contiene el fono de 8 dígitos ingresado por el usuario
  
  // Paso 3: Trabajo y Prevención (Unificados y Dinámicos)
  companyWorkplaceId: string;
  Cargo: string;
  hsecAId: string;
  
  // Observaciones
  CampoAutoComb: string;
  
  // Automático
  Fecha_Actual: string;
}

const typedDefaultConfig = defaultConfig as unknown as AppConfig;

const initialFormState: FormData = {
  documentTypeId: typedDefaultConfig.documentTypes?.[0]?.id || '',
  Nombre_Completo: '',
  Rut_: '',
  SEXO: 'MASCULINO',
  Estado_Civil: 'SOLTERO(A)',
  Fecha_nacimiento: '',
  Nacido_en_: '',
  Nacionalidad: 'CHILENA',
  Nombre_del_padre_: '',
  Nombre_de_la_madre_: '',
  Nivel_Educacion: 'MEDIA',
  
  Domicilio_Particular_: '',
  Comuna: '',
  PROVINCIA: '',
  REGION: '',
  Fono_: '',
  
  companyWorkplaceId: typedDefaultConfig.companyWorkplaces?.[0]?.id || '',
  Cargo: '',
  hsecAId: typedDefaultConfig.hsecProfessionals?.[0]?.id || '',
  
  CampoAutoComb: '',
  Fecha_Actual: formatDateToDDMMYYYY(new Date()),
};

const steps = [
  { id: 1, label: 'Datos Personales' },
  { id: 2, label: 'Dirección y Contacto' },
  { id: 3, label: 'Solicitud y Trabajo' },
  { id: 4, label: 'Confirmar' }
];

export default function App() {
  const [view, setView] = useState<'form' | 'config' | 'registros'>('form');
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState<FormData>(initialFormState);
  
  // Autenticación de Administrador (Contraseña: Enaex.2026)
  const [adminPassword, setAdminPassword] = useState<string>(() => {
    return sessionStorage.getItem('admin_pwd') || '';
  });
  const [isAdminAuthModalOpen, setIsAdminAuthModalOpen] = useState(false);
  const [pendingView, setPendingView] = useState<'config' | 'registros' | null>(null);
  const [loadedAlert, setLoadedAlert] = useState<{ nombre: string; rut: string } | null>(null);

  const [config, setConfig] = useState<AppConfig>(typedDefaultConfig);
  const [comunas, setComunas] = useState<ComunaInfo[]>(comunasChileData as ComunaInfo[]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [apiError, setApiError] = useState<string | null>(null);

  // Estados de generación directa en cliente y Supabase
  const [downloadBlobUrl, setDownloadBlobUrl] = useState<string | null>(null);
  const [downloadFilename, setDownloadFilename] = useState<string>('Solicitud_Licencia.docm');

  useEffect(() => {
    loadConfig();
    loadComunas();
  }, []);

  const loadConfig = async () => {
    try {
      const res = await getRemoteConfig();
      if (res.config) {
        setConfig(res.config);
        setFormData(prev => ({
          ...prev,
          documentTypeId: prev.documentTypeId || res.config.documentTypes[0]?.id || '',
          companyWorkplaceId: prev.companyWorkplaceId || res.config.companyWorkplaces[0]?.id || '',
          hsecAId: prev.hsecAId || res.config.hsecProfessionals[0]?.id || ''
        }));
      }
    } catch (err) {
      console.warn('Error al cargar configuración:', err);
    }
  };

  const loadComunas = async () => {
    // Las 346 comunas están indexadas localmente y se cargan al instante
    setComunas(comunasChileData as ComunaInfo[]);
  };

  const handleNavigateToProtectedView = (target: 'config' | 'registros') => {
    if (adminPassword) {
      setView(target);
    } else {
      setPendingView(target);
      setIsAdminAuthModalOpen(true);
    }
  };

  const handleAdminAuthSuccess = (pwd: string) => {
    setAdminPassword(pwd);
    sessionStorage.setItem('admin_pwd', pwd);
    setIsAdminAuthModalOpen(false);
    if (pendingView) {
      setView(pendingView);
      setPendingView(null);
    }
  };

  const handleAdminLogout = () => {
    setAdminPassword('');
    sessionStorage.removeItem('admin_pwd');
    setView('form');
  };

  const handleLoadRegistro = (datos: Record<string, any>, nombre: string, rut: string) => {
    // Normalizar teléfono para que en el formulario solo se carguen los 8 dígitos
    let cleanFono = '';
    if (datos.Fono_) {
      const allDigits = String(datos.Fono_).replace(/[^0-9]/g, '');
      cleanFono = allDigits.length >= 8 ? allDigits.slice(-8) : allDigits;
    }

    setFormData(prev => ({
      ...prev,
      ...datos,
      Fono_: cleanFono
    }));
    setErrors(prev => {
      const copy = { ...prev };
      delete copy.Fono_;
      return copy;
    });
    setCurrentStep(0);
    setView('form');
    setLoadedAlert({ nombre, rut });
    setTimeout(() => setLoadedAlert(null), 8000);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement> | { target: { name: string; value: string; type?: string } }) => {
    const { name, value } = e.target;
    let val = value;

    // Convertir automáticamente a MAYÚSCULAS para todos los campos de texto e inputs excepto fechas
    const isText = 'type' in e.target ? e.target.type === 'text' : true;
    const isTextarea = 'tagName' in e.target ? (e.target as HTMLElement).tagName === 'TEXTAREA' : false;
    if (name !== 'Fecha_nacimiento' && (isText || isTextarea)) {
      val = value.toUpperCase();
    }

    // Formatear RUT de forma específica
    if (name === 'Rut_') {
      val = formatRut(val);
    }

    // Si cambia Comuna (Paso 2), auto-rellenar Provincia y Región
    if (name === 'Comuna') {
      const info = comunas.find(c => c.comuna === val);
      if (info) {
        setFormData(prev => ({
          ...prev,
          Comuna: val,
          PROVINCIA: info.provincia,
          REGION: info.numeroRegion
        }));
        // Limpiar errores asociados
        setErrors(prev => {
          const copy = { ...prev };
          delete copy.Comuna;
          return copy;
        });
        return;
      }
    }

    // Si es el Teléfono (Fono_), limitar a 8 caracteres numéricos
    if (name === 'Fono_') {
      // Filtrar sólo dígitos
      val = value.replace(/[^0-9]/g, '').slice(0, 8);
    }

    setFormData(prev => ({
      ...prev,
      [name]: val
    }));

    if (errors[name]) {
      setErrors(prev => {
        const copy = { ...prev };
        delete copy[name];
        return copy;
      });
    }
  };

  const validateStep = (stepIndex: number): boolean => {
    const newErrors: Record<string, string> = {};

    if (stepIndex === 0) {
      // Validaciones Paso 1: Datos Personales
      if (!formData.Nombre_Completo.trim()) newErrors.Nombre_Completo = 'El nombre completo es requerido.';
      
      if (!formData.Rut_.trim()) {
        newErrors.Rut_ = 'El RUT es requerido.';
      } else if (!validateRut(formData.Rut_)) {
        newErrors.Rut_ = 'El RUT ingresado no es válido.';
      }

      if (!formData.Fecha_nacimiento) {
        newErrors.Fecha_nacimiento = 'La fecha de nacimiento es requerida.';
      } else if (!isAdult(formData.Fecha_nacimiento)) {
        newErrors.Fecha_nacimiento = `No cumple con la edad mínima requerida (18 años). Edad actual: ${calculateAge(formData.Fecha_nacimiento)} años.`;
      }

      if (!formData.Nacido_en_.trim()) newErrors.Nacido_en_ = 'El lugar de nacimiento es requerido.';
      if (!formData.Nacionalidad.trim()) newErrors.Nacionalidad = 'La nacionalidad es requerida.';
      
      // Al menos uno de los progenitores debe estar ingresado
      const padre = formData.Nombre_del_padre_.trim();
      const madre = formData.Nombre_de_la_madre_.trim();
      if (!padre && !madre) {
        newErrors.Nombre_del_padre_ = 'Debe indicar al menos el nombre de un progenitor (padre o madre).';
        newErrors.Nombre_de_la_madre_ = 'Debe indicar al menos el nombre de un progenitor (padre o madre).';
      }
    } else if (stepIndex === 1) {
      // Validaciones Paso 2: Dirección y Contacto
      if (!formData.Domicilio_Particular_.trim()) newErrors.Domicilio_Particular_ = 'El domicilio particular es requerido.';
      if (!formData.Comuna) newErrors.Comuna = 'La comuna es requerida.';
      if (!formData.Fono_.trim()) {
        newErrors.Fono_ = 'El teléfono es requerido.';
      } else if (formData.Fono_.length < 8) {
        newErrors.Fono_ = 'El teléfono debe tener exactamente 8 dígitos.';
      }
    } else if (stepIndex === 2) {
      // Validaciones Paso 3: Solicitud y Trabajo
      if (!formData.documentTypeId) newErrors.documentTypeId = 'El tipo de documento es requerido.';
      if (!formData.companyWorkplaceId) newErrors.companyWorkplaceId = 'La empresa y faena es requerida.';
      if (!formData.Cargo.trim()) newErrors.Cargo = 'El cargo es requerido.';
      if (!formData.hsecAId) newErrors.hsecAId = 'Debe seleccionar un profesional HSEC principal.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handleBack = () => {
    setCurrentStep(prev => prev - 1);
  };

  const handleSubmit = async () => {
    if (!config) return;
    setLoading(true);
    setApiError(null);
    setLoadingMessage('Guardando registro de la solicitud en Supabase...');

    // Buscar información extendida para el Mail Merge
    const hsecA = config.hsecProfessionals.find(h => h.id === formData.hsecAId);

    // Concatenar el prefijo estático al teléfono (asegurando 8 dígitos limpios)
    const cleanFonoDigits = formData.Fono_.replace(/[^0-9]/g, '').slice(-8);
    const telefonoFormateado = cleanFonoDigits.length === 8
      ? `+56 9 ${cleanFonoDigits.slice(0, 4)} ${cleanFonoDigits.slice(4)}`
      : formData.Fono_;

    // Armar el Domicilio Laboral unificado
    const domicilioLaboralUnificado = selectedCompanyWorkplace 
      ? `EMPRESA ${selectedCompanyWorkplace.companyName} (RUT: ${selectedCompanyWorkplace.companyRut}), FAENA ${selectedCompanyWorkplace.workplaceName}, COMUNA DE ${selectedCompanyWorkplace.comuna}`
      : '';

    // Preparar el cuerpo de envío combinando datos dinámicos de config
    const payload = {
      ...formData,
      // Fechas en formato dd-mm-yyyy garantizado
      Fecha_nacimiento: formatDateToDDMMYYYY(formData.Fecha_nacimiento),
      Fecha_Actual: formatDateToDDMMYYYY(new Date()),

      // Teléfono formateado final
      Fono_: telefonoFormateado,
      
      // Auto-rellenar con HSEC de config
      nombre_Prevensionista_: hsecA ? hsecA.name : '',
      Rut_prevensionista_: hsecA ? hsecA.rut : '',
      SNS_: hsecA ? hsecA.sns : '',
      Resolucion_: hsecA ? hsecA.resolution : '',

      // Auto-rellenar lugar de trabajo (Empresa y Faena)
      companyName: selectedCompanyWorkplace ? selectedCompanyWorkplace.companyName : '',
      companyRut: selectedCompanyWorkplace ? selectedCompanyWorkplace.companyRut : '',
      workplaceName: selectedCompanyWorkplace ? selectedCompanyWorkplace.workplaceName : '',
      workplaceComuna: selectedCompanyWorkplace ? selectedCompanyWorkplace.comuna : '',
      Domicilio_Laboral: selectedCompanyWorkplace ? selectedCompanyWorkplace.workplaceName : '',
      domicilioLaboralCompleto: domicilioLaboralUnificado,
      workArea: selectedCompanyWorkplace ? selectedCompanyWorkplace.workArea : 'MINA',
    };

    try {
      // 1. Guardar registro en Supabase (tabla solicitudes_licencia)
      await saveSolicitudRecord({
        rut: formData.Rut_,
        nombre_completo: formData.Nombre_Completo,
        empresa: selectedCompanyWorkplace ? selectedCompanyWorkplace.companyName : '',
        faena: selectedCompanyWorkplace ? selectedCompanyWorkplace.workplaceName : '',
        comuna: formData.Comuna,
        cargo_desempeno: formData.Cargo,
        motivo_solicitud: config.documentTypes.find(d => d.id === formData.documentTypeId)?.name || 'Solicitud de Licencia',
        datos_formulario: payload
      });

      // 2. Obtener plantilla activa (.docm) desde Supabase
      setLoadingMessage('Obteniendo plantilla oficial desde Supabase...');
      const tpl = await getActiveTemplate();

      // 3. Rellenar campos MERGEFIELD directamente en el navegador
      setLoadingMessage('Completando campos del documento Word...');
      const mergeData = buildMergeData(payload, config);
      const generatedBlob = fillMergeFieldsInBrowser(tpl.binary, mergeData);

      // 4. Crear ObjectURL para descarga directa
      if (downloadBlobUrl) {
        URL.revokeObjectURL(downloadBlobUrl);
      }
      const blobUrl = URL.createObjectURL(generatedBlob);
      const cleanRut = formData.Rut_.replace(/[^0-9kK]/g, '');
      const cleanName = formData.Nombre_Completo.trim().replace(/\s+/g, '_');
      const filename = `Solicitud_Licencia_${cleanRut}_${cleanName}.docm`;

      setDownloadBlobUrl(blobUrl);
      setDownloadFilename(filename);
      setCurrentStep(4);
    } catch (err: any) {
      console.error('Error generando documento:', err);
      setApiError(err.message || 'Error al procesar y guardar la solicitud.');
    } finally {
      setLoading(false);
      setLoadingMessage('');
    }
  };

  const handleReset = () => {
    if (downloadBlobUrl) {
      URL.revokeObjectURL(downloadBlobUrl);
      setDownloadBlobUrl(null);
    }
    setFormData({
      ...initialFormState,
      documentTypeId: config?.documentTypes[0]?.id || '',
      companyWorkplaceId: config?.companyWorkplaces[0]?.id || '',
      hsecAId: config?.hsecProfessionals[0]?.id || ''
    });
    setApiError(null);
    setCurrentStep(0);
  };

  // Obtener HSEC seleccionado para mostrar de solo lectura
  const selectedHsecA = config?.hsecProfessionals.find(h => h.id === formData.hsecAId);
  
  // Obtener Empresa y Faena seleccionada para mostrar de solo lectura y auto-rellenar
  const selectedCompanyWorkplace = config?.companyWorkplaces.find(cw => cw.id === formData.companyWorkplaceId);

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="brand">
          <div className="brand-logo">LM</div>
          <div>
            <h1 className="brand-title">Solicitud de Licencia</h1>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Módulo Administrativo y de Configuración</span>
          </div>
        </div>
        
        {/* Navegación Superior */}
        <div className="header-nav">
          <button 
            className={`btn ${view === 'form' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '0.45rem 0.9rem', fontSize: '0.85rem' }}
            onClick={() => setView('form')}
          >
            Formulario Asistente
          </button>
          <button 
            className={`btn ${view === 'registros' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '0.45rem 0.9rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
            onClick={() => handleNavigateToProtectedView('registros')}
          >
            <span>Historial Registros</span>
            <span style={{ fontSize: '0.75rem', opacity: 0.85 }}>☁️</span>
          </button>
          <button 
            className={`btn ${view === 'config' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '0.45rem 0.9rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
            onClick={() => handleNavigateToProtectedView('config')}
          >
            <span>Configuración</span>
            {!adminPassword && <span style={{ fontSize: '0.75rem' }}>🔒</span>}
          </button>

          {adminPassword && (
            <button 
              type="button" 
              className="btn btn-secondary" 
              onClick={handleAdminLogout}
              style={{ padding: '0.45rem 0.75rem', fontSize: '0.8rem', color: 'var(--danger)', borderColor: 'hsl(0, 70%, 85%)' }}
              title="Bloquear sesión de administrador"
            >
              🔒 Bloquear Admin
            </button>
          )}

          <div className="header-date" style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginLeft: '0.5rem', borderLeft: '1px solid var(--border)', paddingLeft: '0.75rem' }}>
            Fecha: {formData.Fecha_Actual}
          </div>
        </div>
      </header>

      <main className="main-content">
        {view === 'config' ? (
          <ConfigPanel 
            onConfigChange={loadConfig} 
            onLogoutAdmin={handleAdminLogout}
          />
        ) : view === 'registros' ? (
          <RegistrosPanel
            onLoadRegistro={handleLoadRegistro}
            onBackToForm={() => setView('form')}
          />
        ) : (
          <div className="wizard-card">
            {/* Pasos */}
            {currentStep < 4 && (
              <div className="steps-container">
                <div className="steps-indicator">
                  {steps.map((step, idx) => (
                    <div 
                      key={step.id} 
                      className={`step-item ${idx === currentStep ? 'active' : ''} ${idx < currentStep ? 'completed' : ''}`}
                    >
                      <div className="step-bubble">
                        {idx < currentStep ? '✓' : step.id}
                      </div>
                      <div className="step-label">{step.label}</div>
                    </div>
                  ))}
                </div>
                <div className="mobile-step-title">
                  Paso {currentStep + 1} de {steps.length}: <strong>{steps[currentStep]?.label}</strong>
                </div>
              </div>
            )}

            <div className="form-body">
              {loadedAlert && (
                <div style={{
                  backgroundColor: 'hsl(142, 70%, 95%)',
                  border: '1px solid hsl(142, 70%, 45%)',
                  color: 'hsl(142, 75%, 20%)',
                  padding: '0.75rem 1.25rem',
                  borderRadius: 'var(--radius-md)',
                  marginBottom: '1.5rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontWeight: 500,
                  fontSize: '0.9rem'
                }}>
                  <div>
                    ⚡ <strong>Registro cargado con éxito:</strong> {loadedAlert.nombre} (RUT: {loadedAlert.rut}). Los datos se cargaron en el formulario para generar una nueva solicitud.
                  </div>
                  <button 
                    type="button" 
                    onClick={() => setLoadedAlert(null)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, color: 'inherit', marginLeft: '1rem' }}
                  >
                    ✕
                  </button>
                </div>
              )}

              {loading ? (
                <div className="loading-overlay">
                  <div className="spinner"></div>
                  <h3 style={{ fontWeight: 600 }}>Generando Solicitud Word & PDF</h3>
                  <p style={{ color: 'var(--text-secondary)', textAlign: 'center' }}>{loadingMessage}</p>
                </div>
              ) : apiError ? (
                <div style={{ textAlign: 'center', padding: '2rem' }}>
                  <div style={{ fontSize: '3rem', color: 'var(--danger)' }}>⚠️</div>
                  <h2 style={{ margin: '1rem 0', fontWeight: 700 }}>Error en el Proceso</h2>
                  <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem', maxWidth: '500px', marginInline: 'auto' }}>
                    {apiError}
                  </p>
                  <button className="btn btn-primary" onClick={() => setApiError(null)}>
                    Reintentar
                  </button>
                </div>
              ) : (
                <>
                  {/* PASO 1: DATOS PERSONALES */}
                  {currentStep === 0 && (
                    <div>
                      <h2 className="step-title">Datos Personales</h2>
                      <p className="step-subtitle">Todos los campos son obligatorios (a excepción de Progenitores, donde debe indicarse al menos uno de los dos).</p>
                      
                      <div className="form-grid">
                        <div className="form-group full-width">
                          <label>Nombre Completo <span className="required-dot">*</span></label>
                          <input 
                            type="text" 
                            name="Nombre_Completo" 
                            placeholder="JUAN ALBERTO PÉREZ GÓMEZ"
                            value={formData.Nombre_Completo} 
                            onChange={handleChange}
                            className={errors.Nombre_Completo ? 'input-error' : ''}
                          />
                          {errors.Nombre_Completo && <span className="error-message">{errors.Nombre_Completo}</span>}
                        </div>

                        <div className="form-group">
                          <label>RUT (Sin puntos y con guion se auto-formatea) <span className="required-dot">*</span></label>
                          <input 
                            type="text" 
                            name="Rut_" 
                            placeholder="12.345.678-9"
                            value={formData.Rut_} 
                            onChange={handleChange}
                            className={errors.Rut_ ? 'input-error' : ''}
                          />
                          {errors.Rut_ && <span className="error-message">{errors.Rut_}</span>}
                        </div>

                        <div className="form-group">
                          <label>Sexo <span className="required-dot">*</span></label>
                          <select name="SEXO" value={formData.SEXO} onChange={handleChange}>
                            <option value="MASCULINO">MASCULINO</option>
                            <option value="FEMENINO">FEMENINO</option>
                            <option value="OTRO">OTRO</option>
                          </select>
                        </div>

                        <div className="form-group">
                          <label>Fecha de Nacimiento (Mayor de 18 años) <span className="required-dot">*</span></label>
                          <DatePicker 
                            name="Fecha_nacimiento" 
                            value={formData.Fecha_nacimiento} 
                            onChange={handleChange}
                            className={errors.Fecha_nacimiento ? 'input-error' : ''}
                            maxDate={new Date()}
                          />
                          {errors.Fecha_nacimiento && <span className="error-message">{errors.Fecha_nacimiento}</span>}
                        </div>

                        <div className="form-group">
                          <label>Lugar de Nacimiento (Nacido en) <span className="required-dot">*</span></label>
                          <input 
                            type="text" 
                            name="Nacido_en_" 
                            placeholder="CONCEPCIÓN"
                            value={formData.Nacido_en_} 
                            onChange={handleChange}
                            className={errors.Nacido_en_ ? 'input-error' : ''}
                          />
                          {errors.Nacido_en_ && <span className="error-message">{errors.Nacido_en_}</span>}
                        </div>

                        <div className="form-group">
                          <label>Nacionalidad <span className="required-dot">*</span></label>
                          <input 
                            type="text" 
                            name="Nacionalidad" 
                            value={formData.Nacionalidad} 
                            onChange={handleChange}
                            className={errors.Nacionalidad ? 'input-error' : ''}
                          />
                          {errors.Nacionalidad && <span className="error-message">{errors.Nacionalidad}</span>}
                        </div>

                        <div className="form-group">
                          <label>Nivel de Educación <span className="required-dot">*</span></label>
                          <select name="Nivel_Educacion" value={formData.Nivel_Educacion} onChange={handleChange}>
                            <option value="BÁSICA">BÁSICA</option>
                            <option value="MEDIA">MEDIA</option>
                            <option value="TÉCNICO PROFESIONAL">TÉCNICO PROFESIONAL</option>
                            <option value="PROFESIONAL">PROFESIONAL</option>
                            <option value="UNIVERSITARIA">UNIVERSITARIA</option>
                          </select>
                        </div>

                        <div className="form-group">
                          <label>Estado Civil <span className="required-dot">*</span></label>
                          <select name="Estado_Civil" value={formData.Estado_Civil} onChange={handleChange}>
                            <option value="SOLTERO(A)">SOLTERO(A)</option>
                            <option value="CASADO(A)">CASADO(A)</option>
                            <option value="DIVORCIADO(A)">DIVORCIADO(A)</option>
                            <option value="VIUDO(A)">VIUDO(A)</option>
                            <option value="UNIÓN CIVIL">UNIÓN CIVIL</option>
                          </select>
                        </div>

                        <div className="form-group">
                          <label>Nombre del Padre (Opcional si se indica Madre) <span className="required-dot">*</span></label>
                          <input 
                            type="text" 
                            name="Nombre_del_padre_" 
                            placeholder="PEDRO PÉREZ VALENZUELA"
                            value={formData.Nombre_del_padre_} 
                            onChange={handleChange}
                            className={errors.Nombre_del_padre_ ? 'input-error' : ''}
                          />
                          {errors.Nombre_del_padre_ && <span className="error-message">{errors.Nombre_del_padre_}</span>}
                        </div>

                        <div className="form-group">
                          <label>Nombre de la Madre (Opcional si se indica Padre) <span className="required-dot">*</span></label>
                          <input 
                            type="text" 
                            name="Nombre_de_la_madre_" 
                            placeholder="MARÍA GÓMEZ SOTO"
                            value={formData.Nombre_de_la_madre_} 
                            onChange={handleChange}
                            className={errors.Nombre_de_la_madre_ ? 'input-error' : ''}
                          />
                          {errors.Nombre_de_la_madre_ && <span className="error-message">{errors.Nombre_de_la_madre_}</span>}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* PASO 2: DIRECCIÓN Y CONTACTO */}
                  {currentStep === 1 && (
                    <div>
                      <h2 className="step-title">Dirección y Contacto</h2>
                      <p className="step-subtitle">Seleccione su comuna y la provincia/región se completarán automáticamente.</p>
                      
                      <div className="form-grid">
                        <div className="form-group full-width">
                          <label>Domicilio Particular <span className="required-dot">*</span></label>
                          <input 
                            type="text" 
                            name="Domicilio_Particular_" 
                            placeholder="AV. PROVIDENCIA 1234, DEPTO 401"
                            value={formData.Domicilio_Particular_} 
                            onChange={handleChange}
                            className={errors.Domicilio_Particular_ ? 'input-error' : ''}
                          />
                          {errors.Domicilio_Particular_ && <span className="error-message">{errors.Domicilio_Particular_}</span>}
                        </div>

                        <div className="form-group">
                          <label>Comuna <span className="required-dot">*</span></label>
                          <select 
                            name="Comuna" 
                            value={formData.Comuna} 
                            onChange={handleChange}
                            className={errors.Comuna ? 'input-error' : ''}
                          >
                            <option value="">Seleccione Comuna...</option>
                            {comunas.map((co) => (
                              <option key={co.comuna} value={co.comuna}>{co.comuna}</option>
                            ))}
                          </select>
                          {errors.Comuna && <span className="error-message">{errors.Comuna}</span>}
                        </div>

                        <div className="form-group">
                          <label>Provincia (Auto-completado)</label>
                          <input 
                            type="text" 
                            name="PROVINCIA" 
                            value={formData.PROVINCIA} 
                            disabled 
                            style={{ background: 'var(--border)', cursor: 'not-allowed' }}
                          />
                        </div>

                        <div className="form-group">
                          <label>Región (Auto-completado en Romano)</label>
                          <input 
                            type="text" 
                            name="REGION" 
                            value={formData.REGION} 
                            disabled 
                            style={{ background: 'var(--border)', cursor: 'not-allowed' }}
                          />
                        </div>

                        <div className="form-group">
                          <label>Teléfono de Contacto <span className="required-dot">*</span></label>
                          <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-input)', borderRadius: 'var(--radius-md)', paddingLeft: '1rem', border: errors.Fono_ ? '1px solid var(--danger)' : '1px solid transparent', height: '46px' }}>
                            <span style={{ fontWeight: 600, color: 'var(--text-secondary)', marginRight: '0.5rem', userSelect: 'none', whiteSpace: 'nowrap', flexShrink: 0 }}>+56 9</span>
                            <input 
                              type="text" 
                              name="Fono_" 
                              placeholder="1234 5678"
                              value={formData.Fono_} 
                              onChange={handleChange}
                              style={{ background: 'none', border: 'none', paddingLeft: 0, flex: 1, minWidth: 0, height: '100%' }}
                            />
                          </div>
                          {errors.Fono_ && <span className="error-message" style={{ marginTop: '0.2rem' }}>{errors.Fono_}</span>}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* PASO 3: SOLICITUD Y TRABAJO (UNIFICADO) */}
                  {currentStep === 2 && (
                    <div>
                      <h2 className="step-title">Datos de Solicitud, Trabajo y HSEC</h2>
                      <p className="step-subtitle">Complete la información del tipo de licencia, faena laboral y profesional HSEC supervisor.</p>
                      
                      <div className="form-grid">
                        <div className="form-group full-width">
                          <label>Tipo de Documento / Licencia <span className="required-dot">*</span></label>
                          <select name="documentTypeId" value={formData.documentTypeId} onChange={handleChange}>
                            {config?.documentTypes.map(d => (
                              <option key={d.id} value={d.id}>{d.name}</option>
                            ))}
                          </select>
                        </div>

                        <div className="form-group full-width">
                          <label>Seleccionar Empresa y Faena Laboral <span className="required-dot">*</span></label>
                          <select name="companyWorkplaceId" value={formData.companyWorkplaceId} onChange={handleChange}>
                            {config?.companyWorkplaces.map(cw => (
                              <option key={cw.id} value={cw.id}>
                                {cw.companyName} - FAENA {cw.workplaceName} ({cw.comuna})
                              </option>
                            ))}
                          </select>
                          {errors.companyWorkplaceId && <span className="error-message">{errors.companyWorkplaceId}</span>}
                        </div>

                        {selectedCompanyWorkplace && (
                          <>
                            <div className="form-group">
                              <label>Nombre de la Empresa</label>
                              <input type="text" value={selectedCompanyWorkplace.companyName} disabled style={{ background: 'var(--border)', cursor: 'not-allowed' }} />
                            </div>
                            <div className="form-group">
                              <label>RUT de la Empresa</label>
                              <input type="text" value={selectedCompanyWorkplace.companyRut} disabled style={{ background: 'var(--border)', cursor: 'not-allowed' }} />
                            </div>
                            <div className="form-group">
                              <label>Faena / Domicilio Laboral</label>
                              <input type="text" value={selectedCompanyWorkplace.workplaceName} disabled style={{ background: 'var(--border)', cursor: 'not-allowed' }} />
                            </div>
                            <div className="form-group">
                              <label>Comuna Faena</label>
                              <input type="text" value={selectedCompanyWorkplace.comuna} disabled style={{ background: 'var(--border)', cursor: 'not-allowed' }} />
                            </div>
                            <div className="form-group">
                              <label>Área de Trabajo</label>
                              <input type="text" value={selectedCompanyWorkplace.workArea} disabled style={{ background: 'var(--border)', cursor: 'not-allowed' }} />
                            </div>
                          </>
                        )}

                        <div className="form-group full-width">
                          <label>Cargo del Solicitante <span className="required-dot">*</span></label>
                          <input 
                            type="text" 
                            name="Cargo" 
                            placeholder="OPERADOR CARGADOR DE EXPLOSIVOS"
                            value={formData.Cargo} 
                            onChange={handleChange}
                            className={errors.Cargo ? 'input-error' : ''}
                          />
                          {errors.Cargo && <span className="error-message">{errors.Cargo}</span>}
                        </div>

                        {/* Prevencionista A */}
                        <div className="form-group full-width" style={{ marginTop: '1rem' }}>
                          <h4 style={{ color: 'var(--primary)', borderBottom: '1px solid var(--border)', paddingBottom: '0.3rem', fontWeight: 600 }}>
                            Profesional HSEC Asignado <span className="required-dot">*</span>
                          </h4>
                        </div>

                        <div className="form-group full-width">
                          <label>Seleccionar Profesional HSEC</label>
                          <select name="hsecAId" value={formData.hsecAId} onChange={handleChange}>
                            <option value="">Seleccione HSEC...</option>
                            {config?.hsecProfessionals.map(h => (
                              <option key={h.id} value={h.id}>{h.name}</option>
                            ))}
                          </select>
                          {errors.hsecAId && <span className="error-message">{errors.hsecAId}</span>}
                        </div>

                        {selectedHsecA && (
                          <>
                            <div className="form-group">
                              <label>RUT HSEC</label>
                              <input type="text" value={selectedHsecA.rut} disabled style={{ background: 'var(--border)', cursor: 'not-allowed' }} />
                            </div>
                            <div className="form-group">
                              <label>Registro SNS</label>
                              <input type="text" value={selectedHsecA.sns} disabled style={{ background: 'var(--border)', cursor: 'not-allowed' }} />
                            </div>
                            <div className="form-group full-width">
                              <label>Resolución HSEC</label>
                              <input type="text" value={selectedHsecA.resolution} disabled style={{ background: 'var(--border)', cursor: 'not-allowed' }} />
                            </div>
                          </>
                        )}

                        {/* Observaciones */}

                        <div className="form-group full-width" style={{ marginTop: '1rem' }}>
                          <label>Observaciones Adicionales (Se incluirá en el final del documento)</label>
                          <textarea 
                            name="CampoAutoComb" 
                            rows={2}
                            placeholder="INDICAR INFORMACIÓN EXTRA SI CORRESPONDE"
                            value={formData.CampoAutoComb} 
                            onChange={handleChange}
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* PASO 4: CONFIRMACIÓN Y VISOR */}
                  {currentStep === 3 && (
                    <div>
                      <h2 className="step-title">Confirmar y Rellenar</h2>
                      <p className="step-subtitle">Verifique la información consolidada antes de lanzar la generación de PDF.</p>
                      
                      <div className="summary-grid">
                        <div className="summary-group">
                          <div className="summary-label">Solicitante</div>
                          <div className="summary-value">{formData.Nombre_Completo}</div>
                        </div>
                        <div className="summary-group">
                          <div className="summary-label">RUT / Estado Civil</div>
                          <div className="summary-value">{formData.Rut_} | {formData.Estado_Civil}</div>
                        </div>
                        <div className="summary-group">
                          <div className="summary-label">Edad / Nacimiento</div>
                          <div className="summary-value">{calculateAge(formData.Fecha_nacimiento)} AÑOS ({formatDateToDDMMYYYY(formData.Fecha_nacimiento)})</div>
                        </div>
                        <div className="summary-group">
                          <div className="summary-label">Domicilio</div>
                          <div className="summary-value">{formData.Domicilio_Particular_}, {formData.Comuna} ({formData.REGION})</div>
                        </div>
                        <div className="summary-group">
                          <div className="summary-label">Teléfono</div>
                          <div className="summary-value">+56 9 {formData.Fono_.slice(0, 4)} {formData.Fono_.slice(4)}</div>
                        </div>
                        <div className="summary-group">
                          <div className="summary-label">Tipo Documento</div>
                          <div className="summary-value">{config?.documentTypes.find(d => d.id === formData.documentTypeId)?.name}</div>
                        </div>
                        <div className="summary-group">
                          <div className="summary-label">Empresa / Faena</div>
                          <div className="summary-value">{selectedCompanyWorkplace?.companyName} - FAENA {selectedCompanyWorkplace?.workplaceName} ({selectedCompanyWorkplace?.comuna})</div>
                        </div>
                        <div className="summary-group">
                          <div className="summary-label">Área / Cargo</div>
                          <div className="summary-value">{selectedCompanyWorkplace?.workArea} - {formData.Cargo}</div>
                        </div>
                        <div className="summary-group full-width">
                          <div className="summary-label">Profesional HSEC A Cargo</div>
                          <div className="summary-value">
                            {selectedHsecA?.name} (RUT: {selectedHsecA?.rut}, SNS: {selectedHsecA?.sns}, RES: {selectedHsecA?.resolution})
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* VISOR DE RESULTADOS Y DESCARGAS */}
                  {currentStep === 4 && (
                    <div>
                      <h2 className="step-title" style={{ color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span>✓</span> ¡Documento Generado Exitosamente!
                      </h2>
                      <p className="step-subtitle">
                        La solicitud ha sido registrada en Supabase y el archivo oficial Word (.docm) ha sido generado con todos los datos combinados.
                      </p>
                      
                      <div className="result-container" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem', marginTop: '1.5rem' }}>
                        <div className="result-info" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                          <p style={{ fontSize: '0.92rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
                            Haz clic a continuación para descargar el documento oficial con todos los campos del solicitante y de faena rellenados.
                          </p>
                          
                          <div className="download-options" style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', marginTop: '0.5rem' }}>
                            <a 
                              href={downloadBlobUrl || '#'}
                              download={downloadFilename}
                              className="btn btn-download btn-download-word"
                              style={{ 
                                padding: '1rem 1.25rem', 
                                borderRadius: '10px', 
                                textDecoration: 'none',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                background: '#1d4ed8',
                                color: 'white',
                                boxShadow: '0 4px 12px rgba(29, 78, 216, 0.25)',
                                cursor: 'pointer'
                              }}
                            >
                              <div>
                                <div style={{ fontWeight: 700, fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                  <span>📥</span> Descargar Documento Word (.docm)
                                </div>
                                <span style={{ fontSize: '0.8rem', opacity: 0.9 }}>
                                  {downloadFilename}
                                </span>
                              </div>
                              <span style={{ fontSize: '1.5rem', marginLeft: '1rem' }}>↓</span>
                            </a>
                          </div>

                          <div style={{
                            background: '#f8fafc',
                            border: '1px solid #e2e8f0',
                            borderRadius: '12px',
                            padding: '1.25rem',
                            fontSize: '0.88rem',
                            color: '#334155',
                            lineHeight: 1.6,
                            marginTop: '0.5rem'
                          }}>
                            <div style={{ fontWeight: 700, color: '#1e293b', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.95rem' }}>
                              <span>📋</span> Instrucciones de Envío
                            </div>
                            <p style={{ margin: '0 0 0.6rem 0', fontWeight: 500 }}>
                              Se debe descargar este documento y enviarlo por correo a su administrativo adjuntando:
                            </p>
                            <ul style={{ margin: 0, paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                              <li>Fotografía digital para credencial</li>
                              <li>Fotografía cédula identidad por ambos lados</li>
                              <li>Certificado de Antecedentes para <strong>FINES ESPECIALES</strong></li>
                              <li>Certificado de título legalizado <em>(Solo para Licencia de Programador Calculista)</em></li>
                            </ul>
                          </div>

                          <button 
                            className="btn btn-secondary" 
                            style={{ marginTop: '0.5rem', alignSelf: 'flex-start' }}
                            onClick={handleReset}
                          >
                            Generar Nueva Solicitud
                          </button>
                        </div>

                        {/* Ficha Resumen del Registro Guardado */}
                        <div style={{ 
                          background: 'white', 
                          border: '1px solid var(--border)', 
                          borderRadius: '12px', 
                          padding: '1.25rem',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                        }}>
                          <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)', marginBottom: '0.75rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>
                            📋 Resumen de la Solicitud Guardada
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.6rem', fontSize: '0.85rem' }}>
                            <div>
                              <strong style={{ color: 'var(--text-secondary)' }}>Solicitante:</strong>
                              <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{formData.Nombre_Completo}</div>
                            </div>
                            <div>
                              <strong style={{ color: 'var(--text-secondary)' }}>RUT:</strong>
                              <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{formData.Rut_}</div>
                            </div>
                            <div>
                              <strong style={{ color: 'var(--text-secondary)' }}>Empresa / Faena:</strong>
                              <div style={{ color: 'var(--text-primary)' }}>{selectedCompanyWorkplace?.companyName} - {selectedCompanyWorkplace?.workplaceName}</div>
                            </div>
                            <div>
                              <strong style={{ color: 'var(--text-secondary)' }}>Cargo:</strong>
                              <div style={{ color: 'var(--text-primary)' }}>{formData.Cargo}</div>
                            </div>
                            <div>
                              <strong style={{ color: 'var(--text-secondary)' }}>HSEC Asignado:</strong>
                              <div style={{ color: 'var(--text-primary)' }}>{selectedHsecA?.name}</div>
                            </div>
                            <div style={{ marginTop: '0.5rem', padding: '0.5rem', background: '#ecfdf5', borderRadius: '6px', color: '#065f46', fontSize: '0.8rem' }}>
                              ✓ Registro guardado en Supabase (Disponible en Historial de Registros)
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Botones de navegación del asistente */}
            {!loading && currentStep < 4 && (
              <div className="form-footer">
                <button 
                  className="btn btn-secondary" 
                  onClick={handleBack}
                  disabled={currentStep === 0}
                >
                  Anterior
                </button>

                {currentStep < 3 ? (
                  <button className="btn btn-primary" onClick={handleNext}>
                    Siguiente
                  </button>
                ) : (
                  <button className="btn btn-primary" onClick={handleSubmit}>
                    Generar Documento
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Modal de Autenticación de Administrador */}
      <AdminAuthModal
        isOpen={isAdminAuthModalOpen}
        onClose={() => {
          setIsAdminAuthModalOpen(false);
          setPendingView(null);
        }}
        onSuccess={handleAdminAuthSuccess}
        targetViewName={pendingView === 'registros' ? 'Historial de Registros' : 'Configuración General'}
      />
    </div>
  );
}
