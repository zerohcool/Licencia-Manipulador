import React, { useState, useEffect } from 'react';

export interface SolicitudRegistro {
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

interface RegistrosPanelProps {
  onLoadRegistro: (datos: Record<string, any>, nombre: string, rut: string) => void;
  onBackToForm: () => void;
}

export const RegistrosPanel: React.FC<RegistrosPanelProps> = ({
  onLoadRegistro,
  onBackToForm
}) => {
  const [registros, setRegistros] = useState<SolicitudRegistro[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<'supabase' | 'local'>('local');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRegistro, setSelectedRegistro] = useState<SolicitudRegistro | null>(null);

  useEffect(() => {
    fetchRegistros();
  }, []);

  const fetchRegistros = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('http://localhost:3001/api/registros');
      const data = await res.json();
      if (data.success) {
        setRegistros(data.registros || []);
        setSource(data.source || 'local');
      } else {
        setError(data.error || 'No se pudieron cargar los registros.');
      }
    } catch (err: any) {
      console.error(err);
      setError('Error al conectar con el servidor.');
    } finally {
      setLoading(false);
    }
  };

  const filteredRegistros = registros.filter(r => {
    const q = searchTerm.toLowerCase().trim();
    if (!q) return true;
    return (
      (r.rut && r.rut.toLowerCase().includes(q)) ||
      (r.nombre_completo && r.nombre_completo.toLowerCase().includes(q)) ||
      (r.empresa && r.empresa.toLowerCase().includes(q)) ||
      (r.faena && r.faena.toLowerCase().includes(q)) ||
      (r.cargo_desempeno && r.cargo_desempeno.toLowerCase().includes(q))
    );
  });

  const formatDate = (isoString?: string) => {
    if (!isoString) return '-';
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString('es-CL', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return isoString;
    }
  };

  return (
    <div className="wizard-card" style={{ padding: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
            Historial de Solicitudes Registradas
          </h2>
          <p style={{ margin: '0.3rem 0 0', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Selecciona cualquier registro previo para cargar automáticamente sus datos y generar una nueva solicitud.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <span style={{
            fontSize: '0.8rem',
            padding: '0.3rem 0.75rem',
            borderRadius: '20px',
            fontWeight: 600,
            backgroundColor: source === 'supabase' ? 'hsl(142, 70%, 93%)' : 'hsl(45, 95%, 93%)',
            color: source === 'supabase' ? 'hsl(142, 70%, 25%)' : 'hsl(45, 90%, 25%)',
            border: `1px solid ${source === 'supabase' ? 'hsl(142, 70%, 75%)' : 'hsl(45, 90%, 75%)'}`
          }}>
            {source === 'supabase' ? '☁️ Supabase (Dashboard KPI)' : '💾 Almacenamiento Local'}
          </span>
          <button 
            type="button" 
            className="btn btn-secondary" 
            onClick={fetchRegistros} 
            title="Recargar registros"
            style={{ padding: '0.45rem 0.9rem', fontSize: '0.85rem' }}
          >
            ↻ Actualizar
          </button>
          <button 
            type="button" 
            className="btn btn-primary" 
            onClick={onBackToForm}
            style={{ padding: '0.45rem 0.9rem', fontSize: '0.85rem' }}
          >
            Ir al Formulario
          </button>
        </div>
      </div>

      {/* Barra de búsqueda */}
      <div style={{ marginBottom: '1.5rem', display: 'flex', gap: '1rem' }}>
        <input
          type="text"
          placeholder="Buscar por RUT, Nombre, Empresa o Faena..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{ maxWidth: '400px' }}
        />
        {searchTerm && (
          <button 
            type="button" 
            className="btn btn-secondary" 
            onClick={() => setSearchTerm('')}
            style={{ padding: '0.45rem 0.9rem' }}
          >
            Limpiar filtro
          </button>
        )}
      </div>

      {/* Tabla de registros */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem' }}>
          <div className="spinner" style={{ margin: '0 auto 1rem' }}></div>
          <p style={{ color: 'var(--text-secondary)' }}>Consultando base de datos...</p>
        </div>
      ) : error ? (
        <div style={{ padding: '1.5rem', backgroundColor: 'hsl(0, 100%, 97%)', border: '1px solid var(--danger)', borderRadius: '8px', color: 'var(--danger)' }}>
          <strong>Error al cargar registros:</strong> {error}
        </div>
      ) : filteredRegistros.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', border: '2px dashed var(--border)', borderRadius: '12px' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>📋</div>
          <h3 style={{ margin: '0 0 0.5rem', color: 'var(--text-primary)' }}>
            {searchTerm ? 'No se encontraron registros para la búsqueda' : 'No hay solicitudes registradas aún'}
          </h3>
          <p style={{ color: 'var(--text-secondary)', maxWidth: '450px', margin: '0 auto 1.5rem', fontSize: '0.9rem' }}>
            {searchTerm 
              ? 'Prueba con otro término de búsqueda o limpia el filtro.' 
              : 'Cada vez que generes un documento con el asistente, quedará guardado automáticamente aquí y en la base de datos de Dashboard KPI.'}
          </p>
          <button type="button" className="btn btn-primary" onClick={onBackToForm}>
            Crear Nueva Solicitud
          </button>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border)', textAlign: 'left' }}>
                <th style={{ padding: '0.75rem' }}>Fecha</th>
                <th style={{ padding: '0.75rem' }}>RUT</th>
                <th style={{ padding: '0.75rem' }}>Nombre Completo</th>
                <th style={{ padding: '0.75rem' }}>Empresa / Faena</th>
                <th style={{ padding: '0.75rem' }}>Cargo</th>
                <th style={{ padding: '0.75rem', textAlign: 'center' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredRegistros.map((reg) => (
                <tr key={reg.id || reg.rut} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '0.75rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                    {formatDate(reg.created_at)}
                  </td>
                  <td style={{ padding: '0.75rem', fontWeight: 600, whiteSpace: 'nowrap' }}>
                    {reg.rut}
                  </td>
                  <td style={{ padding: '0.75rem', fontWeight: 600 }}>
                    {reg.nombre_completo}
                  </td>
                  <td style={{ padding: '0.75rem' }}>
                    <div style={{ fontWeight: 500 }}>{reg.empresa || '-'}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{reg.faena || '-'}</div>
                  </td>
                  <td style={{ padding: '0.75rem', color: 'var(--text-secondary)' }}>
                    {reg.cargo_desempeno || '-'}
                  </td>
                  <td style={{ padding: '0.75rem', textAlign: 'center', whiteSpace: 'nowrap' }}>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => onLoadRegistro(reg.datos_formulario, reg.nombre_completo, reg.rut)}
                      style={{ padding: '0.4rem 0.85rem', fontSize: '0.82rem', marginRight: '0.5rem' }}
                      title="Cargar estos datos en el formulario de asistente"
                    >
                      ⚡ Cargar en Formulario
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => setSelectedRegistro(reg)}
                      style={{ padding: '0.4rem 0.65rem', fontSize: '0.82rem' }}
                      title="Ver detalle del registro"
                    >
                      👁 Ver
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal de Detalle */}
      {selectedRegistro && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '1rem'
        }}>
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '12px',
            maxWidth: '650px',
            width: '100%',
            maxHeight: '85vh',
            overflowY: 'auto',
            padding: '2rem',
            boxShadow: '0 20px 40px rgba(0,0,0,0.2)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '1rem' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>
                  Detalle de Solicitud
                </h3>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  Registrado el {formatDate(selectedRegistro.created_at)}
                </span>
              </div>
              <button 
                type="button" 
                className="btn btn-secondary" 
                onClick={() => setSelectedRegistro(null)}
                style={{ padding: '0.3rem 0.6rem', fontSize: '0.9rem' }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
              <div><strong>Nombre:</strong> {selectedRegistro.nombre_completo}</div>
              <div><strong>RUT:</strong> {selectedRegistro.rut}</div>
              <div><strong>Empresa:</strong> {selectedRegistro.empresa}</div>
              <div><strong>Faena:</strong> {selectedRegistro.faena}</div>
              <div><strong>Cargo:</strong> {selectedRegistro.cargo_desempeno}</div>
              <div><strong>Motivo:</strong> {selectedRegistro.motivo_solicitud}</div>
              <div style={{ gridColumn: 'span 2' }}><strong>Comuna:</strong> {selectedRegistro.comuna}</div>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <strong style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Datos JSON completos del formulario:
              </strong>
              <pre style={{
                backgroundColor: 'hsl(220, 20%, 96%)',
                padding: '1rem',
                borderRadius: '8px',
                fontSize: '0.78rem',
                maxHeight: '200px',
                overflowY: 'auto'
              }}>
                {JSON.stringify(selectedRegistro.datos_formulario, null, 2)}
              </pre>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setSelectedRegistro(null)}
              >
                Cerrar
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  const reg = selectedRegistro;
                  setSelectedRegistro(null);
                  onLoadRegistro(reg.datos_formulario, reg.nombre_completo, reg.rut);
                }}
              >
                ⚡ Cargar estos datos en el Formulario
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
