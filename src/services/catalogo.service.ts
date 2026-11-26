import { crearCacheListado, listarConRespaldo, type ListadoPaginado } from './cacheListado';
import { http } from './http';

export const CACHE_RAZAS_KEY = 'guateganado_catalogos_razas_cache_v1';
export const CACHE_CATEGORIAS_KEY = 'guateganado_catalogos_categorias_cache_v1';
export const CACHE_UNIDADES_MEDIDA_KEY = 'guateganado_catalogos_unidades_cache_v1';

export const TIPOS_CATEGORIA_REFERENCIA = ['Nutrición', 'Sanidad', 'Suplemento', 'Mantenimiento', 'Equipo'] as const;

export const CAMPOS_ORDEN_RAZA = ['nombre', 'raza_id', 'created_at'] as const;
export type CampoOrdenRaza = (typeof CAMPOS_ORDEN_RAZA)[number];

export const CAMPOS_ORDEN_CATEGORIA = ['nombre', 'tipo', 'categoria_id'] as const;
export type CampoOrdenCategoria = (typeof CAMPOS_ORDEN_CATEGORIA)[number];

export const CAMPOS_ORDEN_UNIDAD_MEDIDA_SEGUROS = ['nombre', 'unidad_medida_id', 'created_at'] as const;
export type CampoOrdenUnidadMedida = (typeof CAMPOS_ORDEN_UNIDAD_MEDIDA_SEGUROS)[number];

export interface OpcionCatalogo {
  id: number;
  nombre: string;
}

export interface OpcionPotreroCatalogo extends OpcionCatalogo {
  capacidad_maxima: number;
  ocupacion_actual: number;
  espacios_disponibles: number;
}

export interface RazaApi {
  raza_id: number;
  nombre: string;
  created_at?: string;
  updated_at?: string;
}

export interface Raza {
  raza_id: number;
  nombre: string;
  created_at?: string;
  updated_at?: string;
}

export interface RazaPayload {
  nombre: string;
}

export interface FiltrosRazas {
  page?: number;
  per_page?: number;
  buscar?: string;
  nombre?: string;
  sort_by?: CampoOrdenRaza;
  order?: 'asc' | 'desc';
  signal?: AbortSignal;
}

