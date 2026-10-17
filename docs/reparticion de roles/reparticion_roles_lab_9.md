# Repartición de Roles y Arquitectura Técnica — Laboratorio 9
**Curso:** Desarrollo de Software — Tema 4: EcmaScript  
**Laboratorio:** Laboratorio 9: JavaScript moderno y consumo asíncrono de la API  
**Paradigma:** **100% Vanilla ECMAScript Moderno (ESM Nativo), Async/Await, Fetch API, AbortController y Store Reactivo**  
**Proyecto:** GuateGanado (Consumo de `ProyectoGanadero_BackEnd` en Laravel)  
**Meta del Equipo (6 Personas):** 100/100 en la Rúbrica de Evaluación  

---

## 1. Arquitectura Modular del Frontend (Screaming Architecture + ESM)

El enunciado exige: *«Organice el código en módulos con responsabilidades separadas: acceso a la API, estado de la aplicación y un módulo por vista»*. Siguiendo las mejores prácticas modernas de ECMAScript, estructuraremos la carpeta `JavaScript/` de la siguiente manera:

```text
ProyectoGanadero_Frontend/
├── HTML/
│   ├── dashboard.html
│   ├── animales.html
│   └── registro-animal.html
│
└── JavaScript/
    ├── core/                          # Núcleo reutilizable del sistema
    │   ├── api/
    │   │   ├── ApiClient.js           # Clase HTTP: encapsula baseUrl, Bearer Token y manejo uniforme
    │   │   └── endpoints.js           # Diccionario centralizado de endpoints REST
    │   ├── store/
    │   │   ├── Store.js               # Gestor de Estado Reactivo Singleton (State-driven UI)
    │   │   └── actions.js             # Mutaciones y despachadores asíncronos
    │   └── utils/
    │       ├── debounce.js            # Función debounce idiomática con temporizador
    │       └── storage.js             # Abstracción segura de localStorage/sessionStorage
    │
    ├── features/                      # Módulos organizados por dominio de negocio
    │   ├── catalogo/
    │   │   ├── CatalogoView.js        # Módulo de vista para animales.html
    │   │   ├── animalService.js       # Consumo asíncrono de /api/v1/animales
    │   │   ├── components/
    │   │   │   ├── AnimalCard.js      # Template literal nativo de tarjeta de ganado
    │   │   │   ├── Pagination.js      # Renderizador y controlador de paginación
    │   │   │   └── ViewStates.js      # Renderizador de los 4 estados (Loading, Empty, Error+Retry, Data)
    │   │   └── searchHandler.js       # Debounce + AbortController para búsquedas
    │   │
    │   ├── formulario/
    │   │   ├── FormularioView.js      # Módulo de vista para registro-animal.html (creación/edición)
    │   │   ├── formValidator.js       # Mapeo en el DOM de errores 422 de Laravel por campo
    │   │   └── draftRecovery.js       # Guardado y recuperación de borrador ante 401
    │   │
    │   └── dashboard/
    │       ├── DashboardView.js       # Módulo de vista para dashboard.html
    │       └── metricsService.js      # Consumo concurrente con Promise.allSettled()
    │
    └── main.js                        # Punto de entrada / Router básico
```

---

## 2. Matriz de Roles (Alineada al 100% de la Rúbrica)

| # | Integrante | Rol Oficial en el Laboratorio 9 | Criterio de la Rúbrica Asociado | Puntaje |
| :-: | :--- | :--- | :--- | :-: |
| **1** | **Persona 1** | **Arquitecto de API Client & Manejo de Errores** | Cliente de la API y manejo de errores | **20 pts** |
| **2** | **Persona 2** | **Arquitecto de Estado Reactivo (Store Singleton)** | Organización en módulos y arquitectura ESM | **20 pts** |
| **3** | **Persona 3** | **Desarrollador de UI & 4 Estados de Interfaz** | Estados de la interfaz (Carga, Vacío, Error, Datos) | **20 pts** |
| **4** | **Persona 4** | **Especialista en Búsqueda Optimizada & Paginación** | Búsqueda con Debounce y Cancelación (AbortController) | **20 pts** |
| **5** | **Persona 5** | **Desarrollador de Formulario & Errores 422 (CRUD)** | Sincronización de datos y formulario | **20 pts** |
| **6** | **Persona 6** | **Integrador de Vistas, Sesión 401 & QA de Entregables** | Expiración de sesión y evidencia de entregables | **Entregables** |

---

## 3. Asignación Exhaustiva de Tareas y Criterios Técnicos por Rol

