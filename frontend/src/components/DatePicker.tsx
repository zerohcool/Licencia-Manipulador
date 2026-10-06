import React, { useState, useRef, useEffect } from 'react';
import { DayPicker } from '@daypicker/react';
import { es } from 'date-fns/locale';
import { format, isValid } from 'date-fns';

interface DatePickerProps {
  id?: string;
  name: string;
  value: string;
  onChange: (e: { target: { name: string; value: string } }) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  required?: boolean;
  minDate?: Date;
  maxDate?: Date;
  startYear?: number;
  endYear?: number;
  defaultMonth?: Date;
}

function parseToDate(val: string): Date | undefined {
  if (!val) return undefined;
  const trimmed = val.trim();
  const ymdMatch = trimmed.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (ymdMatch) {
    const y = parseInt(ymdMatch[1], 10);
    const m = parseInt(ymdMatch[2], 10) - 1;
    const d = parseInt(ymdMatch[3], 10);
    const date = new Date(y, m, d);
    return isValid(date) ? date : undefined;
  }
  const dmyMatch = trimmed.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (dmyMatch) {
    const d = parseInt(dmyMatch[1], 10);
    const m = parseInt(dmyMatch[2], 10) - 1;
    const y = parseInt(dmyMatch[3], 10);
    const date = new Date(y, m, d);
    return isValid(date) ? date : undefined;
  }
  return undefined;
}

export const DatePicker: React.FC<DatePickerProps> = ({
  id,
  name,
  value,
  onChange,
  placeholder = 'dd-mm-aaaa',
  className = '',
  disabled = false,
  required = false,
  minDate,
  maxDate = new Date(),
  startYear = 1920,
  endYear = new Date().getFullYear(),
  defaultMonth
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedDate = parseToDate(value);

  // Formato para mostrar al usuario en el input: DD-MM-YYYY
  const [displayValue, setDisplayValue] = useState<string>(() => {
    if (selectedDate) {
      return format(selectedDate, 'dd-MM-yyyy');
    }
    return value || '';
  });

  // Mantener displayValue sincronizado si cambia el prop value externamente
  useEffect(() => {
    const parsed = parseToDate(value);
    if (parsed) {
      setDisplayValue(format(parsed, 'dd-MM-yyyy'));
    } else {
      setDisplayValue(value || '');
    }
  }, [value]);

  // Cerrar al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleSelectDate = (date: Date | undefined) => {
    if (date) {
      const isoString = format(date, 'yyyy-MM-dd');
      setDisplayValue(format(date, 'dd-MM-yyyy'));
      onChange({ target: { name, value: isoString } });
      setIsOpen(false);
    } else {
      setDisplayValue('');
      onChange({ target: { name, value: '' } });
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setDisplayValue(val);

    if (!val.trim()) {
      onChange({ target: { name, value: '' } });
      return;
    }

    // Si el usuario escribe una fecha completa válida (DD-MM-YYYY o YYYY-MM-DD)
    const parsed = parseToDate(val);
    if (parsed) {
      onChange({ target: { name, value: format(parsed, 'yyyy-MM-dd') } });
    }
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    setDisplayValue('');
    onChange({ target: { name, value: '' } });
  };

  // Mes a mostrar cuando se abre el calendario:
  // Si hay fecha seleccionada, esa fecha; si no, defaultMonth o hace 25 años
  const initialMonth = selectedDate || defaultMonth || new Date(2000, 0);

  return (
    <div className="custom-datepicker-container" ref={containerRef}>
      <div className="custom-datepicker-input-wrapper">
        <input
          ref={inputRef}
          type="text"
          id={id}
          name={name}
          value={displayValue}
          onChange={handleInputChange}
          onClick={() => !disabled && setIsOpen(true)}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          className={`custom-datepicker-input ${className}`}
          autoComplete="off"
        />
        <div className="custom-datepicker-icons">
          {displayValue && !disabled && (
            <button
              type="button"
              className="datepicker-clear-btn"
              onClick={handleClear}
              title="Borrar fecha"
              aria-label="Borrar fecha"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          )}
          <button
            type="button"
            className="datepicker-calendar-btn"
            onClick={() => !disabled && setIsOpen(!isOpen)}
            title="Abrir calendario"
            aria-label="Abrir calendario"
            tabIndex={-1}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="16" y1="2" x2="16" y2="6"></line>
              <line x1="8" y1="2" x2="8" y2="6"></line>
              <line x1="3" y1="10" x2="21" y2="10"></line>
            </svg>
          </button>
        </div>
      </div>

      {isOpen && (
        <div className="datepicker-popover" role="dialog" aria-modal="true">
          <DayPicker
            mode="single"
            selected={selectedDate}
            onSelect={handleSelectDate}
            locale={es}
            captionLayout="dropdown"
            startMonth={new Date(startYear, 0)}
            endMonth={maxDate || new Date(endYear, 11)}
            defaultMonth={initialMonth}
            disabled={
              minDate || maxDate
                ? (date) => {
                    if (minDate && date < minDate) return true;
                    if (maxDate && date > maxDate) return true;
                    return false;
                  }
                : undefined
            }
          />
          <div className="datepicker-footer">
            <button
              type="button"
              className="datepicker-footer-btn"
              onClick={() => {
                const today = new Date();
                if (!maxDate || today <= maxDate) {
                  handleSelectDate(today);
                }
              }}
            >
              Hoy
            </button>
            <button
              type="button"
              className="datepicker-footer-btn datepicker-footer-btn-close"
              onClick={() => setIsOpen(false)}
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