export interface CategoriaApi {
  categoria_id: number;
  nombre: string;
  tipo?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface Categoria {
  categoria_id: number;
  nombre: string;
  tipo: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface CategoriaPayload {
  nombre: string;
  tipo?: string | null;
}

export interface FiltrosCategorias {
  page?: number;
  per_page?: number;
  buscar?: string;
  nombre?: string;
  tipo?: string;
  sort_by?: CampoOrdenCategoria;
  order?: 'asc' | 'desc';
  signal?: AbortSignal;
}

export interface UnidadMedidaApi {
  unidad_medida_id: number;
  nombre: string;
  apertura?: string | null;
  abreviatura?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface UnidadMedida {
  unidad_medida_id: number;
  nombre: string;
  apertura: string | null;
  abreviatura: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface UnidadMedidaPayload {
  nombre: string;
  apertura?: string | null;
  abreviatura?: string | null;
}

export interface FiltrosUnidadesMedida {
  page?: number;
  per_page?: number;
  buscar?: string;
  nombre?: string;
  sort_by?: CampoOrdenUnidadMedida | string;
  order?: 'asc' | 'desc';
  signal?: AbortSignal;
}

interface PotreroApi {
  potrero_id: number;
  nombre: string;
  capacidad_maxima?: number | string;
  ocupacion_actual?: number;
  espacios_disponibles?: number;
}

interface RespuestaCatalogo<T> {
  data: T[];
}

export type ListadoRazas = ListadoPaginado<Raza>;
export type ListadoCategorias = ListadoPaginado<Categoria>;
export type ListadoUnidadesMedida = ListadoPaginado<UnidadMedida>;

const cacheRazas = crearCacheListado<Raza>(CACHE_RAZAS_KEY);
const cacheCategorias = crearCacheListado<Categoria>(CACHE_CATEGORIAS_KEY);
const cacheUnidades = crearCacheListado<UnidadMedida>(CACHE_UNIDADES_MEDIDA_KEY);

export function mapearRaza(raw: RazaApi): Raza {
  return {
    raza_id: Number(raw.raza_id),
    nombre: raw.nombre,
    created_at: raw.created_at,
    updated_at: raw.updated_at,
  };
}

export function mapearCategoria(raw: CategoriaApi): Categoria {
  return {
    categoria_id: Number(raw.categoria_id),
    nombre: raw.nombre,
    tipo: raw.tipo ?? null,
    created_at: raw.created_at,
    updated_at: raw.updated_at,
  };
}

export function mapearUnidadMedida(raw: UnidadMedidaApi): UnidadMedida {
  const aperturaNormalizada = raw.apertura?.trim()
    ? raw.apertura.trim()
    : raw.abreviatura?.trim()
      ? raw.abreviatura.trim()
      : null;

  return {
    unidad_medida_id: Number(raw.unidad_medida_id),
    nombre: raw.nombre,
    apertura: aperturaNormalizada,
    abreviatura: aperturaNormalizada,
    created_at: raw.created_at,
    updated_at: raw.updated_at,
  };
}

export function sanitizarOrdenUnidadMedida(sortBy?: string | null): CampoOrdenUnidadMedida {
  if (sortBy && (CAMPOS_ORDEN_UNIDAD_MEDIDA_SEGUROS as readonly string[]).includes(sortBy)) {
    return sortBy as CampoOrdenUnidadMedida;
  }
  return 'unidad_medida_id';
}

export const razaService = {
  async listar(filtros: FiltrosRazas = {}): Promise<ListadoRazas> {
    const pagina = filtros.page ?? 1;
    const porPagina = filtros.per_page ?? 15;
    const termino = filtros.buscar?.trim() || filtros.nombre?.trim() || '';
    const sinFiltros = !termino;

    return listarConRespaldo<Raza, RazaApi>({
      ruta: '/razas',
      query: {
        page: pagina,
        per_page: porPagina,
        buscar: termino || undefined,
        sort_by: filtros.sort_by ?? 'raza_id',
        order: filtros.order ?? 'asc',
      },
      signal: filtros.signal,
      pagina,
      porPagina,
      sinFiltros,
      mapear: mapearRaza,
      clave: (item) => item.raza_id,
      cache: cacheRazas,
    });
  },

  async obtener(id: number | string): Promise<Raza> {
    const respuesta = await http.get<{ data: RazaApi }>(`/razas/${id}`);
    return mapearRaza(respuesta.data);
  },

  async crear(datos: RazaPayload): Promise<Raza> {
    const respuesta = await http.post<{ data: RazaApi }>('/razas', {
      nombre: datos.nombre.trim(),
    });
    return mapearRaza(respuesta.data);
  },

  async actualizar(id: number | string, datos: Partial<RazaPayload>): Promise<Raza> {
    const cuerpo: Record<string, unknown> = {};
    if (datos.nombre !== undefined) cuerpo.nombre = datos.nombre.trim();
    const respuesta = await http.put<{ data: RazaApi }>(`/razas/${id}`, cuerpo);
    return mapearRaza(respuesta.data);
  },

  async eliminar(id: number | string): Promise<void> {
    await http.delete<void>(`/razas/${id}`);
  },

  async limpiarCache(): Promise<void> {
    await cacheRazas.limpiar();
  },
};

export const categoriaService = {
  async listar(filtros: FiltrosCategorias = {}): Promise<ListadoCategorias> {
    const pagina = filtros.page ?? 1;
    const porPagina = filtros.per_page ?? 15;
    const termino = filtros.buscar?.trim() || filtros.nombre?.trim() || '';
    const tipo = filtros.tipo?.trim() || '';
    const sinFiltros = !termino && !tipo;

    return listarConRespaldo<Categoria, CategoriaApi>({
      ruta: '/categorias',
      query: {
        page: pagina,
        per_page: porPagina,
        buscar: termino || undefined,
        tipo: tipo || undefined,
        sort_by: filtros.sort_by ?? 'categoria_id',
        order: filtros.order ?? 'asc',
      },
      signal: filtros.signal,
      pagina,
      porPagina,
      sinFiltros,
      mapear: mapearCategoria,
      clave: (item) => item.categoria_id,
      cache: cacheCategorias,
    });
  },

  async obtener(id: number | string): Promise<Categoria> {
    const respuesta = await http.get<{ data: CategoriaApi }>(`/categorias/${id}`);
    return mapearCategoria(respuesta.data);
  },

  async crear(datos: CategoriaPayload): Promise<Categoria> {
    const respuesta = await http.post<{ data: CategoriaApi }>('/categorias', {
      nombre: datos.nombre.trim(),
      tipo: datos.tipo?.trim() ? datos.tipo.trim() : null,
    });
    return mapearCategoria(respuesta.data);
  },

  async actualizar(id: number | string, datos: Partial<CategoriaPayload>): Promise<Categoria> {
    const cuerpo: Record<string, unknown> = {};
    if (datos.nombre !== undefined) cuerpo.nombre = datos.nombre.trim();
    if (datos.tipo !== undefined) cuerpo.tipo = datos.tipo?.trim() ? datos.tipo.trim() : null;
    const respuesta = await http.put<{ data: CategoriaApi }>(`/categorias/${id}`, cuerpo);
    return mapearCategoria(respuesta.data);
  },

  async eliminar(id: number | string): Promise<void> {
    await http.delete<void>(`/categorias/${id}`);
  },

  async limpiarCache(): Promise<void> {
    await cacheCategorias.limpiar();
  },
};

export const unidadMedidaService = {
  async listar(filtros: FiltrosUnidadesMedida = {}): Promise<ListadoUnidadesMedida> {
    const pagina = filtros.page ?? 1;
    const porPagina = filtros.per_page ?? 15;
    const termino = filtros.buscar?.trim() || filtros.nombre?.trim() || '';
    const sinFiltros = !termino;
    const sortBySeguro = sanitizarOrdenUnidadMedida(filtros.sort_by);

    return listarConRespaldo<UnidadMedida, UnidadMedidaApi>({
      ruta: '/unidades-medida',
      query: {
        page: pagina,
        per_page: porPagina,
        buscar: termino || undefined,
        sort_by: sortBySeguro,
        order: filtros.order ?? 'asc',
      },
      signal: filtros.signal,
      pagina,
      porPagina,
      sinFiltros,
      mapear: mapearUnidadMedida,
      clave: (item) => item.unidad_medida_id,
      cache: cacheUnidades,
    });
  },

  async obtener(id: number | string): Promise<UnidadMedida> {
    const respuesta = await http.get<{ data: UnidadMedidaApi }>(`/unidades-medida/${id}`);
    return mapearUnidadMedida(respuesta.data);
  },

  async crear(datos: UnidadMedidaPayload): Promise<UnidadMedida> {
    const valorApertura = datos.apertura !== undefined ? datos.apertura : datos.abreviatura;
    const respuesta = await http.post<{ data: UnidadMedidaApi }>('/unidades-medida', {
      nombre: datos.nombre.trim(),
      apertura: valorApertura?.trim() ? valorApertura.trim() : null,
    });
    return mapearUnidadMedida(respuesta.data);
  },

  async actualizar(id: number | string, datos: Partial<UnidadMedidaPayload>): Promise<UnidadMedida> {
    const cuerpo: Record<string, unknown> = {};
    if (datos.nombre !== undefined) cuerpo.nombre = datos.nombre.trim();
    if (datos.apertura !== undefined || datos.abreviatura !== undefined) {
      const valorApertura = datos.apertura !== undefined ? datos.apertura : datos.abreviatura;
      cuerpo.apertura = valorApertura?.trim() ? valorApertura.trim() : null;
    }
    const respuesta = await http.put<{ data: UnidadMedidaApi }>(`/unidades-medida/${id}`, cuerpo);
    return mapearUnidadMedida(respuesta.data);
  },

  async eliminar(id: number | string): Promise<void> {
    await http.delete<void>(`/unidades-medida/${id}`);
  },

  async limpiarCache(): Promise<void> {
    await cacheUnidades.limpiar();
  },
};

export const catalogoService = {
  async razas(): Promise<OpcionCatalogo[]> {
    const respuesta = await http.get<RespuestaCatalogo<RazaApi>>('/razas', {
      query: { per_page: 100, sort_by: 'nombre' },
    });
    return (respuesta.data ?? []).map((raza) => ({ id: Number(raza.raza_id), nombre: raza.nombre }));
  },

  async potreros(): Promise<OpcionPotreroCatalogo[]> {
    const respuesta = await http.get<RespuestaCatalogo<PotreroApi>>('/potreros', {
      query: { per_page: 100 },
    });
    return (respuesta.data ?? []).map((potrero) => {
      const capacidad = Number(potrero.capacidad_maxima ?? 0);
      const ocupacion = Number(potrero.ocupacion_actual ?? 0);
      const disponibles = Number(potrero.espacios_disponibles ?? Math.max(0, capacidad - ocupacion));
      return {
        id: Number(potrero.potrero_id),
        nombre: potrero.nombre,
        capacidad_maxima: Number.isFinite(capacidad) ? Math.max(0, capacidad) : 0,
        ocupacion_actual: Number.isFinite(ocupacion) ? Math.max(0, ocupacion) : 0,
        espacios_disponibles: Number.isFinite(disponibles) ? Math.max(0, disponibles) : Math.max(0, capacidad),
      };
    });
  },

  async categorias(): Promise<Categoria[]> {
    const respuesta = await http.get<RespuestaCatalogo<CategoriaApi>>('/categorias', {
      query: { per_page: 100, sort_by: 'nombre' },
    });
    return (respuesta.data ?? []).map(mapearCategoria);
  },

  async unidadesMedida(): Promise<UnidadMedida[]> {
    const respuesta = await http.get<RespuestaCatalogo<UnidadMedidaApi>>('/unidades-medida', {
      query: { per_page: 100, sort_by: 'nombre' },
    });
    return (respuesta.data ?? []).map(mapearUnidadMedida);
  },

  async limpiarCache(): Promise<void> {
    await Promise.all([
      razaService.limpiarCache(),
      categoriaService.limpiarCache(),
      unidadMedidaService.limpiarCache(),
    ]);
  },
};
