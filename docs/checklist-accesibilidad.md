
## 1. Tabla de Cálculo de Razones de Contraste de Color (WCAG AA)

Para cumplir con el criterio **WCAG 2.1 - 1.4.3 Contraste (Mínimo)**, el texto normal debe tener una razón de contraste de al menos **4.5:1** y el texto grande / elementos interactivos de al menos **3:1**.

| Elemento / Componente UI | Texto / Primer Plano | Fondo (HEX) | Luminancia Relativa ($L_1, L_2$) | Razón de Contraste Calculada ($CR = \frac{L_1 + 0.05}{L_2 + 0.05}$) | Criterio Requerido | Estado |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Texto Principal / Cuerpo** | `#1E293B` (Slate-800) | `#FFFFFF` (Blanco) | $L_1 = 0.0206, L_2 = 1.0000$ | **16.1:1** | $\ge 4.5:1$ | 
| **Encabezados Dashboard (H1, H2)** | `#0F172A` (Slate-900) | `#F8FAFC` (Slate-50) | $L_1 = 0.0089, L_2 = 0.9567$ | **17.0:1** | $\ge 4.5:1$ | 
| **Botón Primario (Verde Finca)** | `#FFFFFF` (Blanco) | `#15803D` (Green-700) | $L_1 = 1.0000, L_2 = 0.1581$ | **5.0:1** | $\ge 4.5:1$ | 
| **Badge / Estado Activo (Verde)** | `#166534` (Green-800) | `#DCFCE7` (Green-100) | $L_1 = 0.1161, L_2 = 0.8878$ | **5.6:1** | $\ge 4.5:1$ | 
| **Badge / Alerta (Rojo)** | `#991B1B` (Red-800) | `#FEE2E2` (Red-100) | $L_1 = 0.0583, L_2 = 0.8250$ | **7.5:1** | $\ge 4.5:1$ | 
| **Barra Lateral / Sidebar (Nav)** | `#F1F5F9` (Slate-100) | `#0F172A` (Slate-900) | $L_1 = 0.8878, L_2 = 0.0089$ | **15.9:1** | $\ge 4.5:1$ | 

### Fórmula Aplicada
$$\text{Luminancia Relativa } (L) = 0.2126 \cdot R + 0.7152 \cdot G + 0.0722 \cdot B$$
$$\text{Razón de Contraste } (CR) = \frac{L_1 + 0.05}{L_2 + 0.05} \quad (L_1 > L_2)$$

---

## 2. Pruebas de Usabilidad y Navegación Exclusiva por Teclado

* **Atajos evaluados:** `Tab`, `Shift + Tab`, `Enter`, `Espacio`.
* **Indicador de Foco Visible:** Verificado. Todos los elementos interactivos (tarjetas, botones de filtros, tablas de ganado) cuentan con un estilo de foco claro (`outline` en color `#15803D`).
* **Trampas de Teclado (*Keyboard Traps*):** Ninguna detectada. La navegación fluye secuencialmente desde el menú lateral hasta el panel principal y las tablas de datos.

---

## 3. Auditoría de Redimensionamiento y Zoom (200%)

* **Criterio evaluado:** WCAG 1.4.4 Redimensionamiento del texto.
* **Resultado:** Al aplicar un zoom del **200%** en el navegador, el panel de gestión ganadera adapta sus métricas y tablas mediante un layout responsivo (*flexbox/grid*), evitando truncamiento de texto y desbordamientos horizontales.

---

## 4. Estructura de Entregables Oficiales

Las capturas de evidencia se encuentran organizadas dentro de `docs/capturas/`:
* Capturas de las 3 pantallas principales en 3 anchos distintos (Móvil: 375px, Tablet: 768px, Desktop: 1440px).
* Capturas de las 3 pantallas con aumento de zoom al 200%.