### Persona 1: Arquitecto de API Client & Manejo de Errores
* **Responsabilidad Principal:** Construir el cliente HTTP centralizado del proyecto mediante una **clase moderna de ECMAScript** con propiedades privadas (`#`).
* **Archivos a su cargo:** `JavaScript/core/api/ApiClient.js` y `endpoints.js`.
* **Criterios Técnicos Estrictos:**
  1. **Encapsulamiento:** La clase `ApiClient` debe encapsular:
     * La URL base (`http://localhost/ProyectoGanadero_BackEnd/public/api/v1`).
     * La inyección automática de la cabecera `Authorization: Bearer <token>`.
     * Las cabeceras por defecto `Accept: application/json` y `Content-Type: application/json`.
  2. **Uso idiomático de Fetch API:** Métodos asíncronos `get(endpoint, options)`, `post(endpoint, body, options)`, `put(...)`, `delete(...)` retornando promesas.
  3. **Manejo uniforme de errores (`ApiException`):**
     * Parsear la respuesta y comprobar `response.ok`.
     * Si falla, lanzar una excepción personalizada que incluya el `status` (401, 403, 404, 422, 500) y el cuerpo JSON devuelto por Laravel.
  4. **Interceptor 401:** Si la respuesta tiene código `401 Unauthorized`, debe emitir una notificación global de expiración de sesión antes de rechazar la promesa.
* **Criterio asegurado:** *Cliente de la API y manejo de errores (20 puntos)*.

---

### Persona 2: Arquitecto de Estado Reactivo (Store Singleton)
* **Responsabilidad Principal:** Implementar la reactividad en el cliente sin frameworks, garantizando que el **estado dirija la vista** (State-Driven UI).
* **Archivos a su cargo:** `JavaScript/core/store/Store.js` y `actions.js`.
* **Criterios Técnicos Estrictos:**
  1. **Módulo como Singleton:** Aprovechar el comportamiento nativo de los módulos ESM (se instancian una sola vez en memoria) para exportar una única instancia de `Store`.
  2. **Patrón Observador / Suscripción:**
     * `getState()`: Devuelve una copia inmutable del estado (`structuredClone` o *spread* profundo).
     * `setState(partialState)`: Actualiza el estado y notifica inmediatamente a todos los suscriptores activos.
     * `subscribe(listener)`: Permite a las vistas reaccionar a los cambios de estado sin recargar la página.
  3. **Modularización Limpia:** Garantizar la configuración de `<script type="module">` en todos los archivos HTML y asegurar que no existan variables contaminando el objeto `window`.
* **Criterio asegurado:** *Organización en módulos (20 puntos)*.

---

### Persona 3: Desarrollador de UI & 4 Estados de Interfaz (Catálogo de Animales)
* **Responsabilidad Principal:** Transformar la maqueta estática del Lab 8 (`animales.html`) en una interfaz viva que responda visualmente a los **cuatro estados de ciclo de vida asíncrono**.
* **Archivos a su cargo:** `JavaScript/features/catalogo/CatalogoView.js`, `components/ViewStates.js` y `components/AnimalCard.js`.
* **Criterios Técnicos Estrictos:**
  1. **Los 4 Estados Visuales Obligatorios:**
     * **Estado de Carga (Loading):** Mientras la promesa de red está pendiente, renderizar un indicador de carga o tarjetas *skeleton* accesibles (`aria-busy="true"`).
     * **Estado Vacío (Empty):** Si la consulta devuelve un arreglo vacío (`data: []`), mostrar un mensaje semántico: *"No se encontraron animales registrados con los criterios seleccionados"*.
     * **Estado de Error con Reintento (Error + Retry):** Si la petición falla (ej. servidor caído o error 500), mostrar el mensaje de error y un botón interactivo **"Reintentar"** que vuelve a disparar la promesa sin recargar el navegador.
     * **Estado de Datos (Success):** Renderizar la cuadrícula Grid con las tarjetas de animales utilizando la función de componente `AnimalCard(animal)`.
  2. **Sincronización:** La vista se suscribe al `Store` de la Persona 2; al mutar los datos, la vista se re-renderiza automáticamente.
* **Criterio asegurado:** *Estados de la interfaz (20 puntos)*.

---

### Persona 4: Especialista en Búsqueda Optimizada & Paginación Concurrente
* **Responsabilidad Principal:** Implementar el control de flujo en la barra de búsqueda y filtros para no saturar el backend, junto con la navegación de páginas.
* **Archivos a su cargo:** `JavaScript/core/utils/debounce.js`, `features/catalogo/searchHandler.js` y `components/Pagination.js`.
* **Criterios Técnicos Estrictos:**
  1. **Debounce Funcional:** Implementar una función `debounce(fn, delay = 300)` nativa para retrasar la ejecución mientras el usuario escribe en el campo de búsqueda.
  2. **Cancelación activa con `AbortController`:**
     * Cada vez que se dispara una nueva búsqueda o filtro, se debe invocar `currentController.abort()` para cancelar la petición HTTP que estaba en vuelo.
     * Pasar el `signal` del nuevo controlador al `ApiClient`. Esto previene condiciones de carrera (*race conditions*) donde una respuesta lenta sobreescriba una búsqueda más reciente.
  3. **Paginación Funcional con `URLSearchParams`:**
     * Gestionar los parámetros `page`, `per_page`, `sort_by` dinámicamente.
     * Consumir la metadata de Laravel (`current_page`, `last_page`, `total`) y renderizar controles accesibles de "Anterior" y "Siguiente".
