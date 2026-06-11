import { useState } from 'react';
import { Download, BookOpen, X, CheckCircle2 } from 'lucide-react';

const ROLE_INFO = {
  employee: {
    label: 'Empleado',
    color: 'hsl(142,60%,20%)',
    textColor: '#4ade80',
    tip: 'Desde aquí puedes reportar incidencias, hacer seguimiento y consultar la base de conocimientos.',
    sections: ['Incidencias', 'Mi historial', 'Base de conocimientos'],
  },
  jefe: {
    label: 'Jefe de Departamento',
    color: 'hsl(38,60%,18%)',
    textColor: '#fbbf24',
    tip: 'Puedes ver y dar seguimiento a las solicitudes de tu área, y reportar incidencias prioritarias.',
    sections: ['Solicitudes', 'Incidencias', 'Base de conocimientos'],
  },
  support: {
    label: 'Técnico de Soporte',
    color: 'hsl(217,60%,20%)',
    textColor: '#60a5fa',
    tip: 'Gestiona y resuelve solicitudes, consulta métricas, administra guardias y la base de conocimientos.',
    sections: ['Solicitudes', 'Incidencias', 'Dashboard & Análisis', 'Guardias', 'Base de conocimientos'],
  },
  admin: {
    label: 'Administrador',
    color: 'hsl(270,50%,18%)',
    textColor: '#c084fc',
    tip: 'Tienes acceso completo: usuarios, departamentos, reglas automáticas, auditoría y configuración.',
    sections: ['Todo el sistema'],
  },
  auditor: {
    label: 'Auditor',
    color: 'hsl(196,60%,16%)',
    textColor: '#22d3ee',
    tip: 'Tienes acceso de solo lectura a todo el sistema. Puedes revisar solicitudes, incidencias, guardias, activos y el registro de auditoría sin modificar nada.',
    sections: ['Solicitudes', 'Incidencias', 'Dashboard & Análisis', 'Guardias', 'Activos', 'Base de conocimientos', 'Auditoría'],
  },
};

/**
 * @param {{ user: any, onClose: () => void }} props
 */
export default function WelcomeModal({ user, onClose }) {
  const [downloaded, setDownloaded] = useState(false);
  const role = user?.role || 'employee';
  const info = ROLE_INFO[role] || ROLE_INFO.employee;
  const firstName = ((user?.display_name || user?.full_name || '').trim().split(' ')[0]) || 'usuario';

  const handleDownload = () => {
    setDownloaded(true);
  };

  return (
    <div
      className="fixed inset-0 z-[300] flex items-end sm:items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}
    >
      <div
        className="w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden"
        style={{ background: 'hsl(222,47%,12%)', border: '1px solid hsl(217,33%,22%)' }}
      >
        {/* Franja de color del rol */}
        <div className="h-1.5 w-full" style={{ background: info.textColor, opacity: 0.6 }} />

        {/* Encabezado con ícono */}
        <div className="px-6 pt-6 pb-4 text-center">
          <div
            className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center text-3xl shadow-lg"
            style={{ background: info.color }}
          >
            👋
          </div>
          <h2 className="text-xl font-bold text-white">
            ¡Bienvenido/a, {firstName}!
          </h2>
          <p className="text-sm mt-1" style={{ color: 'hsl(215,20%,60%)' }}>
            Nos alegra que estés aquí. Esta es la Plataforma de Gestión de Solicitudes de Soporte TI
            de <span className="text-white font-medium">Mercado Elíneas</span>.
          </p>
        </div>

        {/* Rol asignado */}
        <div className="mx-6 rounded-xl px-4 py-3 mb-4" style={{ background: info.color, border: `1px solid ${info.textColor}33` }}>
          <p className="text-xs font-semibold mb-0.5" style={{ color: info.textColor }}>
            Tu rol en el sistema
          </p>
          <p className="text-sm font-bold text-white">{info.label}</p>
          <p className="text-xs mt-1" style={{ color: 'hsl(215,20%,75%)' }}>{info.tip}</p>
        </div>

        {/* Secciones disponibles */}
        <div className="mx-6 mb-5">
          <p className="text-xs font-medium mb-2" style={{ color: 'hsl(215,20%,50%)' }}>
            Secciones disponibles para ti:
          </p>
          <div className="flex flex-wrap gap-1.5">
            {info.sections.map(s => (
              <span
                key={s}
                className="text-[11px] px-2.5 py-1 rounded-lg font-medium"
                style={{ background: 'hsl(222,47%,18%)', color: 'hsl(215,20%,70%)', border: '1px solid hsl(217,33%,26%)' }}
              >
                {s}
              </span>
            ))}
          </div>
        </div>

        {/* Manual de usuario */}
        <div
          className="mx-6 mb-5 rounded-xl p-4 flex items-start gap-3"
          style={{ background: 'hsl(217,60%,12%)', border: '1px solid hsl(217,60%,24%)' }}
        >
          <BookOpen className="w-5 h-5 shrink-0 mt-0.5 text-blue-400" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white">Manual de usuario</p>
            <p className="text-xs mt-0.5 mb-3" style={{ color: 'hsl(215,20%,60%)' }}>
              Te recomendamos leerlo antes de comenzar. Explica paso a paso cómo usar cada función de la plataforma.
            </p>
            <a
              href="/manual_usuario.pdf"
              download="Manual_Usuario_Plataforma_Solicitudes.pdf"
              onClick={handleDownload}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all hover:opacity-90 active:scale-95"
              style={{
                background: downloaded ? 'hsl(142,60%,20%)' : 'hsl(217,91%,45%)',
                color: downloaded ? '#4ade80' : 'white',
                border: downloaded ? '1px solid hsl(142,60%,32%)' : 'none',
              }}
            >
              {downloaded
                ? <><CheckCircle2 className="w-4 h-4" /> Descargado</>
                : <><Download className="w-4 h-4" /> Descargar manual (PDF)</>
              }
            </a>
          </div>
        </div>

        {/* Botón para comenzar */}
        <div className="px-6 pb-6 pt-0">
          <button
            onClick={onClose}
            className="w-full py-3 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90 active:scale-95"
            style={{ background: 'hsl(217,91%,45%)' }}
          >
            Entendido, ¡comenzar!
          </button>
          <p className="text-center text-[10px] mt-2.5" style={{ color: 'hsl(215,20%,40%)' }}>
            Puedes volver a ver el manual en cualquier momento desde la Base de conocimientos.
          </p>
        </div>
      </div>
    </div>
  );
}
