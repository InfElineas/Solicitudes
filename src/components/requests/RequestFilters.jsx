import React, { useState, useCallback } from 'react';
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import debounce from 'lodash/debounce';

// Protocolo Operativo v1.0
const STATUSES = ['Pendiente', 'En Proceso', 'En Espera', 'Requiere Información', 'En Validación', 'Finalizado', 'Retrasado', 'Cancelado', 'Rechazado'];
const PRIORITIES = ['P1 — Crítica', 'P2 — Alta', 'P3 — Media', 'P4 — Baja'];
const TYPES = ['Nueva Implementación', 'Reparación / Bug', 'Mantenimiento', 'Actualización', 'Consulta o Asesoría', 'Integración', 'Optimización', 'Capacitación', 'Reporte o Análisis', 'Soporte Técnico', 'Automatización'];

export default function RequestFilters({ filters, onFiltersChange, departments = [] }) {
  const [searchInput, setSearchInput] = useState(filters.search || '');

  const debouncedSearch = useCallback(
    debounce((value) => {
      onFiltersChange({ ...filters, search: value });
    }, 300),
    [filters, onFiltersChange]
  );

  const handleSearchChange = (e) => {
    setSearchInput(e.target.value);
    debouncedSearch(e.target.value);
  };

  const handleFilterChange = (key, value) => {
    onFiltersChange({ ...filters, [key]: value === 'all' ? '' : value });
  };

  const hasActiveFilters = filters.status || filters.priority || filters.type || filters.department || filters.search;

  const clearFilters = () => {
    setSearchInput('');
    onFiltersChange({ search: '', status: '', priority: '', type: '', department: '' });
  };

  return (
    <div className="glass-card p-4 space-y-3">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[hsl(var(--muted-foreground))]" />
        <Input
          placeholder="Buscar solicitudes..."
          value={searchInput}
          onChange={handleSearchChange}
          className="pl-10 bg-[hsl(var(--secondary))] border-[hsl(var(--border))] text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))]"
        />
      </div>

      {/* Filter row */}
      <div className="flex flex-wrap gap-2">
        <Select value={filters.status || 'all'} onValueChange={(v) => handleFilterChange('status', v)}>
          <SelectTrigger className="w-[140px] bg-[hsl(var(--secondary))] border-[hsl(var(--border))] text-[hsl(var(--foreground))]">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent className="bg-[hsl(var(--card))] border-[hsl(var(--border))]">
            <SelectItem value="all">Todos los estados</SelectItem>
            {STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={filters.priority || 'all'} onValueChange={(v) => handleFilterChange('priority', v)}>
          <SelectTrigger className="w-[130px] bg-[hsl(var(--secondary))] border-[hsl(var(--border))] text-[hsl(var(--foreground))]">
            <SelectValue placeholder="Prioridad" />
          </SelectTrigger>
          <SelectContent className="bg-[hsl(var(--card))] border-[hsl(var(--border))]">
            <SelectItem value="all">Todas</SelectItem>
            {PRIORITIES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={filters.type || 'all'} onValueChange={(v) => handleFilterChange('type', v)}>
          <SelectTrigger className="w-[140px] bg-[hsl(var(--secondary))] border-[hsl(var(--border))] text-[hsl(var(--foreground))]">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent className="bg-[hsl(var(--card))] border-[hsl(var(--border))]">
            <SelectItem value="all">Todos los tipos</SelectItem>
            {TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>

        {departments.length > 0 && (
          <Select value={filters.department || 'all'} onValueChange={(v) => handleFilterChange('department', v)}>
            <SelectTrigger className="w-[160px] bg-[hsl(var(--secondary))] border-[hsl(var(--border))] text-[hsl(var(--foreground))]">
              <SelectValue placeholder="Departamento" />
            </SelectTrigger>
            <SelectContent className="bg-[hsl(var(--card))] border-[hsl(var(--border))]">
              <SelectItem value="all">Todos</SelectItem>
              {departments.map(d => <SelectItem key={d.id} value={d.name}>{d.name}</SelectItem>)}
            </SelectContent>
          </Select>
        )}

        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]">
            <X className="w-3 h-3 mr-1" /> Limpiar
          </Button>
        )}
      </div>
    </div>
  );
}