* **Criterio asegurado:** *Búsqueda optimizada y cancelación de solicitudes (20 puntos)*.

---

### Persona 5: Desarrollador de Formulario, Mutaciones & Mapeo de Errores 422
* **Responsabilidad Principal:** Conectar `registro-animal.html` para crear y editar animales, procesando los errores de validación de Laravel campo por campo.
* **Archivos a su cargo:** `JavaScript/features/formulario/FormularioView.js` y `formValidator.js`.
* **Criterios Técnicos Estrictos:**
  1. **Operaciones CRUD asíncronas:**
     * Creación: `POST /api/v1/animales` enviando los datos validados del animal y su pesaje inicial.
     * Edición: Detectar si existe un parámetro `?id=...` en la URL, precargar los datos con `GET /api/v1/animales/{id}` y actualizar mediante `PUT`.
  2. **Mapeo de Errores de Validación por Campo (HTTP 422):**
     * Capturar la respuesta 422 de Laravel (`StoreAnimalRequest`):
       ```json
       {
         "error": "Error de Validación",
         "errores": {
           "numero_arete": ["Ya existe un animal registrado con ese número de arete."],
           "potrero_id": ["El potrero seleccionado ya alcanzó su capacidad máxima."]
         }
       }
       ```
     * Recorrer el objeto `errores` e inyectar el mensaje exactamente en el contenedor de ayuda correspondiente a cada campo (`#error-numero_arete`), activando `aria-invalid="true"` y clases de error.
  3. **Sincronización:** Al guardar con éxito, actualizar el Store y redirigir al catálogo mostrando el nuevo registro en la lista.
* **Criterio asegurado:** *Sincronización de datos y formulario (20 puntos)*.

---

### Persona 6: Integrador de Vistas, Sesión 401 & QA de Entregables
* **Responsabilidad Principal:** Garantizar el flujo de autenticación, la recuperación de borradores ante 401, y producir las evidencias audiovisuales requeridas.
* **Archivos a su cargo:** `JavaScript/features/formulario/draftRecovery.js`, `dashboard/DashboardView.js` y carpeta `Docs/entregables_lab9/`.
* **Criterios Técnicos Estrictos:**
  1. **Manejo de Expiración de Token (401) sin pérdida de datos:**
     * Cuando el `ApiClient` capture un 401 mientras el usuario llena el formulario, serializar el estado del formulario en `sessionStorage` (`draft_registro_animal`).
     * Redirigir a `login.html`.
     * Tras iniciar sesión de nuevo, restaurar automáticamente los campos en `registro-animal.html`.
  2. **Consumo Concurrente en Dashboard:** Usar `Promise.allSettled()` para consultar en paralelo métricas de animales y potreros sin bloquear la pantalla si uno falla.
  3. **Generación de los 4 Entregables Obligatorios:**
     * Grabar el **video corto / screenshots** demostrando:
       1. Los 4 estados visuales de la lista (Carga $\to$ Datos, Vacío, Error $\to$ Clic en Reintentar).
       2. El formulario mostrando los errores 422 de Laravel debajo de cada campo.
       3. La expiración de sesión (401) y la recuperación del borrador.
     * Certificar que en todo el código no exista **ni una sola callback anidada** (*callback hell*), empleando exclusivamente `async/await`.
* **Criterio asegurado:** *Garantía de los 4 entregables oficiales y 100/100 de nota*.

---

## 4. Reglas Técnicas Obligatorias para los 6 Integrantes

1. **CERO Callbacks Anidadas:** Todo flujo asíncrono se maneja con bloques `try / catch / finally` y sintaxis `await`.
2. **ESM Nativo:** Todos los archivos deben usar `export` e `import`. En el HTML se incluye siempre `<script type="module" src="../JavaScript/main.js"></script>`.
3. **No mutar el DOM sin pasar por el Estado:** La UI no debe manipular elementos aleatorios con `innerHTML` huérfanos; los datos deben fluir desde el Store hacia los componentes de renderizado.
4. **Respuestas de Red Resilientes:** Ninguna llamada `fetch` se hace sin control de errores ni sin contemplar tiempos de espera o cancelaciones con `AbortController`.
